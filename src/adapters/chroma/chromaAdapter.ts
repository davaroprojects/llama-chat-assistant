import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
    ChromaConceptualKnnOptions,
    ChromaDbConnectionConfig,
    ChromaQueryLogger,
    ChromaSearchResult,
    RagIndexResult
} from '../../core/model/chroma';
import { RagGateway } from '../../core/gateways/ragGateway';
import { ChunkProviderGateway } from '../../core/gateways/chunkProviderGateway';
import { VectorIndexGateway } from '../../core/gateways/vectorIndexGateway';
import { EmbeddingGateway } from '../../core/gateways/embeddingGateway';
import { Logger } from '../vscode/outputLogger';

import { detectLanguage, classifyFileType, normalizeExtension } from './utils/analysis/fileAnalyzer';
import { detectProjectType, getEcosystemLanguage } from './utils/analysis/ecosystemDetector';
import {
    IndexedChunk,
    buildEmbeddingInput,
    getMetadataString,
    extractJavaSymbolMetadata
} from './utils/analysis/metadataBuilder';

import { getSplitterForFile } from './utils/text/textSplitter';
import { cosineSimilarity } from './utils/search/vectorSimilarity';
import { lexicalPathScore, normalizeFilePathFilter, tokenizeText } from './utils/search/lexicalSearch';
import {
    looksBinaryContent,
    globToRegExp,
    shouldExcludeFile,
} from './utils/filesystem/fileSystemUtils';
import { getClient } from './utils/chroma/chromaClient';
import { clearCollection, collectionExists } from './utils/chroma/chromaCollections';


type ChromaWhereFilter = {
    file_path: {
        $in: string[];
    };
};

type CandidateScoreSummary = {
    path: string;
    combinedScore?: number;
    vectorScore?: number;
    lexicalScore?: number;
    cosineScore?: number;
    distance?: number;
};

type FileScanStats = {
    visitedDirectories: number;
    visitedEntries: number;
    consideredFiles: number;
    indexedChunks: number;
    skippedBySize: number;
    skippedEmpty: number;
    skippedBinary: number;
    skippedByGlob: number;
    readErrors: number;
};

type FileScanErrorSample = {
    path: string;
    reason: string;
};

function buildQueryPreview(queryText: string, maxLength = 140): string {
    const normalized = queryText.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, maxLength)}...`;
}

function buildTopCandidateSummary(candidates: CandidateScoreSummary[], limit = 5): CandidateScoreSummary[] {
    return candidates.slice(0, limit).map((candidate) => ({
        path: candidate.path,
        combinedScore: candidate.combinedScore,
        vectorScore: candidate.vectorScore,
        lexicalScore: candidate.lexicalScore,
        cosineScore: candidate.cosineScore,
        distance: candidate.distance
    }));
}

function logChromaOperation(logger: ChromaQueryLogger | undefined, operation: string, details: unknown): void {
    const typedLogger = logger as Partial<Logger> | undefined;
    if (typedLogger && typeof typedLogger.logChromaDbOperation === 'function') {
        typedLogger.logChromaDbOperation(operation, details, 'rag');
    }
}

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
    projectType: string,
    logger?: ChromaQueryLogger
): Promise<IndexedChunk[]> {
    const indexed: IndexedChunk[] = [];
    const errorSamples: FileScanErrorSample[] = [];
    const stats: FileScanStats = {
        visitedDirectories: 0,
        visitedEntries: 0,
        consideredFiles: 0,
        indexedChunks: 0,
        skippedBySize: 0,
        skippedEmpty: 0,
        skippedBinary: 0,
        skippedByGlob: 0,
        readErrors: 0
    };
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

        stats.visitedDirectories += 1;

        let entries;
        try {
            entries = await fs.readdir(currentDir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            stats.visitedEntries += 1;
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

            stats.consideredFiles += 1;

            try {
                const stat = await fs.stat(absolutePath);
                if (stat.size > maxFileSizeBytes) {
                    stats.skippedBySize += 1;
                    continue;
                }

                const content = await fs.readFile(absolutePath, 'utf8');
                if (!content.trim()) {
                    stats.skippedEmpty += 1;
                    continue;
                }

                if (looksBinaryContent(content)) {
                    stats.skippedBinary += 1;
                    continue;
                }

                const relativePath = path.relative(workspaceRoot, absolutePath).split(path.sep).join('/');
                if (shouldExcludeFile(relativePath, excludeRegexes)) {
                    stats.skippedByGlob += 1;
                    continue;
                }
                const fileName = path.basename(relativePath);
                const extension = normalizeExtension(fileName);
                const folder = path.dirname(relativePath).split(path.sep).join('/');
                const language = detectLanguage(fileName);
                const fileType = classifyFileType(fileName);
                const ecosystemLanguage = getEcosystemLanguage(language, projectType);
                const docsListosParaChroma = await getSplitterForFile(fileName, content, {
                    targetChunkTokens: config.targetChunkTokens,
                    maxChunkTokens: config.maxChunkTokens,
                    minChunkTokens: config.minChunkTokens,
                    fallbackChunkTokens: config.fallbackChunkTokens
                });

                docsListosParaChroma.forEach((chunk) => {
                    const javaMetadata = language === 'java'
                        ? extractJavaSymbolMetadata(content, chunk.end)
                        : { className: '', methodName: '' };

                    indexed.push({
                        id: `${relativePath}::chunk-${chunk.index}`,
                        relativePath,
                        fileName,
                        extension,
                        folder: folder === '.' ? '' : folder,
                        language: ecosystemLanguage,
                        fileType,
                        className: javaMetadata.className,
                        methodName: javaMetadata.methodName,
                        projectType,
                        chunkIndex: chunk.index,
                        chunkCount: chunk.totalChunks,
                        chunkStart: chunk.start,
                        chunkEnd: chunk.end,
                        content: chunk.text,
                        keywordEntities: chunk.keywordEntities.join('|')
                    });
                    stats.indexedChunks += 1;
                });
            } catch (error) {
                stats.readErrors += 1;
                if (errorSamples.length < 12) {
                    const relativePath = path.relative(workspaceRoot, absolutePath).split(path.sep).join('/');
                    const reason = error instanceof Error ? error.message : String(error);
                    errorSamples.push({
                        path: relativePath,
                        reason
                    });
                }
            }
        }
    }

    await walk(workspaceRoot);
    logger?.info('rag', 'File scan finished for indexing', {
        ...stats,
        maxIndexedFiles,
        maxFileSizeKb: config.maxFileSizeKb,
        excludedDirs: ignoredDirs.size,
        excludedGlobs: excludeRegexes.length,
        indexedChunks: indexed.length,
        errorSamples
    });
    logChromaOperation(logger, 'index.scan.complete', {
        ...stats,
        maxIndexedFiles,
        indexedChunks: indexed.length,
        errorSamples
    });

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
    embeddingGateway: EmbeddingGateway,
    logger?: ChromaQueryLogger
): Promise<RagIndexResult> {
    if (!config.collectionId) {
        throw new Error('Chroma collection ID is not configured for this workspace session.');
    }

    const indexedAt = Date.now();
    const client = getClient(config);
    const collectionName = config.collectionId;

    logger?.info('rag', 'Starting workspace indexing', { collectionName, workspaceRoot });
    logChromaOperation(logger, 'index.start', { collectionName, workspaceRoot });
    const startedAt = Date.now();

    logger?.debug('rag', 'Indexing config snapshot', {
        maxIndexedFiles: config.maxIndexedFiles,
        maxFileSizeKb: config.maxFileSizeKb,
        targetChunkTokens: config.targetChunkTokens,
        maxChunkTokens: config.maxChunkTokens,
        minChunkTokens: config.minChunkTokens,
        fallbackChunkTokens: config.fallbackChunkTokens,
        excludeDirs: config.excludeDirs,
        excludeFileGlobs: config.excludeFileGlobs
    });
    logChromaOperation(logger, 'index.config', {
        maxIndexedFiles: config.maxIndexedFiles,
        maxFileSizeKb: config.maxFileSizeKb,
        targetChunkTokens: config.targetChunkTokens,
        maxChunkTokens: config.maxChunkTokens,
        minChunkTokens: config.minChunkTokens,
        fallbackChunkTokens: config.fallbackChunkTokens,
        excludeDirs: config.excludeDirs,
        excludeFileGlobs: config.excludeFileGlobs
    });

    if (config.previousCollectionId && config.previousCollectionId !== collectionName && await collectionExists(client, config.previousCollectionId)) {
        await clearCollection(client, config.previousCollectionId, logger);
    }

    if (await collectionExists(client, collectionName)) {
        await clearCollection(client, collectionName, logger);
    }

    const collection = await client.createCollection({ name: collectionName } as any);

    const projectType = await detectProjectType(workspaceRoot);
    logger?.info('rag', 'Project type detected for indexing', { projectType });
    logChromaOperation(logger, 'index.project-type', { projectType });

    const files = await listTextFiles(workspaceRoot, config, projectType, logger);
    const uniqueFileCount = new Set(files.map((file) => file.relativePath)).size;
    logger?.info('rag', 'Prepared chunks for indexing', {
        collectionName,
        uniqueFiles: uniqueFileCount,
        totalChunks: files.length
    });
    logChromaOperation(logger, 'index.prepared', {
        collectionName,
        uniqueFiles: uniqueFileCount,
        totalChunks: files.length
    });

    const batchSize = Math.max(1, Math.floor(config.indexWriteBatchSize));
    const totalBatches = Math.ceil(files.length / batchSize);

    for (let i = 0; i < files.length; i += batchSize) {
        const chunk = files.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        logger?.debug('rag', 'Indexing batch started', {
            batchNumber,
            totalBatches,
            batchSize: chunk.length,
            firstChunkId: chunk[0]?.id,
            lastChunkId: chunk[chunk.length - 1]?.id
        });
        logChromaOperation(logger, 'index.batch.start', {
            batchNumber,
            totalBatches,
            batchSize: chunk.length,
            firstChunkId: chunk[0]?.id,
            lastChunkId: chunk[chunk.length - 1]?.id
        });

        const embeddings = await embeddingGateway.computeEmbeddings(
            chunk.map((item) => buildEmbeddingInput(item))
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
                chunkEnd: String(item.chunkEnd),
                keyword_entities: item.keywordEntities
            }))
        });

        logger?.debug('rag', 'Indexing batch finished', {
            batchNumber,
            totalBatches,
            indexedSoFar: Math.min(i + chunk.length, files.length),
            totalChunks: files.length
        });
        logChromaOperation(logger, 'index.batch.complete', {
            batchNumber,
            totalBatches,
            indexedSoFar: Math.min(i + chunk.length, files.length),
            totalChunks: files.length
        });
    }

    const indexingDurationMs = Date.now() - startedAt;
    logger?.info('rag', 'Workspace indexing complete', {
        collectionName,
        indexedFiles: files.length,
        uniqueFiles: uniqueFileCount,
        totalBatches,
        indexingDurationMs
    });
    logChromaOperation(logger, 'index.complete', {
        collectionName,
        indexedFiles: files.length,
        uniqueFiles: uniqueFileCount,
        totalBatches,
        indexingDurationMs
    });

    return {
        status: 'indexed',
        indexedAt,
        indexedFiles: files.length,
        collectionId: collectionName
    };
}

export async function queryRelevantContextFromChromaDbSemantic(
    queryText: string,
    config: ChromaDbConnectionConfig,
    embeddingGateway: EmbeddingGateway,
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

    const queryPreview = buildQueryPreview(queryText);

    logger?.debug('rag', 'Starting semantic Chroma query', {
        maxResults,
        vectorCandidatePool: config.vectorCandidatePool,
        queryPreview,
        filterPaths: filePathFilter?.length ?? 0
    });
    logChromaOperation(logger, 'query.semantic.start', {
        maxResults,
        vectorCandidatePool: config.vectorCandidatePool,
        queryPreview,
        filterPaths: filePathFilter?.length ?? 0
    });

    const collectionName = config.collectionId;
    if (!collectionName) {
        logger?.warn('rag', 'Semantic query skipped: no collection ID stored for this workspace session');
        return [];
    }

    const client = getClient(config, signal);
    if (!(await collectionExists(client, collectionName))) {
        logger?.warn('rag', 'Semantic query skipped: stored Chroma collection was not found', {
            collectionName
        });
        return [];
    }

    logger?.debug('rag', 'Using Chroma collection for semantic query', { collectionName });

    if (signal?.aborted) {
        logger?.warn('rag', 'Aborted semantic query before collection query');
        throw new DOMException('Aborted', 'AbortError');
    }

    try {
        const collection = await client.getCollection({ name: collectionName } as any);
        const where = buildWhereFilter(filePathFilter);
        const queryEmbedding = await embeddingGateway.computeEmbedding(queryText);
        const queryResult = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: Math.max(maxResults, config.vectorCandidatePool),
            include: ['documents', 'metadatas', 'distances'],
            where
        } as any);

        const documents = queryResult.documents?.[0] ?? [];
        const metadatas = queryResult.metadatas?.[0] ?? [];
        const distances = queryResult.distances?.[0] ?? [];
        logger?.debug('rag', 'Semantic Chroma raw results received', {
            queryPreview,
            documents: documents.length,
            metadatas: metadatas.length,
            distances: distances.length,
            whereFilterApplied: !!where
        });
        logChromaOperation(logger, 'query.semantic.raw-results', {
            queryPreview,
            documents: documents.length,
            metadatas: metadatas.length,
            distances: distances.length,
            whereFilterApplied: !!where
        });

        const ranked: Array<ChromaSearchResult & { metadata?: Record<string, unknown>; vectorScore: number; lexicalScore: number; combinedScore: number }> = [];
        documents.forEach((content, index) => {
            if (typeof content !== 'string') {
                return;
            }

            const metadata = metadatas[index] as Record<string, unknown> | undefined;
            const pathValue = getMetadataString(metadata, 'path', `document-${index + 1}`);
            const distance = typeof distances[index] === 'number' ? distances[index] : undefined;
            const vectorScore = distance === undefined ? 0 : 1 / (1 + Math.max(0, distance));
            const lexicalScore = lexicalPathScore(queryText, metadata);
            const combinedScore = (vectorScore * 0.7) + (lexicalScore * 0.3);

            const chunkIndex = getMetadataString(metadata, 'chunkIndex');
            const chunkCount = getMetadataString(metadata, 'chunkCount');
            const chunkSuffix = chunkIndex && chunkCount
                ? ` [chunk ${Number(chunkIndex) + 1}/${chunkCount}]`
                : '';

            ranked.push({
                path: `${pathValue}${chunkSuffix}`,
                content,
                metadata,
                distance,
                vectorScore,
                lexicalScore,
                combinedScore
            });
        });

        ranked.sort((a, b) => b.combinedScore - a.combinedScore);
        logger?.debug('rag', 'Semantic ranking completed', {
            queryPreview,
            rankedCount: ranked.length,
            topCandidates: buildTopCandidateSummary(ranked)
        });
        logChromaOperation(logger, 'query.semantic.rank.complete', {
            queryPreview,
            rankedCount: ranked.length,
            topCandidates: buildTopCandidateSummary(ranked)
        });

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
        logChromaOperation(logger, 'query.semantic.complete', {
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

    const collectionName = config.collectionId;
    if (!collectionName) {
        logger?.warn('rag', 'Lexical query skipped: no collection ID stored for this workspace session');
        return [];
    }

    const queryPreview = buildQueryPreview(queryText);
    const where = buildWhereFilter(filePathFilter);
    const client = getClient(config, signal);
    if (!(await collectionExists(client, collectionName))) {
        logger?.warn('rag', 'Lexical query skipped: stored Chroma collection was not found', {
            collectionName
        });
        return [];
    }

    logger?.debug('rag', 'Starting lexical-only Chroma query (no embeddings endpoint call)', {
        queryPreview,
        maxResults,
        whereFilterApplied: !!where
    });

    const lexicalTokens = tokenizeText(queryText);

    try {
        const collection = await client.getCollection({ name: collectionName } as any);
        const fetchLimit = Math.max(config.vectorCandidatePool, maxResults * 20, 200);
        const response = await collection.get({
            include: ['documents', 'metadatas'],
            where,
            limit: fetchLimit
        } as any);

        const documents = response.documents ?? [];
        const metadatas = response.metadatas ?? [];

        const ranked = documents
            .map((content: unknown, index: number) => {
                if (typeof content !== 'string') {
                    return null;
                }

                const metadata = metadatas[index] as Record<string, unknown> | undefined;
                const lexicalMetadataScore = lexicalPathScore(queryText, metadata);
                const lowerContent = content.toLowerCase();
                const lexicalContentHits = lexicalTokens.reduce((hits, token) => (
                    lowerContent.includes(token) ? hits + 1 : hits
                ), 0);
                const lexicalContentScore = lexicalTokens.length > 0 ? lexicalContentHits / lexicalTokens.length : 0;
                const combinedScore = (lexicalMetadataScore * 0.7) + (lexicalContentScore * 0.3);

                if (combinedScore <= 0) {
                    return null;
                }

                const pathValue = getMetadataString(metadata, 'path', `document-${index + 1}`);
                const chunkIndex = getMetadataString(metadata, 'chunkIndex');
                const chunkCount = getMetadataString(metadata, 'chunkCount');
                const chunkSuffix = chunkIndex && chunkCount
                    ? ` [chunk ${Number(chunkIndex) + 1}/${chunkCount}]`
                    : '';

                return {
                    path: `${pathValue}${chunkSuffix}`,
                    content,
                    combinedScore
                };
            })
            .filter((item): item is { path: string; content: string; combinedScore: number } => item !== null)
            .sort((a, b) => b.combinedScore - a.combinedScore)
            .slice(0, maxResults)
            .map((item) => ({
                path: item.path,
                content: item.content
            }));

        logger?.info('rag', 'Lexical-only Chroma query finished', {
            queryPreview,
            collectionName,
            fetchedDocuments: documents.length,
            returnedResults: ranked.length
        });

        return ranked;
    } catch (error) {
        logger?.error('rag', 'Lexical-only Chroma query failed', error);
        throw error;
    }
}

export async function queryRelevantContextFromChromaDbConceptualKnn(
    queryText: string,
    config: ChromaDbConnectionConfig,
    embeddingGateway: EmbeddingGateway,
    options?: ChromaConceptualKnnOptions
): Promise<ChromaSearchResult[]> {
    if (!queryText.trim()) {
        return [];
    }

    const topK = Math.max(1, options?.topK ?? config.maxQueryResults);
    const minCosineSimilarity = options?.minCosineSimilarity ?? 0.2;
    const signal = options?.signal;
    const queryPreview = buildQueryPreview(queryText);

    if (signal?.aborted) {
        (options as { logger?: ChromaQueryLogger } | undefined)?.logger?.warn('rag', 'Aborted conceptual KNN query before execution');
        throw new DOMException('Aborted', 'AbortError');
    }

    const logger = (options as { logger?: ChromaQueryLogger } | undefined)?.logger;
    logger?.debug('rag', 'Starting conceptual KNN Chroma query', {
        topK,
        minCosineSimilarity,
        queryPreview
    });
    logChromaOperation(logger, 'query.conceptual.start', {
        topK,
        minCosineSimilarity,
        queryPreview
    });

    const collectionName = config.collectionId;
    if (!collectionName) {
        logger?.warn('rag', 'Conceptual KNN query skipped: no collection ID stored for this workspace session');
        return [];
    }

    const client = getClient(config, signal);
    if (!(await collectionExists(client, collectionName))) {
        logger?.warn('rag', 'Conceptual KNN query skipped: stored Chroma collection was not found', {
            collectionName
        });
        return [];
    }

    logger?.debug('rag', 'Using Chroma collection for conceptual KNN query', { collectionName });

    try {
        const collection = await client.getCollection({ name: collectionName } as any);
        const queryEmbedding = await embeddingGateway.computeEmbedding(queryText);

        const pageSize = 500;
        let offset = 0;
        let scannedDocuments = 0;
        const ranked: Array<ChromaSearchResult & { metadata?: Record<string, unknown>; cosineScore: number; lexicalScore: number; combinedScore: number }> = [];

        while (true) {
            if (signal?.aborted) {
                logger?.warn('rag', 'Aborted conceptual KNN query while paging', { offset });
                throw new DOMException('Aborted', 'AbortError');
            }

            const page = await collection.get({
                limit: pageSize,
                offset,
                include: ['documents', 'metadatas', 'embeddings']
            } as any);

            const ids = page.ids ?? [];
            const documents = page.documents ?? [];
            const metadatas = page.metadatas ?? [];
            const embeddings = page.embeddings ?? [];
            scannedDocuments += ids.length;
            logger?.debug('rag', 'Conceptual KNN page scanned', {
                queryPreview,
                offset,
                pageSize: ids.length,
                scannedDocuments
            });
            logChromaOperation(logger, 'query.conceptual.page', {
                queryPreview,
                offset,
                pageSize: ids.length,
                scannedDocuments
            });
            if (ids.length === 0) {
                break;
            }

            for (let i = 0; i < ids.length; i += 1) {
                const content = documents[i];
                if (typeof content !== 'string') {
                    continue;
                }

                const metadata = metadatas[i] as Record<string, unknown> | undefined;
                const docEmbedding = Array.isArray(embeddings[i]) ? embeddings[i] as number[] : [];
                if (!docEmbedding.length) {
                    continue;
                }
                const cosineScore = cosineSimilarity(queryEmbedding, docEmbedding);
                const lexicalScore = lexicalPathScore(queryText, metadata);
                const combinedScore = (cosineScore * 0.75) + (lexicalScore * 0.25);
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
                    metadata,
                    distance: 1 - cosineScore,
                    cosineScore,
                    lexicalScore,
                    combinedScore
                });
            }

            if (ids.length < pageSize) {
                break;
            }

            offset += pageSize;
        }

        ranked.sort((a, b) => b.combinedScore - a.combinedScore);
        logger?.debug('rag', 'Conceptual KNN ranking completed', {
            queryPreview,
            rankedCount: ranked.length,
            topCandidates: buildTopCandidateSummary(ranked)
        });
        logChromaOperation(logger, 'query.conceptual.rank.complete', {
            queryPreview,
            rankedCount: ranked.length,
            topCandidates: buildTopCandidateSummary(ranked)
        });

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
        logChromaOperation(logger, 'query.conceptual.complete', {
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

export class ChromaAdapter implements RagGateway, ChunkProviderGateway, VectorIndexGateway {
    constructor(
        private readonly embeddingGateway: EmbeddingGateway,
        private readonly logger: Logger
    ) {}

    async isAvailable(config: ChromaDbConnectionConfig): Promise<boolean> {
        return isChromaDbAvailable(config);
    }

    async queryConceptual(
        queryText: string,
        config: ChromaDbConnectionConfig,
        options: ChromaConceptualKnnOptions
    ): Promise<ChromaSearchResult[]> {
        return queryRelevantContextFromChromaDbConceptualKnn(queryText, config, this.embeddingGateway, {
            ...options,
            logger: options.logger || this.logger
        });
    }

    async query(
        queryText: string,
        config: ChromaDbConnectionConfig,
        maxResults: number,
        signal?: AbortSignal,
        filePathFilter?: string[]
    ): Promise<ChromaSearchResult[]> {
        return queryRelevantContextFromChromaDbSemantic(
            queryText,
            config,
            this.embeddingGateway,
            maxResults,
            signal,
            filePathFilter,
            this.logger
        );
    }

    async collectChunks(workspaceRoot: string, config: ChromaDbConnectionConfig): Promise<IndexedChunk[]> {
        const projectType = await detectProjectType(workspaceRoot);
        this.logger.info('rag', 'Project type detected for indexing', { projectType });
        logChromaOperation(this.logger, 'index.project-type', { projectType });

        return listTextFiles(workspaceRoot, config, projectType, this.logger);
    }

    async replaceAll(
        _workspaceRoot: string,
        config: ChromaDbConnectionConfig,
        chunks: IndexedChunk[],
        embeddings: number[][]
    ): Promise<RagIndexResult> {
        if (!config.collectionId) {
            throw new Error('Chroma collection ID is not configured for this workspace session.');
        }

        const indexedAt = Date.now();
        const client = getClient(config);
        const collectionName = config.collectionId;

        if (config.previousCollectionId && config.previousCollectionId !== collectionName && await collectionExists(client, config.previousCollectionId)) {
            await clearCollection(client, config.previousCollectionId, this.logger);
        }

        if (await collectionExists(client, collectionName)) {
            await clearCollection(client, collectionName, this.logger);
        }

        const collection = await client.createCollection({ name: collectionName } as any);
        const batchSize = Math.max(1, Math.floor(config.indexWriteBatchSize));

        for (let i = 0; i < chunks.length; i += batchSize) {
            const chunk = chunks.slice(i, i + batchSize);
            const batchEmbeddings = embeddings.slice(i, i + batchSize);
            await collection.add({
                ids: chunk.map((item) => item.id),
                documents: chunk.map((item) => item.content),
                embeddings: batchEmbeddings,
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
                    chunkEnd: String(item.chunkEnd),
                    keyword_entities: item.keywordEntities
                }))
            });
        }

        return {
            status: 'indexed',
            indexedAt,
            indexedFiles: chunks.length,
            collectionId: collectionName
        };
    }

    async indexAll(workspaceRoot: string, chromaConfig: ChromaDbConnectionConfig): Promise<RagIndexResult> {
        return indexAllWithChromaDb(workspaceRoot, chromaConfig, this.embeddingGateway, this.logger);
    }
}