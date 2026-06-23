import { Logger } from '../../adapters/vscode/outputLogger';
import { LlamaMessageBuilder } from '../../helpers/llamaMessageBuilder';
import { ChromaDbConnectionConfig } from '../model/chroma';
import { LlmGenerationConfig, LlmGenerationResult, LlmMessage, LlamaGateway } from '../gateways/llamaGateway';
import { LlamaChatAgentSearchUseCase } from './llamaChatAgentSearchUseCase';
import { MemoryPruningUseCase } from './memoryPruningUseCase';
import { countTokensInMessages } from '../../utils/tokenCounter';
import { TokenCountConfiguration } from '../domain/tokenCount';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

const MAX_AGENT_STEPS = 6;
const REACT_CONTINUATION_PROMPT = [
    'Observation:',
    '{{observation}}',
    '',
    'Continue the Thought/Action/Observation loop.',
    'If you already have enough context, respond with: Final Answer: <your answer>'
].join('\n');

const REACT_FORMAT_CORRECTION_PROMPT = [
    'Your previous response did not follow the required ReAct format.',
    'Do not answer the user yet.',
    'You must respond with exactly these sections:',
    'Thought: <what you need to inspect next>',
    'Action: llamachat_agent_search("specific codebase search terms")',
    'Do not emit Final Answer before at least one successful tool call.'
].join('\n');

export interface RunReactAgentConversationInput {
    baseMessages: LlmMessage[];
    userPrompt: string;
    systemPrompt: string;
    llamaConfig: LlmGenerationConfig;
    chromaConfig: ChromaDbConnectionConfig;
    onToken: (token: string) => void;
    abortSignal?: AbortSignal;
}

export interface RunReactAgentConversationResult extends LlmGenerationResult {
    toolCalls: number;
    retrievedMatches: number;
    references: string[];
}

function extractFinalAnswer(text: string): string | null {
    const match = text.match(/Final Answer:\s*([\s\S]*)$/i);
    if (!match) {
        return null;
    }

    return match[1]?.trim() || null;
}

function isPlaceholderFinalAnswer(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    return normalized.length === 0
        || normalized.includes('[your comprehensive')
        || normalized.includes('[your answer')
        || normalized.includes('your comprehensive, professional')
        || normalized === '<your answer>';
}

function extractActionQuery(text: string): string | null {
    // Accept any search method name (agent_search, llamachat_agent_search, search, etc.)
    const match = text.match(/Action:\s*[a-z_]*(?:agent_search|search)\s*\(\s*["']?([^"'\)]+)["']?\s*\)/i);
    if (!match) {
        return null;
    }

    const rawValue = match[1]?.trim() || '';
    if (!rawValue) {
        return null;
    }

    // Remove surrounding quotes if present
    if ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
        return rawValue.slice(1, -1).trim();
    }

    return rawValue;
}

function buildObservationPrompt(observationText: string): string {
    return REACT_CONTINUATION_PROMPT.replace('{{observation}}', observationText);
}

function buildSortedReferences(paths: Set<string>): string[] {
    return Array.from(paths).sort();
}

export class RunReactAgentConversationUseCase {
    constructor(
        private readonly llamaGateway: LlamaGateway,
        private readonly agentSearchUseCase: LlamaChatAgentSearchUseCase,
        private readonly memoryPruningUseCase: MemoryPruningUseCase,
        private readonly tokenCountConfig: TokenCountConfiguration,
        private readonly logger: Logger
    ) {}

    async execute(input: RunReactAgentConversationInput): Promise<RunReactAgentConversationResult> {
        let workingMessages = LlamaMessageBuilder.prepareMessagesForLlama(
            input.baseMessages,
            input.userPrompt,
            input.systemPrompt
        ) as LlmMessage[];

        this.logger.info('rag', 'Starting ReAct agent conversation', {
            collectionId: input.chromaConfig.collectionId,
            baseMessages: input.baseMessages.length,
            userPromptPreview: input.userPrompt.slice(0, 240)
        });

        let toolCalls = 0;
        let retrievedMatches = 0;
        let totalTokens = 0;
        let totalServerUsageTokens = 0;
        const executedQueries = new Set<string>();
        const consultedFilePaths = new Set<string>();

        for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
            if (input.abortSignal?.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }

            // Check and perform memory pruning before llama.cpp call
            const messageObjectsForPruning = this.convertToBaseMessages(workingMessages);
            const tokenCountResult = await countTokensInMessages(messageObjectsForPruning, this.tokenCountConfig);
            const preRequestTokens = tokenCountResult.totalTokens;

            this.logger.debug('rag', 'Running ReAct agent iteration', {
                step: step + 1,
                toolCalls,
                retrievedMatches,
                messageCount: workingMessages.length,
                tokenCount: preRequestTokens
            });

            // Perform memory pruning if necessary
            const { messages: prunedMessageObjects, result: pruningResult } = this.memoryPruningUseCase.execute(
                messageObjectsForPruning
            );

            if (pruningResult.pruningPerformed) {
                this.logger.info('rag', 'Memory pruning executed during ReAct loop', {
                    step: step + 1,
                    originalTokens: pruningResult.originalTokenCount,
                    finalTokens: pruningResult.finalTokenCount,
                    messagesRemoved: pruningResult.messagesRemoved
                });
                workingMessages = this.convertFromBaseMessages(prunedMessageObjects);
            }

            const generation = await this.llamaGateway.streamResponse(
                workingMessages,
                input.llamaConfig,
                () => undefined,
                input.abortSignal
            );

            totalTokens += generation.tokenCount;
            totalServerUsageTokens += generation.serverUsageTokens;

            const postRequestTokens = preRequestTokens + generation.tokenCount;
            this.logger.debug('llama', 'ReAct iteration model output received', {
                step: step + 1,
                tokenCount: generation.tokenCount,
                totalTokensInContext: postRequestTokens,
                preview: generation.totalText.slice(0, 400)
            });

            const finalAnswer = extractFinalAnswer(generation.totalText);
            // Only accept Final Answer if at least one tool call (search) has been executed
            if (finalAnswer && !isPlaceholderFinalAnswer(finalAnswer) && toolCalls > 0) {
                const references = buildSortedReferences(consultedFilePaths);
                this.logger.info('rag', 'ReAct agent finished with final answer', {
                    step: step + 1,
                    toolCalls,
                    retrievedMatches,
                    finalAnswerPreview: finalAnswer.slice(0, 240)
                });
                input.onToken(finalAnswer);
                return {
                    totalText: finalAnswer,
                    tokenCount: totalTokens,
                    serverUsageTokens: totalServerUsageTokens,
                    toolCalls,
                    retrievedMatches,
                    references
                };
            }

            // If Final Answer detected but toolCalls is 0, reject it and force iteration
            if (finalAnswer && !isPlaceholderFinalAnswer(finalAnswer) && toolCalls === 0) {
                this.logger.warn('rag', 'ReAct agent attempted Final Answer before first tool call; forcing action iteration', {
                    step: step + 1,
                    preview: finalAnswer.slice(0, 240)
                });

                workingMessages = [
                    ...workingMessages,
                    { role: 'assistant', content: generation.totalText },
                    { role: 'user', content: 'You must execute at least one search action before providing Final Answer. Emit Thought and Action.' }
                ];
                continue;
            }

            if (finalAnswer && isPlaceholderFinalAnswer(finalAnswer)) {
                this.logger.warn('rag', 'ReAct agent returned placeholder final answer; forcing another iteration', {
                    step: step + 1,
                    preview: finalAnswer.slice(0, 240)
                });
            }

            const actionQuery = extractActionQuery(generation.totalText);
            if (!actionQuery) {
                this.logger.warn('rag', 'ReAct model response missing action; requesting format correction', {
                    step: step + 1,
                    toolCalls,
                    preview: generation.totalText.slice(0, 240)
                });

                workingMessages = [
                    ...workingMessages,
                    { role: 'assistant', content: generation.totalText },
                    { role: 'user', content: REACT_FORMAT_CORRECTION_PROMPT }
                ];
                continue;
            }

            const normalizedQueryKey = actionQuery.toLowerCase();
            let observationText: string;
            let matchesCount = 0;
            if (executedQueries.has(normalizedQueryKey)) {
                this.logger.warn('rag', 'ReAct agent attempted duplicate search query', {
                    step: step + 1,
                    actionQuery
                });
                observationText = [
                    'Tool: llamachat_agent_search',
                    `Query: ${actionQuery}`,
                    'This exact query was already executed. Refine the search terms before trying again.'
                ].join('\n');
            } else {
                executedQueries.add(normalizedQueryKey);
                const searchResult = await this.agentSearchUseCase.execute(actionQuery, input.chromaConfig, input.abortSignal);
                observationText = searchResult.observationText;
                matchesCount = searchResult.matches.length;
                // Track consulted files for Final Answer references
                searchResult.matches.forEach(match => consultedFilePaths.add(match.path));
            }

            toolCalls += 1;
            retrievedMatches += matchesCount;
            this.logger.debug('rag', 'ReAct agent step completed', {
                step: step + 1,
                actionQuery,
                matchesCount
            });

            workingMessages = [
                ...workingMessages,
                { role: 'assistant', content: generation.totalText },
                { role: 'user', content: buildObservationPrompt(observationText) }
            ];
        }

        this.logger.warn('rag', 'ReAct agent reached max iterations; forcing final answer', {
            maxSteps: MAX_AGENT_STEPS,
            toolCalls,
            retrievedMatches
        });

        // Perform final memory pruning before last generation call
        const finalMessageObjectsForPruning = this.convertToBaseMessages(workingMessages);
        const { messages: finalPrunedMessageObjects } = this.memoryPruningUseCase.execute(finalMessageObjectsForPruning);
        const finalWorkingMessages = this.convertFromBaseMessages(finalPrunedMessageObjects);

        const finalGeneration = await this.llamaGateway.streamResponse(
            [
                ...finalWorkingMessages,
                { role: 'user', content: 'Stop searching and provide Final Answer: using only the gathered observations.' }
            ],
            input.llamaConfig,
            () => undefined,
            input.abortSignal
        );

        totalTokens += finalGeneration.tokenCount;
        totalServerUsageTokens += finalGeneration.serverUsageTokens;
        let extractedFinalAnswer = extractFinalAnswer(finalGeneration.totalText);
        const references = buildSortedReferences(consultedFilePaths);

        const finalAnswer = extractedFinalAnswer && !isPlaceholderFinalAnswer(extractedFinalAnswer)
            ? extractedFinalAnswer
            : finalGeneration.totalText.trim();

        this.logger.info('rag', 'ReAct agent produced forced final answer', {
            toolCalls,
            retrievedMatches,
            finalAnswerPreview: finalAnswer.slice(0, 240)
        });

        input.onToken(finalAnswer);

        return {
            totalText: finalAnswer,
            tokenCount: totalTokens,
            serverUsageTokens: totalServerUsageTokens,
            toolCalls,
            retrievedMatches,
            references
        };
    }

    /**
     * Convert LlmMessage format to BaseMessage for token counting
     */
    private convertToBaseMessages(messages: LlmMessage[]): BaseMessage[] {
        return messages.map((msg) => {
            if (msg.role === 'assistant') {
                return new AIMessage(msg.content);
            } else if (msg.role === 'system') {
                // System messages are treated as human messages for compatibility
                return new HumanMessage(msg.content);
            }
            return new HumanMessage(msg.content);
        });
    }

    /**
     * Convert BaseMessage format back to LlmMessage
     */
    private convertFromBaseMessages(messages: BaseMessage[]): LlmMessage[] {
        return messages.map((msg) => {
            const role = msg._getType() === 'ai' ? 'assistant' : 'user';
            return {
                role,
                content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
            };
        });
    }
}
