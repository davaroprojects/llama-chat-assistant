import * as vscode from 'vscode';

export interface Logger {
    info(scope: string, message: string, details?: unknown): void;
    warn(scope: string, message: string, details?: unknown): void;
    error(scope: string, message: string, details?: unknown): void;
    debug(scope: string, message: string, details?: unknown): void;
    logHttpRequest(method: string, url: string, scope?: string): void;
    logHttpResponse(method: string, url: string, status: number, durationMs: number, scope?: string): void;
    logChromaDbOperation(operation: string, details: unknown, scope?: string): void;
}

function stringifyDetails(details: unknown): string {
    if (details === undefined) {
        return '';
    }

    if (typeof details === 'string') {
        return ` | ${details}`;
    }

    try {
        return ` | ${JSON.stringify(details)}`;
    } catch {
        return ' | [unserializable details]';
    }
}

export class OutputLogger implements Logger, vscode.Disposable {
    private readonly channel: vscode.OutputChannel;
    private debugEnabled = false;

    constructor(channelName: string, debugEnabled = false) {
        this.channel = vscode.window.createOutputChannel(channelName);
        this.debugEnabled = debugEnabled;
    }

    setDebugEnabled(enabled: boolean): void {
        this.debugEnabled = enabled;
    }

    info(scope: string, message: string, details?: unknown): void {
        this.write('INFO', scope, message, details);
    }

    warn(scope: string, message: string, details?: unknown): void {
        this.write('WARN', scope, message, details);
    }

    error(scope: string, message: string, details?: unknown): void {
        this.write('ERROR', scope, message, details);
    }

    debug(scope: string, message: string, details?: unknown): void {
        if (!this.debugEnabled) {
            return;
        }

        this.write('DEBUG', scope, message, details);
    }

    private write(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', scope: string, message: string, details?: unknown): void {
        const timestamp = new Date().toISOString();
        this.channel.appendLine(`${timestamp} [${level}] [${scope}] ${message}${stringifyDetails(details)}`);
    }

    dispose(): void {
        this.channel.dispose();
    }

    logHttpRequest(method: string, url: string, scope = 'http'): void {
        this.info(scope, `${method} ${url}`);
    }

    logHttpResponse(method: string, url: string, status: number, durationMs: number, scope = 'http'): void {
        const level = status >= 400 ? 'error' : 'info';
        this[level](scope, `${method} ${url} → ${status} (${durationMs}ms)`);
    }

    logChromaDbOperation(operation: string, details: unknown, scope = 'rag'): void {
        this.debug(scope, `ChromaDB ${operation}`, details);
    }
}
