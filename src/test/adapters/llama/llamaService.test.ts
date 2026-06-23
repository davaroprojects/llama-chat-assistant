import * as assert from 'assert';
import { LlamaAdapter } from '../../../adapters/llama/llamaAdapter';
import { LlamaMessageBuilder } from '../../../helpers/llamaMessageBuilder';

const BASE_CONFIG = {
    apiUrl: '',
    model: 'local',
    maxTokens: 2048,
    temperature: 0.2,
    systemPrompt: 'sys',
    debug: false
};

suite('LlamaMessageBuilder - prepareMessagesForLlama', () => {
    test('Strips older file version from history, keeps latest', () => {
        const messages = [
            {
                role: 'user',
                content: {
                    text: 'First question',
                    filesMetadata: [{ name: 'app.ts', content: 'v1 content', isAutomatic: true }]
                }
            },
            {
                role: 'assistant',
                content: { text: 'First answer', time: '1.0', tokens: 10 }
            },
            {
                role: 'user',
                content: {
                    text: 'Second question',
                    filesMetadata: [{ name: 'app.ts', content: 'v2 content', isAutomatic: true }]
                }
            }
        ];

        const prepared = LlamaMessageBuilder.prepareMessagesForLlama(
            messages as any,
            '--- ARCHIVO ADJUNTO: app.ts ---\nv2 content\n--- FIN ARCHIVO ---\n\nIndicación del usuario:\nSecond question',
            BASE_CONFIG.systemPrompt
        );

        const userMessages = prepared.filter(m => m.role === 'user');
        // First user message should NOT include app.ts content (v2 is newer)
        assert.ok(!String(userMessages[0].content).includes('v1 content'),
            'Old file version should be stripped from history');
        // Still contains the user text
        assert.ok(String(userMessages[0].content).includes('First question'));
        // Last user message has the current prompt with v2
        assert.ok(String(userMessages[1].content).includes('v2 content'));
    });

    test('Keeps file in history if not superseded by a newer message', () => {
        const messages = [
            {
                role: 'user',
                content: {
                    text: 'About utils',
                    filesMetadata: [{ name: 'utils.ts', content: 'utils content', isAutomatic: false }]
                }
            },
            {
                role: 'assistant',
                content: { text: 'Answer about utils', time: '1.0', tokens: 10 }
            },
            {
                role: 'user',
                content: {
                    text: 'Now about app',
                    filesMetadata: [{ name: 'app.ts', content: 'app content', isAutomatic: false }]
                }
            }
        ];

        const prepared = LlamaMessageBuilder.prepareMessagesForLlama(
            messages as any,
            'Indicación del usuario:\nNow about app',
            BASE_CONFIG.systemPrompt
        );

        const userMessages = prepared.filter(m => m.role === 'user');
        // utils.ts is only in message 0, and app.ts is only in message 2 — no overlap
        assert.ok(String(userMessages[0].content).includes('utils content'),
            'utils.ts should remain in first message since it is not superseded');
    });
});

suite('LlamaAdapter - server props', () => {
    test('Extracts n_ctx from full /props payload', () => {
        const nCtx = LlamaAdapter.extractContextWindow({
            model_path: '/models/qwen.gguf',
            n_ctx: 32768,
            n_ctx_train: 131072,
            n_embd: 4096
        });
        assert.strictEqual(nCtx, 32768);
    });

    test('Returns 0 when n_ctx is unavailable', () => {
        assert.strictEqual(LlamaAdapter.extractContextWindow(null), 0);
        assert.strictEqual(LlamaAdapter.extractContextWindow({ model_path: '/m.gguf' }), 0);
    });

    test('Extracts n_ctx from default_generation_settings payload', () => {
        const nCtx = LlamaAdapter.extractContextWindow({
            default_generation_settings: {
                params: { temperature: 0.8 },
                n_ctx: 16384
            },
            total_slots: 4,
            model_path: './models/qwen.gguf'
        });
        assert.strictEqual(nCtx, 16384);
    });

    test('Builds /props URL from OpenAI-compatible chat endpoint', () => {
        const propsUrl = LlamaAdapter.buildPropsUrl('http://127.0.0.1:8033/v1/chat/completions');
        assert.strictEqual(propsUrl, 'http://127.0.0.1:8033/props');
    });

    test('Extracts model name from explicit model fields', () => {
        const modelName = LlamaAdapter.extractModelName({
            model_name: 'qwen2.5-coder-7b-instruct'
        });
        assert.strictEqual(modelName, 'qwen2.5-coder-7b-instruct');
    });

    test('Extracts model name from model_path fallback', () => {
        const modelName = LlamaAdapter.extractModelName({
            model_path: '/models/qwen2.5-coder-7b-instruct-q8_0.gguf'
        });
        assert.strictEqual(modelName, 'qwen2.5-coder-7b-instruct-q8_0.gguf');
    });

    test('Extracts model name from nested default_generation_settings params', () => {
        const modelName = LlamaAdapter.extractModelName({
            default_generation_settings: {
                params: {
                    model_path: '/models/qwen2.5-coder-7b-instruct-q4_k_m.gguf'
                }
            }
        });
        assert.strictEqual(modelName, 'qwen2.5-coder-7b-instruct-q4_k_m.gguf');
    });
});
