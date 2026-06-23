import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export interface WebviewLabels {
    htmlLang: string;
    chatTabLabel: string;
    settingsTabLabel: string;
    aboutTabLabel: string;
    settingsLlamaSectionTitle: string;
    settingsChromaSectionTitle: string;
    aboutMarkdown: string;
    serverTabLabel: string;
    ragTabLabel: string;
    serverStartLabel: string;
    serverStopLabel: string;
    ragIndexLabel: string;
    ragStatusTitle: string;
    ragStateLabel: string;
    ragIndexedAtLabel: string;
    ragIndexedFilesLabel: string;
    ragChromaUrlLabel: string;
    ragChromaPortLabel: string;
    ragChromaCollectionIdLabel: string;
    ragChromaExcludeDirsLabel: string;
    ragChromaExcludeFileGlobsLabel: string;
    ragChromaMaxFileSizeKbLabel: string;
    ragChromaMaxIndexedFilesLabel: string;
    ragChromaChunkSizeCharsLabel: string;
    ragChromaChunkOverlapCharsLabel: string;
    ragChromaVectorCandidatePoolLabel: string;
    ragChromaMaxQueryResultsLabel: string;
    ragLlamaApiUrlLabel: string;
    ragLlamaModelLabel: string;
    ragLlamaMaxTokensLabel: string;
    ragLlamaTemperatureLabel: string;
    ragIdleLabel: string;
    ragIndexingLabel: string;
    ragIndexedLabel: string;
    ragNeverIndexedLabel: string;
    ragChromaUnavailableLabel: string;
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

export function getWebviewLabels(_language?: string): WebviewLabels {
    return {
        htmlLang: 'en',
        chatTabLabel: 'Chat',
        settingsTabLabel: 'Settings',
        aboutTabLabel: 'About',
        settingsLlamaSectionTitle: 'llama.cpp',
        settingsChromaSectionTitle: 'ChromaDB',
        aboutMarkdown: [
            '## About',
            '',
            'This assistant runs fully local using **llama.cpp** and **ChromaDB**.',
            '',
            '- **llama.cpp** handles local model inference and chat completions.',
            '- **ChromaDB** stores indexed project context used by retrieval.',
            '',
            'No cloud dependency is required for core chat and indexing flows.'
        ].join('\n'),
        serverTabLabel: 'Server',
        ragTabLabel: 'RAG',
        serverStartLabel: 'Start',
        serverStopLabel: 'Stop',
        ragIndexLabel: 'Index',
        ragStatusTitle: 'Indexing status',
        ragStateLabel: 'State',
        ragIndexedAtLabel: 'Indexed at',
        ragIndexedFilesLabel: 'Indexed files',
        ragChromaUrlLabel: 'ChromaDB URL',
        ragChromaPortLabel: 'ChromaDB port',
        ragChromaCollectionIdLabel: 'ChromaDB collection ID',
        ragChromaExcludeDirsLabel: 'Excluded folders',
        ragChromaExcludeFileGlobsLabel: 'Excluded files (glob)',
        ragChromaMaxFileSizeKbLabel: 'Max file size (KB)',
        ragChromaMaxIndexedFilesLabel: 'Max indexed files/chunks',
        ragChromaChunkSizeCharsLabel: 'Chunk size (chars)',
        ragChromaChunkOverlapCharsLabel: 'Chunk overlap (chars)',
        ragChromaVectorCandidatePoolLabel: 'Vector candidate pool',
        ragChromaMaxQueryResultsLabel: 'Max query results',
        ragLlamaApiUrlLabel: 'llama.cpp API URL',
        ragLlamaModelLabel: 'llama.cpp model',
        ragLlamaMaxTokensLabel: 'llama.cpp max tokens',
        ragLlamaTemperatureLabel: 'llama.cpp temperature',
        ragIdleLabel: 'Idle',
        ragIndexingLabel: 'Indexing',
        ragIndexedLabel: 'Indexed',
        ragNeverIndexedLabel: 'Never',
        ragChromaUnavailableLabel: 'ChromaDB server is not active',
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
    const purifyJsPath = path.join(extensionUri.fsPath, 'dist', 'media', 'purify.min.js');

    if (!fs.existsSync(htmlPath) || !fs.existsSync(cssPath) || !fs.existsSync(jsPath) || !fs.existsSync(purifyJsPath)) {
        return '<h3>Error: Resources not found in dist/media. Run npm run compile.</h3>';
    }

    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const labels = getWebviewLabels();
    const cssUri = webview.asWebviewUri(vscode.Uri.file(cssPath));
    const jsUri = webview.asWebviewUri(vscode.Uri.file(jsPath));
    const prismJsUri = webview.asWebviewUri(vscode.Uri.file(prismJsPath));
    const markedJsUri = webview.asWebviewUri(vscode.Uri.file(markedJsPath));
    const purifyJsUri = webview.asWebviewUri(vscode.Uri.file(purifyJsPath));
    const nonce = crypto.randomBytes(16).toString('base64');

    const csp = [
        "default-src 'none'",
        `img-src ${webview.cspSource} data:`,
        `style-src ${webview.cspSource}`,
        `font-src ${webview.cspSource}`,
        `script-src ${webview.cspSource} 'nonce-${nonce}'`,
        "object-src 'none'",
        "base-uri 'none'",
        "frame-src 'none'",
        "worker-src 'none'",
        "form-action 'none'"
    ].join('; ');

    const styleLink = `<link rel="stylesheet" type="text/css" href="${cssUri}">`;
    const scriptSrc = `<script nonce="${nonce}" src="${prismJsUri}"></script><script nonce="${nonce}" src="${markedJsUri}"></script><script nonce="${nonce}" src="${purifyJsUri}"></script><script nonce="${nonce}" src="${jsUri}"></script>`;
    const cspMetaTag = `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">`;

    for (const [key, value] of Object.entries(labels)) {
        htmlContent = htmlContent.replaceAll(`{{${key}}}`, escapeHtml(value));
    }

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
