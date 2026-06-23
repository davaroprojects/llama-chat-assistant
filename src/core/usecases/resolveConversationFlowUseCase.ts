import { FileMetadata } from '../model/sessionPayload';
import { ConversationFlowDecision, ConversationFlowType } from '../model/conversationFlow';

export class ResolveConversationFlowUseCase {
    execute(attachedFiles: FileMetadata[], ragEnabled: boolean): ConversationFlowDecision {
        const hasExplicitCodeContext = attachedFiles.some((file) => !file.isRepository);

        if (hasExplicitCodeContext) {
            return {
                type: ragEnabled ? ConversationFlowType.DEEP_REACT_AGENT : ConversationFlowType.LOCAL_RAG,
                ragEnabled,
                hasExplicitCodeContext
            };
        }

        return {
            type: ragEnabled ? ConversationFlowType.GLOBAL_REACT_AGENT : ConversationFlowType.DIRECT_LLM,
            ragEnabled,
            hasExplicitCodeContext
        };
    }
}
