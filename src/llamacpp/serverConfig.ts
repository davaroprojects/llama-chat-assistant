import * as path from 'node:path';

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

export function resolveWorkspacePath(value: string, workspaceRoot?: string): string {
    if (!value || !workspaceRoot || path.isAbsolute(value)) {
        return value;
    }

    return path.resolve(workspaceRoot, value);
}

export function buildServerLaunchCommand(
    config: LlamaServerLaunchConfig,
    workspaceRoot?: string
): { command: string; args: string[] } {
    const command = resolveWorkspacePath(config.executablePath, workspaceRoot);
    const args = [
        '-m', resolveWorkspacePath(config.modelPath, workspaceRoot),
        '-ngl', String(config.gpuLayers),
        '-c', String(config.contextSize),
        '--flash-attn', config.flashAttention ? 'on' : 'off',
        '--host', config.host,
        '--port', String(config.port),
        '--tools', config.tools,
        '--chat-template', 'chatml'
    ];

    if (config.jinja) {
        args.push('--jinja');
    }

    return { command, args };
}

export function buildServerParameterRows(config: LlamaServerLaunchConfig): ServerParameterRow[] {
    return [
        { property: 'binaryPath', value: config.executablePath },
        { property: 'model', value: config.modelPath },
        { property: 'ngl', value: String(config.gpuLayers) },
        { property: 'c', value: String(config.contextSize) },
        { property: 'flash-attn', value: config.flashAttention ? 'on' : 'off' },
        { property: 'host', value: config.host },
        { property: 'port', value: String(config.port) },
        { property: 'jinja', value: String(config.jinja) },
        { property: 'tools', value: config.tools }
    ];
}

export function buildChatApiUrl(config: LlamaServerLaunchConfig): string {
    const rawPath = config.chatCompletionsPath;

    if (rawPath.includes('..')) {
        throw new Error(`Invalid chatCompletionsPath: path traversal sequences are not allowed: "${rawPath}"`);
    }

    const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    return `http://${config.host}:${config.port}${normalizedPath}`;
}
