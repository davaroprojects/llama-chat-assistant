import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface WebviewLabels {
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
}

export function getWebviewLabels(language: string): WebviewLabels {
    const normalizedLanguage = language.toLowerCase();
    if (normalizedLanguage.startsWith('es')) {
        return {
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
            generationCanceledLabel: 'Generación cancelada'
        };
    }

    return {
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
        generationCanceledLabel: 'Generation canceled'
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

    const styleLink = `<link rel="stylesheet" type="text/css" href="${cssUri}">`;
    const scriptSrc = `<script src="${prismJsUri}"></script><script src="${markedJsUri}"></script><script src="${jsUri}"></script>`;

    htmlContent = htmlContent.replace('{{stylePlaceholder}}', styleLink);
    htmlContent = htmlContent.replace('{{chatTabLabel}}', labels.chatTabLabel);
    htmlContent = htmlContent.replace('{{serverTabLabel}}', labels.serverTabLabel);
    htmlContent = htmlContent.replaceAll('{{serverStartLabel}}', labels.serverStartLabel);
    htmlContent = htmlContent.replaceAll('{{serverStopLabel}}', labels.serverStopLabel);
    htmlContent = htmlContent.replace('{{serverParametersTitle}}', labels.serverParametersTitle);
    htmlContent = htmlContent.replace('{{propertyLabel}}', labels.propertyLabel);
    htmlContent = htmlContent.replace('{{valueLabel}}', labels.valueLabel);
    htmlContent = htmlContent.replace('{{emptyChatReadyLabel}}', labels.emptyChatReadyLabel);
    htmlContent = htmlContent.replace('{{emptyServerStoppedLabel}}', labels.emptyServerStoppedLabel);
    htmlContent = htmlContent.replace('{{deleteSessionLabel}}', labels.deleteSessionLabel);
    htmlContent = htmlContent.replace('{{sessionUnavailableLabel}}', labels.sessionUnavailableLabel);
    htmlContent = htmlContent.replace('{{generationCanceledLabel}}', labels.generationCanceledLabel);
    return htmlContent.replace('{{scriptPlaceholder}}', scriptSrc);
}
