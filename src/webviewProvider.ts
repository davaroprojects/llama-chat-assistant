import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import { SessionManager } from './chat/sessionManager';
import {
    SessionPayloadBuilder,
    FileMetadata,
    UserMessagePayload,
    AssistantMessagePayload
} from './chat/sessionPayloadBuilder';
import { LlamaService, ChatMessage, LlamaConfig, LlamaServerProps } from './chat/llamaService';
import {
    buildChatApiUrl,
    buildServerLaunchCommand,
    buildServerParameterRows,
    LlamaServerLaunchConfig
} from './chat/serverConfig';
import { sendActiveEditorContext } from './webview/editorContext';
import { openFilePicker } from './webview/filePicker';
import { getHtmlForWebview } from './webview/webviewResources';
import {
    ChromaDbConnectionConfig,
    indexAllWithChromaDb,
    isChromaDbAvailable,
    queryRelevantContextFromChromaDb
} from './rag/chromaDbIndexer';
import { buildPromptContext, RagContextSnippet } from './chat/promptContextBuilder';
import { LlamaMessageBuilder } from './chat/llamaMessageBuilder';

interface BaseWebviewMessage {
    type: string;
}

interface AskLlamaMessage extends BaseWebviewMessage {
    type: 'askLlama';
    value: string;
    attachedFiles?: FileMetadata[];
}

interface SelectSessionMessage extends BaseWebviewMessage {
    type: 'selectSession';
    sessionId: string | null;
}

interface DeleteSessionMessage extends BaseWebviewMessage {
    type: 'deleteSession';
    sessionId: string;
}

interface ApplyCodeMessage extends BaseWebviewMessage {
    type: 'applyCode';
    value: string;
}

interface SetActiveTabMessage extends BaseWebviewMessage {
    type: 'setActiveTab';
    tab: 'chat' | 'server' | 'rag';
}

type IncomingWebviewMessage =
    | AskLlamaMessage
    | SelectSessionMessage
    | DeleteSessionMessage
    | ApplyCodeMessage
    | SetActiveTabMessage
    | { type: 'webviewReady' }
    | { type: 'stopGeneration' }
    | { type: 'startServer' }
    | { type: 'stopServer' }
    | { type: 'openFilePicker' }
    | { type: 'requestSessionsUpdate' }
    | { type: 'requestActiveEditorRefresh' }
    | { type: 'indexAll' };

interface RuntimeMetrics {
    totalRequests: number;
    totalErrors: number;
    totalDurationMs: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isFileMetadataArray(value: unknown): value is FileMetadata[] {
    if (!Array.isArray(value)) {
        return false;
    }

    return value.every((item) => {
        if (!isRecord(item)) {
            return false;
        }

        return typeof item.name === 'string'
            && typeof item.content === 'string'
            && item.name.length > 0
            && item.name.length <= 1024
            && item.content.length <= 2_000_000
            && (item.isAutomatic === undefined || typeof item.isAutomatic === 'boolean')
            && (item.isRepository === undefined || typeof item.isRepository === 'boolean');
    });
}

function isIncomingWebviewMessage(data: unknown): data is IncomingWebviewMessage {
    if (!isRecord(data) || typeof data.type !== 'string') {
        return false;
    }

    switch (data.type) {
        case 'webviewReady':
        case 'stopGeneration':
        case 'startServer':
        case 'stopServer':
        case 'openFilePicker':
        case 'requestSessionsUpdate':
        case 'requestActiveEditorRefresh':
        case 'indexAll':
            return true;
        case 'setActiveTab':
            return data.tab === 'chat' || data.tab === 'server' || data.tab === 'rag';
        case 'selectSession':
            return data.sessionId === null || typeof data.sessionId === 'string';
        case 'deleteSession':
            return typeof data.sessionId === 'string' && data.sessionId.length > 0;
        case 'applyCode':
            return typeof data.value === 'string' && data.value.length <= 1_000_000;
        case 'askLlama':
            if (typeof data.value !== 'string' || data.value.length > 100_000) {
                return false;
            }
            return data.attachedFiles === undefined || isFileMetadataArray(data.attachedFiles);
        default:
            return false;
    }
}

export class LlamaChatViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    private currentAbortController: AbortController | null = null;
    private _view?: vscode.WebviewView;
    private isPickerOpen = false;
    private isGenerationActive = false;
    private serverProcess: ChildProcess | null = null;
    private serverProps: LlamaServerProps | null = null;
    private wasServerStartedByPlugin = false;
    private isRagIndexing = false;
    private isChromaAvailable = false;
    private readonly metrics: RuntimeMetrics = {
        totalRequests: 0,
        totalErrors: 0,
        totalDurationMs: 0
    };

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly context: vscode.ExtensionContext,
        private readonly sessionManager: SessionManager
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = getHtmlForWebview(this._extensionUri, webviewView.webview);
        this.setupMessageHandlers(webviewView);
        this.setupEditorListeners();
        this.setupConfigurationListener();
    }

    private setupMessageHandlers(webviewView: vscode.WebviewView): void {
        webviewView.webview.onDidReceiveMessage(async (data) => {
            try {
                if (!isIncomingWebviewMessage(data)) {
                    console.warn('[llama-chat] Ignored invalid webview message payload');
                    return;
                }

                await this.routeMessage(data, webviewView);
            } catch (error) {
                console.error('Error handling message:', error);
            }
        });
    }

    private async routeMessage(data: IncomingWebviewMessage, webviewView: vscode.WebviewView): Promise<void> {
        switch (data.type) {
            case 'webviewReady':
                await this.handleWebviewReady(webviewView);
                break;
            case 'stopGeneration':
                this.handleStopGeneration();
                break;
            case 'startServer':
                await this.handleStartServer(webviewView);
                break;
            case 'stopServer':
                this.handleStopServer();
                break;
            case 'openFilePicker':
                await this.handleOpenFilePicker(webviewView);
                break;
            case 'selectSession':
                this.handleSelectSession(data, webviewView);
                break;
            case 'setActiveTab':
                this.sessionManager.setActiveTab(data.tab);
                break;
            case 'askLlama':
                await this.handleAskLlama(data, webviewView);
                break;
            case 'applyCode':
                this.handleApplyCode(data);
                break;
            case 'deleteSession':
                this.handleDeleteSession(data, webviewView);
                break;
            case 'requestSessionsUpdate':
                this.handleRequestSessionsUpdate(webviewView);
                break;
            case 'requestActiveEditorRefresh':
                this.handleRequestActiveEditorRefresh(webviewView);
                break;
            case 'indexAll':
                await this.handleIndexAll(webviewView);
                break;
        }
    }

    private async handleWebviewReady(webviewView: vscode.WebviewView): Promise<void> {
        this._view = webviewView;
        // Detect if server is already running (don't claim ownership)
        await this.refreshServerProps();
        await this.refreshChromaAvailability();
        const initialSessions = this.sessionManager.getAllSessions();
        const uiState = this.sessionManager.getUiState();
        const activeSession = this.sessionManager.getCurrentSession();

        webviewView.webview.postMessage({
            type: 'renderSessionsList',
            sessions: initialSessions,
            contextWindow: this.getContextWindow(),
            modelName: this.getModelName()
        });

        webviewView.webview.postMessage({
            type: 'restoreUiState',
            activeTab: uiState.activeTab,
            hasActiveSession: !!uiState.currentSessionId
        });

        this.postServerState(webviewView);
        this.postRagState(webviewView);

        if (activeSession) {
            webviewView.webview.postMessage({
                type: 'restoreActiveChat',
                title: activeSession.title,
                messages: activeSession.messages,
                sessionTokens: this.sessionManager.getSessionTokenEstimate(),
                contextWindow: this.getContextWindow(),
                modelName: this.getModelName()
            });
        }

        this.pushActiveEditorContext(webviewView, vscode.window.activeTextEditor);
    }

    private handleStopGeneration(): void {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }
    }

    private async handleStartServer(webviewView: vscode.WebviewView): Promise<void> {
        if (this.serverProcess) {
            return;
        }

        const serverConfig = this.getServerLaunchConfig();
        const workspaceRoot = this.getWorkspaceRoot();
        const { command, args } = buildServerLaunchCommand(serverConfig, workspaceRoot);

        if (!fs.existsSync(command)) {
            vscode.window.showErrorMessage(`llama-server not found: ${command}`);
            this.postRuntimeState(webviewView);
            return;
        }

        if (!fs.existsSync(args[1])) {
            vscode.window.showErrorMessage(`Model not found: ${args[1]}`);
            this.postRuntimeState(webviewView);
            return;
        }

        try {
            const serverProcess = spawn(command, args, {
                cwd: workspaceRoot,
                stdio: 'ignore'
            });
            this.serverProcess = serverProcess;
            serverProcess.on('exit', () => {
                this.serverProcess = null;
                this.serverProps = null;
                this.wasServerStartedByPlugin = false;
                this.postRuntimeState();
            });
            serverProcess.on('error', (error) => {
                this.serverProcess = null;
                this.serverProps = null;
                this.wasServerStartedByPlugin = false;
                vscode.window.showErrorMessage(`Failed to start llama-server: ${error.message}`);
                this.postRuntimeState();
            });
            await this.refreshServerProps(8, 500);
            this.wasServerStartedByPlugin = true;
            this.postRuntimeState();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to start llama-server: ${errorMessage}`);
            this.serverProcess = null;
            this.serverProps = null;
            this.wasServerStartedByPlugin = false;
            this.postRuntimeState(webviewView);
        }
    }

    private handleStopServer(): void {
        if (!this.serverProcess) {
            this.serverProps = null;
            this.wasServerStartedByPlugin = false;
            this.postRuntimeState();
            return;
        }

        this.serverProcess.kill();
        this.serverProcess = null;
        this.serverProps = null;
        this.wasServerStartedByPlugin = false;
        this.postRuntimeState();
    }

    private async handleOpenFilePicker(webviewView: vscode.WebviewView): Promise<void> {
        this.isPickerOpen = true;

        try {
            await openFilePicker(webviewView);
        } finally {
            setTimeout(() => {
                this.isPickerOpen = false;
            }, 400);
        }
    }

    private handleSelectSession(data: SelectSessionMessage, webviewView: vscode.WebviewView): void {
        if (!this.serverProps) {
            return;
        }

        this.sessionManager.setCurrentSession(data.sessionId);
        const activeSession = this.sessionManager.getCurrentSession();

        if (activeSession) {
            webviewView.webview.postMessage({
                type: 'restoreActiveChat',
                title: activeSession.title,
                messages: activeSession.messages,
                sessionTokens: this.sessionManager.getSessionTokenEstimate(),
                contextWindow: this.getContextWindow(),
                modelName: this.getModelName()
            });
        }
    }

    private async handleAskLlama(data: AskLlamaMessage, webviewView: vscode.WebviewView): Promise<void> {
        this.isGenerationActive = true;
        this.metrics.totalRequests += 1;

        const generationStart = performance.now();
        try {
            const userPrompt = data.value;
            const filesMetadata = this.collectFilesMetadata(data.attachedFiles || []);

            // Save user message to session
            const userPayload = SessionPayloadBuilder.createUserMessagePayload(userPrompt, filesMetadata);
            this.saveUserMessageToSession(userPayload);

            // Notify frontend
            webviewView.webview.postMessage({
                type: 'addMessage',
                role: 'user',
                text: userPrompt,
                filesMetadata: filesMetadata
            });
            webviewView.webview.postMessage({ type: 'startStreaming' });

            // Generate response from Llama.cpp
            await this.generateLlamaResponse(
                userPrompt,
                filesMetadata,
                webviewView
            );
        } catch (error: unknown) {
            this.metrics.totalErrors += 1;
            console.error('Error in askLlama:', error);
            if (error instanceof Error && error.name === 'AbortError') {
                webviewView.webview.postMessage({ type: 'stopStreaming' });
            } else {
                const errorMessage = error instanceof Error
                    ? error.message
                    : this.getLocalizedUnknownErrorLabel();
                webviewView.webview.postMessage({
                    type: 'errorStreaming',
                    text: `${this.getLocalizedErrorPrefix()}: ${errorMessage}`
                });
            }
        } finally {
            this.isGenerationActive = false;
            this.metrics.totalDurationMs += (performance.now() - generationStart);
            this.maybeLogMetrics();
            this.pushActiveEditorContext(webviewView, vscode.window.activeTextEditor);
        }
    }

    private handleApplyCode(data: ApplyCodeMessage): void {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.edit(editBuilder => {
                if (!editor.selection.isEmpty) {
                    editBuilder.replace(editor.selection, data.value);
                } else {
                    editBuilder.insert(editor.selection.active, data.value);
                }
            });
        }
    }

    private handleDeleteSession(data: DeleteSessionMessage, webviewView: vscode.WebviewView): void {
        if (!this.serverProps) {
            return;
        }

        this.sessionManager.deleteSession(data.sessionId);

        const remainingSessions = this.sessionManager.getAllSessions();
        webviewView.webview.postMessage({
            type: 'renderSessionsList',
            sessions: remainingSessions,
            contextWindow: this.getContextWindow(),
            modelName: this.getModelName()
        });
    }

    private handleRequestSessionsUpdate(webviewView: vscode.WebviewView): void {
        const freshSessions = this.sessionManager.getAllSessions();
        webviewView.webview.postMessage({
            type: 'renderSessionsList',
            sessions: freshSessions,
            contextWindow: this.getContextWindow(),
            modelName: this.getModelName()
        });
    }

    private handleRequestActiveEditorRefresh(webviewView: vscode.WebviewView): void {
        this.pushActiveEditorContext(webviewView, vscode.window.activeTextEditor);
    }

    private async handleIndexAll(webviewView: vscode.WebviewView): Promise<void> {
        if (this.isRagIndexing) {
            return;
        }

        const chromaConfig = this.getChromaDbConfig();
        this.isChromaAvailable = await isChromaDbAvailable(chromaConfig);
        if (!this.isChromaAvailable) {
            this.postRagState(webviewView);
            return;
        }

        this.isRagIndexing = true;
        const previousState = this.sessionManager.getRagIndexState();
        this.sessionManager.setRagIndexState({
            ...previousState,
            status: 'indexing'
        });
        this.postRagState(webviewView);

        try {
            const workspaceRoot = this.getWorkspaceRoot();
            if (!workspaceRoot) {
                throw new Error(this.isSpanishLocale()
                    ? 'No hay una carpeta de trabajo abierta.'
                    : 'No workspace folder is open.');
            }

            const result = await indexAllWithChromaDb(workspaceRoot, chromaConfig);
            this.sessionManager.setRagIndexState({
                status: result.status,
                indexedAt: result.indexedAt,
                indexedFiles: result.indexedFiles
            });
        } catch (error) {
            console.error('[llama-chat] RAG indexing failed:', error);
            const message = error instanceof Error ? error.message : 'Unknown indexing error';
            vscode.window.showErrorMessage(`RAG indexing failed: ${message}`);
            this.sessionManager.setRagIndexState({
                ...previousState,
                status: 'idle'
            });
        } finally {
            this.isRagIndexing = false;
            this.postRagState(webviewView);
        }
    }

    private async generateLlamaResponse(
        userPrompt: string,
        filesMetadata: FileMetadata[],
        webviewView: vscode.WebviewView
    ): Promise<void> {
        try {
            this.currentAbortController = new AbortController();
            const abortSignal = this.currentAbortController.signal;

            const config = this.getLlamaConfig();
            const ragSnippets = await this.resolveRagContext(userPrompt, filesMetadata, abortSignal);
            this.throwIfAborted(abortSignal);
            const contextPrompt = buildPromptContext({
                userPrompt,
                attachedFiles: filesMetadata,
                ragSnippets
            });
            this.throwIfAborted(abortSignal);

            const startTime = performance.now();
            const session = this.sessionManager.getCurrentSession();
            const baseMessages = session ? [...session.messages] : [];

            const messagesForLlama = LlamaMessageBuilder.prepareMessagesForLlama(
                baseMessages as ChatMessage[],
                contextPrompt,
                config.systemPrompt
            );

            const result = await LlamaService.streamLlamaResponse(
                messagesForLlama,
                config,
                (token) => {
                    webviewView.webview.postMessage({
                        type: 'appendToken',
                        text: token
                    });
                },
                abortSignal
            );

            // Save assistant response to session
            const duration = LlamaService.calculateDuration(startTime);
            const assistantPayload = SessionPayloadBuilder.createAssistantMessagePayload(
                result.totalText,
                duration,
                result.tokenCount
            );
            this.sessionManager.addMessageToCurrentSession('assistant', assistantPayload);

            // Notify frontend of completion
            webviewView.webview.postMessage({
                type: 'endStreaming',
                time: duration,
                tokens: result.tokenCount,
                sessionTokens: this.sessionManager.getSessionTokenEstimate(),
                contextWindow: this.getContextWindow(),
                modelName: this.getModelName()
            });
        } catch (error: unknown) {
            this.handleGenerationError(error, webviewView);
        } finally {
            this.currentAbortController = null;
            this.isGenerationActive = false;
            this.pushActiveEditorContext(webviewView, vscode.window.activeTextEditor);
        }
    }

    private handleGenerationError(error: unknown, webviewView: vscode.WebviewView): void {
        if (error instanceof Error && error.name === 'AbortError') {
            webviewView.webview.postMessage({ type: 'stopStreaming' });
            return;
        }

        const errorMessage = error instanceof Error
            ? error.message
            : this.getLocalizedUnknownGenerationErrorLabel();
        webviewView.webview.postMessage({
            type: 'errorStreaming',
            text: `${this.getLocalizedErrorPrefix()}: ${errorMessage}`
        });
    }

    private getLocalizedErrorPrefix(): string {
        return 'Error';
    }

    private getLocalizedUnknownErrorLabel(): string {
        return this.isSpanishLocale() ? 'Error desconocido' : 'Unknown error';
    }

    private getLocalizedUnknownGenerationErrorLabel(): string {
        return this.isSpanishLocale()
            ? 'Error desconocido durante la generación'
            : 'Unknown error during generation';
    }

    private isSpanishLocale(): boolean {
        return vscode.env.language.toLowerCase().startsWith('es');
    }

    private setupEditorListeners(): void {
        const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(editor => {
            if (this._view) {
                this.pushActiveEditorContext(this._view, editor);
            }
        });
        this.context.subscriptions.push(activeEditorListener);

        const selectionListener = vscode.window.onDidChangeTextEditorSelection(event => {
            if (this._view) {
                this.pushActiveEditorContext(this._view, event.textEditor);
            }
        });
        this.context.subscriptions.push(selectionListener);
    }

    private setupConfigurationListener(): void {
        const configurationListener = vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (!event.affectsConfiguration('llamaChat')) {
                return;
            }

            await this.refreshServerProps();
            await this.refreshChromaAvailability();
            this.postRuntimeState();
        });
        this.context.subscriptions.push(configurationListener);
    }

    private pushActiveEditorContext(
        webviewView: vscode.WebviewView,
        editor: vscode.TextEditor | undefined
    ): void {
        sendActiveEditorContext(webviewView, editor, {
            isPickerOpen: this.isPickerOpen,
            isGenerationActive: this.isGenerationActive
        });
    }

    private collectFilesMetadata(
        attachedFiles: FileMetadata[]
    ): FileMetadata[] {
        return SessionPayloadBuilder.collectFilesMetadata(attachedFiles || []);
    }

    private getContextWindow(): number {
        return LlamaService.extractContextWindow(this.serverProps);
    }

    private getModelName(): string {
        return LlamaService.extractModelName(this.serverProps);
    }

    private saveUserMessageToSession(payload: UserMessagePayload): void {
        let currentSession = this.sessionManager.getCurrentSession();
        if (!currentSession) {
            currentSession = this.sessionManager.createSession(payload.text);
        }
        this.sessionManager.addMessageToCurrentSession('user', payload);
    }

    private getLlamaConfig(): LlamaConfig {
        const config = vscode.workspace.getConfiguration('llamaChat');
        const serverConfig = this.getServerLaunchConfig();
        return {
            apiUrl: buildChatApiUrl(serverConfig),
            temperature: config.get<number>('temperature') ?? 0.2,
            systemPrompt: config.get<string>('systemPrompt') || '',
            debug: config.get<boolean>('debug') ?? false
        };
    }

    private getServerLaunchConfig(): LlamaServerLaunchConfig {
        const config = vscode.workspace.getConfiguration('llamaChat');
        return {
            executablePath: config.get<string>('server.executablePath') || './build/bin/llama-server',
            modelPath: config.get<string>('server.modelPath') || './models/qwen2.5-coder-7b-instruct-q4_k_m.gguf',
            gpuLayers: config.get<number>('server.gpuLayers') ?? 99,
            contextSize: config.get<number>('server.contextSize') ?? 16384,
            flashAttention: config.get<boolean>('server.flashAttention') ?? true,
            host: config.get<string>('server.host') || '127.0.0.1',
            port: config.get<number>('server.port') ?? 8033,
            jinja: config.get<boolean>('server.jinja') ?? true,
            tools: config.get<string>('server.tools') || 'all'
        };
    }

    private getWorkspaceRoot(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || this._extensionUri.fsPath;
    }

    private getChromaDbConfig(): ChromaDbConnectionConfig {
        const config = vscode.workspace.getConfiguration('llamaChat');
        return {
            url: config.get<string>('rag.chromaUrl') || 'http://127.0.0.1',
            port: config.get<number>('rag.chromaPort') ?? 8000
        };
    }

    private async refreshServerProps(retries = 1, delayMs = 0): Promise<void> {
        const config = this.getLlamaConfig();

        for (let attempt = 0; attempt < retries; attempt++) {
            this.serverProps = await LlamaService.fetchServerProps(config.apiUrl);
            if (this.serverProps) {
                return;
            }

            if (attempt < retries - 1 && delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    private async refreshChromaAvailability(): Promise<void> {
        const chromaConfig = this.getChromaDbConfig();
        this.isChromaAvailable = await isChromaDbAvailable(chromaConfig);
    }

    private async resolveRagContext(
        userPrompt: string,
        filesMetadata: FileMetadata[],
        abortSignal?: AbortSignal
    ): Promise<RagContextSnippet[]> {
        const hasRepositoryAttachment = filesMetadata.some((file) => file.isRepository);
        if (!hasRepositoryAttachment) {
            return [];
        }

        this.throwIfAborted(abortSignal);

        const chromaConfig = this.getChromaDbConfig();
        const isAvailable = await isChromaDbAvailable(chromaConfig);
        this.isChromaAvailable = isAvailable;
        this.postRuntimeState();

        if (!isAvailable) {
            return [];
        }

        try {
            this.throwIfAborted(abortSignal);
            const results = await queryRelevantContextFromChromaDb(userPrompt, chromaConfig, 12, abortSignal);
            this.throwIfAborted(abortSignal);
            return results.map((result) => ({
                path: result.path,
                content: result.content,
                distance: result.distance
            }));
        } catch (error) {
            console.error('[llama-chat] RAG query failed:', error);
            return [];
        }
    }

    private throwIfAborted(abortSignal?: AbortSignal): void {
        if (abortSignal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
    }

    private postRuntimeState(webviewView?: vscode.WebviewView): void {
        const targetView = webviewView || this._view;
        if (!targetView) {
            return;
        }

        targetView.webview.postMessage({
            type: 'updateContextWindow',
            contextWindow: this.getContextWindow(),
            modelName: this.getModelName()
        });
        this.postServerState(targetView);
        this.postRagState(targetView);
    }

    private postServerState(webviewView: vscode.WebviewView): void {
        webviewView.webview.postMessage({
            type: 'updateServerState',
            isRunning: this.serverProps !== null,
            wasServerStartedByPlugin: this.wasServerStartedByPlugin,
            parameterRows: buildServerParameterRows(this.getServerLaunchConfig())
        });
    }

    private postRagState(webviewView: vscode.WebviewView): void {
        const ragState = this.sessionManager.getRagIndexState();
        const chromaConfig = this.getChromaDbConfig();
        webviewView.webview.postMessage({
            type: 'updateRagState',
            isIndexing: this.isRagIndexing || ragState.status === 'indexing',
            chromaAvailable: this.isChromaAvailable,
            status: ragState.status,
            indexedAt: ragState.indexedAt,
            indexedFiles: ragState.indexedFiles,
            chromaUrl: chromaConfig.url,
            chromaPort: chromaConfig.port
        });
    }

    private maybeLogMetrics(): void {
        const config = vscode.workspace.getConfiguration('llamaChat');
        const debugEnabled = config.get<boolean>('debug') ?? false;

        if (!debugEnabled || this.metrics.totalRequests === 0) {
            return;
        }

        if (this.metrics.totalRequests % 10 !== 0) {
            return;
        }

        const avgMs = this.metrics.totalDurationMs / this.metrics.totalRequests;
        console.log(
            `[llama-chat] metrics req=${this.metrics.totalRequests} err=${this.metrics.totalErrors} avgMs=${avgMs.toFixed(0)}`
        );
    }

    public dispose(): void {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }

        // Only stop server if plugin started it
        if (this.wasServerStartedByPlugin && this.serverProcess) {
            try {
                this.serverProcess.kill();
            } catch (error) {
                console.error('Error killing server process:', error);
            }
            this.serverProcess = null;
        }

        this.serverProps = null;
    }

}
