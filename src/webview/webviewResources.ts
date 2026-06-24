import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export interface WebviewLabels {
    htmlLang: string;
    chatTabLabel: string;
    settingsTabLabel: string;
    aboutTabLabel: string;
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
    ragChromaCollectionIdLabel: string;
    ragChromaMaxFileSizeKbLabel: string;
    ragChromaMaxIndexedFilesLabel: string;
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
        aboutMarkdown: [
            '## What La Llama Chat does',
            '',
            'La Llama Chat is a local coding assistant inside VS Code. It helps you ask questions about your project, retrieve relevant code context, and generate grounded answers directly in the editor.',
            '',
            '- Keeps conversations in session history and streams responses token by token.',
            '- Uses retrieval when enabled to bring relevant repository context into each answer.',
            '- Supports direct chat, isolated file analysis, and repository-wide ReAct flows for complex queries.',
            '- Uses dedicated libraries for chunking, embeddings generation, and token counting/validation before model calls.',
            '',
            'You can use the plugin as long as `llama.cpp` is reachable at the configured host and port, whether it is started externally or launched from this plugin.',
            '',
            'RAG features are available only when the ChromaDB connection is configured correctly and the server is reachable.',
            '',
            '## How to configure each area',
            '',
            'In the plugin panel, click the `...` menu at the top, then choose the configuration action. You can also open VS Code Settings and search for `laLlamaChat`, or edit your `settings.json` directly.',
            '',
            '### Chat behavior',
            '- `laLlamaChat.chat.temperature`: Controls generation randomness. Lower values improve determinism and reduce off-topic output; higher values increase creativity but may reduce precision.',
            '- `laLlamaChat.chat.maxTokens`: Caps response length. Higher values allow longer answers but increase latency and token usage.',
            '- `laLlamaChat.chat.maxAttachedFileSizeKb`: Limits manual attachment size. Higher limits allow larger files but increase context pressure.',
            '- `laLlamaChat.chat.directLlmTemplate`: Prompt template for direct non-RAG chat. Impacts answer style and instruction strictness.',
            '- `laLlamaChat.chat.globalReactTemplate`: Prompt template for repository-wide ReAct flow. Impacts search strategy and iteration quality.',
            '- `laLlamaChat.chat.localRagTemplate`: Prompt template for isolated attached-file analysis. Impacts strictness of file-scoped reasoning.',
            '- `laLlamaChat.chat.deepReactTemplate`: Prompt template for dependency-expanding ReAct from attached files. Impacts cross-file exploration depth.',
            '',
            '### llama.cpp connection',
            '- `laLlamaChat.llamaCpp.executablePath`: Path used when launching the server from the plugin. Wrong path prevents local launch.',
            '- `laLlamaChat.llamaCpp.modelPath`: GGUF model path. Determines model capability, speed, and memory usage.',
            '- `laLlamaChat.llamaCpp.host`: Host used by the extension to connect. Must match the running server binding.',
            '- `laLlamaChat.llamaCpp.port`: Port used by the extension to connect. Must match the running server port (external or plugin-launched).',
            '- `laLlamaChat.llamaCpp.contextSize`: Context window budget. Higher values allow more history/context but require more memory.',
            '- `laLlamaChat.llamaCpp.gpuLayers`: Number of layers offloaded to GPU. Higher values can speed inference if GPU memory allows it.',
            '- `laLlamaChat.llamaCpp.flashAttention`: Enables optimized attention path when supported. Can improve throughput on compatible setups.',
            '',
            '### ChromaDB indexing and retrieval',
            '- `laLlamaChat.chromaDb.url`: ChromaDB base URL. If incorrect, RAG cannot retrieve context.',
            '- `laLlamaChat.chromaDb.port`: ChromaDB port. Must match the running ChromaDB instance.',
            '- `laLlamaChat.chromaDb.maxFileSizeKb`: Skips oversized files. Protects indexing time and memory usage.',
            '- `laLlamaChat.chromaDb.maxIndexedFiles`: Upper bound for indexed files/chunks per run. Controls runtime and storage growth.',
            '- `laLlamaChat.chromaDb.targetChunkTokens`: Token target used by syntax-aware chunk assembly.',
            '- `laLlamaChat.chromaDb.maxChunkTokens`: Hard token cap for each indexed chunk.',
            '- `laLlamaChat.chromaDb.minChunkTokens`: Preferred minimum chunk size before adjacent chunk merging.',
            '- `laLlamaChat.chromaDb.fallbackChunkTokens`: Token target for manual fallback chunking in unsupported files.',
            '- `laLlamaChat.chromaDb.vectorCandidatePool`: Candidate pool before final filtering. Higher values improve recall but increase query cost.',
            '- `laLlamaChat.chromaDb.maxQueryResults`: Maximum retrieved fragments included in prompts. Higher values add context but can increase token load.',
            '- `laLlamaChat.chromaDb.minCosineSimilarity`: Similarity threshold for acceptance. Higher thresholds improve precision; lower thresholds improve recall.',
            '',
            '### Memory management',
            '- `laLlamaChat.memory.contextWindowSize`: Logical token budget used for memory strategy. Sets the upper planning limit for retained context.',
            '- `laLlamaChat.memory.safetyThreshold`: Pruning trigger threshold. Lower values prune earlier; higher values retain more context before cleanup.',
            '- `laLlamaChat.memory.preserveSystemPrompt`: Keeps system instructions during pruning. Improves behavioral consistency across long sessions.',
            '- `laLlamaChat.memory.preserveRecentMessagesCount`: Number of newest messages always kept. Balances continuity vs. available token budget.'
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
        ragChromaCollectionIdLabel: 'ChromaDB collection ID',
        ragChromaMaxFileSizeKbLabel: 'Max file size (KB)',
        ragChromaMaxIndexedFilesLabel: 'Max indexed files/chunks',
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
