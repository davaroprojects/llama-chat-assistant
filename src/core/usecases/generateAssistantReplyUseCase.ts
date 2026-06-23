import { FileMetadata } from '../model/sessionPayload';
import { PromptTemplateManager } from '../../adapters/vscode/promptTemplateManager';
import { buildConversationUserPrompt } from '../../helpers/conversationPromptBuilder';
import { LlamaMessageBuilder } from '../../helpers/llamaMessageBuilder';
import { ChromaDbConnectionConfig } from '../model/chroma';
import { ConversationFlowDecision, ConversationFlowType } from '../model/conversationFlow';
import { Logger } from '../../adapters/vscode/outputLogger';
import { LlamaGateway, LlmGenerationConfig, LlmGenerationResult, LlmMessage } from '../gateways/llamaGateway';
import { RagGateway } from '../gateways/ragGateway';
import { LlamaChatAgentSearchUseCase } from './llamaChatAgentSearchUseCase';
import { ResolveConversationFlowUseCase } from './resolveConversationFlowUseCase';
import { RunReactAgentConversationUseCase } from './runReactAgentConversationUseCase';

export interface GenerateAssistantReplyInput {
    userPrompt: string;
    filesMetadata: FileMetadata[];
    baseMessages: Array<{ role: string; content: unknown }>;
    ragEnabled: boolean;
    abortSignal?: AbortSignal;
    llamaConfig: LlmGenerationConfig;
    chromaConfig: ChromaDbConnectionConfig;
    onToken: (token: string) => void;
}

export interface GenerateAssistantReplyResult extends LlmGenerationResult {
    durationSeconds: string;
    ragSnippetsCount: number;
    flow: ConversationFlowDecision;
}

export class GenerateAssistantReplyUseCase {
    private readonly resolveConversationFlowUseCase = new ResolveConversationFlowUseCase();
    private readonly reactAgentConversationUseCase: RunReactAgentConversationUseCase;

    constructor(
        private readonly ragGateway: RagGateway,
        private readonly llamaGateway: LlamaGateway,
        private readonly logger: Logger
    ) {
        this.reactAgentConversationUseCase = new RunReactAgentConversationUseCase(
            this.llamaGateway,
            new LlamaChatAgentSearchUseCase(this.ragGateway, this.logger),
            this.logger
        );
    }

    async execute(input: GenerateAssistantReplyInput): Promise<GenerateAssistantReplyResult> {
        const startedAt = Date.now();
        this.throwIfAborted(input.abortSignal);

        const flow = this.resolveConversationFlowUseCase.execute(input.filesMetadata, input.ragEnabled);
        const template = this.getPromptTemplate(flow.type);
        const contextPrompt = buildConversationUserPrompt(
            flow.type,
            template,
            input.userPrompt,
            input.filesMetadata
        );

        this.logger.debug('prompt', 'Resolved conversation flow', {
            flow: flow.type,
            ragEnabled: flow.ragEnabled,
            explicitCodeContext: flow.hasExplicitCodeContext,
            attachedFiles: input.filesMetadata.length
        });

        this.logger.debug('prompt', 'Built flow-specific prompt payload', {
            flow: flow.type,
            systemPromptPreview: template.systemPrompt.slice(0, 240),
            userPromptPreview: contextPrompt.slice(0, 240)
        });

        this.throwIfAborted(input.abortSignal);

        const normalizedBaseMessages: LlmMessage[] = input.baseMessages.map((message) => {
            const content = message.content;
            if (typeof content === 'string' || (typeof content === 'object' && content !== null)) {
                return { role: message.role, content };
            }

            return { role: message.role, content: String(content ?? '') };
        });

        const generationResult = this.isReactFlow(flow.type)
            ? await this.reactAgentConversationUseCase.execute({
                baseMessages: normalizedBaseMessages,
                userPrompt: contextPrompt,
                systemPrompt: template.systemPrompt,
                llamaConfig: input.llamaConfig,
                chromaConfig: input.chromaConfig,
                onToken: input.onToken,
                abortSignal: input.abortSignal
            })
            : await this.runDirectConversation(
                normalizedBaseMessages,
                contextPrompt,
                template.systemPrompt,
                input
            );

        const ragSnippetsCount = 'retrievedMatches' in generationResult && typeof generationResult.retrievedMatches === 'number'
            ? generationResult.retrievedMatches
            : 0;
        const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(2);
        return {
            ...generationResult,
            durationSeconds,
            ragSnippetsCount,
            flow
        };
    }

    private getPromptTemplate(flowType: ConversationFlowType) {
        switch (flowType) {
            case ConversationFlowType.DIRECT_LLM:
                return PromptTemplateManager.getDirectLlmTemplate();
            case ConversationFlowType.GLOBAL_REACT_AGENT:
                return PromptTemplateManager.getGlobalReactTemplate();
            case ConversationFlowType.LOCAL_RAG:
                return PromptTemplateManager.getLocalRagTemplate();
            case ConversationFlowType.DEEP_REACT_AGENT:
                return PromptTemplateManager.getDeepReactTemplate();
            default:
                return PromptTemplateManager.getDirectLlmTemplate();
        }
    }

    private isReactFlow(flowType: ConversationFlowType): boolean {
        return flowType === ConversationFlowType.GLOBAL_REACT_AGENT
            || flowType === ConversationFlowType.DEEP_REACT_AGENT;
    }

    private async runDirectConversation(
        baseMessages: LlmMessage[],
        userPrompt: string,
        systemPrompt: string,
        input: GenerateAssistantReplyInput
    ): Promise<LlmGenerationResult> {
        const messagesForLlama = LlamaMessageBuilder.prepareMessagesForLlama(
            baseMessages,
            userPrompt,
            systemPrompt
        ) as LlmMessage[];

        return this.llamaGateway.streamResponse(
            messagesForLlama,
            input.llamaConfig,
            input.onToken,
            input.abortSignal
        );
    }

    private throwIfAborted(abortSignal?: AbortSignal): void {
        if (abortSignal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
    }
}
