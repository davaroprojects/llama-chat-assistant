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
import { RepositoryIndexGateway } from '../../core/gateways/repositoryIndexGateway';
import { Logger } from '../vscode/outputLogger';

import { computeEmbedding, createHuggingFaceEmbeddingFunction } from './utils/embeddings/huggingfaceEmbedding';
import { detectLanguage, classifyFileType, normalizeExtension } from './utils/analysis/fileAnalyzer';
import { detectProjectType, getEcosystemLanguage } from './utils/analysis/ecosystemDetector';
import {
    IndexedChunk,
    buildEmbeddingInput,
    buildEmbeddingInputFromDocument,
    getMetadataString,
    extractJavaSymbolMetadata
} from './utils/analysis/metadataBuilder';

import { getSplitterForFile } from './utils/text/textSplitter';
import { cosineSimilarity } from './utils/search/vectorSimilarity';
import { lexicalPathScore, normalizeFilePathFilter } from './utils/search/lexicalSearch';
import TransformersReranker, { type RerankCandidate, type RerankResult } from './utils/search/transformersReranker';
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
    rerankScore?: number;
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
        rerankScore: candidate.rerankScore,
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

    const collection = await client.createCollection({
        name: collectionName,
        embeddingFunction: createHuggingFaceEmbeddingFunction()
    } as any);

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

    const batchSize = 64;
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

export async function queryRelevantContextFromChromaDb(
    queryText: string,
    config: ChromaDbConnectionConfig,
    maxResults = config.maxQueryResults,
    signal?: AbortSignal,
    filePathFilter?: string[],
    logger?: ChromaQueryLogger
): Promise<ChromaSearchResult[]> {
    const collectionName = config.collectionId;
    const queryPreview = buildQueryPreview(queryText);
    logger?.debug('rag', 'Chroma semantic query dispatch', {
        maxResults,
        queryLength: queryText.length,
        queryPreview,
        filterPaths: filePathFilter?.length ?? 0
    });
    logChromaOperation(logger, 'query.dispatch', {
        collectionName,
        maxResults,
        queryLength: queryText.length,
        queryPreview,
        filterPaths: filePathFilter?.length ?? 0
    });

    return queryRelevantContextFromChromaDbSemantic(queryText, config, maxResults, signal, filePathFilter, logger);
}

/**
 * Apply cross-encoder reranking to candidates if enabled.
 * Falls back to hybrid ranking if reranking fails or is disabled.
 *
 * @param queryText The original query text
 * @param candidates Candidates with vector/lexical scores
 * @param config ChromaDB config with reranking settings
 * @param logger Optional logger for debugging
 * @returns Reranked candidates sorted by reranker score, or original candidates on fallback
 */
async function applyReranking(
    queryText: string,
    candidates: Array<{
        path: string;
        content: string;
        metadata?: Record<string, unknown>;
        distance?: number;
        vectorScore?: number;
        lexicalScore?: number;
        combinedScore?: number;
        cosineScore?: number;
    }>,
    config: ChromaDbConnectionConfig,
    logger?: ChromaQueryLogger
): Promise<typeof candidates> {
    // Check if reranking is enabled
    if (!config.rerankEnabled) {
        logger?.debug('rag', 'Reranking disabled, using hybrid ranking');
        return candidates;
    }

    if (candidates.length === 0) {
        return candidates;
    }

    const rerankTimeoutMs = config.rerankTimeoutMs ?? 5000;
    const queryPreview = buildQueryPreview(queryText);

    try {
        logger?.debug('rag', 'Starting reranking phase', {
            candidateCount: candidates.length,
            rerankTimeoutMs,
            queryPreview,
            topBeforeRerank: buildTopCandidateSummary(candidates)
        });
        logChromaOperation(logger, 'query.rerank.start', {
            candidateCount: candidates.length,
            rerankTimeoutMs,
            queryPreview,
            topBeforeRerank: buildTopCandidateSummary(candidates)
        });

        // Build rich candidate text with structural metadata to improve symbol-level reranking.
        const rankCandidates: RerankCandidate[] = candidates.map((cand, idx) => ({
            id: `candidate-${idx}`,
            text: [
                getMetadataString(cand.metadata, 'path', cand.path),
                getMetadataString(cand.metadata, 'fileName'),
                getMetadataString(cand.metadata, 'language'),
                getMetadataString(cand.metadata, 'class_name'),
                getMetadataString(cand.metadata, 'method_name'),
                getMetadataString(cand.metadata, 'keyword_entities'),
                cand.content
            ]
                .filter((value): value is string => !!value && value.trim().length > 0)
                .join('\n'),
            score: cand.combinedScore ?? cand.cosineScore ?? 0
        }));

        // Call reranker with timeout
        const reranked = await TransformersReranker.rerank(
            queryText,
            rankCandidates,
            rerankTimeoutMs
        );

        // Map reranker results back to original candidates
        const rerankedMap = new Map(reranked.map((r: RerankResult) => [r.id, r.rerankScore ?? r.score]));
        const rerankedCandidates = candidates.map((cand, idx) => ({
            ...cand,
            rerankScore: rerankedMap.get(`candidate-${idx}`) ?? 0
        }));

        // Sort by reranker score
        rerankedCandidates.sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));

        logger?.info('rag', 'Reranking phase completed', {
            candidateCount: candidates.length,
            appliedReranking: true,
            topAfterRerank: buildTopCandidateSummary(rerankedCandidates)
        });
        logChromaOperation(logger, 'query.rerank.complete', {
            candidateCount: candidates.length,
            appliedReranking: true,
            topAfterRerank: buildTopCandidateSummary(rerankedCandidates)
        });

        return rerankedCandidates;
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger?.warn('rag', 'Reranking failed, falling back to hybrid ranking', {
            error: errorMsg,
            queryPreview,
            candidateCount: candidates.length
        });
        logChromaOperation(logger, 'query.rerank.failed', {
            error: errorMsg,
            queryPreview,
            candidateCount: candidates.length
        });

        if (!config.rerankFallbackToHybrid) {
            logger?.error('rag', 'Reranking fallback disabled, returning empty results');
            return [];
        }

        // Fallback: return candidates sorted by hybrid score
        return candidates.sort((a, b) => (b.combinedScore ?? b.cosineScore ?? 0) - (a.combinedScore ?? a.cosineScore ?? 0));
    }
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
            topBeforeRerank: buildTopCandidateSummary(ranked)
        });
        logChromaOperation(logger, 'query.semantic.rank.complete', {
            queryPreview,
            rankedCount: ranked.length,
            topBeforeRerank: buildTopCandidateSummary(ranked)
        });

        // Apply reranking if enabled (Phase 2)
        const rerankCandidates = await applyReranking(queryText, ranked, config, logger);

        const results = rerankCandidates.slice(0, maxResults).map((item) => ({
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
        const collection = await client.getCollection({
            name: collectionName,
            embeddingFunction: createHuggingFaceEmbeddingFunction()
        } as any);
        const queryEmbedding = await computeEmbedding(queryText);

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
                include: ['documents', 'metadatas']
            } as any);

            const ids = page.ids ?? [];
            const documents = page.documents ?? [];
            const metadatas = page.metadatas ?? [];
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
                const docEmbedding = await computeEmbedding(buildEmbeddingInputFromDocument(content, metadata));
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
            topBeforeRerank: buildTopCandidateSummary(ranked)
        });
        logChromaOperation(logger, 'query.conceptual.rank.complete', {
            queryPreview,
            rankedCount: ranked.length,
            topBeforeRerank: buildTopCandidateSummary(ranked)
        });

        // Apply reranking if enabled (Phase 2)
        const rerankCandidates = await applyReranking(queryText, ranked, config, logger);

        const results = rerankCandidates.slice(0, topK).map((item) => ({
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

    async query(
        queryText: string,
        config: ChromaDbConnectionConfig,
        maxResults: number,
        signal?: AbortSignal,
        filePathFilter?: string[]
    ): Promise<ChromaSearchResult[]> {
        return queryRelevantContextFromChromaDb(
            queryText,
            config,
            maxResults,
            signal,
            filePathFilter,
            this.logger
        );
    }

    async indexAll(workspaceRoot: string, chromaConfig: ChromaDbConnectionConfig): Promise<RagIndexResult> {
        return indexAllWithChromaDb(workspaceRoot, chromaConfig, this.logger);
    }
}