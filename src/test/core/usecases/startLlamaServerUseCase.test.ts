import * as assert from 'assert';
import {
    ServerLifecycleGateway,
    StartServerGatewayInput,
    StartServerGatewayResult,
    StartedServerProcess
} from '../../../core/gateways/serverLifecycleGateway';
import { StartLlamaServerUseCase } from '../../../core/usecases/startLlamaServerUseCase';
import { LlamaEmbeddingsServerLaunchConfig, LlamaServerLaunchConfig } from '../../../core/model/llamaServer';

class FakeStartedProcess implements StartedServerProcess {
    stop(): void {}

    onExit(_listener: () => void): void {}

    onError(_listener: (error: Error) => void): void {}
}

class FakeServerLifecycleGateway implements ServerLifecycleGateway {
    public lastInput: StartServerGatewayInput | null = null;

    async startServer(input: StartServerGatewayInput): Promise<StartServerGatewayResult> {
        this.lastInput = input;
        return {
            process: new FakeStartedProcess(),
            props: null,
            startedByPlugin: false
        };
    }
}

suite('StartLlamaServerUseCase', () => {
    const chatLaunchConfig: LlamaServerLaunchConfig = {
        executablePath: '/tmp/llama-server',
        modelPath: '/tmp/chat.gguf',
        gpuLayers: 99,
        contextSize: 16384,
        flashAttention: true,
        host: '127.0.0.1',
        port: 8033,
        chatCompletionsPath: '/v1/chat/completions',
        jinja: true,
        tools: 'all'
    };

    const embeddingsLaunchConfig: LlamaEmbeddingsServerLaunchConfig = {
        executablePath: '/tmp/llama-server',
        modelPath: '/tmp/embeddings.gguf',
        gpuLayers: 99,
        contextSize: 8192,
        batchSize: 16384,
        ubatchSize: 16384,
        flashAttention: true,
        host: '127.0.0.1',
        port: 8044,
        embeddingsPath: '/v1/embeddings',
        jinja: true,
        tools: 'all'
    };

    test('passes selected chat server type to gateway', async () => {
        const gateway = new FakeServerLifecycleGateway();
        const useCase = new StartLlamaServerUseCase(gateway);

        await useCase.execute({
            serverType: 'chat',
            workspaceRoot: '/workspace',
            chatLaunchConfig,
            embeddingsLaunchConfig,
            chatApiUrl: 'http://127.0.0.1:8033/v1/chat/completions',
            embeddingsApiUrl: 'http://127.0.0.1:8044/v1/embeddings',
            startupDelayMs: 250,
            startupRetries: 3,
            startupRetryDelayMs: 1000
        });

        assert.ok(gateway.lastInput);
        assert.strictEqual(gateway.lastInput?.serverType, 'chat');
        assert.strictEqual(gateway.lastInput?.chatLaunchConfig.modelPath, '/tmp/chat.gguf');
    });

    test('passes selected embeddings server type to gateway', async () => {
        const gateway = new FakeServerLifecycleGateway();
        const useCase = new StartLlamaServerUseCase(gateway);

        await useCase.execute({
            serverType: 'embeddings',
            workspaceRoot: '/workspace',
            chatLaunchConfig,
            embeddingsLaunchConfig,
            chatApiUrl: 'http://127.0.0.1:8033/v1/chat/completions',
            embeddingsApiUrl: 'http://127.0.0.1:8044/v1/embeddings',
            startupDelayMs: 250,
            startupRetries: 3,
            startupRetryDelayMs: 1000
        });

        assert.ok(gateway.lastInput);
        assert.strictEqual(gateway.lastInput?.serverType, 'embeddings');
        assert.strictEqual(gateway.lastInput?.embeddingsLaunchConfig.modelPath, '/tmp/embeddings.gguf');
    });
});
