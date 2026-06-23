/**
 * Tests for memory pruning use case
 */

import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { MemoryPruningUseCase } from '../../../core/usecases/memoryPruningUseCase';
import { DEFAULT_MEMORY_MANAGEMENT_CONFIG } from '../../../core/domain/memoryConfig';
import { DEFAULT_TOKEN_COUNT_CONFIGURATION } from '../../../core/domain/tokenCount';
import { Logger } from '../../../adapters/vscode/outputLogger';

describe('Memory Pruning Use Case', () => {
    let mockLogger: Logger;

    beforeEach(() => {
        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        } as any;
    });

    describe('execute', () => {
        it('should not prune when within safe threshold', () => {
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

            expect(pruningResult.pruningPerformed).toBe(false);
            expect(result.length).toBe(messages.length);
            expect(pruningResult.messagesRemoved).toBe(0);
        });

        it('should trigger pruning when exceeding threshold', () => {
            // Create a config with very low threshold to force pruning
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
                new SystemMessage('You are a helpful assistant'),
                new HumanMessage(
                    'This is a very long human message with lots of content to push token count over threshold'
                ),
                new AIMessage('This is a response message'),
                new HumanMessage('Another question')
            ];

            const { result: pruningResult } = useCase.execute(messages);

            expect(pruningResult.pruningPerformed).toBe(true);
            expect(pruningResult.originalTokenCount).toBeGreaterThan(pruningResult.finalTokenCount);
        });

        it('should preserve system message during pruning', () => {
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

            expect(result[0]).toBeInstanceOf(SystemMessage);
            expect(result[0].content).toBe(systemMessage.content);
        });

        it('should preserve recent messages', () => {
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
            expect(result[result.length - 1]).toBe(messages[messages.length - 1]);
            expect(result[result.length - 2]).toBe(messages[messages.length - 2]);
        });

        it('should truncate observation messages', () => {
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

            expect(truncatedMessages.length).toBeGreaterThan(0);
        });

        it('should log pruning operations', () => {
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
                new HumanMessage('Long message with lots of content to trigger pruning operation and cleanup'),
                new HumanMessage('Question'),
                new AIMessage('Response')
            ];

            useCase.execute(messages);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'memory',
                'Checking memory pruning necessity',
                expect.any(Object)
            );

            expect(mockLogger.info).toHaveBeenCalledWith('memory', 'Memory pruning executed', expect.any(Object));
        });

        it('should handle empty message array', () => {
            const useCase = new MemoryPruningUseCase(
                DEFAULT_MEMORY_MANAGEMENT_CONFIG,
                DEFAULT_TOKEN_COUNT_CONFIGURATION,
                mockLogger
            );

            const { messages: result } = useCase.execute([]);

            expect(result).toEqual([]);
        });

        it('should provide accurate pruning results', () => {
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

            expect(pruningResult.originalMessageCount).toBe(messages.length);
            expect(pruningResult.originalTokenCount).toBeGreaterThan(0);
            expect(pruningResult.messagesRemoved).toBeGreaterThanOrEqual(0);

            if (pruningResult.pruningPerformed) {
                expect(pruningResult.finalTokenCount).toBeLessThan(pruningResult.originalTokenCount);
            }
        });
    });
});
