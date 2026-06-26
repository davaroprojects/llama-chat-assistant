import * as vscode from 'vscode';
import { SesionGateway } from './core/gateways/sesionGateway';
import {
    SessionPayloadBuilder,
} from './helpers/sessionPayloadBuilder';
import { FileMetadata, UserMessagePayload } from './core/model/sessionPayload';
import { LlamaServerProps } from './core/model/llama';
import { LlamaAdapter } from './adapters/llama/llamaAdapter';
import {
    buildServerLaunchCommand,
    buildEmbeddingsServerLaunchCommand,
    buildEmbeddingsServerParameterRows,
    buildServerParameterRows,
} from './adapters/llama/llamaServerConfig';
import { LlamaEmbeddingsServerLaunchConfig, LlamaServerLaunchConfig } from './core/model/llamaServer';
import { sendActiveEditorContext } from './webview/editorContext';
import { openFilePicker } from './webview/filePicker';
import { getHtmlForWebview } from './webview/webviewResources';
import {
    ChromaAdapter
} from './adapters/chroma/chromaAdapter';
import { ChromaDbConnectionConfig } from './core/model/chroma';
import { Logger } from './adapters/vscode/outputLogger';
import { RagGateway } from './core/gateways/ragGateway';
import { LlamaGateway } from './core/gateways/llamaGateway';
import { GenerateAssistantReplyUseCase } from './core/usecases/generateAssistantReplyUseCase';
import {
    readLlamaEmbeddingsRuntimeConfig,
    readLlamaEmbeddingsServerLaunchConfig,
    readLlamaRuntimeConfig,
    readLlamaServerLaunchConfig,
    readStartupDelayMs,
    readStartupRetries
} from './adapters/llama/llamaConfig';
import { createWorkspaceCollectionId, readChromaDbConfig } from './adapters/chroma/chromaConfig';
import { IndexWorkspaceUseCase } from './core/usecases/indexWorkspaceUseCase';
import { ChunkProviderGateway } from './core/gateways/chunkProviderGateway';
import { VectorIndexGateway } from './core/gateways/vectorIndexGateway';
import { LlamaEmbeddingsAdapter } from './adapters/llama/llamaEmbeddingsAdapter';
import {
    ManagedServerType,
    StartedServerProcess
} from './core/gateways/serverLifecycleGateway';
import { StartLlamaServerUseCase } from './core/usecases/startLlamaServerUseCase';
import { LlamaServerLifecycleAdapter } from './adapters/llama/llamaServerLifecycleAdapter';

interface BaseWebviewMessage {
    type: string;
}

interface AskLlamaMessage extends BaseWebviewMessage {
    type: 'askLlama';
    value: string;
    attachedFiles?: FileMetadata[];
    ragEnabled?: boolean;
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

interface SetSettingsAccordionStateMessage extends BaseWebviewMessage {
    type: 'setSettingsAccordionState';
    state: {
        llamaOpen: boolean;
        embeddingsOpen: boolean;
        chromadbOpen: boolean;
    };
}

type IncomingWebviewMessage =
    | AskLlamaMessage
    | SelectSessionMessage
    | DeleteSessionMessage
    | ApplyCodeMessage
    | SetActiveTabMessage
    | SetSettingsAccordionStateMessage
    | { type: 'webviewReady' }
    | { type: 'stopGeneration' }
    | { type: 'startServer' }
    | { type: 'stopServer' }
    | { type: 'startEmbeddingsServer' }
    | { type: 'stopEmbeddingsServer' }
    | { type: 'openFilePicker' }
    | { type: 'requestSessionsUpdate' }
    | { type: 'requestActiveEditorRefresh' }
    | { type: 'indexAll' };

interface RuntimeMetrics {
    totalRequests: number;
    totalErrors: number;
    totalDurationMs: number;
}

interface ServerNode {
    process: StartedServerProcess | null;
    props: LlamaServerProps | null;
    startedByPlugin: boolean;
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
        case 'startEmbeddingsServer':
        case 'stopEmbeddingsServer':
        case 'openFilePicker':
        case 'requestSessionsUpdate':
        case 'requestActiveEditorRefresh':
        case 'indexAll':
            return true;
        case 'setActiveTab':
            return data.tab === 'chat' || data.tab === 'settings' || data.tab === 'about';
        case 'setSettingsAccordionState':
            return isRecord(data.state)
                && typeof data.state.llamaOpen === 'boolean'
                && typeof data.state.embeddingsOpen === 'boolean'
                && typeof data.state.chromadbOpen === 'boolean';
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
            return (data.attachedFiles === undefined || isFileMetadataArray(data.attachedFiles))
                && (data.ragEnabled === undefined || typeof data.ragEnabled === 'boolean');
        default:
            return false;
    }
}

export class LaLlamaChatViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    private currentAbortController: AbortController | null = null;
    private generationLock: Promise<void> = Promise.resolve();
    private _view?: vscode.WebviewView;
    private isPickerOpen = false;
    private isGenerationActive = false;
    private serverNodes: Record<ManagedServerType, ServerNode> = {
        chat: { process: null, props: null, startedByPlugin: false },
        embeddings: { process: null, props: null, startedByPlugin: false }
    };
    private hasLoadedInitialServerStatus = false;
    private isRagIndexing = false;
    private isChromaAvailable = false;
    private readonly metrics: RuntimeMetrics = {
        totalRequests: 0,
        totalErrors: 0,
        totalDurationMs: 0
    };
    private readonly ragGateway: RagGateway;
    private readonly chunkProviderGateway: ChunkProviderGateway;
    private readonly vectorIndexGateway: VectorIndexGateway;
    private readonly llamaGateway: LlamaGateway;
    private readonly generateAssistantReplyUseCase: GenerateAssistantReplyUseCase;
    private readonly indexWorkspaceUseCase: IndexWorkspaceUseCase;
    private readonly startLlamaServerUseCase: StartLlamaServerUseCase;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly context: vscode.ExtensionContext,
        private readonly sessionManager: SesionGateway,
        private readonly logger: Logger
    ) {
        const embeddingsAdapter = new LlamaEmbeddingsAdapter(() => this.getLlamaEmbeddingsConfig());
        const chromaIndexer = new ChromaAdapter(embeddingsAdapter, this.logger);
        this.ragGateway = chromaIndexer;
        this.chunkProviderGateway = chromaIndexer;
        this.vectorIndexGateway = chromaIndexer;
        this.llamaGateway = new LlamaAdapter();
        this.generateAssistantReplyUseCase = new GenerateAssistantReplyUseCase(
            this.ragGateway,
            this.llamaGateway,
            this.logger
        );
        this.indexWorkspaceUseCase = new IndexWorkspaceUseCase(
            this.chunkProviderGateway,
            embeddingsAdapter,
            this.vectorIndexGateway,
            this.ragGateway,
            this.logger
        );

        this.startLlamaServerUseCase = new StartLlamaServerUseCase(
            new LlamaServerLifecycleAdapter(this.logger)
        );
    }

    private getNode(name: ManagedServerType): ServerNode {
        return this.serverNodes[name];
    }

    private getNodeEntries(): Array<[ManagedServerType, ServerNode]> {
        return [
            ['chat', this.serverNodes.chat],
            ['embeddings', this.serverNodes.embeddings]
        ];
    }

    private setNode(name: ManagedServerType, nextNode: ServerNode): void {
        this.serverNodes = {
            ...this.serverNodes,
            [name]: nextNode
        };
    }

    private patchNode(name: ManagedServerType, patch: Partial<ServerNode>): void {
        this.setNode(name, {
            ...this.getNode(name),
            ...patch
        });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
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
            case 'startEmbeddingsServer':
                await this.handleStartEmbeddingsServer(webviewView);
                break;
            case 'stopEmbeddingsServer':
                this.handleStopEmbeddingsServer();
                break;
            case 'openFilePicker':
                await this.handleOpenFilePicker(webviewView);
                break;
            case 'selectSession':
                this.handleSelectSession(data, webviewView);
                break;
            case 'setActiveTab':
                this.logger.info('webview', 'Persisting active tab from webview', {
                    activeTab: data.tab
                });
                this.sessionManager.setActiveTab(data.tab);
                break;
            case 'setSettingsAccordionState':
                this.sessionManager.setSettingsAccordionState(data.state);
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
        await this.ensureInitialServerStatusLoaded();
        await this.refreshChromaAvailability();
        const initialSessions = this.sessionManager.getAllSessions();
        const uiState = this.sessionManager.getUiState();
        const activeSession = this.sessionManager.getCurrentSession();

        this.logger.info('webview', 'Restoring webview state', {
            activeTab: uiState.activeTab,
            activeScreens: uiState.activeScreens,
            hasActiveSession: !!uiState.currentSessionId,
            sessionCount: initialSessions.length
        });

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
            settingsAccordionState: uiState.settingsAccordionState,
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
        await this.handleStartManagedServer('chat', webviewView);
    }

    private handleStopServer(): void {
        this.handleStopManagedServer('chat');
    }

    private async handleStartEmbeddingsServer(webviewView: vscode.WebviewView): Promise<void> {
        await this.handleStartManagedServer('embeddings', webviewView);
    }

    private handleStopEmbeddingsServer(): void {
        this.handleStopManagedServer('embeddings');
    }

    private async handleStartManagedServer(serverType: ManagedServerType, webviewView: vscode.WebviewView): Promise<void> {
        const node = this.getNode(serverType);
        if (node.process) {
            this.logger.info('server', 'Start request ignored because process is already running', {
                serverType
            });
            return;
        }

        this.logger.info('server', 'Start request received', {
            serverType,
            workspaceRoot: this.getWorkspaceRoot(),
            chatApiUrl: this.getLlamaConfig().apiUrl,
            embeddingsApiUrl: this.getLlamaEmbeddingsConfig().apiUrl
        });

        try {
            const startResult = await this.startLlamaServerUseCase.execute({
                serverType,
                workspaceRoot: this.getWorkspaceRoot(),
                chatLaunchConfig: this.getServerLaunchConfig(),
                embeddingsLaunchConfig: this.getEmbeddingsServerLaunchConfig(),
                chatApiUrl: this.getLlamaConfig().apiUrl,
                embeddingsApiUrl: this.getLlamaEmbeddingsConfig().apiUrl,
                startupDelayMs: readStartupDelayMs(),
                startupRetries: readStartupRetries(),
                startupRetryDelayMs: 1000
            });

            this.patchNode(serverType, {
                process: startResult.process,
                props: startResult.props,
                startedByPlugin: startResult.startedByPlugin
            });

            this.logger.info('server', 'Server start flow completed', {
                serverType,
                propsAvailable: startResult.props !== null,
                startedByPlugin: startResult.startedByPlugin
            });

            startResult.process.onExit(() => {
                this.patchNode(serverType, {
                    process: null,
                    props: null,
                    startedByPlugin: false
                });
                this.postRuntimeState();
            });

            startResult.process.onError((error) => {
                this.patchNode(serverType, {
                    process: null,
                    props: null,
                    startedByPlugin: false
                });
                const serverLabel = serverType === 'chat' ? 'llama-server' : 'llama embeddings server';
                vscode.window.showErrorMessage(`Failed to start ${serverLabel}: ${error.message}`);
                this.postRuntimeState();
            });

            this.postRuntimeState();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const serverLabel = serverType === 'chat' ? 'llama-server' : 'llama embeddings server';
            this.logger.error('server', 'Server start flow failed', {
                serverType,
                errorMessage
            });
            vscode.window.showErrorMessage(`Failed to start ${serverLabel}: ${errorMessage}`);
            this.patchNode(serverType, {
                process: null,
                props: null,
                startedByPlugin: false
            });
            this.postRuntimeState(webviewView);
        }
    }

    private handleStopManagedServer(serverType: ManagedServerType): void {
        const node = this.getNode(serverType);
        if (!node.process) {
            this.logger.info('server', 'Stop request received without active process', {
                serverType
            });
            this.patchNode(serverType, {
                props: null,
                startedByPlugin: false
            });
            this.postRuntimeState();
            return;
        }

        try {
            node.process.stop();
            this.logger.info('server', 'Stop signal sent to process', { serverType });
        } catch (error) {
            this.logger.error('server', `Error stopping ${serverType} server`, error);
        }

        this.patchNode(serverType, {
            process: null,
            props: null,
            startedByPlugin: false
        });
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
        if (!this.getNode('chat').props) {
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
                const ragEnabled = !!data.ragEnabled;
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
                    userPrompt,
                    filesMetadata,
                    webviewView,
                    ragEnabled
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
        if (!this.getNode('chat').props) {
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

        this.isRagIndexing = true;
        const previousState = this.sessionManager.getRagIndexState();
        const workspaceRoot = this.getWorkspaceRoot() || this.context.globalStorageUri.fsPath;
        const collectionId = createWorkspaceCollectionId(workspaceRoot);
        this.sessionManager.setRagIndexState({
            ...previousState,
            status: 'indexing',
            indexedAt: null,
            indexedFiles: 0,
            collectionId
        });
        this.postRagState(webviewView);

        try {
            const resolvedWorkspaceRoot = this.getWorkspaceRoot();
            if (!resolvedWorkspaceRoot) {
                throw new Error('No workspace folder is open.');
            }

            const chromaConfig = this.getChromaDbConfig(collectionId, previousState.collectionId);
            const useCaseResult = await this.indexWorkspaceUseCase.execute({
                workspaceRoot: resolvedWorkspaceRoot,
                chromaConfig
            });

            this.isChromaAvailable = useCaseResult.availability;
            if (!useCaseResult.availability || !useCaseResult.result) {
                this.sessionManager.setRagIndexState({
                    status: 'idle',
                    indexedAt: null,
                    indexedFiles: 0,
                    collectionId
                });
                return;
            }

            this.sessionManager.setRagIndexState({
                status: useCaseResult.result.status,
                indexedAt: useCaseResult.result.indexedAt,
                indexedFiles: useCaseResult.result.indexedFiles,
                collectionId: useCaseResult.result.collectionId
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown indexing error';
            const stack = error instanceof Error ? error.stack : undefined;
            this.logger.error('rag', 'RAG indexing failed', {
                error: message,
                stack,
                workspaceRoot: this.getWorkspaceRoot()
            });
            vscode.window.showErrorMessage(`RAG indexing failed: ${message}`);
            this.sessionManager.setRagIndexState({
                status: 'idle',
                indexedAt: null,
                indexedFiles: 0,
                collectionId
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
        ragEnabled: boolean
    ): Promise<void> {
        try {
            this.currentAbortController = new AbortController();
            const abortSignal = this.currentAbortController.signal;
            const session = this.sessionManager.getCurrentSession();
            const baseMessages = session ? [...session.messages] : [];

            const result = await this.generateAssistantReplyUseCase.execute({
                userPrompt,
                filesMetadata,
                baseMessages,
                ragEnabled,
                abortSignal,
                llamaConfig: this.getLlamaConfig(),
                chromaConfig: this.getChromaDbConfig(),
                onToken: (token) => {
                    webviewView.webview.postMessage({
                        type: 'appendToken',
                        text: token
                    });
                }
            });

            this.isChromaAvailable = await this.ragGateway.isAvailable(this.getChromaDbConfig());
            this.postRuntimeState(webviewView);

            const assistantPayload = SessionPayloadBuilder.createAssistantMessagePayload(
                result.totalText,
                result.durationSeconds,
                result.tokenCount,
                result.references || []
            );
            this.sessionManager.addMessageToCurrentSession('assistant', assistantPayload);

            webviewView.webview.postMessage({
                type: 'endStreaming',
                time: result.durationSeconds,
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
            if (!event.affectsConfiguration('laLlamaChat')) {
                return;
            }

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
        return LlamaAdapter.extractContextWindow(this.getNode('chat').props);
    }

    private getModelName(): string {
        return LlamaAdapter.extractModelName(this.getNode('chat').props);
    }

    private saveUserMessageToSession(payload: UserMessagePayload): void {
        let currentSession = this.sessionManager.getCurrentSession();
        if (!currentSession) {
            currentSession = this.sessionManager.createSession(payload.text);
        }
        this.sessionManager.addMessageToCurrentSession('user', payload);
    }

    private getServerLaunchConfig(): LlamaServerLaunchConfig {
        return readLlamaServerLaunchConfig();
    }

    private getLlamaConfig() {
        return readLlamaRuntimeConfig(this.getServerLaunchConfig());
    }

    private getEmbeddingsServerLaunchConfig(): LlamaEmbeddingsServerLaunchConfig {
        return readLlamaEmbeddingsServerLaunchConfig();
    }

    private getLlamaEmbeddingsConfig() {
        return readLlamaEmbeddingsRuntimeConfig(this.getEmbeddingsServerLaunchConfig());
    }

    private getWorkspaceRoot(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || this._extensionUri.fsPath;
    }

    private getChromaDbConfig(collectionId?: string | null, previousCollectionId?: string | null): ChromaDbConnectionConfig {
        const ragState = this.sessionManager.getRagIndexState();
        const workspaceRoot = this.getWorkspaceRoot() || this.context.globalStorageUri.fsPath;
        return readChromaDbConfig(
            workspaceRoot,
            collectionId ?? ragState.collectionId,
            previousCollectionId ?? null
        );
    }

    private async ensureInitialServerStatusLoaded(): Promise<void> {
        if (this.hasLoadedInitialServerStatus) {
            return;
        }

        await Promise.all([
            this.refreshNodeProps('chat'),
            this.refreshNodeProps('embeddings')
        ]);
        this.hasLoadedInitialServerStatus = true;
    }

    private async refreshNodeProps(serverType: ManagedServerType, retries = 1, delayMs = 0): Promise<void> {
        const apiUrl = serverType === 'chat'
            ? this.getLlamaConfig().apiUrl
            : this.getLlamaEmbeddingsConfig().apiUrl;

        for (let attempt = 0; attempt < retries; attempt++) {
            const props = await LlamaAdapter.fetchServerProps(apiUrl);
            this.patchNode(serverType, { props });
            if (props) {
                return;
            }
            if (attempt < retries - 1 && delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    private async refreshChromaAvailability(): Promise<void> {
        const chromaConfig = this.getChromaDbConfig();
        this.isChromaAvailable = await this.ragGateway.isAvailable(chromaConfig);
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
        const chatNode = this.getNode('chat');
        const launchConfig = this.getServerLaunchConfig();
        const launchCommand = buildServerLaunchCommand(launchConfig, this.getWorkspaceRoot());
        const commandLine = [launchCommand.command, ...launchCommand.args].join(' ');

        this.logger.info('server.webview', 'Posting chat server state to webview', {
            isRunning: chatNode.process !== null || chatNode.props !== null,
            hasProcess: chatNode.process !== null,
            hasProps: chatNode.props !== null,
            startedByPlugin: chatNode.startedByPlugin,
            commandLine
        });

        webviewView.webview.postMessage({
            type: 'updateServerState',
            isRunning: chatNode.process !== null || chatNode.props !== null,
            wasServerStartedByPlugin: chatNode.startedByPlugin,
            parameterRows: buildServerParameterRows(launchConfig),
            commandLine
        });

        const embeddingsNode = this.getNode('embeddings');
        const embeddingsLaunchConfig = this.getEmbeddingsServerLaunchConfig();
        const embeddingsCommand = buildEmbeddingsServerLaunchCommand(embeddingsLaunchConfig, this.getWorkspaceRoot());
        const embeddingsCommandLine = [embeddingsCommand.command, ...embeddingsCommand.args].join(' ');

        this.logger.info('server.webview', 'Posting embeddings server state to webview', {
            isRunning: embeddingsNode.process !== null || embeddingsNode.props !== null,
            hasProcess: embeddingsNode.process !== null,
            hasProps: embeddingsNode.props !== null,
            startedByPlugin: embeddingsNode.startedByPlugin,
            commandLine: embeddingsCommandLine
        });

        webviewView.webview.postMessage({
            type: 'updateEmbeddingsServerState',
            isRunning: embeddingsNode.process !== null || embeddingsNode.props !== null,
            wasServerStartedByPlugin: embeddingsNode.startedByPlugin,
            parameterRows: buildEmbeddingsServerParameterRows(embeddingsLaunchConfig),
            commandLine: embeddingsCommandLine
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
            chromaPort: chromaConfig.port,
            chromaCollectionId: ragState.collectionId,
            chromaMinCosineSimilarity: chromaConfig.minCosineSimilarity
        });
    }

    private maybeLogMetrics(): void {
        const config = vscode.workspace.getConfiguration('laLlamaChat');
        const debugEnabled = config.get<boolean>('chat.debug') ?? config.get<boolean>('debug') ?? false;

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

        for (const [serverType, node] of this.getNodeEntries()) {
            if (node.startedByPlugin && node.process) {
                try {
                    node.process.stop();
                } catch (error) {
                    this.logger.error('server', `Error stopping ${serverType} server process`, error);
                }
            }
            this.patchNode(serverType, {
                process: null,
                props: null,
                startedByPlugin: false
            });
        }
    }

}
