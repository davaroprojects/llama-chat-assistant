import * as vscode from 'vscode';
import * as crypto from 'node:crypto';
import { ChromaDbConnectionConfig, ChromaQueryMode } from '../../core/domain/chroma';

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

function getWorkspaceCollectionPrefix(basePrefix: string, workspaceRoot: string): string {
    const hash = crypto.createHash('sha256').update(workspaceRoot).digest('hex').slice(0, 12);
    return `${basePrefix}-${hash}`;
}

export function readChromaDbConfig(workspaceRoot: string): ChromaDbConnectionConfig {
    const config = vscode.workspace.getConfiguration('llamaChat');
    const basePrefix = getConfigValue(config, 'chromaDb.collectionPrefix', 'rag.collectionPrefix', 'llama-chat-ephemeral');
    return {
        url: getConfigValue(config, 'chromaDb.url', 'rag.chromaUrl', 'http://127.0.0.1'),
        port: getConfigValue(config, 'chromaDb.port', 'rag.chromaPort', 8000),
        collectionPrefix: getWorkspaceCollectionPrefix(basePrefix, workspaceRoot),
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
        maxFileSizeKb: getConfigValue(config, 'chromaDb.maxFileSizeKb', 'rag.maxFileSizeKb', 512),
        maxIndexedFiles: getConfigValue(config, 'chromaDb.maxIndexedFiles', 'rag.maxIndexedFiles', 2000),
        chunkSizeChars: getConfigValue(config, 'chromaDb.chunkSizeChars', 'rag.chunkSizeChars', 2000),
        chunkOverlapChars: getConfigValue(config, 'chromaDb.chunkOverlapChars', 'rag.chunkOverlapChars', 300),
        vectorCandidatePool: getConfigValue(config, 'chromaDb.vectorCandidatePool', 'rag.vectorCandidatePool', 50),
        maxQueryResults: getConfigValue(config, 'chromaDb.maxQueryResults', 'rag.maxQueryResults', 12),
        minCosineSimilarity: getConfigValue(config, 'chromaDb.minCosineSimilarity', 'rag.minCosineSimilarity', 0.2)
    };
}

export function readChromaQueryMode(): ChromaQueryMode {
    const config = vscode.workspace.getConfiguration('llamaChat');
    const mode = getConfigValue<string>(config, 'chromaDb.queryMode', 'rag.queryMode', 'semantic');
    return mode === 'lexical' ? 'lexical' : 'semantic';
}
