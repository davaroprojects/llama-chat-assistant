import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export interface WebviewLabels {
    htmlLang: string;
    chatTabLabel: string;
    serverTabLabel: string;
    serverStartLabel: string;
    serverStopLabel: string;
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
}

export function getWebviewLabels(language: string): WebviewLabels {
    const normalizedLanguage = language.toLowerCase();
    if (normalizedLanguage.startsWith('es')) {
        return {
            htmlLang: 'es',
            chatTabLabel: 'Chat',
            serverTabLabel: 'Servidor',
            serverStartLabel: 'Iniciar',
            serverStopLabel: 'Detener',
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
            externalServerBlockedLabel: 'Servidor iniciado externamente. No se puede detener desde aquí.'
        };
    }

    return {
        htmlLang: 'en',
        chatTabLabel: 'Chat',
        serverTabLabel: 'Server',
        serverStartLabel: 'Start',
        serverStopLabel: 'Stop',
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
        externalServerBlockedLabel: 'Server started externally. Cannot stop from here.'
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
        `img-src ${webview.cspSource} https: data:`,
        `style-src ${webview.cspSource}`,
        `font-src ${webview.cspSource}`,
        `script-src ${webview.cspSource} 'nonce-${nonce}'`
    ].join('; ');

    const styleLink = `<link rel="stylesheet" type="text/css" href="${cssUri}">`;
    const scriptSrc = `<script nonce="${nonce}" src="${prismJsUri}"></script><script nonce="${nonce}" src="${markedJsUri}"></script><script nonce="${nonce}" src="${jsUri}"></script>`;
    const cspMetaTag = `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">`;

    htmlContent = htmlContent.replace('{{htmlLang}}', escapeHtml(labels.htmlLang));
    htmlContent = htmlContent.replace('{{cspMetaPlaceholder}}', cspMetaTag);
    htmlContent = htmlContent.replace('{{stylePlaceholder}}', styleLink);
    htmlContent = htmlContent.replace('{{chatTabLabel}}', escapeHtml(labels.chatTabLabel));
    htmlContent = htmlContent.replace('{{serverTabLabel}}', escapeHtml(labels.serverTabLabel));
    htmlContent = htmlContent.replaceAll('{{serverStartLabel}}', escapeHtml(labels.serverStartLabel));
    htmlContent = htmlContent.replaceAll('{{serverStopLabel}}', escapeHtml(labels.serverStopLabel));
    htmlContent = htmlContent.replace('{{serverParametersTitle}}', escapeHtml(labels.serverParametersTitle));
    htmlContent = htmlContent.replace('{{propertyLabel}}', escapeHtml(labels.propertyLabel));
    htmlContent = htmlContent.replace('{{valueLabel}}', escapeHtml(labels.valueLabel));
    htmlContent = htmlContent.replace('{{emptyChatReadyLabel}}', escapeHtml(labels.emptyChatReadyLabel));
    htmlContent = htmlContent.replace('{{emptyServerStoppedLabel}}', escapeHtml(labels.emptyServerStoppedLabel));
    htmlContent = htmlContent.replace('{{deleteSessionLabel}}', escapeHtml(labels.deleteSessionLabel));
    htmlContent = htmlContent.replace('{{sessionUnavailableLabel}}', escapeHtml(labels.sessionUnavailableLabel));
    htmlContent = htmlContent.replace('{{generationCanceledLabel}}', escapeHtml(labels.generationCanceledLabel));
    htmlContent = htmlContent.replace('{{backToSessionsTitle}}', escapeHtml(labels.backToSessionsTitle));
    htmlContent = htmlContent.replace('{{sessionsMainTitle}}', escapeHtml(labels.sessionsMainTitle));
    htmlContent = htmlContent.replace('{{promptPlaceholder}}', escapeHtml(labels.promptPlaceholder));
    htmlContent = htmlContent.replace('{{attachFileTitle}}', escapeHtml(labels.attachFileTitle));
    htmlContent = htmlContent.replace('{{sendMessageTitle}}', escapeHtml(labels.sendMessageTitle));
    htmlContent = htmlContent.replace('{{stopGenerationTitle}}', escapeHtml(labels.stopGenerationTitle));
    htmlContent = htmlContent.replace('{{modelMenuTitle}}', escapeHtml(labels.modelMenuTitle));
    htmlContent = htmlContent.replace('{{modelLabel}}', escapeHtml(labels.modelLabel));
    htmlContent = htmlContent.replace('{{removeFileTitle}}', escapeHtml(labels.removeFileTitle));
    htmlContent = htmlContent.replace('{{unavailableShortLabel}}', escapeHtml(labels.unavailableShortLabel));
    htmlContent = htmlContent.replace('{{copyCodeTitle}}', escapeHtml(labels.copyCodeTitle));
    htmlContent = htmlContent.replace('{{copyClipboardTitle}}', escapeHtml(labels.copyClipboardTitle));
    htmlContent = htmlContent.replace('{{newSessionLabel}}', escapeHtml(labels.newSessionLabel));
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
