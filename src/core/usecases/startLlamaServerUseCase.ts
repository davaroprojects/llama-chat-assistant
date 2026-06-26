import {
    ManagedServerType,
    ServerLifecycleGateway,
    StartedServerProcess
} from '../gateways/serverLifecycleGateway';
import { LlamaServerProps } from '../model/llama';
import { LlamaEmbeddingsServerLaunchConfig, LlamaServerLaunchConfig } from '../model/llamaServer';

export interface StartLlamaServerUseCaseInput {
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

export interface StartLlamaServerUseCaseResult {
    process: StartedServerProcess;
    props: LlamaServerProps | null;
    startedByPlugin: boolean;
}

export class StartLlamaServerUseCase {
    constructor(private readonly serverLifecycleGateway: ServerLifecycleGateway) {}

    async execute(input: StartLlamaServerUseCaseInput): Promise<StartLlamaServerUseCaseResult> {
        const result = await this.serverLifecycleGateway.startServer({
            serverType: input.serverType,
            workspaceRoot: input.workspaceRoot,
            chatLaunchConfig: input.chatLaunchConfig,
            embeddingsLaunchConfig: input.embeddingsLaunchConfig,
            chatApiUrl: input.chatApiUrl,
            embeddingsApiUrl: input.embeddingsApiUrl,
            startupDelayMs: input.startupDelayMs,
            startupRetries: input.startupRetries,
            startupRetryDelayMs: input.startupRetryDelayMs
        });

        return {
            process: result.process,
            props: result.props,
            startedByPlugin: result.startedByPlugin
        };
    }
}