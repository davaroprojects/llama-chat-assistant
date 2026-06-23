export interface LlamaServerLaunchConfig {
    executablePath: string;
    modelPath: string;
    gpuLayers: number;
    contextSize: number;
    flashAttention: boolean;
    host: string;
    port: number;
    chatCompletionsPath: string;
    jinja: boolean;
    tools: string;
}

export interface ServerParameterRow {
    property: string;
    value: string;
}
