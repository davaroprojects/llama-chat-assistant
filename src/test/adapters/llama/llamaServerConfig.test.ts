import * as assert from 'assert';
import {
    buildChatApiUrl,
    buildServerLaunchCommand,
    buildServerParameterRows,
    resolveWorkspacePath
} from '../../../adapters/llama/llamaServerConfig';
import { LlamaServerLaunchConfig } from '../../../core/domain/llamaServer';

const SERVER_CONFIG: LlamaServerLaunchConfig = {
    executablePath: './build/bin/llama-server',
    modelPath: './models/qwen2.5-coder-7b-instruct-q4_k_m.gguf',
    gpuLayers: 99,
    contextSize: 16384,
    flashAttention: true,
    host: '127.0.0.1',
    port: 8033,
    chatCompletionsPath: '/v1/chat/completions',
    jinja: true,
    tools: 'all'
};

suite('llamaServerConfig', () => {
    test('Builds chat api url from server host and port', () => {
        assert.strictEqual(buildChatApiUrl(SERVER_CONFIG), 'http://127.0.0.1:8033/v1/chat/completions');
    });

    test('Builds llama-server launch command with fixed chat template', () => {
        const result = buildServerLaunchCommand(SERVER_CONFIG, '/workspace');

        assert.strictEqual(result.command, '/workspace/build/bin/llama-server');
        assert.deepStrictEqual(result.args, [
            '-m', '/workspace/models/qwen2.5-coder-7b-instruct-q4_k_m.gguf',
            '-ngl', '99',
            '-c', '16384',
            '--flash-attn', 'on',
            '--host', '127.0.0.1',
            '--port', '8033',
            '--tools', 'all',
            '--chat-template', 'chatml',
            '--jinja'
        ]);
    });

    test('Builds server parameter rows', () => {
        const rows = buildServerParameterRows(SERVER_CONFIG);
        assert.strictEqual(rows[0].property, 'binaryPath');
        assert.strictEqual(rows[0].value, './build/bin/llama-server');
        assert.strictEqual(rows[8].property, 'tools');
        assert.strictEqual(rows[8].value, 'all');
    });

    test('Resolves workspace-relative paths', () => {
        assert.strictEqual(resolveWorkspacePath('./build/bin/llama-server', '/workspace'), '/workspace/build/bin/llama-server');
    });
});
