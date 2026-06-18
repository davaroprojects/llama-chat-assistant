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

function createFileBadgeNode(filename) {
    const badge = document.createElement('div');
    badge.className = 'attached-file-badge';

    const span = document.createElement('span');
    span.textContent = `📄 ${filename}`;
    badge.appendChild(span);

    return badge;
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
    serverTabBtn: document.getElementById('server-tab-btn'),
    chatTabPanel: document.getElementById('chat-tab-panel'),
    serverTabPanel: document.getElementById('server-tab-panel'),
    serverStartBtn: document.getElementById('server-start-btn'),
    serverStopBtn: document.getElementById('server-stop-btn'),
    serverParametersBody: document.getElementById('server-parameters-body'),
    chat: document.getElementById('chat'),
    prompt: document.getElementById('prompt'),
    sessionsContainer: document.getElementById('sessions-container'),
    sessionsMainTitle: document.getElementById('sessions-main-title'),
    activeSessionHeader: document.getElementById('active-session-header'),
    activeSessionTitle: document.getElementById('active-session-title'),
    backToSessionsBtn: document.getElementById('back-to-sessions-btn'),
    sessionsList: document.getElementById('sessions-list'),
    attachBtn: document.getElementById('attach-file-btn'),
    fileBadge: document.getElementById('attached-file-badge'),
    fileNameText: document.getElementById('file-name-text'),
    stopBtn: document.getElementById('stop'),
    sendBtn: document.getElementById('send'),
    tokenCounter: document.getElementById('token-counter'),
    tokenCounterValue: document.getElementById('token-counter-value'),
    modelMenuTrigger: document.getElementById('model-menu-trigger'),
    modelContextMenu: document.getElementById('model-context-menu'),
    modelContextMenuItem: document.getElementById('model-context-menu-item'),
    attachedFilesContainer: null
};

const labels = {
    emptyChatReadyLabel: document.body.dataset.emptyChatReadyLabel || 'Inicie una nueva sesion desde el chat',
    emptyServerStoppedLabel: document.body.dataset.emptyServerStoppedLabel || 'Inicie el servidor para iniciar',
    deleteSessionLabel: document.body.dataset.deleteSessionLabel || 'Eliminar sesión permanentemente',
    sessionUnavailableLabel: document.body.dataset.sessionUnavailableLabel || 'No disponible mientras el servidor está detenido',
    generationCanceledLabel: document.body.dataset.generationCanceledLabel || 'Generación cancelada',
    removeFileTitle: document.body.dataset.removeFileTitle || 'Quitar archivo',
    unavailableShortLabel: document.body.dataset.unavailableShortLabel || 'No disponible',
    copyCodeTitle: document.body.dataset.copyCodeTitle || 'Copiar código',
    copyClipboardTitle: document.body.dataset.copyClipboardTitle || 'Copiar al portapapeles',
    newSessionLabel: document.body.dataset.newSessionLabel || 'Nueva Sesión',
    externalServerBlockedLabel: document.body.dataset.externalServerBlockedLabel || 'Server started externally. Cannot stop from here.'
};

const BLOCKED_HTML_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form']);

function isSafeUrl(urlValue) {
    const value = String(urlValue || '').trim();
    if (!value) {
        return true;
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

            if ((attrName === 'href' || attrName === 'src') && !isSafeUrl(attrValue)) {
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

function applyControlState() {
    const allowMainActions = canUseInputActions();
    const allowStop = canStopGeneration();

    elements.prompt.disabled = !allowMainActions;

    elements.attachBtn.classList.toggle('is-disabled', !allowMainActions);
    elements.backToSessionsBtn.classList.toggle('is-disabled', !allowMainActions);
    elements.modelMenuTrigger?.classList.toggle('is-disabled', !allowMainActions);

    elements.attachBtn.setAttribute('aria-disabled', String(!allowMainActions));
    elements.backToSessionsBtn.setAttribute('aria-disabled', String(!allowMainActions));
    elements.modelMenuTrigger?.setAttribute('aria-disabled', String(!allowMainActions));

    if (elements.modelMenuTrigger) {
        elements.modelMenuTrigger.disabled = !allowMainActions;
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
        closeModelMenu();
    }

    renderAllBadges();
}

// ============================================================
// EVENT LISTENERS
// ============================================================
elements.chatTabBtn?.addEventListener('click', () => switchTab('chat'));
elements.serverTabBtn?.addEventListener('click', () => switchTab('server'));
elements.serverStartBtn?.addEventListener('click', () => {
    if (pendingServerAction || isServerRunning) {
        return;
    }
    setPendingServerAction('starting');
    elements.serverStartBtn.blur();
    elements.vscode.postMessage({ type: 'startServer' });
});
elements.serverStopBtn?.addEventListener('click', () => {
    if (pendingServerAction || !isServerRunning) {
        return;
    }
    setPendingServerAction('stopping');
    elements.serverStopBtn.blur();
    elements.vscode.postMessage({ type: 'stopServer' });
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
window.addEventListener('message', handleWebsocketMessage);
elements.modelMenuTrigger?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleModelMenu();
});
elements.modelContextMenu?.addEventListener('click', (event) => {
    event.stopPropagation();
});
document.addEventListener('click', closeModelMenu);

// ============================================================
// MESSAGE HANDLERS - MAIN DISPATCHER
// ============================================================
function handleWebsocketMessage(event) {
    const message = event.data;

    if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
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
            if (typeof message.modelName === 'string' && message.modelName.trim()) {
                currentModelName = message.modelName.trim();
            }
            updateTokenCounter(0, currentContextWindow, currentModelName);
            break;
        case 'restoreUiState':
            if (message.activeTab) {
                switchTab(message.activeTab, false);
            }
            break;
        case 'updateServerState':
            renderServerState(message);
            break;
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
    showChatView();
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
    } else {
        currentSessions.forEach(session => createSessionCard(session));
        syncSessionsServerStoppedNotice();
    }

    if (elements.activeSessionHeader.style.display !== 'flex') {
        elements.sessionsMainTitle.style.display = 'block';
        elements.sessionsList.style.display = 'flex';
        elements.sessionsContainer.style.display = 'flex';
        elements.chat.style.display = 'none';
    }

    if (message.contextWindow !== undefined) {
        currentContextWindow = message.contextWindow;
    }

    if (typeof message.modelName === 'string' && message.modelName.trim()) {
        currentModelName = message.modelName.trim();
    }

    updateTokenCounter(0, currentContextWindow, currentModelName);
}

function handleFileSelected(message) {
    const yaExiste = currentAttachedFiles.some(f => f.name === message.name);
    if (!yaExiste) {
        currentAttachedFiles.push({
            name: message.name,
            content: message.content,
            isAutomatic: false
        });
        renderAllBadges();
    }
}

function handleAddMessage(message) {
    if (message.role === 'user') {
        if (elements.activeSessionHeader.style.display !== 'flex') {
            elements.sessionsContainer.style.display = 'none';
            elements.chat.style.display = 'flex';
            elements.activeSessionTitle.innerText = truncateTitle(message.text);
            elements.activeSessionHeader.style.display = 'flex';
        }
        renderUserMessageLive(message);
    }
}

function handleStartStreaming() {
    isInTransaction = true;
    applyControlState();
    currentAssistantText = "";
    lastBlockRenderTime = 0;

    const container = document.createElement('div');
    container.className = 'message-container assistant';
    const msgBubble = document.createElement('div');
    msgBubble.className = 'message loading-bubble';

    currentAssistantBubble = document.createElement('div');
    currentAssistantBubble.className = 'markdown-content';
    msgBubble.appendChild(currentAssistantBubble);

    streamingBlocksContainer = currentAssistantBubble;

    msgBubble.appendChild(createTypingIndicator());

    container.appendChild(msgBubble);
    elements.chat.appendChild(container);
    elements.chat.scrollTop = elements.chat.scrollHeight;
}

function handleAppendToken(message) {
    if (!currentAssistantBubble) return;

    let tokenText = message.text;
    if (tokenText.startsWith('{') && tokenText.includes('"text"')) {
        try {
            const parsed = JSON.parse(tokenText);
            tokenText = parsed.text;
        } catch (e) { }
    }

    const bubbleNode = currentAssistantBubble.closest('.message');
    if (bubbleNode) {
        bubbleNode.classList.remove('loading-bubble');
        const indicator = bubbleNode.querySelector('.typing-indicator');
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
        const badge = createFileBadgeNode(file.name);

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
    elements.sessionsContainer.style.display = 'none';
    elements.sessionsList.style.display = 'none';
    elements.sessionsMainTitle.style.display = 'none';
    elements.activeSessionHeader.style.display = 'flex';
    elements.chat.style.display = 'flex';
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
    updateServerActionButtons();
}

function clearPendingServerAction() {
    pendingServerAction = null;
    updateServerActionButtons();
}

function updateServerActionButtons() {
    if (elements.serverStartBtn) {
        const isPendingStart = pendingServerAction === 'starting';
        elements.serverStartBtn.disabled = !!pendingServerAction;
        elements.serverStartBtn.classList.toggle('is-pending', isPendingStart);
        const label = isPendingStart
            ? (elements.serverStartBtn.dataset.loadingLabel || 'Iniciar')
            : (elements.serverStartBtn.dataset.label || 'Iniciar');
        setServerButtonContent(elements.serverStartBtn, label, 'start', isPendingStart);
    }


    if (elements.serverStopBtn) {
        const isPendingStop = pendingServerAction === 'stopping';
        // Block stop button if server was started externally
        const isBlocked = isServerRunning && !wasServerStartedByPlugin;
        elements.serverStopBtn.disabled = !!pendingServerAction || isBlocked;
        elements.serverStopBtn.classList.toggle('is-pending', isPendingStop);
        elements.serverStopBtn.classList.toggle('is-disabled', isBlocked);
        elements.serverStopBtn.title = isBlocked
            ? labels.externalServerBlockedLabel
            : (elements.serverStopBtn.dataset.label || 'Detener');
        const label = isPendingStop
            ? (elements.serverStopBtn.dataset.loadingLabel || 'Detener')
            : (elements.serverStopBtn.dataset.label || 'Detener');
        setServerButtonContent(elements.serverStopBtn, label, 'stop', isPendingStop);
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
    const isChatTab = tabName === 'chat';

    elements.chatTabBtn?.classList.toggle('is-active', isChatTab);
    elements.serverTabBtn?.classList.toggle('is-active', !isChatTab);
    elements.chatTabBtn?.setAttribute('aria-selected', String(isChatTab));
    elements.serverTabBtn?.setAttribute('aria-selected', String(!isChatTab));

    if (elements.chatTabPanel) {
        elements.chatTabPanel.style.display = isChatTab ? 'flex' : 'none';
    }
    if (elements.serverTabPanel) {
        elements.serverTabPanel.style.display = isChatTab ? 'none' : 'flex';
    }

    closeModelMenu();

    if (shouldPersist) {
        elements.vscode.postMessage({ type: 'setActiveTab', tab: activeTab });
    }
}

function handleBackToSessions() {
    if (!canUseInputActions()) {
        return;
    }

    elements.chat.innerHTML = '';
    elements.chat.style.display = 'none';
    elements.activeSessionHeader.style.display = 'none';
    elements.activeSessionTitle.innerText = '';
    elements.vscode.postMessage({ type: 'selectSession', sessionId: null });
    elements.vscode.postMessage({ type: 'requestSessionsUpdate' });
    elements.sessionsMainTitle.style.display = 'block';
    elements.sessionsList.style.display = 'flex';
    elements.sessionsContainer.style.display = 'flex';
    elements.vscode.postMessage({ type: 'webviewReady' });

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
    const hasTotal = contextWindow > 0;
    const pct = hasTotal ? Math.min(100, Math.round((sessionTokens / contextWindow) * 100)) : 0;
    const warnClass = hasTotal
        ? (pct >= 90 ? ' token-counter--danger' : pct >= 70 ? ' token-counter--warn' : '')
        : '';
    elements.tokenCounter.className = 'token-counter' + warnClass;
    const totalLabel = hasTotal ? contextWindow.toLocaleString() : '?';
    const normalizedModelName = (modelName || 'local').trim();
    if (elements.tokenCounterValue) {
        elements.tokenCounterValue.textContent = `${sessionTokens.toLocaleString()} / ${totalLabel} tokens`;
    }
    if (elements.modelContextMenuItem) {
        elements.modelContextMenuItem.textContent = normalizedModelName;
    }
}

function renderServerState(message) {
    isServerRunning = !!message.isRunning;
    wasServerStartedByPlugin = !!message.wasServerStartedByPlugin;
    clearPendingServerAction();

    if (elements.serverStartBtn) {
        elements.serverStartBtn.style.display = isServerRunning ? 'none' : 'inline-flex';
    }

    if (elements.serverStopBtn) {
        elements.serverStopBtn.style.display = isServerRunning ? 'inline-flex' : 'none';
    }

    if (elements.serverParametersBody) {
        elements.serverParametersBody.innerHTML = '';
        (message.parameterRows || []).forEach((row) => {
            const tr = document.createElement('tr');

            const propertyCell = document.createElement('td');
            propertyCell.textContent = row.property;

            const valueCell = document.createElement('td');
            valueCell.textContent = row.value;

            tr.appendChild(propertyCell);
            tr.appendChild(valueCell);
            elements.serverParametersBody.appendChild(tr);
        });
    }

    updateServerActionButtons();
    applyControlState();
    syncServerStoppedNotice();
    syncSessionCardsAvailability();
    syncSessionsServerStoppedNotice();

    if (currentSessions.length === 0 && elements.sessionsList) {
        elements.sessionsList.innerHTML = '';
        createEmptySessionsCard();
    }
}

function toggleModelMenu() {
    if (!elements.modelContextMenu || !isServerRunning || elements.modelMenuTrigger?.disabled) {
        return;
    }

    const isVisible = elements.modelContextMenu.style.display === 'block';
    elements.modelContextMenu.style.display = isVisible ? 'none' : 'block';
}

function closeModelMenu() {
    if (!elements.modelContextMenu) {
        return;
    }
    elements.modelContextMenu.style.display = 'none';
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
        elements.prompt.rows = 2;
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
// ============================================================// INITIALIZATION// ============================================================
updateTokenCounter(0, 0, currentModelName);
updateServerActionButtons();
switchTab(activeTab, false);
applyControlState();
elements.vscode.postMessage({ type: 'webviewReady' });