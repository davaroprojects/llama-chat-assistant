/**
 * Tests for token counter utility
 */

import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import {
    countTokensInMessages,
    countTokensInText,
    estimateMessageTokens,
    getTokenCountBreakdown,
    DEFAULT_TOKEN_COUNT_CONFIGURATION
} from '../../utils/tokenCounter';

describe('Token Counter Utility', () => {
    describe('countTokensInText', () => {
        it('should count tokens in simple text', () => {
            const text = 'Hello world';
            const count = countTokensInText(text);

            expect(count).toBeGreaterThan(0);
            expect(typeof count).toBe('number');
        });

        it('should count more tokens for longer text', () => {
            const shortText = 'Hello';
            const longText = 'Hello world this is a much longer text with more words';

            const shortCount = countTokensInText(shortText);
            const longCount = countTokensInText(longText);

            expect(longCount).toBeGreaterThan(shortCount);
        });

        it('should handle empty text', () => {
            const count = countTokensInText('');
            expect(count).toBeGreaterThanOrEqual(0);
        });
    });

    describe('estimateMessageTokens', () => {
        it('should estimate tokens for a message', () => {
            const content = 'This is a test message';
            const tokens = estimateMessageTokens(content);

            expect(tokens).toBeGreaterThan(0);
            expect(typeof tokens).toBe('number');
        });
    });

    describe('countTokensInMessages', () => {
        it('should count tokens in array of messages', () => {
            const messages = [
                new SystemMessage('You are a helpful assistant'),
                new HumanMessage('Hello, how are you?'),
                new AIMessage('I am doing well, thank you!')
            ];

            const result = countTokensInMessages(messages);

            expect(result.totalTokens).toBeGreaterThan(0);
            expect(result.messageTokenCounts.size).toBe(3);
            expect(result.calculatedAt).toBeInstanceOf(Date);
        });

        it('should provide per-message token counts', () => {
            const messages = [new HumanMessage('Short'), new HumanMessage('A much longer message with more content')];

            const result = countTokensInMessages(messages);

            const firstCount = result.messageTokenCounts.get(0);
            const secondCount = result.messageTokenCounts.get(1);

            expect(firstCount).toBeLessThan(secondCount || 0);
        });

        it('should sum to total tokens', () => {
            const messages = [
                new HumanMessage('Message 1'),
                new HumanMessage('Message 2'),
                new AIMessage('Response')
            ];

            const result = countTokensInMessages(messages);
            const summedTokens = Array.from(result.messageTokenCounts.values()).reduce((a, b) => a + b, 0);

            expect(result.totalTokens).toBe(summedTokens);
        });

        it('should handle empty message array', () => {
            const result = countTokensInMessages([]);

            expect(result.totalTokens).toBe(0);
            expect(result.messageTokenCounts.size).toBe(0);
        });
    });

    describe('getTokenCountBreakdown', () => {
        it('should provide detailed breakdown', () => {
            const messages = [
                new HumanMessage('Hello'),
                new AIMessage('Hi there!'),
                new HumanMessage('How are you?')
            ];

            const breakdown = getTokenCountBreakdown(messages);

            expect(breakdown.length).toBe(3);
            expect(breakdown[0].role).toBe('human');
            expect(breakdown[1].role).toBe('ai');
            expect(breakdown[0].tokenCount).toBeGreaterThan(0);
        });

        it('should include preview text', () => {
            const messages = [new HumanMessage('This is a long message that should be truncated in the preview')];

            const breakdown = getTokenCountBreakdown(messages);

            expect(breakdown[0].preview.length).toBeLessThanOrEqual(50);
            expect(breakdown[0].preview).toContain('This is a long');
        });
    });
});
