import * as assert from 'assert';
import * as vscode from 'vscode';
import { createWorkspaceCollectionId, readChromaDbConfig } from '../../../adapters/chroma/chromaConfig';

function mockVscodeConfig(settings: Record<string, unknown>): void {
    const original = vscode.workspace.getConfiguration;
    (vscode.workspace as unknown as Record<string, unknown>).getConfiguration = () => ({
        get: <T>(key: string): T | undefined => settings[key] as T | undefined
    });
    suiteTeardown(() => {
        (vscode.workspace as unknown as Record<string, unknown>).getConfiguration = original;
    });
}

const WORKSPACE_ROOT = '/home/user/project';

suite('readChromaDbConfig - defaults', () => {
    test('Returns default url and port when no config is set', () => {
        mockVscodeConfig({});
        const config = readChromaDbConfig(WORKSPACE_ROOT);
        assert.strictEqual(config.url, 'http://127.0.0.1');
        assert.strictEqual(config.port, 8000);
    });

    test('Returns default limits when no config is set', () => {
        mockVscodeConfig({});
        const config = readChromaDbConfig(WORKSPACE_ROOT);
        assert.strictEqual(config.maxFileSizeKb, 2048);
        assert.strictEqual(config.maxIndexedFiles, 10000);
        assert.strictEqual(config.targetChunkTokens, 350);
        assert.strictEqual(config.maxChunkTokens, 512);
        assert.strictEqual(config.minChunkTokens, 120);
        assert.strictEqual(config.fallbackChunkTokens, 300);
        assert.strictEqual(config.maxQueryResults, 12);
        assert.strictEqual(config.minCosineSimilarity, 0.2);
    });

    test('Collection ID defaults to null before session persistence injects it', () => {
        mockVscodeConfig({});
        const config = readChromaDbConfig(WORKSPACE_ROOT);
        assert.strictEqual(config.collectionId, null);
    });
});

suite('readChromaDbConfig - overrides', () => {
    test('Reads url and port from primary config keys', () => {
        mockVscodeConfig({
            'chromaDb.url': 'http://192.168.1.10',
            'chromaDb.port': 9000
        });
        const config = readChromaDbConfig(WORKSPACE_ROOT);
        assert.strictEqual(config.url, 'http://192.168.1.10');
        assert.strictEqual(config.port, 9000);
    });

    test('Falls back to legacy rag.chromaUrl when primary absent', () => {
        mockVscodeConfig({
            'rag.chromaUrl': 'http://legacy-host',
            'rag.chromaPort': 7777
        });
        const config = readChromaDbConfig(WORKSPACE_ROOT);
        assert.strictEqual(config.url, 'http://legacy-host');
        assert.strictEqual(config.port, 7777);
    });

    test('Reads injected collectionId from session state', () => {
        mockVscodeConfig({});
        const config = readChromaDbConfig('/workspace/a', 'project_a_1710000000000');
        assert.strictEqual(config.collectionId, 'project_a_1710000000000');
    });

    test('Reads excludeDirs from primary config key', () => {
        mockVscodeConfig({
            'chromaDb.excludeDirs': ['custom-dir']
        });
        const config = readChromaDbConfig(WORKSPACE_ROOT);
        assert.deepStrictEqual(config.excludeDirs, ['custom-dir']);
    });
});

suite('createWorkspaceCollectionId', () => {
    test('Builds normalized project-based collection id', () => {
        const collectionId = createWorkspaceCollectionId('/home/user/My Project-Name', 1710000000000);
        assert.strictEqual(collectionId, 'my_project_name_1710000000000');
    });

    test('Removes unsupported characters from project name', () => {
        const collectionId = createWorkspaceCollectionId('/home/user/Project (API) v2', 1710000000000);
        assert.strictEqual(collectionId, 'project_api_v2_1710000000000');
    });
});

