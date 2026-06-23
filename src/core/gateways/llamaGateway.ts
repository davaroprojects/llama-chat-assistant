export interface LlmMessage {
    role: string;
    content: string | object;
}

export interface LlmGenerationConfig {
    apiUrl: string;
    model: string;
    maxTokens: number;
    temperature: number;
    systemPrompt: string;
    debug: boolean;
}

export interface LlmGenerationResult {
    totalText: string;
    tokenCount: number;
    serverUsageTokens: number;
    errorMsg?: string;
}

export interface LlamaGateway {
    streamResponse(
        messages: LlmMessage[],
        config: LlmGenerationConfig,
        onToken: (token: string) => void,
        abortSignal?: AbortSignal
    ): Promise<LlmGenerationResult>;
}
