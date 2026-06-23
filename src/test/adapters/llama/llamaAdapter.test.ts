import * as assert from 'assert';
import { LlamaAdapter } from '../../../adapters/llama/llamaAdapter';

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
