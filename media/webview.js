// ============================================================
// HTML TEMPLATES (Static HTML without value injection)
// ============================================================
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

// ============================================================
// DOM ELEMENTS CACHE
// ============================================================
const elements = {
    vscode: acquireVsCodeApi(),
    chatTabBtn: document.getElementById('chat-tab-btn'),
    settingsTabBtn: document.getElementById('settings-tab-btn'),
    aboutTabBtn: document.getElementById('about-tab-btn'),
    chatTabPanel: document.getElementById('chat-tab-panel'),
    settingsTabPanel: document.getElementById('settings-tab-panel'),
    aboutTabPanel: document.getElementById('about-tab-panel'),
    aboutMarkdownContent: document.getElementById('about-markdown-content'),
    llamaStatusBadge: document.getElementById('llama-status-badge'),
    serverStartBtn: document.getElementById('server-start-btn'),
    serverStopBtn: document.getElementById('server-stop-btn'),
    ragIndexBtn: document.getElementById('rag-index-btn'),
    llamaSettingsAccordion: document.getElementById('llama-settings-accordion'),
    chromadbSettingsAccordion: document.getElementById('chromadb-settings-accordion'),
    serverParametersList: document.getElementById('server-parameters-list'),
    ragChromaUrlValue: document.getElementById('rag-chroma-url-value'),
    ragChromaPortValue: document.getElementById('rag-chroma-port-value'),
    ragChromaCollectionPrefixValue: document.getElementById('rag-chroma-collection-prefix-value'),
    ragChromaExcludeDirsValue: document.getElementById('rag-chroma-exclude-dirs-value'),
    ragChromaExcludeFileGlobsValue: document.getElementById('rag-chroma-exclude-file-globs-value'),
    ragChromaMaxFileSizeKbValue: document.getElementById('rag-chroma-max-file-size-kb-value'),
    ragChromaMaxIndexedFilesValue: document.getElementById('rag-chroma-max-indexed-files-value'),
    ragChromaChunkSizeCharsValue: document.getElementById('rag-chroma-chunk-size-chars-value'),
    ragChromaChunkOverlapCharsValue: document.getElementById('rag-chroma-chunk-overlap-chars-value'),
    ragChromaVectorCandidatePoolValue: document.getElementById('rag-chroma-vector-candidate-pool-value'),
    ragChromaMaxQueryResultsValue: document.getElementById('rag-chroma-max-query-results-value'),
    serverActionStartIcon: document.getElementById('server-action-start-icon'),
    serverActionStopIcon: document.getElementById('server-action-stop-icon'),
    serverActionText: document.getElementById('server-action-text'),
    serverActionLoader: document.getElementById('server-action-loader'),
    ragActionRefreshIcon: document.getElementById('rag-action-refresh-icon'),
    serverActionCopyIcon: document.getElementById('server-action-copy-icon'),
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
    ragEnabledCheckbox: document.getElementById('rag-enabled'),
    fileBadge: document.getElementById('attached-file-badge'),
    fileNameText: document.getElementById('file-name-text'),
    stopBtn: document.getElementById('stop'),
    sendBtn: document.getElementById('send'),
    tokenCounter: document.getElementById('token-counter'),
    tokenUsageChart: document.getElementById('token-usage-chart'),
    tokenUsagePercentage: document.getElementById('token-usage-percentage'),
    tokenUsageContainer: document.getElementById('token-usage-container'),
    modelNameDisplay: document.getElementById('model-name-display'),
    contextWindow: document.getElementById('context-window'),
    contextWindowContent: document.getElementById('context-window-content'),
    attachedFilesContainer: null
};

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
        'Llama.cpp',
        `Status: ${elements.llamaStatusBadge?.textContent?.trim() || 'unknown'}`,
        `State: ${elements.serverActionText?.textContent?.trim() || '-'}`
    ].join('\n');
}

function buildChromaPanelCopyText() {
    return [
        'ChromaDB',
        `Action: ${elements.ragActionText?.textContent?.trim() || '-'}`,
        `URL: ${elements.ragChromaUrlValue?.textContent?.trim() || '-'}`,
        `Port: ${elements.ragChromaPortValue?.textContent?.trim() || '-'}`,
        `Collection Prefix: ${elements.ragChromaCollectionPrefixValue?.textContent?.trim() || '-'}`
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
    ragChromaUrlLabel: document.body.dataset.ragChromaUrlLabel || 'ChromaDB URL',
    ragChromaPortLabel: document.body.dataset.ragChromaPortLabel || 'ChromaDB port',
    ragChromaUnavailableLabel: document.body.dataset.ragChromaUnavailableLabel || 'ChromaDB server is not active'
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
    updateRagState: {}
};

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
    }

    return true;
}

const BLOCKED_HTML_TAGS = new Set([
    'script', 'style', 'iframe', 'object', 'embed',
    'link', 'meta', 'base', 'form',
    'svg', 'math'
]);

function isSafeUrl(urlValue) {
    const value = String(urlValue || '').trim();
    if (!value) {
        return true;
    }

    if (value.startsWith('//')) {
        return false;
    }

    if (value.startsWith('#') || value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) {
        return true;
    }

    return /^(https?:|mailto:)/i.test(value);
}

function sanitizeHtml(unsafeHtml) {
    const template = document.createElement('template');
    template.innerHTML = String(unsafeHtml || '');

    const allElements = template.content.querySelectorAll('*');
    allElements.forEach((element) => {
        const tagName = element.tagName.toLowerCase();

        if (BLOCKED_HTML_TAGS.has(tagName)) {
            element.remove();
            return;
        }

        Array.from(element.attributes).forEach((attribute) => {
            const attrName = attribute.name.toLowerCase();
            const attrValue = attribute.value;

            if (attrName.startsWith('on') || attrName === 'style') {
                element.removeAttribute(attribute.name);
                return;
            }

            if ((attrName === 'href' || attrName === 'src' || attrName === 'xlink:href') && !isSafeUrl(attrValue)) {
                element.removeAttribute(attribute.name);
            }
        });
    });

    return template.innerHTML;
}

// Lazy load attachedFilesContainer
function getAttachedFilesContainer() {
    if (!elements.attachedFilesContainer) {
        elements.attachedFilesContainer = document.getElementById('attached-files-container');
    }
    return elements.attachedFilesContainer;
}

// ============================================================
// STATE MANAGEMENT
// ============================================================
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
let isServerRunning = false;
let wasServerStartedByPlugin = false;
let currentSessions = [];
let pendingServerAction = null;
let isRagIndexing = false;
let isChromaAvailable = false;
let hasActiveSession = false;
let currentSessionTokens = 0;
let serverLaunchCommandLine = '';
let sequentialDotFrame = 0;
let sequentialDotTimer = null;

const serverActionStartIconMarkup = elements.serverActionStartIcon?.innerHTML || '';
const serverActionStopIconMarkup = elements.serverActionStopIcon?.innerHTML || '';
const ragActionRefreshIconMarkup = elements.ragActionRefreshIcon?.innerHTML || '';

function getServerControlState() {
    const isPendingStart = pendingServerAction === 'starting';
    const isPendingStop = pendingServerAction === 'stopping';
    const isStopBlocked = isServerRunning && !wasServerStartedByPlugin;

    return {
        isPendingStart,
        isPendingStop,
        isStopBlocked,
        canStart: !pendingServerAction && !isServerRunning,
        canStop: !pendingServerAction && isServerRunning && !isStopBlocked
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

function updateLlamaStatusBadge() {
    if (!elements.llamaStatusBadge) {
        return;
    }

    const state = getServerControlState();
    let text = 'stopped';
    let statusClass = 'is-stopped';

    if (state.isPendingStart) {
        text = 'started';
        statusClass = 'is-started';
    } else if (isServerRunning) {
        text = 'running';
        statusClass = 'is-running';
    }

    elements.llamaStatusBadge.textContent = text;
    elements.llamaStatusBadge.classList.remove('is-started', 'is-running', 'is-stopped');
    elements.llamaStatusBadge.classList.add(statusClass);
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

    if (pendingServerAction === 'starting' && elements.serverActionStartIcon) {
        elements.serverActionStartIcon.textContent = dots;
    }

    if (isRagIndexing && elements.ragActionRefreshIcon) {
        elements.ragActionRefreshIcon.textContent = dots;
    }
}

function updateSequentialDotTimer() {
    const shouldAnimate = pendingServerAction === 'starting' || isRagIndexing;

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
    // Current visible tab in the UI.
    activeTab: 'chat',
    // Tabs visited by the user during this webview lifecycle.
    activeScreens: ['chat'],
    // Whether llama.cpp server is currently running.
    isServerRunning: false,
    // Whether the running server process was started by this extension.
    wasServerStartedByPlugin: false,
    // Current pending server action (starting/stopping) if any.
    pendingServerAction: null,
    // Whether repository indexing is currently running.
    isRagIndexing: false,
    // Whether ChromaDB is reachable.
    isChromaAvailable: false,
    // Whether a chat session is currently active.
    hasActiveSession: false,
    // Whether assistant generation transaction is active.
    isInTransaction: false,
    // Current context window reported by backend.
    currentContextWindow: 0,
    // Current model name reported by backend.
    currentModelName: 'local',
    // Current session token estimate.
    currentSessionTokens: 0,
    // Open state for settings accordion sections.
    settingsAccordionState: {
        llamaOpen: true,
        chromadbOpen: false
    }
};

function readSettingsAccordionState() {
    return {
        llamaOpen: !!elements.llamaSettingsAccordion?.open,
        chromadbOpen: !!elements.chromadbSettingsAccordion?.open
    };
}

function applySettingsAccordionState(state) {
    if (!state || typeof state !== 'object') {
        return;
    }

    const nextLlamaOpen = !!state.llamaOpen;
    const nextChromadbOpen = !!state.chromadbOpen;

    if (elements.llamaSettingsAccordion) {
        elements.llamaSettingsAccordion.open = nextLlamaOpen;
    }
    if (elements.chromadbSettingsAccordion) {
        elements.chromadbSettingsAccordion.open = nextChromadbOpen;
    }

    uiState.settingsAccordionState = {
        llamaOpen: nextLlamaOpen,
        chromadbOpen: nextChromadbOpen
    };
}
function updateServerActionPanel() {
    if (!elements.serverActionStartIcon || !elements.serverActionStopIcon || !elements.serverActionText || !elements.serverActionLoader) {
        return;
    }

    const state = getServerControlState();

    if (state.isPendingStart) {
        elements.serverActionStartIcon.style.display = 'flex';
        elements.serverActionStartIcon.disabled = true;
        elements.serverActionStartIcon.title = 'Starting';
        elements.serverActionStartIcon.textContent = getSequentialDotsText();
        elements.serverActionStopIcon.style.display = 'none';
        elements.serverActionText.textContent = serverLaunchCommandLine || 'start';
        elements.serverActionLoader.style.display = 'none';
        updateSequentialDotTimer();
        return;
    }

    elements.serverActionStartIcon.innerHTML = serverActionStartIconMarkup;
    elements.serverActionStartIcon.disabled = false;
    elements.serverActionStartIcon.title = 'Start';
    elements.serverActionLoader.style.display = 'none';

    if (isServerRunning) {
        elements.serverActionStartIcon.style.display = 'none';
        elements.serverActionStopIcon.style.display = 'flex';
        elements.serverActionStopIcon.disabled = !state.canStop;
        elements.serverActionStopIcon.title = state.isStopBlocked
            ? labels.externalServerBlockedLabel
            : 'Stop';
        elements.serverActionStopIcon.innerHTML = serverActionStopIconMarkup;
        elements.serverActionText.textContent = serverLaunchCommandLine || 'running';
    } else {
        elements.serverActionStartIcon.style.display = 'flex';
        elements.serverActionStopIcon.style.display = 'none';
        elements.serverActionText.textContent = serverLaunchCommandLine || 'start';
    }

    updateSequentialDotTimer();
}

function updateRagActionPanel() {
    if (!elements.ragActionRefreshIcon || !elements.ragActionText || !elements.ragActionLoader) {
        return;
    }

    const state = getRagControlState();

    if (state.isIndexing) {
        elements.ragActionText.textContent = 'indexing';
        elements.ragActionRefreshIcon.textContent = getSequentialDotsText();
        elements.ragActionRefreshIcon.disabled = true;
        elements.ragActionLoader.style.display = 'none';
    } else {
        elements.ragActionText.textContent = 'index';
        elements.ragActionRefreshIcon.innerHTML = ragActionRefreshIconMarkup;
        elements.ragActionLoader.style.display = 'none';
        elements.ragActionRefreshIcon.disabled = state.isUnavailable;
    }

    updateSequentialDotTimer();
}


function persistSettingsAccordionState() {
    const state = readSettingsAccordionState();
    uiState.settingsAccordionState = state;
    elements.vscode.postMessage({ type: 'setSettingsAccordionState', state });
}

function setRagIndexingState(value) {
    isRagIndexing = !!value;
    uiState.isRagIndexing = isRagIndexing;
    updateRagActionButton();
    updateRagActionPanel();
}

function createAutoContextKey(name, content) {
    return `${name}::${content}`;
}

function getBaseFileName(fileName) {
    return (fileName || '').replace(/:\d+(?:-\d+)?$/, '');
}

function canUseInputActions() {
    return isServerRunning && !isInTransaction;
}

function canStopGeneration() {
    return isServerRunning && isInTransaction;
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

    // Apply same blocking logic to RAG checkbox as attach button
    if (elements.ragEnabledCheckbox) {
        elements.ragEnabledCheckbox.disabled = !allowMainActions;
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

    renderAllBadges();
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

// ============================================================
// EVENT LISTENERS
// ============================================================
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
elements.ragActionRefreshIcon?.addEventListener('click', () => {
    requestRagIndex(elements.ragActionRefreshIcon);
});
elements.ragActionCopyIcon?.addEventListener('click', () => {
    copyActionText(elements.ragActionCopyIcon, buildChromaPanelCopyText());
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
elements.contextWindow?.addEventListener('click', (event) => {
    event.stopPropagation();
});
document.addEventListener('click', () => {
    hideContextWindow();
});
window.addEventListener('resize', () => {
    if (activeContextMenu && activeContextAnchor) {
        placeContextWindow(activeContextAnchor);
    }
});
window.addEventListener('blur', () => {
    hideContextWindow();
});

// ============================================================
// MESSAGE HANDLERS - MAIN DISPATCHER
// ============================================================
function handleExtensionMessage(event) {
    const message = event.data;

    if (!isValidIncomingMessage(message)) {
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
            if (message.activeTab) {
                switchTab(message.activeTab, false);
            }
            if (Array.isArray(message.activeScreens)) {
                uiState.activeScreens = message.activeScreens.filter((screen) =>
                    screen === 'chat' || screen === 'settings' || screen === 'about'
                );
                if (uiState.activeScreens.length === 0) {
                    uiState.activeScreens = [uiState.activeTab];
                }
            }
            if (typeof message.hasActiveSession === 'boolean') {
                setHasActiveSession(message.hasActiveSession);
            }
            if (message.settingsAccordionState && typeof message.settingsAccordionState === 'object') {
                applySettingsAccordionState(message.settingsAccordionState);
            }
            break;
        case 'updateServerState':
            renderServerState(message);
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
    setRagIndexingState(!!message.isIndexing);
    isChromaAvailable = !!message.chromaAvailable;
    uiState.isChromaAvailable = isChromaAvailable;
    updateRagActionButton();
    updateRagActionPanel();

    if (elements.ragChromaUrlValue) {
        elements.ragChromaUrlValue.textContent = typeof message.chromaUrl === 'string' && message.chromaUrl
            ? message.chromaUrl
            : 'http://127.0.0.1';
    }

    if (elements.ragChromaPortValue) {
        elements.ragChromaPortValue.textContent = String(Number(message.chromaPort) || 8000);
    }

    if (elements.ragChromaCollectionPrefixValue) {
        elements.ragChromaCollectionPrefixValue.textContent = String(message.chromaCollectionPrefix || '-');
    }

    if (elements.ragChromaExcludeDirsValue) {
        elements.ragChromaExcludeDirsValue.textContent = String(message.chromaExcludeDirs || '-');
    }

    if (elements.ragChromaExcludeFileGlobsValue) {
        elements.ragChromaExcludeFileGlobsValue.textContent = String(message.chromaExcludeFileGlobs || '-');
    }

    if (elements.ragChromaMaxFileSizeKbValue) {
        elements.ragChromaMaxFileSizeKbValue.textContent = String(Number(message.chromaMaxFileSizeKb) || 0);
    }

    if (elements.ragChromaMaxIndexedFilesValue) {
        elements.ragChromaMaxIndexedFilesValue.textContent = String(Number(message.chromaMaxIndexedFiles) || 0);
    }

    if (elements.ragChromaChunkSizeCharsValue) {
        elements.ragChromaChunkSizeCharsValue.textContent = String(Number(message.chromaChunkSizeChars) || 0);
    }

    if (elements.ragChromaChunkOverlapCharsValue) {
        elements.ragChromaChunkOverlapCharsValue.textContent = String(Number(message.chromaChunkOverlapChars) || 0);
    }

    if (elements.ragChromaVectorCandidatePoolValue) {
        elements.ragChromaVectorCandidatePoolValue.textContent = String(Number(message.chromaVectorCandidatePool) || 0);
    }

    if (elements.ragChromaMaxQueryResultsValue) {
        elements.ragChromaMaxQueryResultsValue.textContent = String(Number(message.chromaMaxQueryResults) || 0);
    }

}

// ============================================================
// MESSAGE HANDLER IMPLEMENTATIONS
// ============================================================

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

// ============================================================
// UI RENDERING FUNCTIONS
// ============================================================

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
    title.textContent = isServerRunning ? labels.emptyChatReadyLabel : labels.emptyServerStoppedLabel;

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

// ============================================================
// UI STATE HELPERS
// ============================================================

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

    if (isServerRunning || currentSessions.length === 0) {
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
    pendingServerAction = action;
    uiState.pendingServerAction = pendingServerAction;
    updateServerActionButtons();
    updateServerActionPanel();
}

function clearPendingServerAction() {
    pendingServerAction = null;
    uiState.pendingServerAction = pendingServerAction;
    updateServerActionButtons();
    updateServerActionPanel();
}

function updateServerActionButtons() {
    const state = getServerControlState();
    updateLlamaStatusBadge();

    if (elements.serverStartBtn) {
        elements.serverStartBtn.disabled = !state.canStart;
        elements.serverStartBtn.classList.toggle('is-pending', state.isPendingStart);
        const label = state.isPendingStart
            ? (elements.serverStartBtn.dataset.loadingLabel || 'Start')
            : (elements.serverStartBtn.dataset.label || 'Start');
        setServerButtonContent(elements.serverStartBtn, label, 'start', state.isPendingStart);
    }


    if (elements.serverStopBtn) {
        elements.serverStopBtn.disabled = !state.canStop;
        elements.serverStopBtn.classList.toggle('is-pending', state.isPendingStop);
        elements.serverStopBtn.classList.toggle('is-disabled', state.isStopBlocked);
        elements.serverStopBtn.title = state.isStopBlocked
            ? labels.externalServerBlockedLabel
            : (elements.serverStopBtn.dataset.label || 'Detener');
        const label = state.isPendingStop
            ? (elements.serverStopBtn.dataset.loadingLabel || 'Stop')
            : (elements.serverStopBtn.dataset.label || 'Stop');
        setServerButtonContent(elements.serverStopBtn, label, 'stop', state.isPendingStop);
    }
}
function syncServerStoppedNotice() {
    removeServerStoppedNotice();

    if (isServerRunning || !isActiveChatVisible()) {
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

function switchTab(tabName, shouldPersist = true) {
    activeTab = tabName;
    uiState.activeTab = tabName;
    if (!uiState.activeScreens.includes(tabName)) {
        uiState.activeScreens.push(tabName);
    }
    const isChatTab = tabName === 'chat';
    const isSettingsTab = tabName === 'settings';
    const isAboutTab = tabName === 'about';

    elements.chatTabBtn?.classList.toggle('is-active', isChatTab);
    elements.settingsTabBtn?.classList.toggle('is-active', isSettingsTab);
    elements.aboutTabBtn?.classList.toggle('is-active', isAboutTab);
    elements.chatTabBtn?.setAttribute('aria-selected', String(isChatTab));
    elements.settingsTabBtn?.setAttribute('aria-selected', String(isSettingsTab));
    elements.aboutTabBtn?.setAttribute('aria-selected', String(isAboutTab));

    if (elements.chatTabPanel) {
        elements.chatTabPanel.style.display = isChatTab ? 'flex' : 'none';
    }
    if (elements.settingsTabPanel) {
        elements.settingsTabPanel.style.display = isSettingsTab ? 'flex' : 'none';
    }
    if (elements.aboutTabPanel) {
        elements.aboutTabPanel.style.display = isAboutTab ? 'flex' : 'none';
    }

    if (shouldPersist) {
        elements.vscode.postMessage({ type: 'setActiveTab', tab: activeTab });
    }
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

// ============================================================
// TOKEN COUNTER
// ============================================================

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

    const totalLabel = hasTotal ? contextWindow.toLocaleString() : '?';

    if (elements.tokenUsagePercentage) {
        elements.tokenUsagePercentage.textContent = `${pct}%`;
    }

    if (elements.tokenUsageChart) {
        elements.tokenUsageChart.style.setProperty('--token-usage-pct', String(pct));
        elements.tokenUsageChart.title = `${pct}% - Click for details`;
    }

    tokenUsageState = {
        used: currentSessionTokens,
        total: hasTotal ? contextWindow : 0,
        pct
    };

    if (elements.modelNameDisplay) {
        elements.modelNameDisplay.textContent = modelName || 'local';
    }

}

function renderServerState(message) {
    isServerRunning = !!message.isRunning;
    wasServerStartedByPlugin = !!message.wasServerStartedByPlugin;
    uiState.isServerRunning = isServerRunning;
    uiState.wasServerStartedByPlugin = wasServerStartedByPlugin;

    if (typeof message.commandLine === 'string' && message.commandLine.trim()) {
        serverLaunchCommandLine = message.commandLine.trim();
    }

    if (pendingServerAction === 'starting' && isServerRunning) {
        clearPendingServerAction();
    } else if (pendingServerAction === 'stopping' && !isServerRunning) {
        clearPendingServerAction();
    }

    if (elements.serverStartBtn) {
        elements.serverStartBtn.style.display = isServerRunning ? 'none' : 'inline-flex';
    }

    if (elements.serverStopBtn) {
        elements.serverStopBtn.style.display = isServerRunning ? 'inline-flex' : 'none';
    }

    if (elements.serverParametersList) {
        elements.serverParametersList.innerHTML = '';
        (message.parameterRows || []).forEach((row) => {
            const line = document.createElement('div');
            line.className = 'server-parameter-row';

            const propertyLabel = document.createElement('span');
            propertyLabel.className = 'server-parameter-label';
            propertyLabel.textContent = String(row.property || '-');

            const valueLabel = document.createElement('span');
            valueLabel.className = 'server-parameter-value';
            valueLabel.textContent = String(row.value || '-');

            line.appendChild(propertyLabel);
            line.appendChild(valueLabel);
            elements.serverParametersList.appendChild(line);
        });

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
    }

    updateServerActionButtons();
    updateServerActionPanel();
    applyControlState();
    syncServerStoppedNotice();
    syncSessionCardsAvailability();
    syncSessionsServerStoppedNotice();
    updateTokenCounter(currentSessionTokens, currentContextWindow, currentModelName);

    if (currentSessions.length === 0 && elements.sessionsList) {
        elements.sessionsList.innerHTML = '';
        createEmptySessionsCard();
    }
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

    const totalLabel = tokenUsageState.total > 0 ? tokenUsageState.total.toLocaleString() : '?';
    const usedLabel = tokenUsageState.used.toLocaleString();
    const pct = tokenUsageState.pct;
    const fillColor = getTokenFillColor(pct);

    elements.contextWindowContent.innerHTML = `
        <div class="token-usage-window-values">${usedLabel} / ${totalLabel} tokens</div>
        <div class="token-usage-window-bar" aria-hidden="true">
            <div class="token-usage-window-bar-fill" style="width: ${pct}%; background: ${fillColor};"></div>
        </div>
    `;
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
    if (!isServerRunning || !elements.tokenUsageContainer || elements.tokenUsageContainer.classList.contains('is-disabled')) {
        return;
    }

    const shouldClose = activeContextMenu === 'token' && elements.contextWindow?.style.display === 'block';
    if (shouldClose) {
        hideContextWindow();
        return;
    }

    showContextWindow('token', elements.tokenUsageContainer);
}

function closeTokenUsageMenu() {
    if (activeContextMenu === 'token') {
        hideContextWindow();
    }
}

// ============================================================
// MESSAGE PROCESSING HELPERS
// ============================================================

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
        elements.vscode.postMessage({ type: 'askLlama', value: text, attachedFiles: currentAttachedFiles });
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
    cleanText = cleanText.split(/Indicación(?: del usuario)?:/i).pop()?.trim() || cleanText; cleanText = cleanText.replace(/\s+/g, ' ');
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

function setupSingleOpenAccordion() {
    const accordionItems = document.querySelectorAll('.settings-accordion .settings-accordion-item');
    let foundOpen = false;
    accordionItems.forEach((item) => {
        if (item.open && !foundOpen) {
            foundOpen = true;
            return;
        }
        item.open = false;
    });

    accordionItems.forEach((item) => {
        item.addEventListener('toggle', () => {
            if (!item.open) {
                persistSettingsAccordionState();
                return;
            }

            accordionItems.forEach((otherItem) => {
                if (otherItem !== item) {
                    otherItem.open = false;
                }
            });

            persistSettingsAccordionState();
        });
    });

    uiState.settingsAccordionState = readSettingsAccordionState();
}
// ============================================================// INITIALIZATION// ============================================================
renderAboutMarkdown();
setupSingleOpenAccordion();
updateTokenCounter(0, 0, currentModelName);
updateServerActionButtons();
updateRagActionButton();
switchTab(activeTab, false);
autoResizePrompt();
applyControlState();
elements.vscode.postMessage({ type: 'webviewReady' });