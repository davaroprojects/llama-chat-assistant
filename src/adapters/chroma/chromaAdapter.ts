import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
    ChromaConceptualKnnOptions,
    ChromaDbConnectionConfig,
    ChromaQueryLogger,
    ChromaQueryMode,
    ChromaSearchResult,
    RagIndexResult
} from '../../core/model/chroma';
import { RagGateway } from '../../core/gateways/ragGateway';
import { RepositoryIndexGateway } from '../../core/gateways/repositoryIndexGateway';
import { WorkspaceDependencyGraphBuilder } from './workspaceDependencyGraphBuilder';
import { Logger } from '../vscode/outputLogger';

// Import utils - embeddings
import { computeEmbedding, createHuggingFaceEmbeddingFunction } from './utils/embeddings/huggingfaceEmbedding';

// Import utils - analysis
import { detectLanguage, classifyFileType, normalizeExtension } from './utils/analysis/fileAnalyzer';
import { detectProjectType, getEcosystemLanguage } from './utils/analysis/ecosystemDetector';
import {
    IndexedChunk,
    buildEmbeddingInput,
    buildEmbeddingInputFromDocument,
    getMetadataString,
    extractJavaSymbolMetadata
} from './utils/analysis/metadataBuilder';

// Import utils - text
import { getSplitterForFile, resolveChunkTuning, ChunkTuning } from './utils/text/textSplitter';
import { processAndChunkFile, TextChunk } from './utils/text/textChunking';

// Import utils - search
import { cosineSimilarity } from './utils/search/vectorSimilarity';
import { tokenizeText, lexicalPathScore, normalizeFilePathFilter } from './utils/search/lexicalSearch';

// Import utils - filesystem
import {
    looksBinaryContent,
    escapeRegex,
    globToRegExp,
    shouldExcludeFile,
    fileExists,
    readFileContent,
    readFileStats,
    listDirectoryEntries
} from './utils/filesystem/fileSystemUtils';

// Import utils - chroma
import { getClient } from './utils/chroma/chromaClient';
import { cleanupEphemeralCollections, getLatestEphemeralCollectionName } from './utils/chroma/chromaCollections';


type ChromaWhereFilter = {
    file_path: {
        $in: string[];
    };
};

function buildWhereFilter(filePaths?: string[]): ChromaWhereFilter | undefined {
    const normalizedPaths = normalizeFilePathFilter(filePaths);
    if (normalizedPaths.length === 0) {
        return undefined;
    }

    return {
        file_path: {
            $in: normalizedPaths
        }
    };
}

async function listTextFiles(
    workspaceRoot: string,
    config: ChromaDbConnectionConfig,
    projectType: string
): Promise<IndexedChunk[]> {
    const indexed: IndexedChunk[] = [];
    const ignoredDirs = new Set((config.excludeDirs || []).map((dir) => dir.trim()).filter(Boolean));
    const excludeRegexes = (config.excludeFileGlobs || [])
        .map((pattern) => pattern.trim())
        .filter(Boolean)
        .map((pattern) => globToRegExp(pattern));
    const maxFileSizeBytes = Math.max(1, config.maxFileSizeKb) * 1024;
    const maxIndexedFiles = Math.max(1, config.maxIndexedFiles);

    async function walk(currentDir: string): Promise<void> {
        if (indexed.length >= maxIndexedFiles) {
            return;
        }

        let entries;
        try {
            entries = await fs.readdir(currentDir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            if (indexed.length >= maxIndexedFiles) {
                return;
            }

            const absolutePath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                if (!ignoredDirs.has(entry.name)) {
                    await walk(absolutePath);
                }
                continue;
            }

            if (!entry.isFile()) {
                continue;
            }

            try {
                const stat = await fs.stat(absolutePath);
                if (stat.size > maxFileSizeBytes) {
                    continue;
                }

                const content = await fs.readFile(absolutePath, 'utf8');
                if (!content.trim()) {
                    continue;
                }

                if (looksBinaryContent(content)) {
                    continue;
                }

                const relativePath = path.relative(workspaceRoot, absolutePath).split(path.sep).join('/');
                if (shouldExcludeFile(relativePath, excludeRegexes)) {
                    continue;
                }
                const fileName = path.basename(relativePath);
                const extension = normalizeExtension(fileName);
                const folder = path.dirname(relativePath).split(path.sep).join('/');
                const language = detectLanguage(fileName);
                const fileType = classifyFileType(fileName, language);
                const ecosystemLanguage = getEcosystemLanguage(language, projectType);
                const chunks = await processAndChunkFile(relativePath, content, {
                    chunkSizeChars: config.chunkSizeChars,
                    chunkOverlapChars: config.chunkOverlapChars
                });

                chunks.forEach((chunk, index) => {
                    const javaMetadata = language === 'java'
                        ? extractJavaSymbolMetadata(content, chunk.end)
                        : { className: '', methodName: '' };

                    indexed.push({
                        id: `${relativePath}::chunk-${index}`,
                        relativePath,
                        fileName,
                        extension,
                        folder: folder === '.' ? '' : folder,
                        language: ecosystemLanguage,
                        fileType,
                        className: javaMetadata.className,
                        methodName: javaMetadata.methodName,
                        projectType,
                        chunkIndex: index,
                        chunkCount: chunks.length,
                        chunkStart: chunk.start,
                        chunkEnd: chunk.end,
                        content: chunk.text
                    });
                });
            } catch (error) {
            }
        }
    }

    await walk(workspaceRoot);
    return indexed;
}

export async function isChromaDbAvailable(config: ChromaDbConnectionConfig): Promise<boolean> {
    try {
        const client = getClient(config);
        await client.heartbeat();
        return true;
    } catch {
        return false;
    }
}

export async function indexAllWithChromaDb(
    workspaceRoot: string,
    config: ChromaDbConnectionConfig,
    logger?: ChromaQueryLogger
): Promise<RagIndexResult> {
    const indexedAt = Date.now();
    const client = getClient(config);

    logger?.info('rag', 'Starting workspace indexing', { collectionPrefix: config.collectionPrefix, workspaceRoot });

    await cleanupEphemeralCollections(client, config.collectionPrefix, logger);

    const collectionName = `${config.collectionPrefix}-${indexedAt}`;
    const collection = await client.createCollection({
        name: collectionName,
        embeddingFunction: createHuggingFaceEmbeddingFunction()
    } as any);

    const projectType = await detectProjectType(workspaceRoot);
    const files = await listTextFiles(workspaceRoot, config, projectType);
    const batchSize = 64;

    for (let i = 0; i < files.length; i += batchSize) {
        const chunk = files.slice(i, i + batchSize);
        const embeddings = await Promise.all(
            chunk.map((item) => computeEmbedding(buildEmbeddingInput(item)))
        );
        await collection.add({
            ids: chunk.map((item) => item.id),
            documents: chunk.map((item) => item.content),
            embeddings,
            metadatas: chunk.map((item) => ({
                path: item.relativePath,
                file_path: item.relativePath,
                file_type: item.fileType,
                extension: item.extension,
                fileName: item.fileName,
                folder: item.folder,
                language: item.language,
                class_name: item.className,
                method_name: item.methodName,
                project_type: item.projectType,
                chunkIndex: String(item.chunkIndex),
                chunkCount: String(item.chunkCount),
                chunkStart: String(item.chunkStart),
                chunkEnd: String(item.chunkEnd)
            }))
        });
    }

    logger?.info('rag', 'Workspace indexing complete', { collectionName, indexedFiles: files.length });

    return {
        status: 'indexed',
        indexedAt,
        indexedFiles: files.length
    };
}

export async function queryRelevantContextFromChromaDb(
    queryText: string,
    config: ChromaDbConnectionConfig,
    maxResults = config.maxQueryResults,
    mode: ChromaQueryMode = 'semantic',
    signal?: AbortSignal,
    filePathFilter?: string[],
    logger?: ChromaQueryLogger
): Promise<ChromaSearchResult[]> {
    logger?.debug('rag', 'Chroma query dispatch', {
        mode,
        maxResults,
        queryLength: queryText.length,
        filterPaths: filePathFilter?.length ?? 0
    });

    if (mode === 'lexical') {
        return queryRelevantContextFromChromaDbLexical(queryText, config, maxResults, signal, filePathFilter, logger);
    }

    return queryRelevantContextFromChromaDbSemantic(queryText, config, maxResults, signal, filePathFilter, logger);
}

export async function queryRelevantContextFromChromaDbSemantic(
    queryText: string,
    config: ChromaDbConnectionConfig,
    maxResults = config.maxQueryResults,
    signal?: AbortSignal,
    filePathFilter?: string[],
    logger?: ChromaQueryLogger
): Promise<ChromaSearchResult[]> {
    if (!queryText.trim()) {
        logger?.debug('rag', 'Skipped semantic query: empty query text');
        return [];
    }

    if (signal?.aborted) {
        logger?.warn('rag', 'Aborted semantic query before execution');
        throw new DOMException('Aborted', 'AbortError');
    }

    logger?.debug('rag', 'Starting semantic Chroma query', {
        maxResults,
        vectorCandidatePool: config.vectorCandidatePool,
        filterPaths: filePathFilter?.length ?? 0
    });

    const client = getClient(config, signal);
    const collectionName = await getLatestEphemeralCollectionName(client, config.collectionPrefix);
    if (!collectionName) {
        logger?.warn('rag', 'Semantic query skipped: no indexed Chroma collection found', {
            collectionPrefix: config.collectionPrefix
        });
        return [];
    }

    logger?.debug('rag', 'Using Chroma collection for semantic query', { collectionName });

    if (signal?.aborted) {
        logger?.warn('rag', 'Aborted semantic query before collection query');
        throw new DOMException('Aborted', 'AbortError');
    }

    try {
        const collection = await client.getCollection({
            name: collectionName,
            embeddingFunction: createHuggingFaceEmbeddingFunction()
        } as any);
        const where = buildWhereFilter(filePathFilter);
        const queryEmbedding = await computeEmbedding(queryText);
        const queryResult = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: Math.max(maxResults, config.vectorCandidatePool),
            include: ['documents', 'metadatas', 'distances'],
            where
        } as any);

        const documents = queryResult.documents?.[0] ?? [];
        const metadatas = queryResult.metadatas?.[0] ?? [];
        const distances = queryResult.distances?.[0] ?? [];

        const ranked: Array<ChromaSearchResult & { vectorScore: number }> = [];
        documents.forEach((content, index) => {
            if (typeof content !== 'string') {
                return;
            }

            const metadata = metadatas[index] as Record<string, unknown> | undefined;
            const pathValue = getMetadataString(metadata, 'path', `document-${index + 1}`);
            const distance = typeof distances[index] === 'number' ? distances[index] : undefined;
            const vectorScore = distance === undefined ? 0 : 1 / (1 + Math.max(0, distance));

            const chunkIndex = getMetadataString(metadata, 'chunkIndex');
            const chunkCount = getMetadataString(metadata, 'chunkCount');
            const chunkSuffix = chunkIndex && chunkCount
                ? ` [chunk ${Number(chunkIndex) + 1}/${chunkCount}]`
                : '';

            ranked.push({
                path: `${pathValue}${chunkSuffix}`,
                content,
                distance,
                vectorScore
            });
        });

        ranked.sort((a, b) => b.vectorScore - a.vectorScore);
        const results = ranked.slice(0, maxResults).map((item) => ({
            path: item.path,
            content: item.content,
            distance: item.distance
        }));

        logger?.info('rag', 'Semantic Chroma query finished', {
            collectionName,
            retrievedDocuments: documents.length,
            rankedMatches: ranked.length,
            returnedResults: results.length,
            filteredByPath: !!buildWhereFilter(filePathFilter)
        });

        return results;
    } catch (error) {
        logger?.error('rag', 'Semantic Chroma query failed', error);
        throw error;
    }
}

export async function queryRelevantContextFromChromaDbLexical(
    queryText: string,
    config: ChromaDbConnectionConfig,
    maxResults = config.maxQueryResults,
    signal?: AbortSignal,
    filePathFilter?: string[],
    logger?: ChromaQueryLogger
): Promise<ChromaSearchResult[]> {
    if (!queryText.trim()) {
        logger?.debug('rag', 'Skipped lexical query: empty query text');
        return [];
    }

    if (signal?.aborted) {
        logger?.warn('rag', 'Aborted lexical query before execution');
        throw new DOMException('Aborted', 'AbortError');
    }

    logger?.debug('rag', 'Starting lexical Chroma query', {
        maxResults,
        filterPaths: filePathFilter?.length ?? 0
    });

    const client = getClient(config, signal);
    const collectionName = await getLatestEphemeralCollectionName(client, config.collectionPrefix);
    if (!collectionName) {
        logger?.warn('rag', 'Lexical query skipped: no indexed Chroma collection found', {
            collectionPrefix: config.collectionPrefix
        });
        return [];
    }

    logger?.debug('rag', 'Using Chroma collection for lexical query', { collectionName });

    try {
        const collection = await client.getCollection({
            name: collectionName,
            embeddingFunction: createHuggingFaceEmbeddingFunction()
        } as any);
        const where = buildWhereFilter(filePathFilter);
        const pageSize = 500;
        let offset = 0;
        let scannedDocuments = 0;
        const matches: Array<ChromaSearchResult & { lexicalScore: number }> = [];

        while (true) {
            if (signal?.aborted) {
                logger?.warn('rag', 'Aborted lexical query while paging', { offset });
                throw new DOMException('Aborted', 'AbortError');
            }

            const page = await collection.get({
                limit: pageSize,
                offset,
                include: ['documents', 'metadatas'],
                where
            } as any);

            const ids = page.ids ?? [];
            const documents = page.documents ?? [];
            const metadatas = page.metadatas ?? [];
            scannedDocuments += ids.length;
            if (ids.length === 0) {
                break;
            }

            for (let i = 0; i < ids.length; i += 1) {
                const content = documents[i];
                if (typeof content !== 'string') {
                    continue;
                }

                const metadata = metadatas[i] as Record<string, unknown> | undefined;
                const lexicalScore = lexicalPathScore(queryText, metadata);
                if (lexicalScore <= 0) {
                    continue;
                }

                const pathValue = getMetadataString(metadata, 'path', `document-${i + offset + 1}`);
                const chunkIndex = getMetadataString(metadata, 'chunkIndex');
                const chunkCount = getMetadataString(metadata, 'chunkCount');
                const chunkSuffix = chunkIndex && chunkCount
                    ? ` [chunk ${Number(chunkIndex) + 1}/${chunkCount}]`
                    : '';

                matches.push({
                    path: `${pathValue}${chunkSuffix}`,
                    content,
                    lexicalScore
                });
            }

            if (ids.length < pageSize) {
                break;
            }

            offset += pageSize;
        }

        matches.sort((a, b) => b.lexicalScore - a.lexicalScore);
        const results = matches.slice(0, maxResults).map((item) => ({
            path: item.path,
            content: item.content,
            distance: undefined
        }));

        logger?.info('rag', 'Lexical Chroma query finished', {
            collectionName,
            scannedDocuments,
            lexicalMatches: matches.length,
            returnedResults: results.length,
            filteredByPath: !!buildWhereFilter(filePathFilter)
        });

        return results;
    } catch (error) {
        logger?.error('rag', 'Lexical Chroma query failed', error);
        throw error;
    }
}

export async function queryRelevantContextFromChromaDbConceptualKnn(
    queryText: string,
    config: ChromaDbConnectionConfig,
    options?: ChromaConceptualKnnOptions
): Promise<ChromaSearchResult[]> {
    if (!queryText.trim()) {
        return [];
    }

    const topK = Math.max(1, options?.topK ?? config.maxQueryResults);
    const minCosineSimilarity = options?.minCosineSimilarity ?? 0.2;
    const signal = options?.signal;

    if (signal?.aborted) {
        (options as { logger?: ChromaQueryLogger } | undefined)?.logger?.warn('rag', 'Aborted conceptual KNN query before execution');
        throw new DOMException('Aborted', 'AbortError');
    }

    const logger = (options as { logger?: ChromaQueryLogger } | undefined)?.logger;
    logger?.debug('rag', 'Starting conceptual KNN Chroma query', {
        topK,
        minCosineSimilarity
    });

    const client = getClient(config, signal);
    const collectionName = await getLatestEphemeralCollectionName(client, config.collectionPrefix);
    if (!collectionName) {
        logger?.warn('rag', 'Conceptual KNN query skipped: no indexed Chroma collection found', {
            collectionPrefix: config.collectionPrefix
        });
        return [];
    }

    logger?.debug('rag', 'Using Chroma collection for conceptual KNN query', { collectionName });

    try {
        const collection = await client.getCollection({
            name: collectionName,
            embeddingFunction: createHuggingFaceEmbeddingFunction()
        } as any);
        const queryEmbedding = await computeEmbedding(queryText);

        const pageSize = 500;
        let offset = 0;
        let scannedDocuments = 0;
        const ranked: Array<ChromaSearchResult & { cosineScore: number }> = [];

        while (true) {
            if (signal?.aborted) {
                logger?.warn('rag', 'Aborted conceptual KNN query while paging', { offset });
                throw new DOMException('Aborted', 'AbortError');
            }

            const page = await collection.get({
                limit: pageSize,
                offset,
                include: ['documents', 'metadatas']
            } as any);

            const ids = page.ids ?? [];
            const documents = page.documents ?? [];
            const metadatas = page.metadatas ?? [];
            scannedDocuments += ids.length;
            if (ids.length === 0) {
                break;
            }

            for (let i = 0; i < ids.length; i += 1) {
                const content = documents[i];
                if (typeof content !== 'string') {
                    continue;
                }

                const metadata = metadatas[i] as Record<string, unknown> | undefined;
                const docEmbedding = await computeEmbedding(buildEmbeddingInputFromDocument(content, metadata));
                const cosineScore = cosineSimilarity(queryEmbedding, docEmbedding);
                if (cosineScore < minCosineSimilarity) {
                    continue;
                }

                const pathValue = getMetadataString(metadata, 'path', `document-${offset + i + 1}`);
                const chunkIndex = getMetadataString(metadata, 'chunkIndex');
                const chunkCount = getMetadataString(metadata, 'chunkCount');
                const chunkSuffix = chunkIndex && chunkCount
                    ? ` [chunk ${Number(chunkIndex) + 1}/${chunkCount}]`
                    : '';

                ranked.push({
                    path: `${pathValue}${chunkSuffix}`,
                    content,
                    distance: 1 - cosineScore,
                    cosineScore
                });
            }

            if (ids.length < pageSize) {
                break;
            }

            offset += pageSize;
        }

        ranked.sort((a, b) => b.cosineScore - a.cosineScore);
        const results = ranked.slice(0, topK).map((item) => ({
            path: item.path,
            content: item.content,
            distance: item.distance
        }));

        logger?.info('rag', 'Conceptual KNN Chroma query finished', {
            collectionName,
            scannedDocuments,
            minCosineSimilarity,
            rankedMatches: ranked.length,
            returnedResults: results.length
        });

        return results;
    } catch (error) {
        logger?.error('rag', 'Conceptual KNN Chroma query failed', error);
        throw error;
    }
}

export class ChromaAdapter implements RagGateway, RepositoryIndexGateway {
    constructor(private readonly logger: Logger) {}

    async isAvailable(config: ChromaDbConnectionConfig): Promise<boolean> {
        return isChromaDbAvailable(config);
    }

    async queryConceptual(
        queryText: string,
        config: ChromaDbConnectionConfig,
        options: ChromaConceptualKnnOptions
    ): Promise<ChromaSearchResult[]> {
        return queryRelevantContextFromChromaDbConceptualKnn(queryText, config, {
            ...options,
            logger: options.logger || this.logger
        });
    }

    async queryByMode(
        queryText: string,
        config: ChromaDbConnectionConfig,
        maxResults: number,
        mode: ChromaQueryMode,
        signal?: AbortSignal,
        filePathFilter?: string[]
    ): Promise<ChromaSearchResult[]> {
        return queryRelevantContextFromChromaDb(
            queryText,
            config,
            maxResults,
            mode,
            signal,
            filePathFilter,
            this.logger
        );
    }

    async buildWorkspaceGraph(workspaceRoot: string, chromaConfig: ChromaDbConnectionConfig, cacheRoot: string): Promise<void> {
        const graphBuilder = new WorkspaceDependencyGraphBuilder(workspaceRoot, chromaConfig, cacheRoot);
        await graphBuilder.build();
    }

    async indexAll(workspaceRoot: string, chromaConfig: ChromaDbConnectionConfig): Promise<RagIndexResult> {
        return indexAllWithChromaDb(workspaceRoot, chromaConfig, this.logger);
    }
}