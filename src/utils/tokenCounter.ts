/**
 * Token counter utility
 * Converts chat messages to tokens and counts them
 */

import { BaseMessage } from '@langchain/core/messages';
import { TokenCountResult, TokenCountConfiguration, DEFAULT_TOKEN_COUNT_CONFIGURATION } from '../core/domain/tokenCount';

export { TokenCountConfiguration, DEFAULT_TOKEN_COUNT_CONFIGURATION };

let encoding: any = null;

/**
 * Initialize the encoding lazily
 */
async function getEncodingInstance(model: string) {
    if (!encoding) {
        const jsTiktoken = await import('js-tiktoken');
        encoding = jsTiktoken.getEncoding(model as any);
    }
    return encoding;
}

/**
 * Extract text content from message
 */
function extractMessageContent(content: string | object[]): string {
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .map((item: any) => {
                if (typeof item === 'string') {
                    return item;
                }
                if (item.type === 'text' && item.text) {
                    return item.text;
                }
                return '';
            })
            .join(' ');
    }
    return '';
}

/**
 * Count tokens in a set of messages synchronously (uses cached encoding)
 * WARNING: This uses a synchronously cached encoding. First call should be awaited via countTokensInMessagesAsync
 */
function countTokensInMessagesSync(
    messages: BaseMessage[],
    config: TokenCountConfiguration = DEFAULT_TOKEN_COUNT_CONFIGURATION
): TokenCountResult {
    void config;

    if (!encoding) {
        throw new Error('Encoding not initialized. Call countTokensInMessagesAsync first.');
    }

    const messageTokenCounts = new Map<number, number>();
    let totalTokens = 0;

    for (let i = 0; i < messages.length; i++) {
        const content = extractMessageContent(messages[i].content);
        const messageText = `${messages[i]._getType()}: ${content}`;
        const tokens = encoding.encode(messageText);
        const tokenCount = tokens.length;

        messageTokenCounts.set(i, tokenCount);
        totalTokens += tokenCount;
    }

    return {
        totalTokens,
        messageTokenCounts,
        calculatedAt: new Date()
    };
}

/**
 * Count tokens in a set of messages (initializes encoding if needed)
 */
export async function countTokensInMessages(
    messages: BaseMessage[],
    config: TokenCountConfiguration = DEFAULT_TOKEN_COUNT_CONFIGURATION
): Promise<TokenCountResult> {
    await getEncodingInstance(config.encodingModel);
    return countTokensInMessagesSync(messages, config);
}

/**
 * Count tokens in formatted conversation text (synchronous)
 */
export function countTokensInText(
    text: string,
    config: TokenCountConfiguration = DEFAULT_TOKEN_COUNT_CONFIGURATION
): number {
    void config;

    if (!encoding) {
        throw new Error('Encoding not initialized. Call an async token counting function first.');
    }
    const tokens = encoding.encode(text);
    return tokens.length;
}

/**
 * Estimate tokens for a single message (synchronous after initialization)
 */
export function estimateMessageTokens(
    content: string,
    config: TokenCountConfiguration = DEFAULT_TOKEN_COUNT_CONFIGURATION
): number {
    return countTokensInText(content, config);
}

/**
 * Get token count breakdown for messages (synchronous after initialization)
 */
export function getTokenCountBreakdown(
    messages: BaseMessage[],
    config: TokenCountConfiguration = DEFAULT_TOKEN_COUNT_CONFIGURATION
): { index: number; role: string; tokenCount: number; preview: string }[] {
    const result = countTokensInMessagesSync(messages, config);

    return Array.from(result.messageTokenCounts.entries()).map(([index, tokenCount]) => ({
        index,
        role: messages[index]._getType(),
        tokenCount,
        preview: extractMessageContent(messages[index].content).substring(0, 50)
    }));
}

/**
 * Ensure encoding is initialized
 * Call this once at application startup
 */
export async function initializeTokenCounter(
    config: TokenCountConfiguration = DEFAULT_TOKEN_COUNT_CONFIGURATION
): Promise<void> {
    await getEncodingInstance(config.encodingModel);
}
