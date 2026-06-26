import { LlamaServerProps } from '../model/llama';
import { LlamaEmbeddingsServerLaunchConfig, LlamaServerLaunchConfig } from '../model/llamaServer';

export type ManagedServerType = 'chat' | 'embeddings';

export interface StartedServerProcess {
    stop(): void;
    onExit(listener: () => void): void;
    onError(listener: (error: Error) => void): void;
}

export interface StartServerGatewayInput {
    serverType: ManagedServerType;
    workspaceRoot?: string;
    chatLaunchConfig: LlamaServerLaunchConfig;
    embeddingsLaunchConfig: LlamaEmbeddingsServerLaunchConfig;
    chatApiUrl: string;
    embeddingsApiUrl: string;
    startupDelayMs: number;
    startupRetries: number;
    startupRetryDelayMs: number;
}

export interface StartServerGatewayResult {
    process: StartedServerProcess;
    props: LlamaServerProps | null;
    startedByPlugin: boolean;
}

export interface ServerLifecycleGateway {
    startServer(input: StartServerGatewayInput): Promise<StartServerGatewayResult>;
}