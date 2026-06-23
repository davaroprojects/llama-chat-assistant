import * as assert from 'assert';
import * as vscode from 'vscode';
import * as crypto from 'node:crypto';
import { readChromaDbConfig, readChromaQueryMode } from '../../../adapters/chroma/chromaConfig';

function mockVscodeConfig(settings: Record<string, unknown>): void {
    const original = vscode.workspace.getConfiguration;
    (vscode.workspace as unknown as Record<string, unknown>).getConfiguration = () => ({
        get: <T>(key: string): T | undefined => settings[key] as T | undefined
    });
    after(() => {
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
        assert.strictEqual(config.maxFileSizeKb, 512);
        assert.strictEqual(config.maxIndexedFiles, 2000);
        assert.strictEqual(config.chunkSizeChars, 2000);
        assert.strictEqual(config.chunkOverlapChars, 300);
        assert.strictEqual(config.maxQueryResults, 12);
        assert.strictEqual(config.minCosineSimilarity, 0.2);
    });

    test('Collection prefix includes SHA256 hash of workspace root', () => {
        mockVscodeConfig({});
        const config = readChromaDbConfig(WORKSPACE_ROOT);
        const hash = crypto.createHash('sha256').update(WORKSPACE_ROOT).digest('hex').slice(0, 12);
        assert.ok(config.collectionPrefix.endsWith(`-${hash}`));
    });

    test('Collection prefix starts with default base prefix', () => {
        mockVscodeConfig({});
        const config = readChromaDbConfig(WORKSPACE_ROOT);
        assert.ok(config.collectionPrefix.startsWith('llama-chat-ephemeral-'));
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

    test('Custom collectionPrefix is hashed with workspace root', () => {
        mockVscodeConfig({
            'chromaDb.collectionPrefix': 'my-project'
        });
        const config1 = readChromaDbConfig('/workspace/a');
        const config2 = readChromaDbConfig('/workspace/b');
        assert.ok(config1.collectionPrefix.startsWith('my-project-'));
        assert.ok(config2.collectionPrefix.startsWith('my-project-'));
        assert.notStrictEqual(config1.collectionPrefix, config2.collectionPrefix);
    });

    test('Reads excludeDirs from primary config key', () => {
        mockVscodeConfig({
            'chromaDb.excludeDirs': ['custom-dir']
        });
        const config = readChromaDbConfig(WORKSPACE_ROOT);
        assert.deepStrictEqual(config.excludeDirs, ['custom-dir']);
    });
});

suite('readChromaQueryMode', () => {
    test('Returns semantic by default', () => {
        mockVscodeConfig({});
        const mode = readChromaQueryMode();
        assert.strictEqual(mode, 'semantic');
    });

    test('Returns lexical when config is set to lexical', () => {
        mockVscodeConfig({ 'chromaDb.queryMode': 'lexical' });
        const mode = readChromaQueryMode();
        assert.strictEqual(mode, 'lexical');
    });

    test('Returns semantic when config is set to unknown value', () => {
        mockVscodeConfig({ 'chromaDb.queryMode': 'unknown-mode' });
        const mode = readChromaQueryMode();
        assert.strictEqual(mode, 'semantic');
    });

    test('Falls back to legacy rag.queryMode key', () => {
        mockVscodeConfig({ 'rag.queryMode': 'lexical' });
        const mode = readChromaQueryMode();
        assert.strictEqual(mode, 'lexical');
    });
});
