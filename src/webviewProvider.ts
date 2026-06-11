import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SessionManager } from './sessionManager';

export class LlamaChatViewProvider implements vscode.WebviewViewProvider {
    private currentAbortController: AbortController | null = null;
    private _view?: vscode.WebviewView;

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

        let isPickerOpen = false;
        let isGenerationActive = false;

        // 📝 Función interna para enviar el archivo o la selección actual al Frontend
        const sendActiveEditorContext = (editor: vscode.TextEditor | undefined) => {
            // 🛠️ Bloqueo Estricto: Si el selector está abierto O si Llama.cpp está respondiendo, NO actualizar nada
            if (isPickerOpen || isGenerationActive) { return; }

            if (editor) {
                const document = editor.document;
                if (document.uri.scheme === 'file') {
                    const fileName = path.basename(document.fileName);
                    const selection = editor.selection;

                    if (!selection.isEmpty) {
                        const selectedText = document.getText(selection);
                        const startLine = selection.start.line + 1;
                        const endLine = selection.end.line + 1;
                        const lineSuffix = (startLine === endLine) ? `:${startLine}` : `:${startLine}-${endLine}`;

                        webviewView.webview.postMessage({
                            type: 'codeSelectionCaptured',
                            name: `${fileName}${lineSuffix}`,
                            content: selectedText
                        });
                    } else {
                        const fullContent = document.getText();
                        webviewView.webview.postMessage({
                            type: 'codeSelectionCaptured',
                            name: fileName,
                            content: fullContent
                        });
                    }
                }
            } else {
                webviewView.webview.postMessage({ type: 'clearActiveEditorContext' });
            }
        };

        // Escucha los mensajes que envía el HTML de la interfaz del chat
        webviewView.webview.onDidReceiveMessage(async (data) => {

            // 🌟 NUEVO: El backend responde solo cuando el frontend confirma estar listo
            if (data.type === 'webviewReady') {
                const activeSession = this.sessionManager.getCurrentSession();
                if (activeSession) {
                    webviewView.webview.postMessage({ type: 'restoreActiveChat', title: activeSession.title, messages: activeSession.messages });
                } else {
                    const initialSessions = this.sessionManager.getAllSessions();
                    if (initialSessions.length > 0) {
                        webviewView.webview.postMessage({ type: 'renderSessionsList', sessions: initialSessions });
                    }
                }
                if (!activeSession) {
                    sendActiveEditorContext(vscode.window.activeTextEditor);
                }
            }


            if (data.type === 'stopGeneration') {
                if (this.currentAbortController) {
                    this.currentAbortController.abort(); // Cancela el fetch inmediatamente
                    this.currentAbortController = null;
                }
            }

            else if (data.type === 'openFilePicker') {
                isPickerOpen = true; // Activar el escudo protector de eventos

                const fileUri = await vscode.window.showOpenDialog({
                    canSelectMany: false,
                    openLabel: 'Agregar al contexto',
                    filters: { 'Código': ['ts', 'js', 'json', 'py', 'go', 'rs', 'txt', 'html', 'css', 'md', 'java', 'cpp'] }
                });

                if (fileUri && fileUri[0]) {
                    try {
                        const filePath = fileUri[0].fsPath;
                        const fileName = path.basename(filePath);
                        const fileContent = fs.readFileSync(filePath, 'utf8');

                        webviewView.webview.postMessage({
                            type: 'fileSelected',
                            name: fileName,
                            content: fileContent
                        });
                    } catch (err: any) {
                        vscode.window.showErrorMessage(`Error al leer archivo: ${err.message}`);
                    }
                }

                // Liberar el escudo protector un instante después de cerrar la ventana nativa
                setTimeout(() => {
                    isPickerOpen = false;
                }, 400);
            }
            else if (data.type === 'selectSession') {
                this.sessionManager.setCurrentSession(data.sessionId);
                const activeSession = this.sessionManager.getCurrentSession();

                if (activeSession) {
                    webviewView.webview.postMessage({
                        type: 'restoreActiveChat',
                        title: activeSession.title,
                        messages: activeSession.messages
                    });
                }
            } else if (data.type === 'askLlama') {
                const userPrompt = data.value;
                const editor = vscode.window.activeTextEditor;
                let currentEditorContext = '';
                let currentEditorName = '';

                if (editor && editor.document.uri.scheme === 'file') {
                    currentEditorName = path.basename(editor.document.fileName);
                    const textSelection = editor.document.getText(editor.selection);
                    currentEditorContext = textSelection ? textSelection : editor.document.getText();
                }

                const startTime = performance.now();
                let generatedCharactersLength = 0;
                let serverUsageTokens = 0;
                let assistantReplyAccumulator = "";

                isGenerationActive = true;

                let userContentWithContext = "";
                const uniqueFilesSet = new Set<string>();

                if (currentEditorContext) { uniqueFilesSet.add(currentEditorName); }
                if (data.attachedFiles && Array.isArray(data.attachedFiles)) {
                    data.attachedFiles.forEach((file: any) => { uniqueFilesSet.add(file.name); });
                }

                const uniqueFilesNames = [...uniqueFilesSet];

                // 📦 1. CONSTRUCCIÓN DEL CONTEXTO INVISIBLE PARA LLAMA.CPP
                if (currentEditorContext) {
                    userContentWithContext += `--- ARCHIVO EN EDITOR ACTIVO: ${currentEditorName} ---\n${currentEditorContext}\n--- FIN ARCHIVO ---\n\n`;
                }

                if (data.attachedFiles && Array.isArray(data.attachedFiles)) {
                    data.attachedFiles.forEach((file: any) => {
                        if (file.name === currentEditorName && currentEditorContext) { return; }
                        userContentWithContext += `--- ARCHIVO ADJUNTO MANUAL: ${file.name} ---\n${file.content}\n--- FIN ARCHIVO ---\n\n`;
                    });
                }
                userContentWithContext += `Indicación del usuario:\n${userPrompt}`;

                // 💾 2. PERSISTENCIA ÚNICA EN EL DISCO (Formato ligero comprimido JSON)
                let currentSession = this.sessionManager.getCurrentSession();
                if (!currentSession) {
                    currentSession = this.sessionManager.createSession(userPrompt);
                }

                const richUserPayloadObj = {
                    text: userPrompt,
                    files: uniqueFilesNames
                };

                // Forzamos a TypeScript a aceptar el objeto enviándolo como un string tipado
                // Tu sessionManager lo guardará de forma nativa en el globalState sin romper las comillas
                this.sessionManager.addMessageToCurrentSession('user', richUserPayloadObj as any);


                // Notificar al Webview pasando los metadatos de archivos en caliente
                webviewView.webview.postMessage({ 
                    type: 'addMessage', 
                    role: 'user', 
                    text: userPrompt,
                    files: uniqueFilesNames 
                });
                webviewView.webview.postMessage({ type: 'startStreaming' });

                try {
                    this.currentAbortController = new AbortController();

                    const config = vscode.workspace.getConfiguration('llamaChat');
                    const apiUrl = config.get<string>('apiUrl') || 'http://127.0.0';
                    const temperature = config.get<number>('temperature') ?? 0.2;
                    const systemPrompt = config.get<string>('systemPrompt') || 'Eres un asistente de programación para VS Code.';

                    // 🧠 REGLA DE ORO DE TURNOS (No duplicar escrituras)
                    const updatedSession = this.sessionManager.getCurrentSession();
                    const baseMessages = updatedSession ? [...updatedSession.messages] : [];
                    
                    // 🔄 Inyectamos temporalmente el código fuente gigante solo en memoria para Llama.cpp
                    if (baseMessages.length > 0 && baseMessages[baseMessages.length - 1].role === 'user') {
                        baseMessages[baseMessages.length - 1].content = userContentWithContext;
                    }

                    // ❌ ELIMINAR O BORRAR TODO ESTE BLOQUE CORRUPTO QUE TENÍAS AQUÍ:
                    // let currentSession = this.sessionManager.getCurrentSession(); <-- BORRAR
                    // if (!currentSession) { ... }                                 <-- BORRAR
                    // const richUserPayload = JSON.stringify({ ...Set });          <-- BORRAR
                    // this.sessionManager.addMessageToCurrentSession('user', ...); <-- BORRAR (Duplicaba y rompía con el Set plano)

                    const hasSystemPrompt = baseMessages.some(m => m.role === 'system');
                    const fullMessagesPayload = hasSystemPrompt
                        ? baseMessages
                        : [{ role: "system", content: systemPrompt }, ...baseMessages];

                    const response = await globalThis.fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: "local",
                            messages: fullMessagesPayload,
                            temperature: temperature,
                            stream: true
                        }),
                        signal: this.currentAbortController.signal
                    });

                    // ... (El resto de tus validaciones de response.ok y bucle while continúan igual de forma normal abajo)

                    if (!response.ok) { throw new Error(`Servidor respondió: ${response.status}`); }
                    if (!response.body) { throw new Error('No se recibió cuerpo de respuesta.'); }

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder('utf-8');
                    let buffer = '';

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) { break; }

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            const cleanLine = line.trim();
                            if (!cleanLine || !cleanLine.startsWith('data:')) { continue; }

                            const jsonString = cleanLine.substring(5).trim();
                            if (jsonString === '[DONE]') { break; }

                            try {
                                const parsed = JSON.parse(jsonString);

                                // 🛠️ CAPTURA ULTRA-ROBUSTA: Verifica múltiples rutas compatibles con OpenAI y llama.cpp
                                if (parsed.choices && parsed.choices.length > 0) {
                                    const choice = parsed.choices[0];

                                    // Evaluar si viene en delta.content (Modo Stream) o directamente en text (Modo Completado)
                                    const tokenText = (choice.delta && choice.delta.content) ? choice.delta.content : (choice.text || "");

                                    if (tokenText) {
                                        generatedCharactersLength += tokenText.length;
                                        assistantReplyAccumulator += tokenText; // Acumular de forma estricta

                                        // Despachar inmediatamente el token al frontend
                                        webviewView.webview.postMessage({
                                            type: 'appendToken',
                                            text: tokenText
                                        });
                                    }
                                }

                                // Capturar estadísticas nativas de uso final
                                if (parsed.usage && parsed.usage.completion_tokens) {
                                    serverUsageTokens = parsed.usage.completion_tokens;
                                }
                            } catch (e) {
                                // Ignorar excepciones de líneas parciales incompletas
                            }
                        }

                    }

                    if (assistantReplyAccumulator) {
                        const endTime = performance.now();
                        const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
                        const finalTokensCount = serverUsageTokens > 0 ? serverUsageTokens : Math.round(generatedCharactersLength / 3.2);

                        // 1. Guardar con estructura rica en el disco para cuando cambies a Gradle
                        const richAssistantPayload = JSON.stringify({
                            text: assistantReplyAccumulator,
                            time: durationSeconds,
                            tokens: finalTokensCount
                        });
                        this.sessionManager.addMessageToCurrentSession('assistant', richAssistantPayload);

                        // 2. 🛠️ ENVIAR LIMPIO AL FRONT: Enviamos las variables sueltas por separado para que el JS las pinte ordenadas
                        webviewView.webview.postMessage({
                            type: 'endStreaming',
                            time: durationSeconds,
                            tokens: finalTokensCount
                        });
                    }

                } catch (error: any) {
                    console.error('Error durante la generación:', error);

                    const endTime = performance.now();
                    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
                    const finalTokensCount = Math.round(generatedCharactersLength / 3.2);

                    if (error.name === 'AbortError') {
                        // 📊 CASO ABORTAR: También empaquetamos las métricas parciales si el usuario detiene la IA
                        if (assistantReplyAccumulator) {
                            const richAssistantPayload = JSON.stringify({
                                text: assistantReplyAccumulator,
                                time: durationSeconds,
                                tokens: finalTokensCount
                            });
                            this.sessionManager.addMessageToCurrentSession('assistant', richAssistantPayload);
                        }

                        webviewView.webview.postMessage({
                            type: 'endStreaming',
                            time: durationSeconds,
                            tokens: finalTokensCount
                        });
                    } else {
                        // ... (Mantén tu bloque de error convencional igual)
                    }
                } finally {
                    this.currentAbortController = null;
                    // 🛠️ APAGAR ESCUDO: La petición terminó, liberamos el sistema de captura automática
                    isGenerationActive = false;

                    // 🛠️ RE-EVALUACIÓN INMEDIATA: Forzamos a validar qué editor está abierto en este milisegundo exacto
                    sendActiveEditorContext(vscode.window.activeTextEditor);
                }
            } else if (data.type === 'applyCode') {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    editor.edit(editBuilder => {
                        if (!editor.selection.isEmpty) { editBuilder.replace(editor.selection, data.value); }
                        else { editBuilder.insert(editor.selection.active, data.value); }
                    });
                }
            }

            else if (data.type === 'deleteSession') {
                // 1. Delegar el borrado físico al gestor de sesiones
                this.sessionManager.deleteSession(data.sessionId);

                // 2. Volver a solicitar la lista actualizada y refrescar la pantalla
                const updatedSessions = this.sessionManager.getAllSessions();
                if (updatedSessions.length > 0) {
                    webviewView.webview.postMessage({
                        type: 'renderSessionsList',
                        sessions: updatedSessions
                    });
                } else {
                    // Si ya no quedan más sesiones, vaciar el contenedor visual
                    webviewView.webview.postMessage({
                        type: 'renderSessionsList',
                        sessions: []
                    });
                }
            }

            else if (data.type === 'requestSessionsUpdate') {
                // Forzar al gestor a recuperar el listado con los nuevos cambios persistidos
                const freshSessions = this.sessionManager.getAllSessions();
                webviewView.webview.postMessage({
                    type: 'renderSessionsList',
                    sessions: freshSessions
                });
            }

            else if (data.type === 'requestActiveEditorRefresh') {
                sendActiveEditorContext(vscode.window.activeTextEditor);
            }

        });

        const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(editor => {
            sendActiveEditorContext(editor);
        });
        this.context.subscriptions.push(activeEditorListener);

        const selectionListener = vscode.window.onDidChangeTextEditorSelection(event => {
            sendActiveEditorContext(event.textEditor);
        });
        this.context.subscriptions.push(selectionListener);
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const htmlPath = path.join(this._extensionUri.fsPath, 'dist', 'media', 'webview.html');
        const cssPath = path.join(this._extensionUri.fsPath, 'dist', 'media', 'webview.css');
        const jsPath = path.join(this._extensionUri.fsPath, 'dist', 'media', 'webview.js');

        // 2. Verificar que los tres archivos existan de verdad
        if (!fs.existsSync(htmlPath) || !fs.existsSync(cssPath) || !fs.existsSync(jsPath)) {
            return `<h3>Error: Resources not found in dist/media. Run npm run compile.</h3>`;
        }

        // 3. Leer el molde HTML
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');

        // 4. Convertir los archivos CSS y JS en enlaces seguros para el panel de VS Code
        const cssUri = webview.asWebviewUri(vscode.Uri.file(cssPath));
        const jsUri = webview.asWebviewUri(vscode.Uri.file(jsPath));

        // 5. Crear las etiquetas reales de HTML
        const styleLink = `<link rel="stylesheet" type="text/css" href="${cssUri}">`;
        const scriptSrc = `<script src="${jsUri}"></script>`;

        // 6. Inyectar el CSS y el JS reemplazando las palabras clave del molde HTML
        htmlContent = htmlContent.replace('{{stylePlaceholder}}', styleLink);
        return htmlContent.replace('{{scriptPlaceholder}}', scriptSrc);
    }

}
