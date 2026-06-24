import * as path from 'node:path';
import * as vscode from 'vscode';
import { ChromaDbConnectionConfig } from '../../core/model/chroma';

function getConfigValue<T>(
    config: vscode.WorkspaceConfiguration,
    primaryKey: string,
    legacyKey: string,
    fallback: T
): T {
    const primaryValue = config.get<T>(primaryKey);
    if (primaryValue !== undefined) {
        return primaryValue;
    }

    const legacyValue = config.get<T>(legacyKey);
    if (legacyValue !== undefined) {
        return legacyValue;
    }

    return fallback;
}

function sanitizeCollectionSegment(value: string): string {
    return value
        .trim()
        .replace(/[\s-]+/g, '_')
        .replace(/[^A-Za-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
}

export function createWorkspaceCollectionId(workspaceRoot: string, timestamp = Date.now()): string {
    const projectName = path.basename(workspaceRoot) || 'workspace';
    const normalizedProjectName = sanitizeCollectionSegment(projectName) || 'workspace';
    return `${normalizedProjectName}_${timestamp}`;
}

export function readChromaDbConfig(
    _workspaceRoot: string,
    collectionId: string | null = null,
    previousCollectionId: string | null = null
): ChromaDbConnectionConfig {
    const config = vscode.workspace.getConfiguration('laLlamaChat');
    return {
        url: getConfigValue(config, 'chromaDb.url', 'rag.chromaUrl', 'http://127.0.0.1'),
        port: getConfigValue(config, 'chromaDb.port', 'rag.chromaPort', 8000),
        collectionId,
        previousCollectionId,
        excludeDirs: getConfigValue(config, 'chromaDb.excludeDirs', 'rag.excludeDirs', [
            '.git',
            '.gradle',
            '.idea',
            'node_modules',
            'dist',
            'out',
            'build',
            'coverage',
            'target',
            '.vscode'
        ]),
        excludeFileGlobs: getConfigValue(config, 'chromaDb.excludeFileGlobs', 'rag.excludeFileGlobs', [
            '**/*.bin',
            '**/*.class',
            '**/*.jar',
            '**/*.lock'
        ]),
        maxFileSizeKb: getConfigValue(config, 'chromaDb.maxFileSizeKb', 'rag.maxFileSizeKb', 2048),
        maxIndexedFiles: getConfigValue(config, 'chromaDb.maxIndexedFiles', 'rag.maxIndexedFiles', 10000),
        targetChunkTokens: getConfigValue(config, 'chromaDb.targetChunkTokens', 'rag.targetChunkTokens', 350),
        maxChunkTokens: getConfigValue(config, 'chromaDb.maxChunkTokens', 'rag.maxChunkTokens', 512),
        minChunkTokens: getConfigValue(config, 'chromaDb.minChunkTokens', 'rag.minChunkTokens', 120),
        fallbackChunkTokens: getConfigValue(config, 'chromaDb.fallbackChunkTokens', 'rag.fallbackChunkTokens', 300),
        vectorCandidatePool: getConfigValue(config, 'chromaDb.vectorCandidatePool', 'rag.vectorCandidatePool', 50),
        maxQueryResults: getConfigValue(config, 'chromaDb.maxQueryResults', 'rag.maxQueryResults', 12),
        minCosineSimilarity: getConfigValue(config, 'chromaDb.minCosineSimilarity', 'rag.minCosineSimilarity', 0.2)
    };
}
