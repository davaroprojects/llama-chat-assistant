import { FileMetadata } from '../domain/sessionPayload';
import { buildPromptContext, RagContextSnippet } from '../../chat/promptContextBuilder';
import { PromptTemplateManager } from '../../chat/promptTemplateManager';
import { LlamaMessageBuilder } from '../../chat/llamaMessageBuilder';
import { ChromaConceptualKnnOptions, ChromaDbConnectionConfig, ChromaQueryMode } from '../domain/chroma';
import { Logger } from '../../logging/outputLogger';
import { LlamaGateway, LlmGenerationConfig, LlmGenerationResult, LlmMessage } from '../gateways/llamaGateway';
import { RagContextMatch, RagGateway } from '../gateways/ragGateway';
import { ResolveContextStrategyUseCase } from './resolveContextStrategyUseCase';

export interface GenerateAssistantReplyInput {
    userPrompt: string;
    filesMetadata: FileMetadata[];
    baseMessages: Array<{ role: string; content: unknown }>;
    endpointFlowPaths?: string[];
    shouldRunStructuredFlow: boolean;
    abortSignal?: AbortSignal;
    llamaConfig: LlmGenerationConfig;
    chromaConfig: ChromaDbConnectionConfig;
    chromaQueryMode: ChromaQueryMode;
    onToken: (token: string) => void;
}

export interface GenerateAssistantReplyResult extends LlmGenerationResult {
    durationSeconds: string;
    ragSnippetsCount: number;
    contextStrategy: {
        hasExplicitFileContext: boolean;
        hasRepositoryAttachment: boolean;
        shouldUseRepositoryScope: boolean;
    };
}

export class GenerateAssistantReplyUseCase {
    constructor(
        private readonly ragGateway: RagGateway,
        private readonly llamaGateway: LlamaGateway,
        private readonly contextStrategyUseCase: ResolveContextStrategyUseCase,
        private readonly logger: Logger
    ) {}

    async execute(input: GenerateAssistantReplyInput): Promise<GenerateAssistantReplyResult> {
        const startedAt = Date.now();
        const ragSnippets = await this.resolveRagContext(input);
        this.throwIfAborted(input.abortSignal);

        const contextStrategy = this.contextStrategyUseCase.execute(input.filesMetadata);
        this.logger.debug('prompt', 'Resolved prompt context source', {
            explicitFileContext: contextStrategy.hasExplicitFileContext,
            repositoryAttachment: contextStrategy.hasRepositoryAttachment,
            ragSnippets: ragSnippets.length,
            attachedFiles: input.filesMetadata.length
        });

        const contextPrompt = buildPromptContext({
            userPrompt: input.userPrompt,
            attachedFiles: input.filesMetadata,
            ragSnippets,
            hasRepositoryAttachment: contextStrategy.hasRepositoryAttachment,
            ragModeTemplate: PromptTemplateManager.getRagModeTemplate(),
            specificFilesModeTemplate: PromptTemplateManager.getSpecificFilesModeTemplate()
        });

        this.throwIfAborted(input.abortSignal);

        const normalizedBaseMessages: LlmMessage[] = input.baseMessages.map((message) => {
            const content = message.content;
            if (typeof content === 'string' || (typeof content === 'object' && content !== null)) {
                return { role: message.role, content };
            }

            return { role: message.role, content: String(content ?? '') };
        });

        const messagesForLlama = LlamaMessageBuilder.prepareMessagesForLlama(
            normalizedBaseMessages,
            contextPrompt,
            input.llamaConfig.systemPrompt
        ) as LlmMessage[];

        const generationResult = await this.llamaGateway.streamResponse(
            messagesForLlama,
            input.llamaConfig,
            input.onToken,
            input.abortSignal
        );

        const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(2);
        return {
            ...generationResult,
            durationSeconds,
            ragSnippetsCount: ragSnippets.length,
            contextStrategy
        };
    }

    private async resolveRagContext(input: GenerateAssistantReplyInput): Promise<RagContextSnippet[]> {
        const contextStrategy = this.contextStrategyUseCase.execute(input.filesMetadata);

        if (!contextStrategy.shouldUseRepositoryScope) {
            this.logger.debug('rag', 'Skipping repository context because explicit file context is attached', {
                attachedFiles: input.filesMetadata.length
            });
            return [];
        }

        this.logger.debug('rag', 'Using repository context for query', {
            hasRepositoryAttachment: contextStrategy.hasRepositoryAttachment,
            explicitFileContext: contextStrategy.hasExplicitFileContext,
            attachedFiles: input.filesMetadata.length,
            structured: input.shouldRunStructuredFlow
        });

        this.logger.debug('rag', 'Resolving repository context', {
            structured: input.shouldRunStructuredFlow,
            endpointFlowPaths: input.endpointFlowPaths?.length ?? 0
        });

        this.throwIfAborted(input.abortSignal);

        const isAvailable = await this.ragGateway.isAvailable(input.chromaConfig);
        if (!isAvailable) {
            return [];
        }

        try {
            this.throwIfAborted(input.abortSignal);
            let results: RagContextMatch[] = [];

            if (input.shouldRunStructuredFlow) {
                results = await this.ragGateway.queryByMode(
                    input.userPrompt,
                    input.chromaConfig,
                    input.chromaConfig.maxQueryResults,
                    input.chromaQueryMode,
                    input.abortSignal,
                    input.endpointFlowPaths
                );

                if (results.length === 0 && input.chromaQueryMode !== 'semantic') {
                    results = await this.ragGateway.queryByMode(
                        input.userPrompt,
                        input.chromaConfig,
                        input.chromaConfig.maxQueryResults,
                        'semantic',
                        input.abortSignal,
                        input.endpointFlowPaths
                    );
                }

                if (results.length === 0 && input.chromaQueryMode !== 'lexical') {
                    results = await this.ragGateway.queryByMode(
                        input.userPrompt,
                        input.chromaConfig,
                        input.chromaConfig.maxQueryResults,
                        'lexical',
                        input.abortSignal,
                        input.endpointFlowPaths
                    );
                }

                if (results.length === 0 && input.endpointFlowPaths && input.endpointFlowPaths.length > 0) {
                    results = await this.ragGateway.queryByMode(
                        input.userPrompt,
                        input.chromaConfig,
                        input.chromaConfig.maxQueryResults,
                        input.chromaQueryMode,
                        input.abortSignal,
                        undefined
                    );
                }
            } else {
                const conceptualOptions: ChromaConceptualKnnOptions = {
                    topK: input.chromaConfig.maxQueryResults,
                    minCosineSimilarity: input.chromaConfig.minCosineSimilarity,
                    signal: input.abortSignal,
                    logger: this.logger
                };

                results = await this.ragGateway.queryConceptual(
                    input.userPrompt,
                    input.chromaConfig,
                    conceptualOptions
                );

                if (results.length === 0 && input.chromaConfig.minCosineSimilarity > 0) {
                    results = await this.ragGateway.queryConceptual(
                        input.userPrompt,
                        input.chromaConfig,
                        {
                            ...conceptualOptions,
                            minCosineSimilarity: 0
                        }
                    );
                }

                if (results.length === 0) {
                    results = await this.ragGateway.queryByMode(
                        input.userPrompt,
                        input.chromaConfig,
                        input.chromaConfig.maxQueryResults,
                        'semantic',
                        input.abortSignal,
                        undefined
                    );
                }

                if (results.length === 0) {
                    results = await this.ragGateway.queryByMode(
                        input.userPrompt,
                        input.chromaConfig,
                        input.chromaConfig.maxQueryResults,
                        'lexical',
                        input.abortSignal,
                        undefined
                    );
                }
            }

            this.logger.debug('rag', 'RAG retrieval completed', {
                structured: input.shouldRunStructuredFlow,
                results: results.length
            });

            this.throwIfAborted(input.abortSignal);
            return results.map((result) => ({
                path: result.path,
                content: result.content,
                distance: result.distance
            }));
        } catch (error) {
            this.logger.error('rag', 'RAG query failed', error);
            return [];
        }
    }

    private throwIfAborted(abortSignal?: AbortSignal): void {
        if (abortSignal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
    }
}
