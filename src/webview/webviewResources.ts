import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export interface WebviewLabels {
    htmlLang: string;
    chatTabLabel: string;
    serverTabLabel: string;
    ragTabLabel: string;
    serverStartLabel: string;
    serverStopLabel: string;
    ragIndexLabel: string;
    ragStatusTitle: string;
    ragStateLabel: string;
    ragIndexedAtLabel: string;
    ragIndexedFilesLabel: string;
    ragIdleLabel: string;
    ragIndexingLabel: string;
    ragIndexedLabel: string;
    ragNeverIndexedLabel: string;
    serverParametersTitle: string;
    propertyLabel: string;
    valueLabel: string;
    emptyChatReadyLabel: string;
    emptyServerStoppedLabel: string;
    deleteSessionLabel: string;
    sessionUnavailableLabel: string;
    generationCanceledLabel: string;
    backToSessionsTitle: string;
    sessionsMainTitle: string;
    promptPlaceholder: string;
    attachFileTitle: string;
    sendMessageTitle: string;
    stopGenerationTitle: string;
    modelMenuTitle: string;
    modelLabel: string;
    removeFileTitle: string;
    unavailableShortLabel: string;
    copyCodeTitle: string;
    copyClipboardTitle: string;
    newSessionLabel: string;
    externalServerBlockedLabel: string;
    repositoryBadgeLabel: string;
}

export function getWebviewLabels(language: string): WebviewLabels {
    const normalizedLanguage = language.toLowerCase();
    if (normalizedLanguage.startsWith('es')) {
        return {
            htmlLang: 'es',
            chatTabLabel: 'Chat',
            serverTabLabel: 'Servidor',
            ragTabLabel: 'RAG',
            serverStartLabel: 'Iniciar',
            serverStopLabel: 'Detener',
            ragIndexLabel: 'Indexar',
            ragStatusTitle: 'Estado de indexación',
            ragStateLabel: 'Estado',
            ragIndexedAtLabel: 'Fecha de indexación',
            ragIndexedFilesLabel: 'Archivos indexados',
            ragIdleLabel: 'Inactivo',
            ragIndexingLabel: 'Indexando',
            ragIndexedLabel: 'Indexado',
            ragNeverIndexedLabel: 'Nunca',
            serverParametersTitle: 'Parámetros',
            propertyLabel: 'Propiedad',
            valueLabel: 'Valor',
            emptyChatReadyLabel: 'Inicie una nueva sesion desde el chat',
            emptyServerStoppedLabel: 'Inicie el servidor para iniciar',
            deleteSessionLabel: 'Eliminar sesión permanentemente',
            sessionUnavailableLabel: 'No disponible mientras el servidor está detenido',
            generationCanceledLabel: 'Generación cancelada',
            backToSessionsTitle: 'Volver a las sesiones',
            sessionsMainTitle: 'Sesiones',
            promptPlaceholder: 'Pregúntale a tu Llama local o pide cambios...',
            attachFileTitle: 'Agregar archivo al contexto',
            sendMessageTitle: 'Enviar mensaje',
            stopGenerationTitle: 'Detener generación',
            modelMenuTitle: 'Ver modelo actual',
            modelLabel: 'Modelo',
            removeFileTitle: 'Quitar archivo',
            unavailableShortLabel: 'No disponible',
            copyCodeTitle: 'Copiar código',
            copyClipboardTitle: 'Copiar al portapapeles',
            newSessionLabel: 'Nueva Sesión',
            externalServerBlockedLabel: 'Servidor iniciado externamente. No se puede detener desde aquí.',
            repositoryBadgeLabel: 'Repositorio'
        };
    }

    return {
        htmlLang: 'en',
        chatTabLabel: 'Chat',
        serverTabLabel: 'Server',
        ragTabLabel: 'RAG',
        serverStartLabel: 'Start',
        serverStopLabel: 'Stop',
        ragIndexLabel: 'Index',
        ragStatusTitle: 'Indexing status',
        ragStateLabel: 'State',
        ragIndexedAtLabel: 'Indexed at',
        ragIndexedFilesLabel: 'Indexed files',
        ragIdleLabel: 'Idle',
        ragIndexingLabel: 'Indexing',
        ragIndexedLabel: 'Indexed',
        ragNeverIndexedLabel: 'Never',
        serverParametersTitle: 'Parameters',
        propertyLabel: 'Property',
        valueLabel: 'Value',
        emptyChatReadyLabel: 'Start a new session from chat',
        emptyServerStoppedLabel: 'Start the server to begin',
        deleteSessionLabel: 'Delete session permanently',
        sessionUnavailableLabel: 'Unavailable while the server is stopped',
        generationCanceledLabel: 'Generation canceled',
        backToSessionsTitle: 'Back to sessions',
        sessionsMainTitle: 'Sessions',
        promptPlaceholder: 'Ask your local Llama or request changes...',
        attachFileTitle: 'Add file to context',
        sendMessageTitle: 'Send message',
        stopGenerationTitle: 'Stop generation',
        modelMenuTitle: 'View current model',
        modelLabel: 'Model',
        removeFileTitle: 'Remove file',
        unavailableShortLabel: 'Unavailable',
        copyCodeTitle: 'Copy code',
        copyClipboardTitle: 'Copy to clipboard',
        newSessionLabel: 'New Session',
        externalServerBlockedLabel: 'Server started externally. Cannot stop from here.',
        repositoryBadgeLabel: 'Repository'
    };
}

export function getHtmlForWebview(extensionUri: vscode.Uri, webview: vscode.Webview): string {
    const htmlPath = path.join(extensionUri.fsPath, 'dist', 'media', 'webview.html');
    const cssPath = path.join(extensionUri.fsPath, 'dist', 'media', 'webview.css');
    const jsPath = path.join(extensionUri.fsPath, 'dist', 'media', 'webview.js');
    const prismJsPath = path.join(extensionUri.fsPath, 'dist', 'media', 'prism.min.js');
    const markedJsPath = path.join(extensionUri.fsPath, 'dist', 'media', 'marked.min.js');

    if (!fs.existsSync(htmlPath) || !fs.existsSync(cssPath) || !fs.existsSync(jsPath)) {
        return '<h3>Error: Resources not found in dist/media. Run npm run compile.</h3>';
    }

    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const labels = getWebviewLabels(vscode.env.language);
    const cssUri = webview.asWebviewUri(vscode.Uri.file(cssPath));
    const jsUri = webview.asWebviewUri(vscode.Uri.file(jsPath));
    const prismJsUri = webview.asWebviewUri(vscode.Uri.file(prismJsPath));
    const markedJsUri = webview.asWebviewUri(vscode.Uri.file(markedJsPath));
    const nonce = crypto.randomBytes(16).toString('base64');

    const csp = [
        "default-src 'none'",
        `img-src ${webview.cspSource}`,
        `style-src ${webview.cspSource}`,
        `font-src ${webview.cspSource}`,
        `script-src ${webview.cspSource} 'nonce-${nonce}'`
    ].join('; ');

    const styleLink = `<link rel="stylesheet" type="text/css" href="${cssUri}">`;
    const scriptSrc = `<script nonce="${nonce}" src="${prismJsUri}"></script><script nonce="${nonce}" src="${markedJsUri}"></script><script nonce="${nonce}" src="${jsUri}"></script>`;
    const cspMetaTag = `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">`;

    // Replace all label placeholders in a single loop (replaceAll handles keys that appear multiple times)
    for (const [key, value] of Object.entries(labels)) {
        htmlContent = htmlContent.replaceAll(`{{${key}}}`, escapeHtml(value));
    }

    // Replace structural placeholders — these are not HTML-escaped
    htmlContent = htmlContent.replace('{{cspMetaPlaceholder}}', cspMetaTag);
    htmlContent = htmlContent.replace('{{stylePlaceholder}}', styleLink);
    return htmlContent.replace('{{scriptPlaceholder}}', scriptSrc);
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
