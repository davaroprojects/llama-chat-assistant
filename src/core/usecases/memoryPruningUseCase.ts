import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { Logger } from '../../adapters/vscode/outputLogger';
import { MemoryManagementConfig, isMemoryPruningNeeded, calculatePruningTarget } from '../../core/domain/memoryConfig';
import { TokenCountConfiguration } from '../../core/domain/tokenCount';

function countTokensInMessagesSync(
    messages: BaseMessage[],
    encodingModel: string = 'cl100k_base'
): { totalTokens: number; messageTokenCounts: Map<number, number> } {
    let encoding: any;
    try {
         
        const jsTiktoken = require('js-tiktoken');
        encoding = jsTiktoken.getEncoding(encodingModel);
    } catch (error) {
        let totalTokens = 0;
        const messageTokenCounts = new Map<number, number>();
        for (let i = 0; i < messages.length; i++) {
            const content = typeof messages[i].content === 'string' ? messages[i].content : JSON.stringify(messages[i].content);
            const estimatedTokens = Math.ceil(content.length / 4);
            messageTokenCounts.set(i, estimatedTokens);
            totalTokens += estimatedTokens;
        }
        return { totalTokens, messageTokenCounts };
    }

    const messageTokenCounts = new Map<number, number>();
    let totalTokens = 0;

    for (let i = 0; i < messages.length; i++) {
        const content = typeof messages[i].content === 'string' ? messages[i].content : JSON.stringify(messages[i].content);
        const messageText = `${messages[i]._getType()}: ${content}`;
        const tokens = encoding.encode(messageText);
        const tokenCount = tokens.length;

        messageTokenCounts.set(i, tokenCount);
        totalTokens += tokenCount;
    }

    return { totalTokens, messageTokenCounts };
}

export interface MemoryPruningResult {
    originalMessageCount: number;
    pruningPerformed: boolean;
    originalTokenCount: number;
    finalTokenCount: number;
    messagesRemoved: number;
    pruningReason: string;
}

export class MemoryPruningUseCase {
    constructor(
        private readonly memoryConfig: MemoryManagementConfig,
        private readonly tokenCountConfig: TokenCountConfiguration,
        private readonly logger: Logger
    ) {}

    execute(messages: BaseMessage[]): { messages: BaseMessage[]; result: MemoryPruningResult } {
        const originalMessageCount = messages.length;
        const tokenCountResult = countTokensInMessagesSync(messages, this.tokenCountConfig.encodingModel);
        const originalTokenCount = tokenCountResult.totalTokens;

        this.logger.debug(
            'memory',
            'Checking memory pruning necessity',
            {
                currentTokens: originalTokenCount,
                safetyThreshold: this.memoryConfig.safetyThreshold,
                messageCount: originalMessageCount
            }
        );

        if (!isMemoryPruningNeeded(originalTokenCount, this.memoryConfig)) {
            return {
                messages,
                result: {
                    originalMessageCount,
                    pruningPerformed: false,
                    originalTokenCount,
                    finalTokenCount: originalTokenCount,
                    messagesRemoved: 0,
                    pruningReason: 'Token count within safe threshold'
                }
            };
        }

        // Perform pruning
        const prunedMessages = this.pruneMessages(messages);
        const finalTokenCountResult = countTokensInMessagesSync(prunedMessages, this.tokenCountConfig.encodingModel);
        const finalTokenCount = finalTokenCountResult.totalTokens;
        const messagesRemoved = messages.length - prunedMessages.length;

        this.logger.info(
            'memory',
            'Memory pruning executed',
            {
                originalTokens: originalTokenCount,
                finalTokens: finalTokenCount,
                tokensFreed: originalTokenCount - finalTokenCount,
                messagesRemoved,
                originalCount: originalMessageCount,
                finalCount: prunedMessages.length
            }
        );

        return {
            messages: prunedMessages,
            result: {
                originalMessageCount,
                pruningPerformed: true,
                originalTokenCount,
                finalTokenCount,
                messagesRemoved,
                pruningReason: `Token count exceeded threshold: ${originalTokenCount} > ${this.memoryConfig.safetyThreshold}`
            }
        };
    }

    private pruneMessages(messages: BaseMessage[]): BaseMessage[] {
        if (messages.length === 0) {
            return messages;
        }

        const preservationIndices = this.getIndicesToPreserve(messages);
        const targetTokenCount = calculatePruningTarget(this.memoryConfig);

        const prunedMessages: BaseMessage[] = messages.filter((_, index) => preservationIndices.has(index));

        for (let i = messages.length - this.memoryConfig.preserveRecentMessagesCount - 1; i >= 0; i--) {
            if (preservationIndices.has(i)) {
                continue;
            }

            const currentMessage = messages[i];

            // Try truncating observation messages
            if (this.isObservationMessage(currentMessage)) {
                const truncatedMessage = this.truncateMessage(currentMessage);
                const candidateMessages = [truncatedMessage, ...prunedMessages];
                const candidateTokens = countTokensInMessagesSync(candidateMessages, this.tokenCountConfig.encodingModel).totalTokens;

                if (candidateTokens <= targetTokenCount) {
                    prunedMessages.unshift(truncatedMessage);
                }
            } else {
                const candidateMessages = [currentMessage, ...prunedMessages];
                const candidateTokens = countTokensInMessagesSync(candidateMessages, this.tokenCountConfig.encodingModel).totalTokens;

                if (candidateTokens <= targetTokenCount) {
                    prunedMessages.unshift(currentMessage);
                } else {
                    break;
                }
            }

            const currentTokens = countTokensInMessagesSync(prunedMessages, this.tokenCountConfig.encodingModel).totalTokens;
            if (currentTokens <= targetTokenCount) {
                break;
            }
        }

        return prunedMessages;
    }

    private getIndicesToPreserve(messages: BaseMessage[]): Set<number> {
        const indices = new Set<number>();

        if (this.memoryConfig.preserveSystemPrompt && messages[0] instanceof SystemMessage) {
            indices.add(0);
        }

        const recentStartIndex = Math.max(0, messages.length - this.memoryConfig.preserveRecentMessagesCount);
        for (let i = recentStartIndex; i < messages.length; i++) {
            indices.add(i);
        }

        return indices;
    }

    private isObservationMessage(message: BaseMessage): boolean {
        const content = typeof message.content === 'string' ? message.content : '';
        return content.startsWith('Observation:') || content.startsWith('Tool:');
    }

    private truncateMessage(message: BaseMessage): BaseMessage {
        if (message instanceof HumanMessage) {
            return new HumanMessage({
                content: `Observation: ${this.memoryConfig.truncationMarker}`,
                additional_kwargs: message.additional_kwargs
            });
        }

        if (message instanceof AIMessage) {
            return new AIMessage({
                content: this.memoryConfig.truncationMarker,
                additional_kwargs: message.additional_kwargs
            });
        }

        return message;
    }
}
