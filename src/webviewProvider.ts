import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SessionManager } from './chat/sessionManager';
import {
    SessionPayloadBuilder,
    FileMetadata,
    UserMessagePayload,
    AssistantMessagePayload
} from './chat/sessionPayloadBuilder';
import { LlamaService, ChatMessage, LlamaConfig, LlamaServerProps } from './llamacpp/llamaService';
import {
    buildChatApiUrl,
    buildServerLaunchCommand,
    buildServerParameterRows,
    LlamaServerLaunchConfig
} from './llamacpp/serverConfig';
import { sendActiveEditorContext } from './webview/editorContext';
import { openFilePicker } from './webview/filePicker';
import { getHtmlForWebview } from './webview/webviewResources';
import {
    ChromaDbConnectionConfig,
    ChromaConceptualKnnOptions,
    ChromaQueryMode,
    indexAllWithChromaDb,
    isChromaDbAvailable,
    queryRelevantContextFromChromaDbConceptualKnn,
    queryRelevantContextFromChromaDb
} from './chromadb/chromaDbIndexer';
import { WorkspaceDependencyGraphBuilder } from './chromadb/workspaceDependencyGraphBuilder';
import { buildPromptContext, RagContextSnippet } from './chat/promptContextBuilder';
import { PromptTemplateManager } from './chat/promptTemplateManager';
import { LlamaMessageBuilder } from './chat/llamaMessageBuilder';
import { EndpointFlowResolver } from './chat/endpointFlowResolver';
import { classifyUserIntent, QueryIntentType } from './chat/queryIntentClassifier';
import { Logger } from './logging/outputLogger';

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
    tab: 'chat' | 'settings' | 'about';
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
            return data.tab === 'chat' || data.tab === 'settings' || data.tab === 'about';
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
    private generationLock: Promise<void> = Promise.resolve();
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
        private readonly sessionManager: SessionManager,
        private readonly logger: Logger
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
                    this.logger.warn('webview', 'Ignored invalid webview message payload');
                    return;
                }

                await this.routeMessage(data, webviewView);
            } catch (error) {
                this.logger.error('webview', 'Error handling message', error);
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
            activeScreens: uiState.activeScreens,
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
        this.generationLock = this.generationLock.catch(() => undefined).then(async () => {
            if (this.currentAbortController) {
                this.currentAbortController.abort();
                this.currentAbortController = null;
            }

            this.isGenerationActive = true;
            this.metrics.totalRequests += 1;

            const generationStart = performance.now();
            try {
                const userPrompt = data.value;
                const queryIntent = classifyUserIntent(userPrompt);
                const shouldRunStructuredFlow = queryIntent === QueryIntentType.STRUCTURED_FOCUSED;

                let endpointFlow: string[] = [];
                let promptWithEndpointFlow = userPrompt;

                if (shouldRunStructuredFlow) {
                    const endpointFlowResolver = new EndpointFlowResolver(this.getProjectGraphCacheRoot());
                    endpointFlow = await endpointFlowResolver.resolveFlowFromPrompt(userPrompt);
                    promptWithEndpointFlow = this.buildPromptWithEndpointFlow(userPrompt, endpointFlow);
                }

                const filesMetadata = this.collectFilesMetadata(data.attachedFiles || []);

                const userPayload = SessionPayloadBuilder.createUserMessagePayload(userPrompt, filesMetadata);
                this.saveUserMessageToSession(userPayload);

                webviewView.webview.postMessage({
                    type: 'addMessage',
                    role: 'user',
                    text: userPrompt,
                    filesMetadata: filesMetadata
                });
                webviewView.webview.postMessage({ type: 'startStreaming' });

                await this.generateLlamaResponse(
                    promptWithEndpointFlow,
                    filesMetadata,
                    webviewView,
                    endpointFlow,
                    shouldRunStructuredFlow
                );
            } catch (error: unknown) {
                this.metrics.totalErrors += 1;
                this.logger.error('llama', 'Error in askLlama flow', error);
                if (error instanceof Error && error.name === 'AbortError') {
                    webviewView.webview.postMessage({ type: 'stopStreaming' });
                } else {
                    const errorMessage = error instanceof Error
                        ? error.message
                        : this.getUnknownErrorLabel();
                    webviewView.webview.postMessage({
                        type: 'errorStreaming',
                        text: `${this.getErrorPrefix()}: ${errorMessage}`
                    });
                }
            } finally {
                this.isGenerationActive = false;
                this.metrics.totalDurationMs += (performance.now() - generationStart);
                this.maybeLogMetrics();
                this.pushActiveEditorContext(webviewView, vscode.window.activeTextEditor);
            }
        });

        await this.generationLock;
    }

    private buildPromptWithEndpointFlow(userPrompt: string, endpointFlow: string[]): string {
        if (endpointFlow.length === 0) {
            return userPrompt;
        }

        const flowLines = endpointFlow.map((filePath, index) => `${index + 1}. ${filePath}`).join('\n');
        return [
            'Detected endpoint call flow:',
            flowLines,
            '',
            userPrompt
        ].join('\n');
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

        this.logger.info('rag', 'Starting repository indexing');

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
                throw new Error('No workspace folder is open.');
            }

            const chromaConfig = this.getChromaDbConfig();
            const cacheRoot = this.getProjectGraphCacheRoot();
            const graphBuilder = new WorkspaceDependencyGraphBuilder(workspaceRoot, chromaConfig, cacheRoot);
            await graphBuilder.build();

            this.isChromaAvailable = await isChromaDbAvailable(chromaConfig);
            if (!this.isChromaAvailable) {
                this.logger.warn('rag', 'Skipping indexing because ChromaDB is unavailable');
                this.sessionManager.setRagIndexState({
                    ...previousState,
                    status: 'idle'
                });
                return;
            }

            const result = await indexAllWithChromaDb(workspaceRoot, chromaConfig);
            this.logger.info('rag', 'Repository indexing completed', {
                indexedAt: result.indexedAt,
                indexedFiles: result.indexedFiles
            });
            this.sessionManager.setRagIndexState({
                status: result.status,
                indexedAt: result.indexedAt,
                indexedFiles: result.indexedFiles
            });
        } catch (error) {
            this.logger.error('rag', 'RAG indexing failed', error);
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
        webviewView: vscode.WebviewView,
        endpointFlowPaths: string[] = [],
        shouldRunStructuredFlow = false
    ): Promise<void> {
        try {
            this.currentAbortController = new AbortController();
            const abortSignal = this.currentAbortController.signal;

            const config = this.getLlamaConfig();
            const ragSnippets = await this.resolveRagContext(
                userPrompt,
                filesMetadata,
                abortSignal,
                endpointFlowPaths,
                shouldRunStructuredFlow
            );
            this.throwIfAborted(abortSignal);
            const hasRepositoryAttachment = filesMetadata.some((file) => file.isRepository) || !this.hasManualAttachments(filesMetadata);
            const ragModeTemplate = PromptTemplateManager.getRagModeTemplate();
            const specificFilesModeTemplate = PromptTemplateManager.getSpecificFilesModeTemplate();
            const contextPrompt = buildPromptContext({
                userPrompt,
                attachedFiles: filesMetadata,
                ragSnippets,
                hasRepositoryAttachment,
                ragModeTemplate,
                specificFilesModeTemplate
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

            const duration = LlamaService.calculateDuration(startTime);
            const assistantPayload = SessionPayloadBuilder.createAssistantMessagePayload(
                result.totalText,
                duration,
                result.tokenCount
            );
            this.sessionManager.addMessageToCurrentSession('assistant', assistantPayload);

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
            : this.getUnknownGenerationErrorLabel();
        webviewView.webview.postMessage({
            type: 'errorStreaming',
            text: `${this.getErrorPrefix()}: ${errorMessage}`
        });
    }

    private getErrorPrefix(): string {
        return 'Error';
    }

    private getUnknownErrorLabel(): string {
        return 'Unknown error';
    }

    private getUnknownGenerationErrorLabel(): string {
        return 'Unknown error during generation';
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

    private hasManualAttachments(filesMetadata: FileMetadata[]): boolean {
        return filesMetadata.some((file) => !file.isAutomatic);
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
            model: this.getConfigValue(config, 'chat.model', 'model', 'local'),
            maxTokens: this.getConfigValue(config, 'chat.maxTokens', 'maxTokens', 2048),
            temperature: this.getConfigValue(config, 'chat.temperature', 'temperature', 0.2),
            systemPrompt: this.getConfigValue(config, 'chat.systemPrompt', 'systemPrompt', ''),
            debug: this.getConfigValue(config, 'chat.debug', 'debug', false)
        };
    }

    private getServerLaunchConfig(): LlamaServerLaunchConfig {
        const config = vscode.workspace.getConfiguration('llamaChat');
        return {
            executablePath: this.getConfigValue(config, 'llamaCpp.executablePath', 'server.executablePath', './build/bin/llama-server'),
            modelPath: this.getConfigValue(config, 'llamaCpp.modelPath', 'server.modelPath', './models/qwen2.5-coder-7b-instruct-q4_k_m.gguf'),
            gpuLayers: this.getConfigValue(config, 'llamaCpp.gpuLayers', 'server.gpuLayers', 99),
            contextSize: this.getConfigValue(config, 'llamaCpp.contextSize', 'server.contextSize', 16384),
            flashAttention: this.getConfigValue(config, 'llamaCpp.flashAttention', 'server.flashAttention', true),
            host: this.getConfigValue(config, 'llamaCpp.host', 'server.host', '127.0.0.1'),
            port: this.getConfigValue(config, 'llamaCpp.port', 'server.port', 8033),
            chatCompletionsPath: this.getConfigValue(config, 'llamaCpp.chatCompletionsPath', 'server.chatCompletionsPath', '/v1/chat/completions'),
            jinja: this.getConfigValue(config, 'llamaCpp.jinja', 'server.jinja', true),
            tools: this.getConfigValue(config, 'llamaCpp.tools', 'server.tools', 'all')
        };
    }

    private getWorkspaceRoot(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || this._extensionUri.fsPath;
    }

    private getProjectGraphCacheRoot(): string {
        const workspaceRoot = this.getWorkspaceRoot() || this.context.globalStorageUri.fsPath;
        return path.join(workspaceRoot, '.prrrrr');
    }

    private getChromaDbConfig(): ChromaDbConnectionConfig {
        const config = vscode.workspace.getConfiguration('llamaChat');
        return {
            url: this.getConfigValue(config, 'chromaDb.url', 'rag.chromaUrl', 'http://127.0.0.1'),
            port: this.getConfigValue(config, 'chromaDb.port', 'rag.chromaPort', 8000),
            collectionPrefix: this.getConfigValue(config, 'chromaDb.collectionPrefix', 'rag.collectionPrefix', 'llama-chat-ephemeral'),
            excludeDirs: this.getConfigValue(config, 'chromaDb.excludeDirs', 'rag.excludeDirs', [
                '.git',
                '.gradle',
                '.idea',
                'node_modules',
                'dist',
                'out',
                'build',
                'coverage',
                'target',
                '.vscode'
            ]),
            excludeFileGlobs: this.getConfigValue(config, 'chromaDb.excludeFileGlobs', 'rag.excludeFileGlobs', [
                '**/*.bin',
                '**/*.class',
                '**/*.jar',
                '**/*.lock'
            ]),
            maxFileSizeKb: this.getConfigValue(config, 'chromaDb.maxFileSizeKb', 'rag.maxFileSizeKb', 512),
            maxIndexedFiles: this.getConfigValue(config, 'chromaDb.maxIndexedFiles', 'rag.maxIndexedFiles', 2000),
            chunkSizeChars: this.getConfigValue(config, 'chromaDb.chunkSizeChars', 'rag.chunkSizeChars', 2000),
            chunkOverlapChars: this.getConfigValue(config, 'chromaDb.chunkOverlapChars', 'rag.chunkOverlapChars', 300),
            vectorCandidatePool: this.getConfigValue(config, 'chromaDb.vectorCandidatePool', 'rag.vectorCandidatePool', 50),
            maxQueryResults: this.getConfigValue(config, 'chromaDb.maxQueryResults', 'rag.maxQueryResults', 12),
            minCosineSimilarity: this.getConfigValue(config, 'chromaDb.minCosineSimilarity', 'rag.minCosineSimilarity', 0.2)
        };
    }

    private getChromaQueryMode(): ChromaQueryMode {
        const config = vscode.workspace.getConfiguration('llamaChat');
        const mode = this.getConfigValue<string>(config, 'chromaDb.queryMode', 'rag.queryMode', 'semantic');
        return mode === 'lexical' ? 'lexical' : 'semantic';
    }

    private getConfigValue<T>(
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
        abortSignal?: AbortSignal,
        endpointFlowPaths?: string[],
        shouldRunStructuredFlow = false
    ): Promise<RagContextSnippet[]> {
        const hasRepositoryAttachment = filesMetadata.some((file) => file.isRepository);
        const hasManualAttachments = this.hasManualAttachments(filesMetadata);
        const shouldUseRepositoryScope = hasRepositoryAttachment || !hasManualAttachments;

        if (!shouldUseRepositoryScope) {
            return [];
        }

        this.logger.debug('rag', 'Resolving repository context', {
            structured: shouldRunStructuredFlow,
            endpointFlowPaths: endpointFlowPaths?.length ?? 0
        });

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
            let results: Array<{ path: string; content: string; distance?: number }> = [];
            if (shouldRunStructuredFlow) {
                const queryMode = this.getChromaQueryMode();
                results = await queryRelevantContextFromChromaDb(
                    userPrompt,
                    chromaConfig,
                    chromaConfig.maxQueryResults,
                    queryMode,
                    abortSignal,
                    endpointFlowPaths
                );

                if (results.length === 0 && queryMode !== 'semantic') {
                    results = await queryRelevantContextFromChromaDb(
                        userPrompt,
                        chromaConfig,
                        chromaConfig.maxQueryResults,
                        'semantic',
                        abortSignal,
                        endpointFlowPaths
                    );
                }

                if (results.length === 0 && queryMode !== 'lexical') {
                    results = await queryRelevantContextFromChromaDb(
                        userPrompt,
                        chromaConfig,
                        chromaConfig.maxQueryResults,
                        'lexical',
                        abortSignal,
                        endpointFlowPaths
                    );
                }

                if (results.length === 0 && endpointFlowPaths && endpointFlowPaths.length > 0) {
                    results = await queryRelevantContextFromChromaDb(
                        userPrompt,
                        chromaConfig,
                        chromaConfig.maxQueryResults,
                        queryMode,
                        abortSignal
                    );
                }
            } else {
                const conceptualOptions: ChromaConceptualKnnOptions = {
                    topK: chromaConfig.maxQueryResults,
                    minCosineSimilarity: chromaConfig.minCosineSimilarity,
                    signal: abortSignal
                };
                results = await queryRelevantContextFromChromaDbConceptualKnn(
                    userPrompt,
                    chromaConfig,
                    conceptualOptions
                );

                if (results.length === 0 && chromaConfig.minCosineSimilarity > 0) {
                    results = await queryRelevantContextFromChromaDbConceptualKnn(
                        userPrompt,
                        chromaConfig,
                        {
                            ...conceptualOptions,
                            minCosineSimilarity: 0
                        }
                    );
                }

                if (results.length === 0) {
                    results = await queryRelevantContextFromChromaDb(
                        userPrompt,
                        chromaConfig,
                        chromaConfig.maxQueryResults,
                        'semantic',
                        abortSignal
                    );
                }

                if (results.length === 0) {
                    results = await queryRelevantContextFromChromaDb(
                        userPrompt,
                        chromaConfig,
                        chromaConfig.maxQueryResults,
                        'lexical',
                        abortSignal
                    );
                }
            }

            this.logger.debug('rag', 'RAG retrieval completed', {
                structured: shouldRunStructuredFlow,
                results: results.length
            });

            this.throwIfAborted(abortSignal);
            return results.map((result) => ({
                path: result.path,
                content: result.content,
                distance: result.distance
            }));
        } catch (error) {
            this.logger.error('rag', 'RAG query failed', error);
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
        const queryMode = this.getChromaQueryMode();
        webviewView.webview.postMessage({
            type: 'updateRagState',
            isIndexing: this.isRagIndexing || ragState.status === 'indexing',
            chromaAvailable: this.isChromaAvailable,
            status: ragState.status,
            chromaUrl: chromaConfig.url,
            chromaPort: chromaConfig.port,
            chromaCollectionPrefix: chromaConfig.collectionPrefix,
            chromaExcludeDirs: chromaConfig.excludeDirs.join(', '),
            chromaExcludeFileGlobs: chromaConfig.excludeFileGlobs.join(', '),
            chromaMaxFileSizeKb: chromaConfig.maxFileSizeKb,
            chromaMaxIndexedFiles: chromaConfig.maxIndexedFiles,
            chromaChunkSizeChars: chromaConfig.chunkSizeChars,
            chromaChunkOverlapChars: chromaConfig.chunkOverlapChars,
            chromaVectorCandidatePool: chromaConfig.vectorCandidatePool,
            chromaMaxQueryResults: chromaConfig.maxQueryResults,
            chromaMinCosineSimilarity: chromaConfig.minCosineSimilarity,
            chromaQueryMode: queryMode
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
        this.logger.debug('metrics', 'Request metrics snapshot', {
            requests: this.metrics.totalRequests,
            errors: this.metrics.totalErrors,
            avgMs: Number(avgMs.toFixed(0))
        });
    }

    public dispose(): void {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }

        if (this.wasServerStartedByPlugin && this.serverProcess) {
            try {
                this.serverProcess.kill();
            } catch (error) {
                this.logger.error('server', 'Error killing server process', error);
            }
            this.serverProcess = null;
        }

        this.serverProps = null;
    }

}
