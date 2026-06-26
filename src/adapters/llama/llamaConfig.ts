import * as vscode from 'vscode';
import { buildChatApiUrl, buildEmbeddingsApiUrl } from './llamaServerConfig';
import { LlamaConfig, LlamaEmbeddingsRuntimeConfig } from '../../core/model/llama';
import { LlamaEmbeddingsServerLaunchConfig, LlamaServerLaunchConfig } from '../../core/model/llamaServer';

function getConfigValue<T>(
    config: vscode.WorkspaceConfiguration,
    primaryKey: string,
    legacyKey: string,
    fallback: T
): T {
    const primaryValue = config.get<T>(primaryKey);
    if (primaryValue !== undefined) {
        return primaryValue;
    }

    const legacyValue = config.get<T>(legacyKey);
    if (legacyValue !== undefined) {
        return legacyValue;
    }

    return fallback;
}

export function readLlamaServerLaunchConfig(): LlamaServerLaunchConfig {
    const config = vscode.workspace.getConfiguration('laLlamaChat');
    return {
        executablePath: getConfigValue(config, 'llamaCpp.executablePath', 'server.executablePath', './build/bin/llama-server'),
        modelPath: getConfigValue(config, 'llamaCpp.modelPath', 'server.modelPath', './models/qwen2.5-coder-7b-instruct-q4_k_m.gguf'),
        gpuLayers: getConfigValue(config, 'llamaCpp.gpuLayers', 'server.gpuLayers', 99),
        contextSize: getConfigValue(config, 'llamaCpp.contextSize', 'server.contextSize', 16384),
        flashAttention: getConfigValue(config, 'llamaCpp.flashAttention', 'server.flashAttention', true),
        host: getConfigValue(config, 'llamaCpp.host', 'server.host', '127.0.0.1'),
        port: getConfigValue(config, 'llamaCpp.port', 'server.port', 8033),
        chatCompletionsPath: getConfigValue(config, 'llamaCpp.chatCompletionsPath', 'server.chatCompletionsPath', '/v1/chat/completions'),
        jinja: getConfigValue(config, 'llamaCpp.jinja', 'server.jinja', true),
        tools: getConfigValue(config, 'llamaCpp.tools', 'server.tools', 'all')
    };
}

export function readLlamaRuntimeConfig(serverConfig: LlamaServerLaunchConfig): LlamaConfig {
    const config = vscode.workspace.getConfiguration('laLlamaChat');
    return {
        apiUrl: buildChatApiUrl(serverConfig),
        model: getConfigValue(config, 'chat.model', 'model', 'local'),
        maxTokens: getConfigValue(config, 'chat.maxTokens', 'maxTokens', 2048),
        temperature: getConfigValue(config, 'chat.temperature', 'temperature', 0.1),
        debug: getConfigValue(config, 'chat.debug', 'debug', false)
    };
}

export function readLlamaEmbeddingsServerLaunchConfig(): LlamaEmbeddingsServerLaunchConfig {
    const config = vscode.workspace.getConfiguration('laLlamaChat');
    return {
        executablePath: getConfigValue(config, 'llamaCpp.executablePath', 'server.executablePath', './build/bin/llama-server'),
        modelPath: getConfigValue(config, 'llamaCpp.embeddingsModelPath', 'server.embeddingsModelPath', './models/jina-embeddings-v4-text-code-Q8_0.gguf'),
        gpuLayers: getConfigValue(config, 'llamaCpp.gpuLayers', 'server.gpuLayers', 99),
        contextSize: getConfigValue(config, 'llamaCpp.contextSize', 'server.contextSize', 8192),
        flashAttention: getConfigValue(config, 'llamaCpp.flashAttention', 'server.flashAttention', true),
        host: getConfigValue(config, 'llamaCpp.host', 'server.host', '127.0.0.1'),
        port: getConfigValue(config, 'llamaCpp.embeddingsPort', 'server.embeddingsPort', 8044),
        embeddingsPath: getConfigValue(config, 'llamaCpp.embeddingsPath', 'server.embeddingsPath', '/v1/embeddings'),
        jinja: getConfigValue(config, 'llamaCpp.jinja', 'server.jinja', true),
        tools: getConfigValue(config, 'llamaCpp.tools', 'server.tools', 'all')
    };
}

export function readLlamaEmbeddingsRuntimeConfig(serverConfig: LlamaEmbeddingsServerLaunchConfig): LlamaEmbeddingsRuntimeConfig {
    const config = vscode.workspace.getConfiguration('laLlamaChat');
    return {
        apiUrl: buildEmbeddingsApiUrl(serverConfig),
        model: getConfigValue(config, 'chat.model', 'model', 'local'),
        timeoutMs: getConfigValue(config, 'llamaCpp.embeddingsTimeoutMs', 'server.embeddingsTimeoutMs', 180000)
    };
}
