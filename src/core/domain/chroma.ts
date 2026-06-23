export interface RagIndexResult {
    status: 'indexed';
    indexedAt: number;
    indexedFiles: number;
}

export interface ChromaDbConnectionConfig {
    url: string;
    port: number;
    collectionPrefix: string;
    excludeDirs: string[];
    excludeFileGlobs: string[];
    maxFileSizeKb: number;
    maxIndexedFiles: number;
    chunkSizeChars: number;
    chunkOverlapChars: number;
    vectorCandidatePool: number;
    maxQueryResults: number;
    minCosineSimilarity: number;
}

export interface ChromaSearchResult {
    path: string;
    content: string;
    distance?: number;
}

export interface ChromaQueryLogger {
    debug(scope: string, message: string, details?: unknown): void;
    info(scope: string, message: string, details?: unknown): void;
    warn(scope: string, message: string, details?: unknown): void;
    error(scope: string, message: string, details?: unknown): void;
}

export interface ChromaConceptualKnnOptions {
    topK?: number;
    minCosineSimilarity?: number;
    signal?: AbortSignal;
    logger?: ChromaQueryLogger;
}

export type ChromaQueryMode = 'semantic' | 'lexical';
