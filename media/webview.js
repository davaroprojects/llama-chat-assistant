const HTML_TEMPLATES = {
    copyIcon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>`,
    checkmarkIcon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6 9 17l-5-5"/>
    </svg>`,
    deleteSessionIcon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6 6 18M6 6l12 12"/>
    </svg>`
};

function createTypingIndicator(className = 'typing-indicator') {
    const wrapper = document.createElement('div');
    wrapper.className = className;

    for (let i = 0; i < 3; i += 1) {
        wrapper.appendChild(document.createElement('span'));
    }

    return wrapper;
}

function createUserMessageNode(text) {
    const messageNode = document.createElement('div');
    messageNode.className = 'message';

    const spanNode = document.createElement('span');
    spanNode.textContent = text;
    messageNode.appendChild(spanNode);

    return messageNode;
}

function createFileBadgeNode(filename, isRepository = false) {
    const badge = document.createElement('div');
    badge.className = 'attached-file-badge';

    const span = document.createElement('span');
    const fileIcon = isRepository ? '📁' : '📄';
    span.textContent = `${fileIcon} ${filename}`;
    badge.appendChild(span);

    return badge;
}

function createFileBadgeNodeWithSource(filename, isRepository = false) {
    return createFileBadgeNode(filename, isRepository);
}

function createServerButtonIconSvg(kind) {
    const parser = new DOMParser();
    const svgMarkup = kind === 'start'
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" xmlns="http://w3.org"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;

    const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
    return document.importNode(doc.documentElement, true);
}

function setServerButtonContent(button, label, kind, isPending) {
    button.replaceChildren();

    const textSpan = document.createElement('span');
    textSpan.className = 'server-action-button-label';
    textSpan.textContent = label;
    button.appendChild(textSpan);

    if (isPending) {
        button.appendChild(createTypingIndicator('typing-indicator typing-indicator--button'));
    } else {
        button.appendChild(createServerButtonIconSvg(kind));
    }
}

const elements = {
    vscode: acquireVsCodeApi(),
    chatTabPanel: document.getElementById('chat-tab-panel'),
    settingsTabPanel: document.getElementById('settings-tab-panel'),
    aboutTabPanel: document.getElementById('about-tab-panel'),
    aboutMarkdownContent: document.getElementById('about-markdown-content'),
    llamaStatusBadge: document.getElementById('llama-status-badge'),
    embeddingsStatusBadge: document.getElementById('embeddings-status-badge'),
    serverStartBtn: document.getElementById('server-start-btn'),
    serverStopBtn: document.getElementById('server-stop-btn'),
    ragIndexBtn: document.getElementById('rag-index-btn'),
    serverActionStartIcon: document.getElementById('server-action-start-icon'),
    serverActionStopIcon: document.getElementById('server-action-stop-icon'),
    serverActionText: document.getElementById('server-action-text'),
    serverActionLoader: document.getElementById('server-action-loader'),
    ragActionRefreshIcon: document.getElementById('rag-action-refresh-icon'),
    serverActionCopyIcon: document.getElementById('server-action-copy-icon'),
    embeddingsActionStartIcon: document.getElementById('embeddings-action-start-icon'),
    embeddingsActionStopIcon: document.getElementById('embeddings-action-stop-icon'),
    embeddingsActionText: document.getElementById('embeddings-action-text'),
    embeddingsActionLoader: document.getElementById('embeddings-action-loader'),
    embeddingsActionCopyIcon: document.getElementById('embeddings-action-copy-icon'),
    ragActionCopyIcon: document.getElementById('rag-action-copy-icon'),
    ragActionText: document.getElementById('rag-action-text'),
    ragActionLoader: document.getElementById('rag-action-loader'),
    chat: document.getElementById('chat'),
    prompt: document.getElementById('prompt'),
    sessionsContainer: document.getElementById('sessions-container'),
    sessionsMainTitle: document.getElementById('sessions-main-title'),
    activeSessionHeader: document.getElementById('active-session-header'),
    activeSessionTitle: document.getElementById('active-session-title'),
    backToSessionsBtn: document.getElementById('back-to-sessions-btn'),
    sessionsList: document.getElementById('sessions-list'),
    attachBtn: document.getElementById('attach-file-btn'),
    ragContextControl: document.getElementById('rag-context-control'),
    ragSwitchLabel: document.getElementById('rag-switch-label'),
    ragEnabledCheckbox: document.getElementById('rag-enabled'),
    ragNoDataBtn: document.getElementById('rag-no-data-btn'),
    fileBadge: document.getElementById('attached-file-badge'),
    fileNameText: document.getElementById('file-name-text'),
    stopBtn: document.getElementById('stop'),
    sendBtn: document.getElementById('send'),
    tokenCounter: document.getElementById('token-counter'),
    tokenUsageChart: document.getElementById('token-usage-chart'),
    tokenUsagePercentage: document.getElementById('token-usage-percentage'),
    tokenUsageContainer: document.getElementById('token-usage-container'),
    modelMenuTrigger: document.getElementById('model-menu-trigger'),
    messagesIconTrigger: document.getElementById('messages-icon-trigger'),
    settingsIconTrigger: document.getElementById('settings-icon-trigger'),
    aboutIconTrigger: document.getElementById('about-icon-trigger'),
    contextWindow: document.getElementById('context-window'),
    contextWindowContent: document.getElementById('context-window-content'),
    attachedFilesContainer: null,
    treeNodeChat: document.getElementById('tree-node-chat'),
    treeNodeEmbeddings: document.getElementById('tree-node-embeddings'),
    treeStatusChat: document.getElementById('tree-status-chat'),
    treeStatusEmbeddings: document.getElementById('tree-status-embeddings'),
    treeLlamaChevron: document.getElementById('tree-llama-chevron'),
    treeLlamaChildren: document.getElementById('tree-llama-children'),
    treeChromadbChevron: document.getElementById('tree-chromadb-chevron'),
    treeChromadbChildren: document.getElementById('tree-chromadb-children'),
    treeChromadbStatusNode: document.getElementById('tree-node-chromadb-status'),
    treeStatusChromadb: document.getElementById('tree-status-chromadb'),
    treeChromadbLabel: document.getElementById('tree-chromadb-label'),
    nodeCtxMenu: document.getElementById('node-ctx-menu'),
    ctxMenuActionBtn: document.getElementById('ctx-menu-action-btn'),
    ctxMenuIndexBtn: document.getElementById('ctx-menu-index-btn'),
    ctxMenuClearBtn: document.getElementById('ctx-menu-clear-btn'),
    ctxMenuStopBtn: document.getElementById('ctx-menu-stop-btn'),
    ctxMenuCancelBtn: document.getElementById('ctx-menu-cancel-btn')
};

const ragConnectionSnapshot = {
    url: 'http://127.0.0.1',
    port: '8000',
    collectionId: '-'
};

/* ── Server Tree ──────────────────────────────────────────────────── */

let nodeCtxMenuTarget = null; // null | 'chat' | 'embeddings' | 'chromadb'
let isTreeLlamaExpanded = true;
let isTreeChromadbExpanded = true;
let isNodeCtxMenuVisible = false;
let allowNodeCtxMenuOpen = false;

function getTreeStatusIconSvg(state) {
    if (state === 'running') {
        return `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" class="tree-status-running" xmlns="http://www.w3.org/2000/svg"><polygon points="5 3 19 12 5 21"></polygon></svg>`;
    }
    if (state === 'pending') {
        return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="tree-status-pending spin-anim" xmlns="http://www.w3.org/2000/svg"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36M20.49 15a9 9 0 0 1-14.85 3.36"></path></svg>`;
    }
    return `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" class="tree-status-stopped" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="16" height="16" rx="2"></rect></svg>`;
}

function getChatNodeState() {
    const node = getNode('chat');
    if (node.pendingAction !== null) { return 'pending'; }
    return node.running ? 'running' : 'stopped';
}

function getEmbeddingsNodeState() {
    const node = getNode('embeddings');
    if (node.pendingAction !== null) { return 'pending'; }
    return node.running ? 'running' : 'stopped';
}

function updateServerTreeIcons() {
    if (elements.treeStatusChat) {
        elements.treeStatusChat.innerHTML = getTreeStatusIconSvg(getChatNodeState());
    }
    if (elements.treeStatusEmbeddings) {
        elements.treeStatusEmbeddings.innerHTML = getTreeStatusIconSvg(getEmbeddingsNodeState());
    }
}

function toggleTreeLlamaChildren() {
    isTreeLlamaExpanded = !isTreeLlamaExpanded;
    if (elements.treeLlamaChildren) {
        elements.treeLlamaChildren.classList.toggle('is-collapsed', !isTreeLlamaExpanded);
    }
    if (elements.treeLlamaChevron) {
        elements.treeLlamaChevron.setAttribute('aria-expanded', String(isTreeLlamaExpanded));
    }
}

function getChromadbIndexStatusIcon(state) {
    if (state === 'indexing') {
        return `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="tree-status-pending spin-anim" xmlns="http://www.w3.org/2000/svg"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36M20.49 15a9 9 0 0 1-14.85 3.36"></path></svg>`;
    }
    if (state === 'indexed') {
        return `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" class="tree-status-running" xmlns="http://www.w3.org/2000/svg"><polygon points="5 3 19 12 5 21"></polygon></svg>`;
    }
    return `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" class="tree-status-stopped" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="16" height="16" rx="2"></rect></svg>`;
}

function updateChromadbTreeStatus() {
    const state = ragIndexState.status;
    if (elements.treeStatusChromadb) {
        elements.treeStatusChromadb.innerHTML = getChromadbIndexStatusIcon(state);
    }
    
    if (elements.treeChromadbLabel) {
        if (state === 'indexing') {
            elements.treeChromadbLabel.textContent = 'indexing...';
        } else if (state === 'indexed' && ragIndexState.indexedAt) {
            const indexedAtFormatted = formatRagIndexedAt(ragIndexState.indexedAt);
            const indexedFilesCount = Number(ragIndexState.indexedFiles) || 0;
            elements.treeChromadbLabel.textContent = `indexed at ${indexedAtFormatted} - ${indexedFilesCount} files`;
        } else {
            elements.treeChromadbLabel.textContent = 'not indexed';
        }
    }
}

function toggleTreeChromadbChildren() {
    isTreeChromadbExpanded = !isTreeChromadbExpanded;
    if (elements.treeChromadbChildren) {
        elements.treeChromadbChildren.classList.toggle('is-collapsed', !isTreeChromadbExpanded);
    }
    if (elements.treeChromadbChevron) {
        elements.treeChromadbChevron.setAttribute('aria-expanded', String(isTreeChromadbExpanded));
    }
}

function showChromadbNodeCtxMenu(clientX, clientY) {
    showNodeCtxMenu('chromadb', clientX, clientY);
}

function toggleTreeChromadbChildren() {
    isTreeChromadbExpanded = !isTreeChromadbExpanded;
    if (elements.treeChromadbChildren) {
        elements.treeChromadbChildren.classList.toggle('is-collapsed', !isTreeChromadbExpanded);
    }
    if (elements.treeChromadbChevron) {
        elements.treeChromadbChevron.setAttribute('aria-expanded', String(isTreeChromadbExpanded));
    }
}

function updateChromadbTreeStatus() {
    const state = ragIndexState.status;
    if (elements.treeStatusChromadb) {
        elements.treeStatusChromadb.innerHTML = getChromadbIndexStatusIcon(state);
    }
    
    if (elements.treeChromadbLabel) {
        if (state === 'indexing') {
            elements.treeChromadbLabel.textContent = 'indexing...';
        } else if (state === 'indexed' && ragIndexState.indexedAt) {
            const indexedAtFormatted = formatRagIndexedAt(ragIndexState.indexedAt);
            const indexedFilesCount = Number(ragIndexState.indexedFiles) || 0;
            elements.treeChromadbLabel.textContent = `indexed at ${indexedAtFormatted} - ${indexedFilesCount} files`;
        } else {
            elements.treeChromadbLabel.textContent = 'not indexed';
        }
    }
}

function showNodeCtxMenu(nodeType, clientX, clientY) {
    const menu = elements.nodeCtxMenu;
    if (!menu) { return; }

    if (!allowNodeCtxMenuOpen) {
        return;
    }

    allowNodeCtxMenuOpen = false;
    nodeCtxMenuTarget = nodeType;

    // Hide all buttons first
    if (elements.ctxMenuActionBtn) elements.ctxMenuActionBtn.style.display = 'none';
    if (elements.ctxMenuIndexBtn) elements.ctxMenuIndexBtn.style.display = 'none';
    if (elements.ctxMenuClearBtn) elements.ctxMenuClearBtn.style.display = 'none';
    if (elements.ctxMenuStopBtn) elements.ctxMenuStopBtn.style.display = 'none';

    if (nodeType === 'chromadb') {
        const ragState = getRagControlState();
        
        // Show Index button only when not indexing
        if (elements.ctxMenuIndexBtn && !ragState.isIndexing) {
            elements.ctxMenuIndexBtn.style.display = '';
        }

        // Show Clear button only when already indexed
        if (elements.ctxMenuClearBtn && isProjectIndexed()) {
            elements.ctxMenuClearBtn.style.display = '';
        }

        // Show Stop button only when indexing
        if (elements.ctxMenuStopBtn && ragState.isIndexing) {
            elements.ctxMenuStopBtn.style.display = '';
        }
    } else {
        // Chat or embeddings
        const node = getNode(nodeType);
        const isRunning = node.running;
        const isPending = node.pendingAction !== null;

        if (!isPending && elements.ctxMenuActionBtn) {
            elements.ctxMenuActionBtn.style.display = '';
            elements.ctxMenuActionBtn.textContent = isRunning ? labels.panelButtonStop : labels.panelButtonStart;
        }
    }

    menu.style.display = 'block';
    isNodeCtxMenuVisible = true;
    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;

    requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${clientX - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${clientY - rect.height}px`;
        }
    });
}

function hideNodeCtxMenu() {
    if (elements.nodeCtxMenu) {
        elements.nodeCtxMenu.style.display = 'none';
    }
    nodeCtxMenuTarget = null;
    isNodeCtxMenuVisible = false;
    allowNodeCtxMenuOpen = false;
}

function handleNodeCtxAction() {
    const target = nodeCtxMenuTarget;
    if (!target) { return; }

    if (target === 'chromadb') {
        return; // ChromaDB actions handled separately
    }

    // Handle chat/embeddings
    if (target === 'chat') {
        if (getNode('chat').running) {
            requestServerStop(null);
        } else {
            requestServerStart(null);
        }
    } else if (target === 'embeddings') {
        if (getNode('embeddings').running) {
            requestEmbeddingsServerStop(null);
        } else {
            requestEmbeddingsServerStart(null);
        }
    }

    hideNodeCtxMenu();
}

function handleNodeCtxIndex() {
    if (nodeCtxMenuTarget === 'chromadb') {
        requestRagIndex(null);
    }
    hideNodeCtxMenu();
}

function handleNodeCtxClear() {
    if (nodeCtxMenuTarget === 'chromadb') {
        // Trigger clear collection (only delete, not re-index)
        elements.vscode.postMessage({ type: 'clearChromaCollection' });
    }
    hideNodeCtxMenu();
}

function handleNodeCtxStop() {
    if (nodeCtxMenuTarget === 'chromadb') {
        // Stop indexing and delete collection
        elements.vscode.postMessage({ type: 'stopIndexing' });
    }
    hideNodeCtxMenu();
}

// Tree event listeners
elements.treeLlamaChevron?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleTreeLlamaChildren();
});

elements.treeChromadbChevron?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleTreeChromadbChildren();
});

elements.treeNodeChat?.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    allowNodeCtxMenuOpen = true;
    showNodeCtxMenu('chat', event.clientX, event.clientY);
});

elements.treeNodeEmbeddings?.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    allowNodeCtxMenuOpen = true;
    showNodeCtxMenu('embeddings', event.clientX, event.clientY);
});

elements.treeChromadbStatusNode?.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    allowNodeCtxMenuOpen = true;
    showNodeCtxMenu('chromadb', event.clientX, event.clientY);
});

elements.treeNodeChat?.addEventListener('keydown', (event) => {
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
        event.preventDefault();
        const rect = elements.treeNodeChat.getBoundingClientRect();
        allowNodeCtxMenuOpen = true;
        showNodeCtxMenu('chat', rect.left, rect.bottom);
    }
});

elements.treeNodeEmbeddings?.addEventListener('keydown', (event) => {
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
        event.preventDefault();
        const rect = elements.treeNodeEmbeddings.getBoundingClientRect();
        allowNodeCtxMenuOpen = true;
        showNodeCtxMenu('embeddings', rect.left, rect.bottom);
    }
});

elements.treeChromadbStatusNode?.addEventListener('keydown', (event) => {
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
        event.preventDefault();
        const rect = elements.treeChromadbStatusNode.getBoundingClientRect();
        allowNodeCtxMenuOpen = true;
        showNodeCtxMenu('chromadb', rect.left, rect.bottom);
    }
});

elements.ctxMenuActionBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    handleNodeCtxAction();
});

elements.ctxMenuIndexBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    handleNodeCtxIndex();
});

elements.ctxMenuClearBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    handleNodeCtxClear();
});

elements.ctxMenuStopBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    handleNodeCtxStop();
});

elements.ctxMenuCancelBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    hideNodeCtxMenu();
});

elements.serverNodeCtxMenu?.addEventListener('click', (event) => {
    event.stopPropagation();
});

elements.nodeCtxMenu?.addEventListener('click', (event) => {
    event.stopPropagation();
});

/* ──────────────────────────────────────────────────────────────────── */

function copyActionText(button, text) {
    const content = String(text || '').trim();
    if (!content) {
        return;
    }

    navigator.clipboard.writeText(content).then(() => {
        button.innerHTML = HTML_TEMPLATES.checkmarkIcon;
        button.classList.add('copied');
        setTimeout(() => {
            button.innerHTML = HTML_TEMPLATES.copyIcon;
            button.classList.remove('copied');
        }, 1400);
    }).catch((err) => console.error('Copy error:', err));
}

function buildLlamaPanelCopyText() {
    return [
        labels.llamaPanelTitle,
        `Status: ${elements.llamaStatusBadge?.textContent?.trim() || 'unknown'}`,
        `State: ${elements.serverActionText?.textContent?.trim() || '-'}`
    ].join('\n');
}

function buildChromaPanelCopyText() {
    return [
        labels.chromaPanelTitle,
        `Status: ${elements.ragActionText?.textContent?.trim() || '-'}`,
        `URL: ${ragConnectionSnapshot.url}`,
        `Port: ${ragConnectionSnapshot.port}`,
        `Collection ID: ${ragConnectionSnapshot.collectionId}`
    ].join('\n');
}

function buildEmbeddingsPanelCopyText() {
    return [
        labels.embeddingsPanelTitle,
        `Status: ${elements.embeddingsStatusBadge?.textContent?.trim() || 'unknown'}`,
        `State: ${elements.embeddingsActionText?.textContent?.trim() || '-'}`
    ].join('\n');
}

const labels = {
    emptyChatReadyLabel: document.body.dataset.emptyChatReadyLabel || 'Start a new session from chat',
    emptyServerStoppedLabel: document.body.dataset.emptyServerStoppedLabel || 'Start the server to begin',
    deleteSessionLabel: document.body.dataset.deleteSessionLabel || 'Delete session permanently',
    sessionUnavailableLabel: document.body.dataset.sessionUnavailableLabel || 'Unavailable while the server is stopped',
    generationCanceledLabel: document.body.dataset.generationCanceledLabel || 'Generation canceled',
    removeFileTitle: document.body.dataset.removeFileTitle || 'Remove file',
    unavailableShortLabel: document.body.dataset.unavailableShortLabel || 'Unavailable',
    copyCodeTitle: document.body.dataset.copyCodeTitle || 'Copy code',
    copyClipboardTitle: document.body.dataset.copyClipboardTitle || 'Copy to clipboard',
    newSessionLabel: document.body.dataset.newSessionLabel || 'New Session',
    externalServerBlockedLabel: document.body.dataset.externalServerBlockedLabel || 'Server started externally. Cannot stop from here.',
    repositoryBadgeLabel: document.body.dataset.repositoryBadgeLabel || 'Repository',
    ragIdleLabel: document.body.dataset.ragIdleLabel || 'Idle',
    ragIndexingLabel: document.body.dataset.ragIndexingLabel || 'Indexing',
    ragIndexedLabel: document.body.dataset.ragIndexedLabel || 'Indexed',
    ragNeverIndexedLabel: document.body.dataset.ragNeverIndexedLabel || 'Never',
    ragChromaUnavailableLabel: document.body.dataset.ragChromaUnavailableLabel || 'ChromaDB server is not active',
    ragSwitchText: document.body.dataset.ragSwitchText || 'rag',
    ragNoDataButtonLabel: document.body.dataset.ragNoDataButtonLabel || 'no data',
    llamaPanelTitle: document.body.dataset.llamaPanelTitle || 'Llama.cpp',
    embeddingsPanelTitle: document.body.dataset.embeddingsPanelTitle || 'Llama.cpp Embeddings',
    chromaPanelTitle: document.body.dataset.chromaPanelTitle || 'ChromaDB',
    panelStateNotRunning: document.body.dataset.panelStateNotRunning || 'Not running',
    panelButtonStart: document.body.dataset.panelButtonStart || 'Start',
    panelButtonStop: document.body.dataset.panelButtonStop || 'Stop',
    panelButtonStarting: document.body.dataset.panelButtonStarting || 'Starting',
    panelButtonIndex: document.body.dataset.panelButtonIndex || 'Index',
    panelButtonCopyText: document.body.dataset.panelButtonCopyText || 'Copy text',
    statusRunningLabel: document.body.dataset.statusRunningLabel || 'running',
    statusStoppedLabel: document.body.dataset.statusStoppedLabel || 'stopped',
    statusStartedLabel: document.body.dataset.statusStartedLabel || 'started',
    modelMenuAriaLabel: document.body.dataset.modelMenuAriaLabel || 'Model',
    modelMenuTitle: document.body.dataset.modelMenuTitle || 'Click for model details',
    tokenUsageAriaLabel: document.body.dataset.tokenUsageAriaLabel || 'Token usage',
    tokenUsageTitle: document.body.dataset.tokenUsageTitle || 'Click for details',
    tabChatAriaLabel: document.body.dataset.tabChatAriaLabel || 'Chat',
    tabSettingsAriaLabel: document.body.dataset.tabSettingsAriaLabel || 'Settings',
    tabAboutAriaLabel: document.body.dataset.tabAboutAriaLabel || 'Information',
    tabChatTitle: document.body.dataset.tabChatTitle || 'Chat',
    tabSettingsTitle: document.body.dataset.tabSettingsTitle || 'Settings',
    tabAboutTitle: document.body.dataset.tabAboutTitle || 'Information'
};

const incomingMessageSchemas = {
    codeSelectionCaptured: { name: 'string', content: 'string' },
    clearActiveEditorContext: {},
    restoreActiveChat: { title: 'string', messages: 'array' },
    renderSessionsList: { sessions: 'array' },
    fileSelected: { name: 'string', content: 'string' },
    addMessage: { role: 'string', text: 'string' },
    startStreaming: {},
    appendToken: { text: 'string' },
    endStreaming: {},
    errorStreaming: { text: 'string' },
    stopStreaming: {},
    updateContextWindow: { contextWindow: 'number' },
    restoreUiState: {},
    updateServerState: {},
    updateEmbeddingsServerState: {},
    updateRagState: {}
};

const MAX_INCOMING_STRING_LENGTH = 2_000_000;

function isSafeIncomingString(value) {
    return typeof value === 'string' && value.length <= MAX_INCOMING_STRING_LENGTH;
}

function isValidIncomingMessage(message) {
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
        return false;
    }

    const schema = incomingMessageSchemas[message.type];
    if (!schema) {
        return false;
    }

    for (const [field, expectedType] of Object.entries(schema)) {
        const value = message[field];
        if (value === undefined || value === null) {
            return false;
        }

        if (expectedType === 'array') {
            if (!Array.isArray(value)) {
                return false;
            }
            continue;
        }

        if (typeof value !== expectedType) {
            return false;
        }

        if (expectedType === 'string' && !isSafeIncomingString(value)) {
            return false;
        }
    }

    if (message.type === 'restoreActiveChat') {
        if (!Array.isArray(message.messages) || message.messages.length > 2000) {
            return false;
        }
    }

    if (message.type === 'renderSessionsList') {
        if (!Array.isArray(message.sessions) || message.sessions.length > 2000) {
            return false;
        }
    }

    if (message.type === 'updateContextWindow') {
        if (message.modelName !== undefined && !isSafeIncomingString(String(message.modelName))) {
            return false;
        }
    }

    return true;
}

function sanitizeHtml(unsafeHtml) {
    const source = String(unsafeHtml || '');
    if (typeof DOMPurify === 'undefined') {
        const fallback = document.createElement('div');
        fallback.textContent = source;
        return fallback.innerHTML;
    }

    return DOMPurify.sanitize(source, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form'],
        FORBID_ATTR: ['style'],
        ALLOW_UNKNOWN_PROTOCOLS: false
    });
}

function getAttachedFilesContainer() {
    if (!elements.attachedFilesContainer) {
        elements.attachedFilesContainer = document.getElementById('attached-files-container');
    }
    return elements.attachedFilesContainer;
}

let currentAttachedFiles = [];
let activeContextMenu = null;
let activeContextAnchor = null;
let tokenUsageState = { used: 0, total: 0, pct: 0 };
let currentAssistantBubble = null;
let currentAssistantText = "";
let streamingBlocksContainer = null;
let lastBlockRenderTime = 0;
const BLOCK_RENDER_INTERVAL = 0;
let isInTransaction = false;
const removedAutoContextKeys = new Set();
let currentContextWindow = 0;
let currentModelName = 'local';
let activeTab = 'chat';
let currentSessions = [];
const serverNodes = [
    { name: 'chat',       running: false, pendingAction: null, startedByPlugin: false },
    { name: 'embeddings', running: false, pendingAction: null, startedByPlugin: false }
];
function getNode(name) { return serverNodes.find(n => n.name === name); }
let isRagIndexing = false;
let isChromaAvailable = false;
let hasActiveSession = false;
let currentSessionTokens = 0;
let serverLaunchCommandLine = '';
let embeddingsServerLaunchCommandLine = '';
let sequentialDotFrame = 0;
let sequentialDotTimer = null;
let ragIndexState = {
    status: 'idle',
    indexedAt: null,
    indexedFiles: 0,
    collectionId: null
};
let ragEnabled = false;

function readPersistedWebviewUiState() {
    try {
        const state = elements.vscode.getState?.();
        if (!state || typeof state !== 'object') {
            return null;
        }
        return state;
    } catch {
        return null;
    }
}

function persistWebviewUiState() {
    try {
        const previous = readPersistedWebviewUiState() || {};
        elements.vscode.setState?.({
            ...previous,
            activeTab,
            activeScreens: uiState.activeScreens,
            ragEnabled
        });
    } catch {
        // Ignore state persistence failures in webview runtime.
    }
}

const serverActionStartIconMarkup = elements.serverActionStartIcon?.innerHTML || '';
const serverActionStopIconMarkup = elements.serverActionStopIcon?.innerHTML || '';
const ragActionRefreshIconMarkup = elements.ragActionRefreshIcon?.innerHTML || '';

function getServerControlState() {
    const node = getNode('chat');
    const isPendingStart = node.pendingAction === 'starting';
    const isPendingStop = node.pendingAction === 'stopping';
    const isStopBlocked = node.running && !node.startedByPlugin;

    return {
        isPendingStart,
        isPendingStop,
        isStopBlocked,
        canStart: !node.pendingAction && !node.running,
        canStop: !node.pendingAction && node.running && !isStopBlocked
    };
}

function getEmbeddingsServerControlState() {
    const node = getNode('embeddings');
    const isPendingStart = node.pendingAction === 'starting';
    const isPendingStop = node.pendingAction === 'stopping';
    const isStopBlocked = node.running && !node.startedByPlugin;

    return {
        isPendingStart,
        isPendingStop,
        isStopBlocked,
        canStart: !node.pendingAction && !node.running,
        canStop: !node.pendingAction && node.running && !isStopBlocked
    };
}

function getRagControlState() {
    const isUnavailable = !isChromaAvailable;

    return {
        isUnavailable,
        isIndexing: isRagIndexing,
        canIndex: !isRagIndexing && !isUnavailable
    };
}

function isProjectIndexed() {
    return ragIndexState.status === 'indexed';
}

function formatRagIndexedAt(indexedAt) {
    if (indexedAt === null || indexedAt === undefined) {
        return '-';
    }

    const date = new Date(Number(indexedAt));
    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    const pad = (value) => String(value).padStart(2, '0');
    return [
        `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    ].join(' ');
}

function buildRagStatusText() {
    if (ragIndexState.status === 'indexing') {
        return labels.ragIndexingLabel;
    }

    if (ragIndexState.status !== 'indexed') {
        return labels.panelStateNotRunning;
    }

    return [
        `collectionId: ${ragIndexState.collectionId || '-'}`,
        `indexedAt: ${formatRagIndexedAt(ragIndexState.indexedAt)}`,
        `indexedFilesCount: ${Number(ragIndexState.indexedFiles) || 0}`
    ].join('\n');
}

function buildRagNoDataWindowText() {
    return labels.panelStateNotRunning;
}

function isTabSwitchBlocked() {
    return isInTransaction
        || isRagIndexing
        || getNode('chat').pendingAction === 'starting'
        || getNode('embeddings').pendingAction === 'starting';
}

function updateTabNavigationState() {
    const blocked = isTabSwitchBlocked();
    const controls = [
        elements.chatTabBtn,
        elements.settingsTabBtn,
        elements.aboutTabBtn,
        elements.messagesIconTrigger,
        elements.settingsIconTrigger,
        elements.aboutIconTrigger
    ];

    controls.forEach((control) => {
        if (!control) {
            return;
        }

        control.classList.toggle('is-disabled', blocked);
        control.setAttribute('aria-disabled', String(blocked));
    });
}

function updateLlamaStatusBadge() {
    if (!elements.llamaStatusBadge) {
        return;
    }

    const state = getServerControlState();
    const node = getNode('chat');
    let text = labels.statusStoppedLabel;
    let statusClass = 'is-stopped';

    if (state.isPendingStart) {
        text = labels.statusStartedLabel;
        statusClass = 'is-started';
    } else if (node.running) {
        text = labels.statusRunningLabel;
        statusClass = 'is-running';
    }

    elements.llamaStatusBadge.textContent = text;
    elements.llamaStatusBadge.classList.remove('is-started', 'is-running', 'is-stopped');
    elements.llamaStatusBadge.classList.add(statusClass);
}

function updateEmbeddingsStatusBadge() {
    if (!elements.embeddingsStatusBadge) {
        return;
    }

    const state = getEmbeddingsServerControlState();
    const node = getNode('embeddings');
    let text = labels.statusStoppedLabel;
    let statusClass = 'is-stopped';

    if (state.isPendingStart) {
        text = labels.statusStartedLabel;
        statusClass = 'is-started';
    } else if (node.running) {
        text = labels.statusRunningLabel;
        statusClass = 'is-running';
    }

    elements.embeddingsStatusBadge.textContent = text;
    elements.embeddingsStatusBadge.classList.remove('is-started', 'is-running', 'is-stopped');
    elements.embeddingsStatusBadge.classList.add(statusClass);
}

function requestServerStart(triggerElement) {
    const state = getServerControlState();
    if (!state.canStart) {
        return;
    }

    setPendingServerAction('starting');
    triggerElement?.blur();
    elements.vscode.postMessage({ type: 'startServer' });
}

function requestServerStop(triggerElement) {
    const state = getServerControlState();
    if (!state.canStop) {
        return;
    }

    setPendingServerAction('stopping');
    triggerElement?.blur();
    elements.vscode.postMessage({ type: 'stopServer' });
}

function requestEmbeddingsServerStart(triggerElement) {
    const state = getEmbeddingsServerControlState();
    if (!state.canStart) {
        return;
    }

    setPendingEmbeddingsServerAction('starting');
    triggerElement?.blur();
    elements.vscode.postMessage({ type: 'startEmbeddingsServer' });
}

function requestEmbeddingsServerStop(triggerElement) {
    const state = getEmbeddingsServerControlState();
    if (!state.canStop) {
        return;
    }

    setPendingEmbeddingsServerAction('stopping');
    triggerElement?.blur();
    elements.vscode.postMessage({ type: 'stopEmbeddingsServer' });
}

function requestRagIndex(triggerElement) {
    const state = getRagControlState();
    if (!state.canIndex) {
        return;
    }

    setRagIndexingState(true);
    triggerElement?.blur();
    elements.vscode.postMessage({ type: 'indexAll' });
}

function getSequentialDotsText() {
    return '.'.repeat((sequentialDotFrame % 3) + 1);
}

function refreshSequentialIndicators() {
    const dots = getSequentialDotsText();

    if (getNode('chat').pendingAction === 'starting' && elements.serverActionStartIcon) {
        elements.serverActionStartIcon.textContent = dots;
    }

    if (isRagIndexing && elements.ragActionRefreshIcon) {
        elements.ragActionRefreshIcon.textContent = dots;
    }

    if (getNode('embeddings').pendingAction === 'starting' && elements.embeddingsActionStartIcon) {
        elements.embeddingsActionStartIcon.textContent = dots;
    }
}

function updateSequentialDotTimer() {
    const shouldAnimate = getNode('chat').pendingAction === 'starting'
        || getNode('embeddings').pendingAction === 'starting'
        || isRagIndexing;

    if (shouldAnimate && !sequentialDotTimer) {
        refreshSequentialIndicators();
        sequentialDotTimer = window.setInterval(() => {
            sequentialDotFrame += 1;
            refreshSequentialIndicators();
        }, 350);
        return;
    }

    if (!shouldAnimate && sequentialDotTimer) {
        window.clearInterval(sequentialDotTimer);
        sequentialDotTimer = null;
        sequentialDotFrame = 0;
    }
}

const uiState = {
    activeTab: 'chat',
    activeScreens: ['chat'],
    get isServerRunning() { return getNode('chat').running; },
    get wasServerStartedByPlugin() { return getNode('chat').startedByPlugin; },
    get isEmbeddingsServerRunning() { return getNode('embeddings').running; },
    get wasEmbeddingsServerStartedByPlugin() { return getNode('embeddings').startedByPlugin; },
    get pendingServerAction() { return getNode('chat').pendingAction; },
    get pendingEmbeddingsServerAction() { return getNode('embeddings').pendingAction; },
    isRagIndexing: false,
    isChromaAvailable: false,
    hasActiveSession: false,
    isInTransaction: false,
    currentContextWindow: 0,
    currentModelName: 'local',
    currentSessionTokens: 0
};
function updateServerActionPanel() {
    if (!elements.serverActionStartIcon || !elements.serverActionStopIcon || !elements.serverActionText || !elements.serverActionLoader) {
        return;
    }

    const state = getServerControlState();

    if (state.isPendingStart) {
        elements.serverActionStartIcon.style.display = 'flex';
        elements.serverActionStartIcon.disabled = true;
        elements.serverActionStartIcon.title = labels.panelButtonStarting;
        elements.serverActionStartIcon.textContent = getSequentialDotsText();
        elements.serverActionStopIcon.style.display = 'none';
        elements.serverActionText.textContent = serverLaunchCommandLine || labels.panelButtonStart;
        elements.serverActionLoader.style.display = 'none';
        updateSequentialDotTimer();
        return;
    }

    elements.serverActionStartIcon.innerHTML = serverActionStartIconMarkup;
    elements.serverActionStartIcon.disabled = false;
    elements.serverActionStartIcon.title = labels.panelButtonStart;
    elements.serverActionLoader.style.display = 'none';

    if (getNode('chat').running) {
        elements.serverActionStartIcon.style.display = 'none';
        elements.serverActionStopIcon.style.display = 'flex';
        elements.serverActionStopIcon.disabled = !state.canStop;
        elements.serverActionStopIcon.title = state.isStopBlocked
            ? labels.externalServerBlockedLabel
            : labels.panelButtonStop;
        elements.serverActionStopIcon.innerHTML = serverActionStopIconMarkup;
        elements.serverActionText.textContent = serverLaunchCommandLine || labels.statusRunningLabel;
    } else {
        elements.serverActionStartIcon.style.display = 'flex';
        elements.serverActionStopIcon.style.display = 'none';
        elements.serverActionText.textContent = serverLaunchCommandLine || labels.panelButtonStart;
    }

    updateSequentialDotTimer();
}

function updateEmbeddingsServerActionPanel() {
    if (!elements.embeddingsActionStartIcon || !elements.embeddingsActionStopIcon || !elements.embeddingsActionText || !elements.embeddingsActionLoader) {
        return;
    }

    const state = getEmbeddingsServerControlState();

    if (state.isPendingStart) {
        elements.embeddingsActionStartIcon.style.display = 'flex';
        elements.embeddingsActionStartIcon.disabled = true;
        elements.embeddingsActionStartIcon.title = labels.panelButtonStarting;
        elements.embeddingsActionStartIcon.textContent = getSequentialDotsText();
        elements.embeddingsActionStopIcon.style.display = 'none';
        elements.embeddingsActionText.textContent = embeddingsServerLaunchCommandLine || labels.panelButtonStart;
        elements.embeddingsActionLoader.style.display = 'none';
        updateSequentialDotTimer();
        return;
    }

    elements.embeddingsActionStartIcon.disabled = false;
    elements.embeddingsActionStartIcon.title = labels.panelButtonStart;
    elements.embeddingsActionLoader.style.display = 'none';

    if (getNode('embeddings').running) {
        elements.embeddingsActionStartIcon.style.display = 'none';
        elements.embeddingsActionStopIcon.style.display = 'flex';
        elements.embeddingsActionStopIcon.disabled = !state.canStop;
        elements.embeddingsActionStopIcon.title = state.isStopBlocked
            ? labels.externalServerBlockedLabel
            : labels.panelButtonStop;
        elements.embeddingsActionText.textContent = embeddingsServerLaunchCommandLine || labels.statusRunningLabel;
    } else {
        elements.embeddingsActionStartIcon.style.display = 'flex';
        elements.embeddingsActionStopIcon.style.display = 'none';
        elements.embeddingsActionText.textContent = embeddingsServerLaunchCommandLine || labels.panelButtonStart;
    }

    updateSequentialDotTimer();
}

function updateRagActionPanel() {
    if (!elements.ragActionRefreshIcon || !elements.ragActionText || !elements.ragActionLoader) {
        return;
    }

    const state = getRagControlState();
    elements.ragActionText.textContent = buildRagStatusText();

    if (state.isIndexing) {
        elements.ragActionRefreshIcon.textContent = getSequentialDotsText();
        elements.ragActionRefreshIcon.disabled = true;
        elements.ragActionLoader.style.display = 'none';
    } else {
        elements.ragActionRefreshIcon.innerHTML = ragActionRefreshIconMarkup;
        elements.ragActionLoader.style.display = 'none';
        elements.ragActionRefreshIcon.disabled = state.isUnavailable;
    }

    updateSequentialDotTimer();
}


function setRagIndexingState(value) {
    isRagIndexing = !!value;
    uiState.isRagIndexing = isRagIndexing;
    updateRagActionButton();
    updateRagActionPanel();
    updateRagInputVisibility();
    updateChromadbTreeStatus();
}

function updateRagInputVisibility() {
    const isIndexed = isProjectIndexed();

    if (elements.ragContextControl) {
        elements.ragContextControl.style.display = 'inline-flex';
    }

    if (elements.ragSwitchLabel) {
        elements.ragSwitchLabel.style.display = isIndexed ? 'inline-flex' : 'none';
    }

    if (elements.ragEnabledCheckbox) {
        elements.ragEnabledCheckbox.disabled = !isIndexed || !canUseInputActions();
    }

    if (elements.ragNoDataBtn) {
        elements.ragNoDataBtn.style.display = isIndexed ? 'none' : 'inline-flex';
        elements.ragNoDataBtn.disabled = false;
    }
}

function createAutoContextKey(name, content) {
    return `${name}::${content}`;
}

function getBaseFileName(fileName) {
    return (fileName || '').replace(/:\d+(?:-\d+)?$/, '');
}

function canUseInputActions() {
    return getNode('chat').running && !isInTransaction;
}

function canStopGeneration() {
    return getNode('chat').running && isInTransaction;
}

function autoResizePrompt() {
    const minHeight = 48;
    const maxHeight = 240;
    elements.prompt.style.height = 'auto';
    const nextHeight = Math.min(maxHeight, Math.max(minHeight, elements.prompt.scrollHeight));
    elements.prompt.style.height = `${nextHeight}px`;
    elements.prompt.style.overflowY = elements.prompt.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

function syncTokenUsageVisibility() {
    if (!elements.tokenUsageContainer) {
        return;
    }

    const shouldShow = hasActiveSession;
    elements.tokenUsageContainer.style.display = shouldShow ? 'inline-flex' : 'none';
    elements.tokenUsageContainer.setAttribute('aria-hidden', String(!shouldShow));

    if (!shouldShow && activeContextMenu === 'token') {
        hideContextWindow();
    }
}

function applyControlState() {
    const allowMainActions = canUseInputActions();
    const allowStop = canStopGeneration();

    syncTokenUsageVisibility();

    elements.prompt.disabled = !allowMainActions;

    elements.attachBtn.classList.toggle('is-disabled', !allowMainActions);
    elements.backToSessionsBtn.classList.toggle('is-disabled', !allowMainActions);
    elements.backToSessionsBtn.style.display = hasActiveSession ? 'flex' : 'none';

    elements.attachBtn.setAttribute('aria-disabled', String(!allowMainActions));
    elements.backToSessionsBtn.setAttribute('aria-disabled', String(!allowMainActions));

    updateRagInputVisibility();

    if (elements.ragEnabledCheckbox) {
        elements.ragEnabledCheckbox.disabled = !isProjectIndexed() || !allowMainActions;
    }

    if (elements.sendBtn) {
        elements.sendBtn.style.display = allowMainActions ? 'flex' : 'none';
        elements.sendBtn.disabled = !allowMainActions;
    }

    if (elements.stopBtn) {
        elements.stopBtn.style.display = allowStop ? 'flex' : 'none';
        elements.stopBtn.disabled = !allowStop;
    }

    if (!allowMainActions) {
        hideContextWindow();
    }

    if (elements.tokenUsageContainer) {
        elements.tokenUsageContainer.classList.toggle('is-disabled', !allowMainActions);
        elements.tokenUsageContainer.setAttribute('aria-disabled', String(!allowMainActions));
    }

    updateTabNavigationState();
    renderAllBadges();
}

function setRagEnabledState(value, shouldPersist = true) {
    ragEnabled = !!value;
    uiState.ragEnabled = ragEnabled;

    if (elements.ragEnabledCheckbox) {
        elements.ragEnabledCheckbox.checked = ragEnabled;
    }

    persistWebviewUiState();

    if (shouldPersist) {
        elements.vscode.postMessage({ type: 'setRagEnabled', ragEnabled });
    }
}

function setHasActiveSession(value) {
    hasActiveSession = !!value;
    uiState.hasActiveSession = hasActiveSession;

    if (hasActiveSession) {
        elements.sessionsContainer.style.display = 'none';
        elements.sessionsList.style.display = 'none';
        elements.sessionsMainTitle.style.display = 'none';
        elements.activeSessionHeader.style.display = 'flex';
        elements.chat.style.display = 'flex';
    } else {
        elements.activeSessionHeader.style.display = 'none';
        elements.activeSessionTitle.innerText = '';
        elements.sessionsMainTitle.style.display = 'block';
        elements.sessionsList.style.display = 'flex';
        elements.sessionsContainer.style.display = 'flex';
        elements.chat.style.display = 'none';
    }

    applyControlState();
}

elements.chatTabBtn?.addEventListener('click', () => switchTab('chat'));
elements.settingsTabBtn?.addEventListener('click', () => switchTab('settings'));
elements.aboutTabBtn?.addEventListener('click', () => switchTab('about'));
elements.serverStartBtn?.addEventListener('click', () => {
    requestServerStart(elements.serverStartBtn);
});
elements.serverStopBtn?.addEventListener('click', () => {
    requestServerStop(elements.serverStopBtn);
});
elements.ragIndexBtn?.addEventListener('click', () => {
    requestRagIndex(elements.ragIndexBtn);
});
elements.serverActionStartIcon?.addEventListener('click', () => {
    requestServerStart(elements.serverActionStartIcon);
});
elements.serverActionStopIcon?.addEventListener('click', () => {
    requestServerStop(elements.serverActionStopIcon);
});
elements.serverActionCopyIcon?.addEventListener('click', () => {
    copyActionText(elements.serverActionCopyIcon, buildLlamaPanelCopyText());
});
elements.embeddingsActionStartIcon?.addEventListener('click', () => {
    requestEmbeddingsServerStart(elements.embeddingsActionStartIcon);
});
elements.embeddingsActionStopIcon?.addEventListener('click', () => {
    requestEmbeddingsServerStop(elements.embeddingsActionStopIcon);
});
elements.embeddingsActionCopyIcon?.addEventListener('click', () => {
    copyActionText(elements.embeddingsActionCopyIcon, buildEmbeddingsPanelCopyText());
});
elements.ragActionRefreshIcon?.addEventListener('click', () => {
    requestRagIndex(elements.ragActionRefreshIcon);
});
elements.ragActionCopyIcon?.addEventListener('click', () => {
    copyActionText(elements.ragActionCopyIcon, buildChromaPanelCopyText());
});
elements.ragEnabledCheckbox?.addEventListener('change', () => {
    setRagEnabledState(!!elements.ragEnabledCheckbox?.checked);
});
elements.ragNoDataBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!elements.ragNoDataBtn) {
        return;
    }
    const shouldClose = activeContextMenu === 'rag-empty' && elements.contextWindow?.style.display === 'block';
    if (shouldClose) {
        hideContextWindow();
        return;
    }

    showContextWindow('rag-empty', elements.ragNoDataBtn);
});
elements.backToSessionsBtn.addEventListener('click', handleBackToSessions);
elements.sendBtn.addEventListener('click', sendMessage);
elements.stopBtn.addEventListener('click', () => {
    if (!canStopGeneration()) {
        return;
    }
    elements.vscode.postMessage({ type: 'stopGeneration' });
});
elements.attachBtn.addEventListener('click', () => {
    if (!canUseInputActions()) {
        return;
    }
    elements.vscode.postMessage({ type: 'openFilePicker' });
});
elements.prompt.addEventListener('keydown', handlePromptKeyDown);
elements.prompt.addEventListener('input', autoResizePrompt);
window.addEventListener('message', handleExtensionMessage);
elements.tokenUsageContainer?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleTokenUsageMenu();
});
elements.modelMenuTrigger?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleModelMenu();
});
elements.modelMenuTrigger?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    toggleModelMenu();
});
elements.messagesIconTrigger?.addEventListener('click', () => {
    switchTab('chat');
});
elements.messagesIconTrigger?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
        return;
    }
    event.preventDefault();
    switchTab('chat');
});
elements.settingsIconTrigger?.addEventListener('click', () => {
    switchTab('settings');
});
elements.settingsIconTrigger?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
        return;
    }
    event.preventDefault();
    switchTab('settings');
});
elements.aboutIconTrigger?.addEventListener('click', () => {
    switchTab('about');
});
elements.aboutIconTrigger?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
        return;
    }
    event.preventDefault();
    switchTab('about');
});
elements.contextWindow?.addEventListener('click', (event) => {
    event.stopPropagation();
});
document.addEventListener('click', () => {
    hideContextWindow();
    hideNodeCtxMenu();
});
window.addEventListener('resize', () => {
    if (activeContextMenu && activeContextAnchor) {
        placeContextWindow(activeContextAnchor);
    }
});
window.addEventListener('blur', () => {
    hideContextWindow();
    hideNodeCtxMenu();
});

function handleExtensionMessage(event) {
    const message = event.data;

    if (!isValidIncomingMessage(message)) {
        if (message && typeof message === 'object' && typeof message.type === 'string') {
            console.warn('[laLlamaChat] Ignored incoming message with invalid payload', {
                type: message.type
            });
        }
        return;
    }

    switch (message.type) {
        case 'codeSelectionCaptured':
            handleCodeSelectionCaptured(message);
            break;
        case 'clearActiveEditorContext':
            handleClearActiveEditorContext();
            break;
        case 'restoreActiveChat':
            handleRestoreActiveChat(message);
            break;
        case 'renderSessionsList':
            handleRenderSessionsList(message);
            break;
        case 'fileSelected':
            handleFileSelected(message);
            break;
        case 'addMessage':
            handleAddMessage(message);
            break;
        case 'startStreaming':
            handleStartStreaming();
            break;
        case 'appendToken':
            handleAppendToken(message);
            break;
        case 'endStreaming':
            handleEndStreaming(message);
            break;
        case 'errorStreaming':
            handleErrorStreaming(message);
            break;
        case 'stopStreaming':
            handleStopStreaming();
            break;
        case 'updateContextWindow':
            currentContextWindow = message.contextWindow;
            uiState.currentContextWindow = currentContextWindow;
            if (typeof message.modelName === 'string' && message.modelName.trim()) {
                currentModelName = message.modelName.trim();
                uiState.currentModelName = currentModelName;
            }
            updateTokenCounter(currentSessionTokens, currentContextWindow, currentModelName);
            break;
        case 'restoreUiState':
            console.info('[laLlamaChat] restoreUiState', {
                activeTab: message.activeTab,
                activeScreens: Array.isArray(message.activeScreens) ? message.activeScreens : [],
                hasActiveSession: !!message.hasActiveSession
            });

            if (message.activeTab) {
                switchTab(message.activeTab === 'about' ? 'settings' : message.activeTab, false, true);
            }
            if (Array.isArray(message.activeScreens)) {
                uiState.activeScreens = message.activeScreens.filter((screen) =>
                    screen === 'chat' || screen === 'settings'
                );
                if (uiState.activeScreens.length === 0) {
                    uiState.activeScreens = [uiState.activeTab];
                }
            }
            if (typeof message.hasActiveSession === 'boolean') {
                setHasActiveSession(message.hasActiveSession);
            }
            if (typeof message.ragEnabled === 'boolean') {
                setRagEnabledState(message.ragEnabled, false);
            }
            persistWebviewUiState();
            elements.vscode.postMessage({ type: 'setRagEnabled', ragEnabled });
            break;
        case 'updateServerState':
            renderServerState(message);
            break;
        case 'updateEmbeddingsServerState':
            renderEmbeddingsServerState(message);
            break;
        case 'updateRagState':
            renderRagState(message);
            break;
    }
}

function updateRagActionButton() {
    if (!elements.ragIndexBtn) {
        return;
    }

    const state = getRagControlState();
    elements.ragIndexBtn.disabled = !state.canIndex;
    elements.ragIndexBtn.classList.toggle('is-pending', state.isIndexing);
    elements.ragIndexBtn.classList.toggle('is-disabled', state.isUnavailable);
    elements.ragIndexBtn.title = state.isUnavailable
        ? labels.ragChromaUnavailableLabel
        : (elements.ragIndexBtn.dataset.label || labels.ragIndexedLabel);

    const label = state.isIndexing
        ? (elements.ragIndexBtn.dataset.loadingLabel || labels.ragIndexingLabel)
        : (elements.ragIndexBtn.dataset.label || labels.ragIndexedLabel);

    setServerButtonContent(elements.ragIndexBtn, label, 'start', isRagIndexing);
}

function renderRagState(message) {
    ragIndexState = {
        status: typeof message.status === 'string' ? message.status : 'idle',
        indexedAt: message.indexedAt ?? null,
        indexedFiles: Number(message.indexedFiles) || 0,
        collectionId: typeof message.chromaCollectionId === 'string' && message.chromaCollectionId.trim()
            ? message.chromaCollectionId.trim()
            : null
    };

    setRagIndexingState(!!message.isIndexing);
    isChromaAvailable = !!message.chromaAvailable;
    uiState.isChromaAvailable = isChromaAvailable;

    if (typeof message.ragEnabled === 'boolean') {
        setRagEnabledState(message.ragEnabled, false);
    }

    updateRagActionButton();
    updateRagActionPanel();
    updateRagInputVisibility();
    updateChromadbTreeStatus();

    ragConnectionSnapshot.url = typeof message.chromaUrl === 'string' && message.chromaUrl
        ? message.chromaUrl
        : 'http://127.0.0.1';
    ragConnectionSnapshot.port = String(Number(message.chromaPort) || 8000);
    ragConnectionSnapshot.collectionId = String(message.chromaCollectionId || '-');

}


function handleCodeSelectionCaptured(message) {
    const baseName = message.baseName || getBaseFileName(message.name);
    const existingAutoFile = currentAttachedFiles.find(
        f => f.isAutomatic && getBaseFileName(f.name) === baseName
    );

    const autoContextKey = createAutoContextKey(message.name, message.content);
    if (!existingAutoFile && removedAutoContextKeys.has(autoContextKey)) {
        renderAllBadges();
        return;
    }

    if (existingAutoFile) {
        existingAutoFile.name = message.name;
        existingAutoFile.content = message.content;
    } else {
        currentAttachedFiles.unshift({
            name: message.name,
            content: message.content,
            isAutomatic: true
        });
    }
    renderAllBadges();
}

function handleClearActiveEditorContext() {
    removedAutoContextKeys.clear();
    currentAttachedFiles = currentAttachedFiles.filter(file => !file.isAutomatic);
    renderAllBadges();
}

function handleRestoreActiveChat(message) {
    setHasActiveSession(true);
    elements.activeSessionTitle.innerText = message.title;
    elements.chat.innerHTML = '';

    message.messages.forEach(msg => {
        switch (msg.role) {
            case 'user':
                renderUserMessageFromHistory(msg);
                break;
            case 'assistant':
                renderAssistantMessageFromHistory(msg);
                break;
        }
    });

    if (message.sessionTokens !== undefined && message.contextWindow !== undefined) {
        if (typeof message.modelName === 'string' && message.modelName.trim()) {
            currentModelName = message.modelName.trim();
        }
        currentSessionTokens = Number(message.sessionTokens) || 0;
        updateTokenCounter(message.sessionTokens, message.contextWindow, currentModelName);
    }

    syncServerStoppedNotice();

    elements.chat.scrollTop = elements.chat.scrollHeight;
}

function handleRenderSessionsList(message) {
    currentSessions = message.sessions || [];
    elements.sessionsList.innerHTML = '';

    if (currentSessions.length === 0) {
        createEmptySessionsCard();
        setHasActiveSession(false);
    } else {
        currentSessions.forEach(session => createSessionCard(session));
        syncSessionsServerStoppedNotice();
        if (!hasActiveSession) {
            setHasActiveSession(false);
        }
    }

    if (message.contextWindow !== undefined) {
        currentContextWindow = message.contextWindow;
    }

    if (typeof message.modelName === 'string' && message.modelName.trim()) {
        currentModelName = message.modelName.trim();
    }

    if (!hasActiveSession) {
        currentSessionTokens = 0;
    }
    updateTokenCounter(currentSessionTokens, currentContextWindow, currentModelName);
}

function handleFileSelected(message) {
    const alreadyExists = currentAttachedFiles.some(f => f.name === message.name);
    if (!alreadyExists) {
        currentAttachedFiles.push({
            name: message.name,
            content: message.content,
            isRepository: !!message.isRepository,
            isAutomatic: false
        });
        renderAllBadges();
    }
}

function handleAddMessage(message) {
    if (message.role === 'user') {
        if (!hasActiveSession) {
            setHasActiveSession(true);
            elements.activeSessionTitle.innerText = truncateTitle(message.text);
        }
        renderUserMessageLive(message);
    }
}

function handleStartStreaming() {
    isInTransaction = true;
    uiState.isInTransaction = isInTransaction;
    applyControlState();
    currentAssistantText = "";
    lastBlockRenderTime = 0;

    const container = document.createElement('div');
    container.className = 'message-container assistant';
    const msgBubble = document.createElement('div');
    msgBubble.className = 'message assistant-streaming';

    const statusRow = document.createElement('div');
    statusRow.className = 'assistant-streaming-status';
    statusRow.appendChild(createTypingIndicator());
    msgBubble.appendChild(statusRow);

    currentAssistantBubble = document.createElement('div');
    currentAssistantBubble.className = 'markdown-content';
    msgBubble.appendChild(currentAssistantBubble);

    streamingBlocksContainer = currentAssistantBubble;

    container.appendChild(msgBubble);
    elements.chat.appendChild(container);
    elements.chat.scrollTop = elements.chat.scrollHeight;
}

function handleAppendToken(message) {
    if (!currentAssistantBubble) return;

    let tokenText = typeof message.text === 'string' ? message.text : String(message.text || '');
    if (tokenText.length > 10000) {
        tokenText = tokenText.slice(0, 10000);
    }
    if (tokenText.startsWith('{') && tokenText.includes('"text"')) {
        try {
            const parsed = JSON.parse(tokenText);
            tokenText = typeof parsed.text === 'string' ? parsed.text : '';
        } catch (e) { }
    }

    const bubbleNode = currentAssistantBubble.closest('.message');
    if (bubbleNode) {
        const indicator = bubbleNode.querySelector('.assistant-streaming-status');
        if (indicator) {
            indicator.remove();
        }
    }

    currentAssistantText += tokenText;
    
    const now = performance.now();
    if (now - lastBlockRenderTime >= BLOCK_RENDER_INTERVAL) {
        renderIncrementalStreaming(currentAssistantBubble, currentAssistantText);
        lastBlockRenderTime = now;
    }
    
    elements.chat.scrollTop = elements.chat.scrollHeight;
}

function handleEndStreaming(message) {
    isInTransaction = false;
    uiState.isInTransaction = isInTransaction;
    applyControlState();
    if (canUseInputActions()) {
        elements.prompt.focus();
    }

    if (currentAssistantBubble) {
        const bubbleNode = currentAssistantBubble.closest('.message');
        let finalContent = currentAssistantText.trim();

        if (finalContent.startsWith('{') && finalContent.includes('"text"')) {
            try {
                const parsedData = JSON.parse(finalContent);
                finalContent = parsedData.text.trim();
            } catch (e) { }
        }

        bubbleNode.innerHTML = '';
        renderFormattedContent(bubbleNode, finalContent);
        addMessageFooter(bubbleNode, finalContent, message.time, message.tokens);
    }

    if (message.sessionTokens !== undefined && message.contextWindow !== undefined) {
        if (typeof message.modelName === 'string' && message.modelName.trim()) {
            currentModelName = message.modelName.trim();
        }
        updateTokenCounter(message.sessionTokens, message.contextWindow, currentModelName);
    }

    currentAssistantBubble = null;
    elements.vscode.postMessage({ type: 'requestActiveEditorRefresh' });
}

function handleErrorStreaming(message) {
    isInTransaction = false;
    uiState.isInTransaction = isInTransaction;
    applyControlState();
    if (canUseInputActions()) {
        elements.prompt.focus();
    }

    if (currentAssistantBubble) {
        const bubbleNode = currentAssistantBubble.closest('.message');
        if (bubbleNode) {
            bubbleNode.remove();
        }
        currentAssistantBubble = null;
        currentAssistantText = "";
    }

    const container = document.createElement('div');
    container.className = 'message-container assistant';
    const errorNode = document.createElement('div');
    errorNode.className = 'message';
    errorNode.style.color = 'var(--vscode-errorForeground)';
    errorNode.textContent = typeof message.text === 'string' ? message.text : String(message.text || 'Error');
    container.appendChild(errorNode);
    elements.chat.appendChild(container);

    if (currentAssistantBubble) {
        const bubbleNode = currentAssistantBubble.closest('.message');
        if (bubbleNode) {
            bubbleNode.remove();
        }
        currentAssistantBubble = null;
        currentAssistantText = "";
    }

    elements.vscode.postMessage({ type: 'requestActiveEditorRefresh' });
}

function handleStopStreaming() {
    isInTransaction = false;
    uiState.isInTransaction = isInTransaction;
    applyControlState();
    if (canUseInputActions()) {
        elements.prompt.focus();
    }

    if (currentAssistantBubble) {
        const bubbleNode = currentAssistantBubble.closest('.message');
        if (bubbleNode) {
            bubbleNode.remove();
        }
        currentAssistantBubble = null;
        currentAssistantText = "";
    }

    const container = document.createElement('div');
    container.className = 'message-container assistant';
    const cancelNode = document.createElement('div');
    cancelNode.className = 'message';
    cancelNode.style.color = 'var(--vscode-errorForeground)';
    cancelNode.textContent = labels.generationCanceledLabel;
    container.appendChild(cancelNode);
    elements.chat.appendChild(container);

    elements.vscode.postMessage({ type: 'requestActiveEditorRefresh' });
}


function renderAllBadges() {
    const container = getAttachedFilesContainer();
    if (!container) return;

    container.innerHTML = '';
    currentAttachedFiles.forEach((file) => {
        const badge = createFileBadgeNodeWithSource(file.name, !!file.isRepository);

        const removeBtn = document.createElement('div');
        const isDisabled = !canUseInputActions();
        removeBtn.className = 'remove-file-btn' + (isDisabled ? ' is-disabled' : '');
        removeBtn.innerText = '×';
        removeBtn.title = isDisabled ? labels.unavailableShortLabel : labels.removeFileTitle;
        removeBtn.onclick = () => {
            if (isDisabled) { return; }
            if (file.isAutomatic) {
                removedAutoContextKeys.add(createAutoContextKey(file.name, file.content));
            }
            currentAttachedFiles = currentAttachedFiles.filter(f => f !== file);
            renderAllBadges();
        };
        badge.appendChild(removeBtn);
        container.appendChild(badge);
    });
}

function renderUserMessageLive(message) {
    let userContainer = null;

    if (message.text || (message.filesMetadata && message.filesMetadata.length > 0)) {
        userContainer = document.createElement('div');
        userContainer.className = 'message-container user';
        if (message.text) {
            userContainer.appendChild(createUserMessageNode(message.text));
        }
        elements.chat.appendChild(userContainer);
    }

    if (userContainer && message.filesMetadata && Array.isArray(message.filesMetadata) && message.filesMetadata.length > 0) {
        renderFileBadgesInChat(message.filesMetadata.map(fileObj => fileObj.name), userContainer);
    }
    elements.chat.scrollTop = elements.chat.scrollHeight;
}

function renderUserMessageFromHistory(msg) {
    const { text, files } = parseUserMessage(msg);
    let userContainer = null;

    if (text || files.length > 0) {
        userContainer = document.createElement('div');
        userContainer.className = 'message-container user';
        if (text) {
            userContainer.appendChild(createUserMessageNode(text));
        }
        elements.chat.appendChild(userContainer);
    }

    if (userContainer && files.length > 0) {
        renderFileBadgesInChat(files.map(fileObj => fileObj.name), userContainer);
    }
}

function renderAssistantMessageFromHistory(msg) {
    const { text, time, tokens } = parseAssistantMessage(msg);
    if (!text) return;

    const container = document.createElement('div');
    container.className = 'message-container assistant';
    const msgBubble = document.createElement('div');
    msgBubble.className = 'message';

    renderFormattedContent(msgBubble, text);
    addMessageFooter(msgBubble, text, time, tokens);

    container.appendChild(msgBubble);
    elements.chat.appendChild(container);
}

function renderFormattedContent(bubbleNode, content) {
    renderMarkdownContent(bubbleNode, content);

    bubbleNode.querySelectorAll('p, li').forEach(node => {
        node.style.lineHeight = '1.5';
    });

    bubbleNode.querySelectorAll('pre > code').forEach(codeNode => {
        const pre = codeNode.parentElement;
        if (!pre) return;

        const languageClass = [...codeNode.classList].find(c => c.startsWith('language-')) || '';
        const language = languageClass.replace('language-', '').trim();

        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';

        const header = document.createElement('div');
        header.className = 'code-block-header';

        const languageName = document.createElement('span');
        languageName.className = 'code-block-language';
        languageName.textContent = language || 'code';

        const codeText = codeNode.textContent || '';
        const copyBtn = createCopyButton(codeText);
        copyBtn.className = 'copy-icon-button code-block-copy-btn';
        copyBtn.title = labels.copyCodeTitle;

        header.appendChild(languageName);
        header.appendChild(copyBtn);

        const wrappedPre = pre.cloneNode(true);
        wrapper.appendChild(header);
        wrapper.appendChild(wrappedPre);

        pre.replaceWith(wrapper);

        const wrappedCodeNode = wrappedPre.querySelector('code');
        if (wrappedCodeNode && typeof Prism !== 'undefined') {
            Prism.highlightElement(wrappedCodeNode);
        }
    });
}

function renderMarkdownContent(bubbleNode, content) {
    bubbleNode.innerHTML = '';
    bubbleNode.classList.add('markdown-content');

    if (typeof marked === 'undefined') {
        const fallbackDiv = document.createElement('div');
        fallbackDiv.innerText = content;
        bubbleNode.appendChild(fallbackDiv);
        return;
    }

    const parsedHtml = marked.parse(content, { breaks: true, gfm: true });
    bubbleNode.innerHTML = sanitizeHtml(parsedHtml);
}

function renderIncrementalStreaming(bubbleNode, fullContent) {
    const normalizedContent = normalizeStreamingContent(fullContent);
    const { stableContent, trailingContent } = splitStreamingMarkdownContent(normalizedContent);

    bubbleNode.innerHTML = '';

    if (stableContent) {
        const stableContainer = document.createElement('div');
        stableContainer.className = 'streaming-stable-block';
        if (typeof marked !== 'undefined') {
            const parsedHtml = marked.parse(stableContent, { breaks: true, gfm: true });
            stableContainer.innerHTML = sanitizeHtml(parsedHtml);
        } else {
            stableContainer.textContent = stableContent;
        }
        bubbleNode.appendChild(stableContainer);
    }

    if (trailingContent) {
        const tailContainer = document.createElement('div');
        tailContainer.className = 'markdown-stream-tail';
        tailContainer.textContent = trailingContent;
        bubbleNode.appendChild(tailContainer);
    }
}

function normalizeStreamingContent(content) {
    return content
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\n+$/g, '');
}

function splitStreamingMarkdownContent(content) {
    const lines = content.split('\n');
    let inCodeFence = false;
    let stableEndIndex = 0;
    let cursor = 0;

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const isFenceLine = /^\s*```/.test(line);

        if (isFenceLine) {
            inCodeFence = !inCodeFence;
        }

        const lineEnd = cursor + line.length;
        const hasLineBreak = index < lines.length - 1;

        if (hasLineBreak && !inCodeFence) {
            stableEndIndex = lineEnd + 1;
        }

        cursor = lineEnd + 1;
    }

    return {
        stableContent: content.slice(0, stableEndIndex).trimEnd(),
        trailingContent: content.slice(stableEndIndex)
    };
}

function addMessageFooter(bubbleNode, content, time, tokens) {
    const codeToCopy = content.includes('```') ? extractLastCode(content) : content;
    const footerRow = document.createElement('div');
    footerRow.className = 'chat-footer-row';

    const copyBtn = createCopyButton(codeToCopy);
    const statsDiv = document.createElement('div');
    statsDiv.className = 'chat-stats';

    const cleanTime = time !== undefined ? time : '0.00';
    const cleanTokens = tokens !== undefined ? tokens : '0';
    statsDiv.innerText = `${cleanTime}s  •  ${cleanTokens} tokens`;

    footerRow.appendChild(copyBtn);
    footerRow.appendChild(statsDiv);
    bubbleNode.appendChild(footerRow);
}

function createCopyButton(content) {
    const copyBtn = document.createElement('div');
    copyBtn.className = 'copy-icon-button';
    copyBtn.title = labels.copyClipboardTitle;
    copyBtn.innerHTML = HTML_TEMPLATES.copyIcon;

    copyBtn.onclick = () => {
        navigator.clipboard.writeText(content).then(() => {
            copyBtn.innerHTML = HTML_TEMPLATES.checkmarkIcon;
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.innerHTML = HTML_TEMPLATES.copyIcon;
                copyBtn.classList.remove('copied');
            }, 2000);
        }).catch(err => console.error('Copy error:', err));
    };
    return copyBtn;
}

function renderFileBadgesInChat(fileNames, targetContainer = elements.chat) {
    if (!fileNames || fileNames.length === 0) {
        return;
    }

    const filesContainer = document.createElement('div');
    filesContainer.className = 'attached-files-container chat-attached-files-container';

    fileNames.forEach(filename => {
        const badge = createFileBadgeNode(filename);
        filesContainer.appendChild(badge);
    });

    targetContainer.appendChild(filesContainer);
}

function createSessionCard(session) {
    const card = document.createElement('div');
    const isDisabled = !canUseInputActions();
    card.className = 'session-card' + (isDisabled ? ' is-disabled' : '');

    const body = document.createElement('div');
    body.className = 'session-card-body';

    const title = document.createElement('div');
    title.className = 'session-card-title';
    title.innerText = session.title || labels.newSessionLabel;

    const time = document.createElement('div');
    time.className = 'session-card-time';
    time.innerText = session.relativeTime || '';

    body.appendChild(title);
    body.appendChild(time);

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'delete-session-button' + (isDisabled ? ' is-disabled' : '');
    deleteBtn.setAttribute('title', isDisabled ? labels.sessionUnavailableLabel : labels.deleteSessionLabel);
    deleteBtn.innerHTML = HTML_TEMPLATES.deleteSessionIcon;

    card.appendChild(body);
    card.appendChild(deleteBtn);
    card.setAttribute('aria-disabled', String(isDisabled));

    card.onclick = () => {
        if (!canUseInputActions()) {
            return;
        }
        showChatView();
        elements.activeSessionTitle.innerText = session.title;
        elements.chat.innerHTML = '';
        elements.vscode.postMessage({ type: 'selectSession', sessionId: session.id });
    };

    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (!canUseInputActions()) {
            return;
        }
        card.style.opacity = '0';
        card.style.transform = 'translateX(-10px)';
        card.style.transition = 'all 0.2s ease';
        setTimeout(() => {
            elements.vscode.postMessage({ type: 'deleteSession', sessionId: session.id });
        }, 200);
    };
    elements.sessionsList.appendChild(card);
}

function createEmptySessionsCard() {
    const emptyCard = document.createElement('div');
    emptyCard.className = 'session-card empty-session-card';

    const body = document.createElement('div');
    body.className = 'session-card-body';

    const title = document.createElement('div');
    title.className = 'session-card-title';
    title.textContent = getNode('chat').running ? labels.emptyChatReadyLabel : labels.emptyServerStoppedLabel;

    body.appendChild(title);
    emptyCard.appendChild(body);
    elements.sessionsList.appendChild(emptyCard);
}

function createServerStoppedSessionsNotice() {
    const noticeCard = document.createElement('div');
    noticeCard.className = 'session-card empty-session-card server-stopped-sessions-notice';

    const body = document.createElement('div');
    body.className = 'session-card-body';

    const title = document.createElement('div');
    title.className = 'session-card-title';
    title.textContent = labels.emptyServerStoppedLabel;

    body.appendChild(title);
    noticeCard.appendChild(body);
    elements.sessionsList.appendChild(noticeCard);
}


function showChatView() {
    switchTab('chat');
    showActiveChatLayout();
}

function showActiveChatLayout() {
    setHasActiveSession(true);
}

function isActiveChatVisible() {
    return elements.activeSessionHeader.style.display === 'flex' && elements.chat.style.display !== 'none';
}

function removeServerStoppedNotice() {
    elements.chat.querySelector('.server-stopped-notice')?.remove();
}

function syncSessionsServerStoppedNotice() {
    if (!elements.sessionsList) {
        return;
    }

    elements.sessionsList.querySelector('.server-stopped-sessions-notice')?.remove();

    if (getNode('chat').running || currentSessions.length === 0) {
        return;
    }

    createServerStoppedSessionsNotice();
}

function syncSessionCardsAvailability() {
    if (!elements.sessionsList) {
        return;
    }

    const cardsDisabled = !canUseInputActions();

    const sessionCards = elements.sessionsList.querySelectorAll('.session-card:not(.empty-session-card)');
    sessionCards.forEach((card) => {
        card.classList.toggle('is-disabled', cardsDisabled);
        card.setAttribute('aria-disabled', String(cardsDisabled));
    });

    const deleteButtons = elements.sessionsList.querySelectorAll('.delete-session-button');
    deleteButtons.forEach((button) => {
        button.classList.toggle('is-disabled', cardsDisabled);
        button.setAttribute('title', cardsDisabled ? labels.sessionUnavailableLabel : labels.deleteSessionLabel);
    });
}

function setPendingServerAction(action) {
    getNode('chat').pendingAction = action;
    updateServerActionButtons();
    updateServerActionPanel();
    updateServerTreeIcons();
}

function setPendingEmbeddingsServerAction(action) {
    getNode('embeddings').pendingAction = action;
    updateEmbeddingsServerActionPanel();
    updateServerTreeIcons();
}

function clearPendingServerAction() {
    getNode('chat').pendingAction = null;
    updateServerActionButtons();
    updateServerActionPanel();
    updateServerTreeIcons();
}

function clearPendingEmbeddingsServerAction() {
    getNode('embeddings').pendingAction = null;
    updateEmbeddingsServerActionPanel();
    updateServerTreeIcons();
}

function updateServerActionButtons() {
    const state = getServerControlState();
    updateLlamaStatusBadge();

    if (elements.serverStartBtn) {
        elements.serverStartBtn.disabled = !state.canStart;
        elements.serverStartBtn.classList.toggle('is-pending', state.isPendingStart);
        const label = state.isPendingStart
            ? (elements.serverStartBtn.dataset.loadingLabel || labels.panelButtonStart)
            : (elements.serverStartBtn.dataset.label || labels.panelButtonStart);
        setServerButtonContent(elements.serverStartBtn, label, 'start', state.isPendingStart);
    }


    if (elements.serverStopBtn) {
        elements.serverStopBtn.disabled = !state.canStop;
        elements.serverStopBtn.classList.toggle('is-pending', state.isPendingStop);
        elements.serverStopBtn.classList.toggle('is-disabled', state.isStopBlocked);
        elements.serverStopBtn.title = state.isStopBlocked
            ? labels.externalServerBlockedLabel
            : (elements.serverStopBtn.dataset.label || labels.panelButtonStop);
        const label = state.isPendingStop
            ? (elements.serverStopBtn.dataset.loadingLabel || labels.panelButtonStop)
            : (elements.serverStopBtn.dataset.label || labels.panelButtonStop);
        setServerButtonContent(elements.serverStopBtn, label, 'stop', state.isPendingStop);
    }
}
function syncServerStoppedNotice() {
    removeServerStoppedNotice();

    if (getNode('chat').running || !isActiveChatVisible()) {
        return;
    }

    const noticeContainer = document.createElement('div');
    noticeContainer.className = 'message-container assistant server-stopped-notice';

    const noticeMessage = document.createElement('div');
    noticeMessage.className = 'message server-stopped-notice-message';
    noticeMessage.textContent = labels.emptyServerStoppedLabel;

    noticeContainer.appendChild(noticeMessage);
    elements.chat.appendChild(noticeContainer);
    elements.chat.scrollTop = elements.chat.scrollHeight;
}

function switchTab(tabName, shouldPersist = true, forceSwitch = false) {
    if (!forceSwitch && tabName !== activeTab && isTabSwitchBlocked()) {
        updateTabNavigationState();
        return;
    }

    activeTab = tabName;
    uiState.activeTab = tabName;
    if (!uiState.activeScreens.includes(tabName)) {
        uiState.activeScreens.push(tabName);
    }
    const isChatTab = tabName === 'chat';
    const isSettingsTab = tabName === 'settings';
    const isAboutTab = tabName === 'about';

    elements.messagesIconTrigger?.classList.toggle('is-active', isChatTab);
    elements.settingsIconTrigger?.classList.toggle('is-active', isSettingsTab);
    elements.aboutIconTrigger?.classList.toggle('is-active', isAboutTab);
    elements.messagesIconTrigger?.setAttribute('aria-pressed', String(isChatTab));
    elements.settingsIconTrigger?.setAttribute('aria-pressed', String(isSettingsTab));
    elements.aboutIconTrigger?.setAttribute('aria-pressed', String(isAboutTab));

    if (elements.chatTabPanel) {
        elements.chatTabPanel.style.display = isChatTab ? 'flex' : 'none';
    }
    if (elements.settingsTabPanel) {
        elements.settingsTabPanel.style.display = isSettingsTab ? 'flex' : 'none';
    }
    if (elements.aboutTabPanel) {
        elements.aboutTabPanel.style.display = isAboutTab ? 'flex' : 'none';
    }

    // Context menu is only valid inside settings and under explicit user action.
    if (!isSettingsTab || isNodeCtxMenuVisible) {
        hideNodeCtxMenu();
    }

    persistWebviewUiState();

    if (shouldPersist) {
        elements.vscode.postMessage({ type: 'setActiveTab', tab: activeTab });
    }

    updateTabNavigationState();
}

function handleBackToSessions() {
    if (!canUseInputActions()) {
        return;
    }

    elements.chat.innerHTML = '';
    setHasActiveSession(false);
    elements.vscode.postMessage({ type: 'selectSession', sessionId: null });
    elements.vscode.postMessage({ type: 'requestSessionsUpdate' });
    elements.vscode.postMessage({ type: 'webviewReady' });
    currentSessionTokens = 0;

    if (elements.tokenCounter) {
        elements.tokenCounter.style.display = 'block';
        updateTokenCounter(0, currentContextWindow, currentModelName);
    }
}


function updateTokenCounter(sessionTokens, contextWindow, modelName = currentModelName) {
    if (!elements.tokenCounter) { return; }
    elements.tokenCounter.style.display = 'block';

    currentSessionTokens = Number(sessionTokens) || 0;
    uiState.currentSessionTokens = currentSessionTokens;

    const hasTotal = contextWindow > 0;
    const pct = hasTotal ? Math.min(100, Math.round((currentSessionTokens / contextWindow) * 100)) : 0;
    const warnClass = hasTotal
        ? (pct >= 90 ? ' token-counter--danger' : pct >= 70 ? ' token-counter--warn' : '')
        : '';
    elements.tokenCounter.className = 'token-counter' + warnClass;

    if (elements.tokenUsagePercentage) {
        elements.tokenUsagePercentage.textContent = `${pct}%`;
    }

    if (elements.tokenUsageChart) {
        elements.tokenUsageChart.style.setProperty('--token-usage-pct', String(pct));
        elements.tokenUsageChart.title = `${pct}% - ${labels.tokenUsageTitle}`;
    }

    tokenUsageState = {
        used: currentSessionTokens,
        total: hasTotal ? contextWindow : 0,
        pct
    };

    if (elements.modelMenuTrigger) {
        const resolvedModelName = modelName || 'local';
        elements.modelMenuTrigger.title = `${labels.modelMenuAriaLabel}: ${resolvedModelName}`;
    }

}

function renderServerState(message) {
    console.info('[laLlamaChat] updateServerState', {
        isRunning: !!message.isRunning,
        wasServerStartedByPlugin: !!message.wasServerStartedByPlugin,
        commandLine: message.commandLine || ''
    });

    const node = getNode('chat');
    node.running = !!message.isRunning;
    node.startedByPlugin = !!message.wasServerStartedByPlugin;

    if (typeof message.commandLine === 'string' && message.commandLine.trim()) {
        serverLaunchCommandLine = message.commandLine.trim();
    }

    if (node.pendingAction === 'starting') {
        clearPendingServerAction();
    } else if (node.pendingAction === 'stopping' && !node.running) {
        clearPendingServerAction();
    }

    if (elements.serverStartBtn) {
        elements.serverStartBtn.style.display = node.running ? 'none' : 'inline-flex';
    }

    if (elements.serverStopBtn) {
        elements.serverStopBtn.style.display = node.running ? 'inline-flex' : 'none';
    }

    if (!serverLaunchCommandLine) {
        const rowsByProperty = new Map((message.parameterRows || []).map((row) => [String(row.property), String(row.value)]));
        const binaryPath = rowsByProperty.get('binaryPath');
        const model = rowsByProperty.get('model');
        const ngl = rowsByProperty.get('ngl');
        const contextSize = rowsByProperty.get('c');
        const flashAttn = rowsByProperty.get('flash-attn');
        const host = rowsByProperty.get('host');
        const port = rowsByProperty.get('port');
        const tools = rowsByProperty.get('tools');
        const jinja = rowsByProperty.get('jinja');

        if (binaryPath && model) {
            const parts = [
                binaryPath,
                '-m', model,
                '-ngl', ngl || '99',
                '-c', contextSize || '16384',
                '--flash-attn', flashAttn || 'on',
                '--host', host || '127.0.0.1',
                '--port', port || '8033',
                '--tools', tools || 'all',
                '--chat-template', 'chatml'
            ];

            if (String(jinja).toLowerCase() === 'true') {
                parts.push('--jinja');
            }

            serverLaunchCommandLine = parts.join(' ');
        }
    }

    updateServerActionButtons();
    updateServerActionPanel();
    applyControlState();
    syncServerStoppedNotice();
    syncSessionCardsAvailability();
    syncSessionsServerStoppedNotice();
    updateTokenCounter(currentSessionTokens, currentContextWindow, currentModelName);
    updateServerTreeIcons();

    if (currentSessions.length === 0 && elements.sessionsList) {
        elements.sessionsList.innerHTML = '';
        createEmptySessionsCard();
    }
}

function renderEmbeddingsServerState(message) {
    console.info('[laLlamaChat] updateEmbeddingsServerState', {
        isRunning: !!message.isRunning,
        wasServerStartedByPlugin: !!message.wasServerStartedByPlugin,
        commandLine: message.commandLine || ''
    });

    const node = getNode('embeddings');
    node.running = !!message.isRunning;
    node.startedByPlugin = !!message.wasServerStartedByPlugin;

    if (typeof message.commandLine === 'string' && message.commandLine.trim()) {
        embeddingsServerLaunchCommandLine = message.commandLine.trim();
    }

    if (node.pendingAction === 'starting') {
        clearPendingEmbeddingsServerAction();
    } else if (node.pendingAction === 'stopping' && !node.running) {
        clearPendingEmbeddingsServerAction();
    }

    updateEmbeddingsStatusBadge();
    updateEmbeddingsServerActionPanel();
    applyControlState();
    updateServerTreeIcons();
}

function placeContextWindow(anchorElement) {
    if (!elements.contextWindow || !anchorElement) {
        return;
    }

    elements.contextWindow.style.visibility = 'hidden';
    elements.contextWindow.style.display = 'block';

    const rect = anchorElement.getBoundingClientRect();
    const panelRect = elements.contextWindow.getBoundingClientRect();
    const margin = 8;

    let left = rect.left;
    let top = rect.top - panelRect.height - 6;

    if (top < margin) {
        top = rect.bottom + 6;
    }

    if (left + panelRect.width > window.innerWidth - margin) {
        left = window.innerWidth - panelRect.width - margin;
    }

    if (left < margin) {
        left = margin;
    }

    if (top + panelRect.height > window.innerHeight - margin) {
        top = window.innerHeight - panelRect.height - margin;
    }

    if (top < margin) {
        top = margin;
    }

    elements.contextWindow.style.left = `${left}px`;
    elements.contextWindow.style.top = `${top}px`;
    elements.contextWindow.style.visibility = 'visible';
}

function getTokenFillColor(percent) {
    const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
    const blend = clamped / 100;

    const start = { r: 255, g: 255, b: 255 };
    const end = { r: 77, g: 163, b: 255 };

    const r = Math.round(start.r + (end.r - start.r) * blend);
    const g = Math.round(start.g + (end.g - start.g) * blend);
    const b = Math.round(start.b + (end.b - start.b) * blend);

    return `rgb(${r}, ${g}, ${b})`;
}

function renderContextWindowContent(menuType) {
    if (!elements.contextWindowContent) {
        return;
    }

    if (menuType === 'model') {
        const resolvedModelName = currentModelName || 'local';
        elements.contextWindowContent.innerHTML = '';
        const modelItem = document.createElement('div');
        modelItem.className = 'quick-context-item';
        modelItem.textContent = `Model: ${resolvedModelName}`;
        elements.contextWindowContent.appendChild(modelItem);
        return;
    }

    if (menuType === 'rag-empty') {
        elements.contextWindowContent.innerHTML = '';
        const messageNode = document.createElement('div');
        messageNode.className = 'quick-context-item';
        messageNode.textContent = buildRagNoDataWindowText();
        elements.contextWindowContent.appendChild(messageNode);
        return;
    }

    const totalLabel = tokenUsageState.total > 0 ? tokenUsageState.total.toLocaleString() : '?';
    const usedLabel = tokenUsageState.used.toLocaleString();
    const pct = tokenUsageState.pct;
    const fillColor = getTokenFillColor(pct);

    elements.contextWindowContent.innerHTML = '';

    const valuesNode = document.createElement('div');
    valuesNode.className = 'token-usage-window-values';
    valuesNode.textContent = `${usedLabel} / ${totalLabel} tokens`;

    const barNode = document.createElement('div');
    barNode.className = 'token-usage-window-bar';
    barNode.setAttribute('aria-hidden', 'true');

    const fillNode = document.createElement('div');
    fillNode.className = 'token-usage-window-bar-fill';
    fillNode.style.width = `${pct}%`;
    fillNode.style.background = fillColor;

    barNode.appendChild(fillNode);
    elements.contextWindowContent.appendChild(valuesNode);
    elements.contextWindowContent.appendChild(barNode);
}

function showContextWindow(menuType, anchorElement) {
    if (!elements.contextWindow || !elements.contextWindowContent || !anchorElement) {
        return;
    }

    activeContextMenu = menuType;
    activeContextAnchor = anchorElement;
    renderContextWindowContent(menuType);
    placeContextWindow(anchorElement);
}

function hideContextWindow() {
    if (!elements.contextWindow) {
        return;
    }

    elements.contextWindow.style.display = 'none';
    elements.contextWindow.style.left = '0px';
    elements.contextWindow.style.top = '0px';
    activeContextMenu = null;
    activeContextAnchor = null;
}

function toggleTokenUsageMenu() {
    if (!getNode('chat').running || !elements.tokenUsageContainer || elements.tokenUsageContainer.classList.contains('is-disabled')) {
        return;
    }

    const shouldClose = activeContextMenu === 'token' && elements.contextWindow?.style.display === 'block';
    if (shouldClose) {
        hideContextWindow();
        return;
    }

    showContextWindow('token', elements.tokenUsageContainer);
}

function toggleModelMenu() {
    if (!elements.modelMenuTrigger) {
        return;
    }

    const shouldClose = activeContextMenu === 'model' && elements.contextWindow?.style.display === 'block';
    if (shouldClose) {
        hideContextWindow();
        return;
    }

    showContextWindow('model', elements.modelMenuTrigger);
}

function closeTokenUsageMenu() {
    if (activeContextMenu === 'token') {
        hideContextWindow();
    }
}


function parseUserMessage(msg) {
    let text = "";
    let files = [];
    let isNewFormat = false;

    if (msg.content && typeof msg.content === 'object') {
        text = msg.content.text || ""; files = msg.content.filesMetadata || []; isNewFormat = true;
    } else if (typeof msg.content === 'string') { const cleanStr = msg.content.trim(); if (cleanStr.startsWith('{') && cleanStr.endsWith('}')) { try { const parsed = JSON.parse(cleanStr); text = parsed.text || ""; files = parsed.filesMetadata || []; isNewFormat = true; } catch (e) { isNewFormat = false; } } else { text = msg.content; } } return { text, files, isNewFormat };
}

function parseAssistantMessage(msg) {
    let text = "";
    let time = "";
    let tokens = "";
    if (msg.content && typeof msg.content === 'object') {
        text = msg.content.text || ""; time = msg.content.time || "";
        tokens = msg.content.tokens || "";
    } else if (typeof msg.content === 'string') {
        const cleanStr = msg.content.trim();
        if (cleanStr.startsWith('{') && cleanStr.endsWith('}')) {
            try {
                const parsed = JSON.parse(cleanStr);
                text = parsed.text || "";
                time = parsed.time || "";
                tokens = parsed.tokens || "";
            } catch (e) {
                text = msg.content;
            }
        } else {
            text = msg.content;
        }
    } return {
        text, time, tokens
    };
}

function extractLastCode(content) {
    const matches = [...content.matchAll(/[a-zA-Z0-9+-]*\s*([\s\S]*?)/g)];
    if (matches.length > 0) {
        return matches[matches.length - 1][1].trim();
    }
    return content;
}

function handlePromptKeyDown(event) {
    const isEnterKey = event.key === 'Enter' || event.code === 'Enter' || event.keyCode === 13;
    if (isEnterKey && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        sendMessage();
    }
}

function sendMessage() {
    if (!canUseInputActions()) {
        return;
    }

    const text = elements.prompt.value.trim();
    const hasManualFiles = currentAttachedFiles.some(f => !f.isAutomatic);
    
    if (text || hasManualFiles) {
        elements.vscode.postMessage({
            type: 'askLlama',
            value: text,
            attachedFiles: currentAttachedFiles,
            ragEnabled: ragEnabled
        });
        elements.prompt.value = '';
        autoResizePrompt();
        setTimeout(() => {
            currentAttachedFiles = currentAttachedFiles.filter(file => file.isAutomatic);
            renderAllBadges();
        }, 50);
    }
}

function truncateTitle(text) {
    if (!text) return labels.newSessionLabel;
    let cleanText = text.replace(/---[\s\S]*?---/g, '');
    cleanText = cleanText.split(/User instruction:/i).pop()?.trim() || cleanText; cleanText = cleanText.replace(/\s+/g, ' ');
    return cleanText.length > 30 ? cleanText.substring(0, 27) + '...' : cleanText;
}

function renderAboutMarkdown() {
    if (!elements.aboutMarkdownContent) {
        return;
    }

    const markdownText = document.body.dataset.aboutMarkdown || '';
    const normalizedMarkdown = markdownText
        .replace(/\\n/g, '\n')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.replace(/^\s{1,4}/, ''))
        .join('\n')
        .trim();

    if (!normalizedMarkdown) {
        elements.aboutMarkdownContent.textContent = '';
        return;
    }

    if (typeof marked === 'undefined') {
        elements.aboutMarkdownContent.textContent = normalizedMarkdown;
        return;
    }

    const parsedHtml = marked.parse(normalizedMarkdown, { breaks: true, gfm: true });
    elements.aboutMarkdownContent.innerHTML = sanitizeHtml(parsedHtml);
    elements.aboutMarkdownContent.classList.add('markdown-content');
}

renderAboutMarkdown();
updateTokenCounter(0, 0, currentModelName);
updateServerActionButtons();
updateRagActionButton();
hideNodeCtxMenu();
const persistedUiState = readPersistedWebviewUiState();
if (persistedUiState?.activeTab === 'chat' || persistedUiState?.activeTab === 'settings' || persistedUiState?.activeTab === 'about') {
    activeTab = persistedUiState.activeTab === 'about' ? 'settings' : persistedUiState.activeTab;
}
if (typeof persistedUiState?.ragEnabled === 'boolean') {
    ragEnabled = persistedUiState.ragEnabled;
    uiState.ragEnabled = ragEnabled;
}
switchTab(activeTab, false, true);
autoResizePrompt();
applyControlState();
updateServerTreeIcons();
elements.vscode.postMessage({ type: 'webviewReady' });