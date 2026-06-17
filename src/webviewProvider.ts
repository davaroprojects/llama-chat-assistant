import * as vscode from 'vscode';
import { SessionManager } from './chat/sessionManager';
import { SessionPayloadBuilder, FileMetadata } from './chat/sessionPayloadBuilder';
import { LlamaService, ChatMessage, LlamaConfig } from './chat/llamaService';
import { getActiveEditorContext, sendActiveEditorContext, EditorContext } from './webview/editorContext';
import { openFilePicker } from './webview/filePicker';
import { getHtmlForWebview } from './webview/webviewResources';

export class LlamaChatViewProvider implements vscode.WebviewViewProvider {
    private currentAbortController: AbortController | null = null;
    private _view?: vscode.WebviewView;
    private isPickerOpen = false;
    private isGenerationActive = false;

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
    }

    private setupMessageHandlers(webviewView: vscode.WebviewView): void {
        webviewView.webview.onDidReceiveMessage(async (data) => {
            try {
                await this.routeMessage(data, webviewView);
            } catch (error) {
                console.error('Error handling message:', error);
            }
        });
    }

    private async routeMessage(data: any, webviewView: vscode.WebviewView): Promise<void> {
        switch (data.type) {
            case 'webviewReady':
                this.handleWebviewReady(webviewView);
                break;
            case 'stopGeneration':
                this.handleStopGeneration();
                break;
            case 'openFilePicker':
                await this.handleOpenFilePicker(webviewView);
                break;
            case 'selectSession':
                this.handleSelectSession(data, webviewView);
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
        }
    }

    private handleWebviewReady(webviewView: vscode.WebviewView): void {
        const initialSessions = this.sessionManager.getAllSessions();

        this.sessionManager.setCurrentSession(null);
        webviewView.webview.postMessage({
            type: 'renderSessionsList',
            sessions: initialSessions
        });

        this.pushActiveEditorContext(webviewView, vscode.window.activeTextEditor);
    }

    private handleStopGeneration(): void {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }
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

    private handleSelectSession(data: any, webviewView: vscode.WebviewView): void {
        this.sessionManager.setCurrentSession(data.sessionId);
        const activeSession = this.sessionManager.getCurrentSession();

        if (activeSession) {
            webviewView.webview.postMessage({
                type: 'restoreActiveChat',
                title: activeSession.title,
                messages: activeSession.messages
            });
        }
    }

    private async handleAskLlama(data: any, webviewView: vscode.WebviewView): Promise<void> {
        this.isGenerationActive = true;
        try {
            const userPrompt = data.value;
            const editorContext = getActiveEditorContext();
            const filesMetadata = this.collectFilesMetadata(data.attachedFiles, editorContext);

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
                editorContext,
                filesMetadata,
                webviewView
            );
        } catch (error: any) {
            console.error('Error in askLlama:', error);
            if (error.name === 'AbortError') {
                webviewView.webview.postMessage({ type: 'stopStreaming' });
            } else {
                webviewView.webview.postMessage({ type: 'errorStreaming', text: `❌ Error: ${error.message}` });
            }
        } finally {
            this.isGenerationActive = false;
            this.pushActiveEditorContext(webviewView, vscode.window.activeTextEditor);
        }
    }

    private handleApplyCode(data: any): void {
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

    private handleDeleteSession(data: any, webviewView: vscode.WebviewView): void {
        this.sessionManager.deleteSession(data.sessionId);

        const remainingSessions = this.sessionManager.getAllSessions();
        webviewView.webview.postMessage({
            type: 'renderSessionsList',
            sessions: remainingSessions
        });
    }

    private handleRequestSessionsUpdate(webviewView: vscode.WebviewView): void {
        const freshSessions = this.sessionManager.getAllSessions();
        webviewView.webview.postMessage({
            type: 'renderSessionsList',
            sessions: freshSessions
        });
    }

    private handleRequestActiveEditorRefresh(webviewView: vscode.WebviewView): void {
        this.pushActiveEditorContext(webviewView, vscode.window.activeTextEditor);
    }

    private async generateLlamaResponse(
        userPrompt: string,
        editorContext: EditorContext,
        filesMetadata: FileMetadata[],
        webviewView: vscode.WebviewView
    ): Promise<void> {
        try {
            this.currentAbortController = new AbortController();

            const config = this.getLlamaConfig();
            const contextPrompt = SessionPayloadBuilder.buildLlamaContextPrompt(
                userPrompt,
                editorContext.name,
                editorContext.content,
                filesMetadata
            );

            const startTime = performance.now();
            const session = this.sessionManager.getCurrentSession();
            const baseMessages = session ? [...session.messages] : [];

            const messagesForLlama = LlamaService.prepareMessagesForLlama(
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
                this.currentAbortController.signal
            );

            // Save assistant response to session
            const duration = LlamaService.calculateDuration(startTime);
            const assistantPayload = SessionPayloadBuilder.createAssistantMessagePayload(
                result.totalText,
                duration,
                result.tokenCount
            );
            this.sessionManager.addMessageToCurrentSession('assistant', assistantPayload as any);

            // Notify frontend of completion
            webviewView.webview.postMessage({
                type: 'endStreaming',
                time: duration,
                tokens: result.tokenCount
            });
        } catch (error: any) {
            this.handleGenerationError(error, webviewView);
        } finally {
            this.currentAbortController = null;
            this.isGenerationActive = false;
            this.pushActiveEditorContext(webviewView, vscode.window.activeTextEditor);
        }
    }

    private handleGenerationError(error: any, webviewView: vscode.WebviewView): void {
        if (error.name === 'AbortError') {
            webviewView.webview.postMessage({ type: 'stopStreaming' });
            return;
        }

        const errorMessage = error.message || 'Unknown error during generation';
        webviewView.webview.postMessage({
            type: 'errorStreaming',
            text: `❌ Error: ${errorMessage}`
        });
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
        attachedFiles: FileMetadata[],
        editorContext: EditorContext
    ): FileMetadata[] {
        return SessionPayloadBuilder.collectFilesMetadata(
            editorContext.name,
            editorContext.content,
            attachedFiles || []
        );
    }

    private saveUserMessageToSession(payload: any): void {
        let currentSession = this.sessionManager.getCurrentSession();
        if (!currentSession) {
            currentSession = this.sessionManager.createSession(payload.text);
        }
        this.sessionManager.addMessageToCurrentSession('user', payload as any);
    }

    private getLlamaConfig(): LlamaConfig {
        const config = vscode.workspace.getConfiguration('llamaChat');
        return {
            apiUrl: config.get<string>('apiUrl') || 'http://127.0.0.1:8033/v1/chat/completions',
            temperature: config.get<number>('temperature') ?? 0.2,
            systemPrompt: config.get<string>('systemPrompt') || ''
        };
    }

}
