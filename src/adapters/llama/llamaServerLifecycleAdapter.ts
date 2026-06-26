import { ChildProcess, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import {
    ManagedServerType,
    ServerLifecycleGateway,
    StartServerGatewayInput,
    StartServerGatewayResult,
    StartedServerProcess
} from '../../core/gateways/serverLifecycleGateway';
import {
    buildEmbeddingsServerLaunchCommand,
    buildServerLaunchCommand
} from './llamaServerConfig';
import { LlamaAdapter } from './llamaAdapter';
import { Logger } from '../vscode/outputLogger';

class ChildProcessServerHandle implements StartedServerProcess {
    constructor(private readonly childProcess: ChildProcess) {}

    stop(): void {
        this.childProcess.kill();
    }

    onExit(listener: () => void): void {
        this.childProcess.on('exit', () => listener());
    }

    onError(listener: (error: Error) => void): void {
        this.childProcess.on('error', listener);
    }
}

export class LlamaServerLifecycleAdapter implements ServerLifecycleGateway {
    constructor(private readonly logger: Logger) {}

    async startServer(input: StartServerGatewayInput): Promise<StartServerGatewayResult> {
        const { command, args } = this.resolveLaunchCommand(input);

        if (!fs.existsSync(command)) {
            throw new Error(`llama-server not found: ${command}`);
        }

        if (!fs.existsSync(args[1])) {
            const modelPrefix = input.serverType === 'chat' ? 'Model' : 'Embeddings model';
            throw new Error(`${modelPrefix} not found: ${args[1]}`);
        }

        const childProcess = spawn(command, args, {
            cwd: input.workspaceRoot,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        this.attachProcessLogging(childProcess, input.serverType);

        if (input.startupDelayMs > 0) {
            await new Promise<void>((resolve) => {
                setTimeout(() => resolve(), input.startupDelayMs);
            });
        }

        const props = await this.fetchServerPropsWithRetries(input);
        return {
            process: new ChildProcessServerHandle(childProcess),
            props,
            startedByPlugin: props !== null
        };
    }

    private resolveLaunchCommand(input: StartServerGatewayInput): { command: string; args: string[] } {
        if (input.serverType === 'chat') {
            return buildServerLaunchCommand(input.chatLaunchConfig, input.workspaceRoot);
        }

        return buildEmbeddingsServerLaunchCommand(input.embeddingsLaunchConfig, input.workspaceRoot);
    }

    private async fetchServerPropsWithRetries(input: StartServerGatewayInput) {
        const apiUrl = input.serverType === 'chat' ? input.chatApiUrl : input.embeddingsApiUrl;

        for (let attempt = 0; attempt < input.startupRetries; attempt++) {
            const props = await LlamaAdapter.fetchServerProps(apiUrl);
            if (props) {
                return props;
            }

            if (attempt < input.startupRetries - 1 && input.startupRetryDelayMs > 0) {
                await new Promise<void>((resolve) => {
                    setTimeout(() => resolve(), input.startupRetryDelayMs);
                });
            }
        }

        return null;
    }

    private attachProcessLogging(process: ChildProcess, serverType: ManagedServerType): void {
        const scope = serverType === 'chat' ? 'llama.server' : 'llama.embeddings';
        process.stdout?.on('data', (chunk: Buffer | string) => {
            const text = String(chunk).trim();
            if (!text) {
                return;
            }
            this.logger.debug(scope, 'process.stdout', text);
        });

        process.stderr?.on('data', (chunk: Buffer | string) => {
            const text = String(chunk).trim();
            if (!text) {
                return;
            }
            this.logger.debug(scope, 'process.stderr', text);
        });
    }
}