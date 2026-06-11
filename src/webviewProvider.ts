import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SessionManager } from './sessionManager';
import { SessionPayloadBuilder, FileMetadata } from './sessionPayloadBuilder';
import { LlamaService, ChatMessage, LlamaConfig } from './llamaService';

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

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
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
        const activeSession = this.sessionManager.getCurrentSession();
        
        if (activeSession) {
            webviewView.webview.postMessage({
                type: 'restoreActiveChat',
                title: activeSession.title,
                messages: activeSession.messages
            });
        } else {
            const initialSessions = this.sessionManager.getAllSessions();
            if (initialSessions.length > 0) {
                webviewView.webview.postMessage({
                    type: 'renderSessionsList',
                    sessions: initialSessions
                });
            }
        }

        if (!activeSession) {
            this.sendActiveEditorContext(webviewView, vscode.window.activeTextEditor);
        }
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
            const fileUri = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Agregar al contexto',
                filters: {
                    'Código': ['ts', 'js', 'json', 'py', 'go', 'rs', 'txt', 'html', 'css', 'md', 'java', 'cpp']
                }
            });

            if (fileUri?.[0]) {
                this.processSelectedFile(fileUri[0], webviewView);
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error al leer archivo: ${error.message}`);
        } finally {
            setTimeout(() => {
                this.isPickerOpen = false;
            }, 400);
        }
    }

    private processSelectedFile(fileUri: vscode.Uri, webviewView: vscode.WebviewView): void {
        try {
            const filePath = fileUri.fsPath;
            const fileName = path.basename(filePath);
            const fileContent = fs.readFileSync(filePath, 'utf8');

            webviewView.webview.postMessage({
                type: 'fileSelected',
                name: fileName,
                content: fileContent
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error al leer archivo: ${error.message}`);
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
            const editorContext = this.getActiveEditorContext();
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
        } catch (error) {
            console.error('Error in askLlama:', error);
        } finally {
            this.isGenerationActive = false;
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
        this.sendActiveEditorContext(webviewView, vscode.window.activeTextEditor);
    }

    private async generateLlamaResponse(
        userPrompt: string,
        editorContext: { name: string; content: string },
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
                }
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
            this.sendActiveEditorContext(webviewView, vscode.window.activeTextEditor);
        }
    }

    private handleGenerationError(error: any, webviewView: vscode.WebviewView): void {
        if (error.name === 'AbortError') {
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
                this.sendActiveEditorContext(this._view, editor);
            }
        });
        this.context.subscriptions.push(activeEditorListener);

        const selectionListener = vscode.window.onDidChangeTextEditorSelection(event => {
            if (this._view) {
                this.sendActiveEditorContext(this._view, event.textEditor);
            }
        });
        this.context.subscriptions.push(selectionListener);
    }

    private sendActiveEditorContext(
        webviewView: vscode.WebviewView,
        editor: vscode.TextEditor | undefined
    ): void {
        if (this.isPickerOpen || this.isGenerationActive) {
            return;
        }

        if (editor && editor.document.uri.scheme === 'file') {
            const fileName = path.basename(editor.document.fileName);
            const selection = editor.selection;

            const message = this.buildEditorContextMessage(fileName, editor, selection);
            webviewView.webview.postMessage(message);
        } else {
            webviewView.webview.postMessage({ type: 'clearActiveEditorContext' });
        }
    }

    private buildEditorContextMessage(
        fileName: string,
        editor: vscode.TextEditor,
        selection: vscode.Selection
    ): any {
        if (!selection.isEmpty) {
            const selectedText = editor.document.getText(selection);
            const startLine = selection.start.line + 1;
            const endLine = selection.end.line + 1;
            const lineSuffix = (startLine === endLine) 
                ? `:${startLine}` 
                : `:${startLine}-${endLine}`;

            return {
                type: 'codeSelectionCaptured',
                name: `${fileName}${lineSuffix}`,
                content: selectedText
            };
        } else {
            const fullContent = editor.document.getText();
            return {
                type: 'codeSelectionCaptured',
                name: fileName,
                content: fullContent
            };
        }
    }

    private getActiveEditorContext(): { name: string; content: string } {
        const editor = vscode.window.activeTextEditor;
        let name = '';
        let content = '';

        if (editor && editor.document.uri.scheme === 'file') {
            name = path.basename(editor.document.fileName);
            const selection = editor.document.getText(editor.selection);
            content = selection ? selection : editor.document.getText();
        }

        return { name, content };
    }

    private collectFilesMetadata(
        attachedFiles: FileMetadata[],
        editorContext: { name: string; content: string }
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
            systemPrompt: config.get<string>('systemPrompt') || 'Eres un asistente de programación para VS Code.'
        };
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const htmlPath = path.join(this._extensionUri.fsPath, 'dist', 'media', 'webview.html');
        const cssPath = path.join(this._extensionUri.fsPath, 'dist', 'media', 'webview.css');
        const jsPath = path.join(this._extensionUri.fsPath, 'dist', 'media', 'webview.js');

        if (!fs.existsSync(htmlPath) || !fs.existsSync(cssPath) || !fs.existsSync(jsPath)) {
            return '<h3>Error: Resources not found in dist/media. Run npm run compile.</h3>';
        }

        let htmlContent = fs.readFileSync(htmlPath, 'utf8');
        const cssUri = webview.asWebviewUri(vscode.Uri.file(cssPath));
        const jsUri = webview.asWebviewUri(vscode.Uri.file(jsPath));

        const styleLink = `<link rel="stylesheet" type="text/css" href="${cssUri}">`;
        const scriptSrc = `<script src="${jsUri}"></script>`;

        htmlContent = htmlContent.replace('{{stylePlaceholder}}', styleLink);
        return htmlContent.replace('{{scriptPlaceholder}}', scriptSrc);
    }
}
