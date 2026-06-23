export enum ConversationFlowType {
    DIRECT_LLM = 'DIRECT_LLM',
    GLOBAL_REACT_AGENT = 'GLOBAL_REACT_AGENT',
    LOCAL_RAG = 'LOCAL_RAG',
    DEEP_REACT_AGENT = 'DEEP_REACT_AGENT'
}

export interface ConversationFlowDecision {
    type: ConversationFlowType;
    ragEnabled: boolean;
    hasExplicitCodeContext: boolean;
}
