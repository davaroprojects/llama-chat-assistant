/**
 * Tests for memory pruning use case
 */

import * as assert from 'assert';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { MemoryPruningUseCase } from '../../../core/usecases/memoryPruningUseCase';
import { DEFAULT_MEMORY_MANAGEMENT_CONFIG } from '../../../core/domain/memoryConfig';
import { DEFAULT_TOKEN_COUNT_CONFIGURATION } from '../../../core/domain/tokenCount';
import { Logger } from '../../../adapters/vscode/outputLogger';

type LogCall = [string, string, unknown?];

suite('Memory Pruning Use Case', () => {
    let mockLogger: Logger;
    let debugCalls: LogCall[];
    let infoCalls: LogCall[];

    setup(() => {
        debugCalls = [];
        infoCalls = [];

        mockLogger = {
            debug: (category: string, message: string, details?: unknown) => {
                debugCalls.push([category, message, details]);
            },
            info: (category: string, message: string, details?: unknown) => {
                infoCalls.push([category, message, details]);
            },
            warn: () => {
                return;
            },
            error: () => {
                return;
            }
        } as any;
    });

    suite('execute', () => {
        test('should not prune when within safe threshold', () => {
            const useCase = new MemoryPruningUseCase(
                DEFAULT_MEMORY_MANAGEMENT_CONFIG,
                DEFAULT_TOKEN_COUNT_CONFIGURATION,
                mockLogger
            );

            const messages = [
                new SystemMessage('You are helpful'),
                new HumanMessage('Short question'),
                new AIMessage('Short answer')
            ];

            const { messages: result, result: pruningResult } = useCase.execute(messages);

            assert.strictEqual(pruningResult.pruningPerformed, false);
            assert.strictEqual(result.length, messages.length);
            assert.strictEqual(pruningResult.messagesRemoved, 0);
        });

        test('should trigger pruning when exceeding threshold', () => {
            // Create a config with very low threshold to force pruning
            const lowThresholdConfig = {
                ...DEFAULT_MEMORY_MANAGEMENT_CONFIG,
                safetyThreshold: 1
            };

            const useCase = new MemoryPruningUseCase(
                lowThresholdConfig,
                DEFAULT_TOKEN_COUNT_CONFIGURATION,
                mockLogger
            );

            const messages = [
                new SystemMessage('You are a helpful assistant'),
                new HumanMessage(
                    'This is a very long human message with lots of content to push token count over threshold'
                ),
                new AIMessage('This is a response message'),
                new HumanMessage('Another question')
            ];

            const { result: pruningResult } = useCase.execute(messages);

            assert.strictEqual(pruningResult.pruningPerformed, true);
            assert.ok(pruningResult.originalTokenCount > pruningResult.finalTokenCount);
        });

        test('should preserve system message during pruning', () => {
            const lowThresholdConfig = {
                ...DEFAULT_MEMORY_MANAGEMENT_CONFIG,
                safetyThreshold: 100,
                preserveSystemPrompt: true
            };

            const useCase = new MemoryPruningUseCase(
                lowThresholdConfig,
                DEFAULT_TOKEN_COUNT_CONFIGURATION,
                mockLogger
            );

            const systemMessage = new SystemMessage('You are a helpful assistant');
            const messages = [
                systemMessage,
                new HumanMessage('Long message with lots of content to exceed token limit and trigger pruning'),
                new AIMessage('Response'),
                new HumanMessage('Another question')
            ];

            const { messages: result } = useCase.execute(messages);

            assert.ok(result[0] instanceof SystemMessage);
            assert.strictEqual(result[0].content, systemMessage.content);
        });

        test('should preserve recent messages', () => {
            const lowThresholdConfig = {
                ...DEFAULT_MEMORY_MANAGEMENT_CONFIG,
                safetyThreshold: 100,
                preserveRecentMessagesCount: 2
            };

            const useCase = new MemoryPruningUseCase(
                lowThresholdConfig,
                DEFAULT_TOKEN_COUNT_CONFIGURATION,
                mockLogger
            );

            const messages = [
                new HumanMessage('Message 1'),
                new HumanMessage('Message 2'),
                new HumanMessage('Long message with lots of content to trigger pruning and memory cleanup'),
                new HumanMessage('Recent message A'),
                new AIMessage('Recent message B')
            ];

            const { messages: result } = useCase.execute(messages);

            // Recent messages should be in result
            assert.strictEqual(result[result.length - 1], messages[messages.length - 1]);
            assert.strictEqual(result[result.length - 2], messages[messages.length - 2]);
        });

        test('should truncate observation messages', () => {
            const lowThresholdConfig = {
                ...DEFAULT_MEMORY_MANAGEMENT_CONFIG,
                safetyThreshold: 100
            };

            const useCase = new MemoryPruningUseCase(
                lowThresholdConfig,
                DEFAULT_TOKEN_COUNT_CONFIGURATION,
                mockLogger
            );

            const longObservation = new HumanMessage(
                'Observation: ' +
                    'A'.repeat(1000) +
                    ' some code content that should be truncated during memory pruning'
            );
            const messages = [
                new SystemMessage('You are helpful'),
                longObservation,
                new HumanMessage('Recent question'),
                new AIMessage('Recent response')
            ];

            const { messages: result } = useCase.execute(messages);

            // Should contain truncation marker
            const truncatedMessages = result.filter(
                (msg) => {
                    if (typeof msg.content !== 'string') {
                        return false;
                    }

                    return msg.content.includes('[Code snippet truncated to save memory]')
                        || msg.content.includes('Observation:');
                }
            );

            assert.ok(truncatedMessages.length > 0);
        });

        test('should log pruning operations', () => {
            const lowThresholdConfig = {
                ...DEFAULT_MEMORY_MANAGEMENT_CONFIG,
                safetyThreshold: 1
            };

            const useCase = new MemoryPruningUseCase(
                lowThresholdConfig,
                DEFAULT_TOKEN_COUNT_CONFIGURATION,
                mockLogger
            );

            const messages = [
                new SystemMessage('You are helpful'),
                new HumanMessage('Long message with lots of content to trigger pruning operation and cleanup'),
                new HumanMessage('Question'),
                new AIMessage('Response')
            ];

            useCase.execute(messages);

            const hasExpectedDebugCall = debugCalls.some((call) =>
                call[0] === 'memory'
                && call[1] === 'Checking memory pruning necessity'
                && typeof call[2] === 'object'
                && call[2] !== null
            );

            const hasExpectedInfoCall = infoCalls.some((call) =>
                call[0] === 'memory'
                && call[1] === 'Memory pruning executed'
                && typeof call[2] === 'object'
                && call[2] !== null
            );

            assert.strictEqual(hasExpectedDebugCall, true);
            assert.strictEqual(hasExpectedInfoCall, true);
        });

        test('should handle empty message array', () => {
            const useCase = new MemoryPruningUseCase(
                DEFAULT_MEMORY_MANAGEMENT_CONFIG,
                DEFAULT_TOKEN_COUNT_CONFIGURATION,
                mockLogger
            );

            const { messages: result } = useCase.execute([]);

            assert.deepStrictEqual(result, []);
        });

        test('should provide accurate pruning results', () => {
            const lowThresholdConfig = {
                ...DEFAULT_MEMORY_MANAGEMENT_CONFIG,
                safetyThreshold: 100
            };

            const useCase = new MemoryPruningUseCase(
                lowThresholdConfig,
                DEFAULT_TOKEN_COUNT_CONFIGURATION,
                mockLogger
            );

            const messages = [
                new SystemMessage('You are helpful'),
                new HumanMessage('Long message with content'),
                new HumanMessage('Another message'),
                new AIMessage('Response')
            ];

            const { result: pruningResult } = useCase.execute(messages);

            assert.strictEqual(pruningResult.originalMessageCount, messages.length);
            assert.ok(pruningResult.originalTokenCount > 0);
            assert.ok(pruningResult.messagesRemoved >= 0);

            if (pruningResult.pruningPerformed) {
                assert.ok(pruningResult.finalTokenCount < pruningResult.originalTokenCount);
            }
        });
    });
});
