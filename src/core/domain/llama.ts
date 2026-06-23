export interface ChatMessage {
    role: string;
    content: string | object;
}

export interface LlamaConfig {
    apiUrl: string;
    model: string;
    maxTokens: number;
    temperature: number;
    systemPrompt: string;
    debug: boolean;
}

export interface LlamaServerProps {
    default_generation_settings?: {
        n_ctx?: number;
        params?: Record<string, unknown>;
        [key: string]: unknown;
    };
    model?: string;
    model_name?: string;
    model_alias?: string;
    model_path?: string;
    model_description?: string;
    n_ctx?: number;
    n_ctx_train?: number;
    n_embd?: number;
    n_layer?: number;
    [key: string]: unknown;
}
