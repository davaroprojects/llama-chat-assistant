import * as assert from 'assert';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import {
    countTokensInMessages,
    countTokensInText,
    estimateMessageTokens,
    getTokenCountBreakdown,
    initializeTokenCounter
} from '../../utils/tokenCounter';

suite('tokenCounter', () => {
    suiteSetup(async () => {
        await initializeTokenCounter();
    });

    test('countTokensInText returns token count for simple text', () => {
        const count = countTokensInText('Hello world');
        assert.ok(count > 0);
    });

    test('countTokensInText increases with longer text', () => {
        const shortCount = countTokensInText('Hello');
        const longCount = countTokensInText('Hello world this is a much longer text with more words');
        assert.ok(longCount > shortCount);
    });

    test('estimateMessageTokens returns positive count', () => {
        const tokens = estimateMessageTokens('This is a test message');
        assert.ok(tokens > 0);
    });

    test('countTokensInMessages returns total and per-message counts', async () => {
        const messages = [
            new SystemMessage('You are a helpful assistant'),
            new HumanMessage('Hello, how are you?'),
            new AIMessage('I am doing well, thank you!')
        ];

        const result = await countTokensInMessages(messages);

        assert.ok(result.totalTokens > 0);
        assert.strictEqual(result.messageTokenCounts.size, 3);
        assert.ok(result.calculatedAt instanceof Date);
    });

    test('countTokensInMessages preserves relative message lengths', async () => {
        const messages = [
            new HumanMessage('Short'),
            new HumanMessage('A much longer message with more content')
        ];

        const result = await countTokensInMessages(messages);
        const firstCount = result.messageTokenCounts.get(0) || 0;
        const secondCount = result.messageTokenCounts.get(1) || 0;

        assert.ok(secondCount >= firstCount);
    });

    test('countTokensInMessages handles empty arrays', async () => {
        const result = await countTokensInMessages([]);
        assert.strictEqual(result.totalTokens, 0);
        assert.strictEqual(result.messageTokenCounts.size, 0);
    });

    test('getTokenCountBreakdown returns detailed rows', () => {
        const messages = [
            new HumanMessage('Hello'),
            new AIMessage('Hi there!'),
            new HumanMessage('How are you?')
        ];

        const breakdown = getTokenCountBreakdown(messages);

        assert.strictEqual(breakdown.length, 3);
        assert.strictEqual(breakdown[0].role, 'human');
        assert.strictEqual(breakdown[1].role, 'ai');
        assert.ok(breakdown[0].tokenCount > 0);
    });

    test('getTokenCountBreakdown includes preview text', () => {
        const messages = [new HumanMessage('This is a long message that should be truncated in the preview')];
        const breakdown = getTokenCountBreakdown(messages);

        assert.ok(breakdown[0].preview.length <= 50);
        assert.ok(breakdown[0].preview.includes('This is a long'));
    });
});
