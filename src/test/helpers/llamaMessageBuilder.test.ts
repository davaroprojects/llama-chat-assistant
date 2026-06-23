import * as assert from 'assert';
import { LlamaMessageBuilder } from '../../helpers/llamaMessageBuilder';

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
        assert.ok(!String(userMessages[0].content).includes('v1 content'),
            'Old file version should be stripped from history');
        assert.ok(String(userMessages[0].content).includes('First question'));
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
        assert.ok(String(userMessages[0].content).includes('utils content'),
            'utils.ts should remain in first message since it is not superseded');
    });
});
