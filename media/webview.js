// ============================================================
// HTML TEMPLATES (Static HTML without value injection)
// ============================================================
const HTML_TEMPLATES = {
    userMessage: (text) => `<div class="message"><span>${text}</span></div>`,
    attachedFileBadge: (filename) => `<span>📄 ${filename}</span>`,
    copyIcon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>`,
    checkmarkIcon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6 9 17l-5-5"/>
    </svg>`,
    typingIndicator: '<div class="typing-indicator"><span></span><span></span><span></span></div>',
    deleteSessionIcon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6 6 18M6 6l12 12"/>
    </svg>`
};

// ============================================================
// DOM ELEMENTS CACHE
// ============================================================
const elements = {
    vscode: acquireVsCodeApi(),
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
let isStreamingActive = false;
const removedAutoContextKeys = new Set();
let currentContextWindow = 0;
let currentModelName = 'local';

function createAutoContextKey(name, content) {
    return `${name}::${content}`;
}

function getBaseFileName(fileName) {
    return (fileName || '').replace(/:\d+(?:-\d+)?$/, '');
}

function setStreamingUiLocked(locked) {
    isStreamingActive = locked;

    elements.attachBtn.classList.toggle('is-disabled', locked);
    elements.backToSessionsBtn.classList.toggle('is-disabled', locked);

    elements.attachBtn.setAttribute('aria-disabled', String(locked));
    elements.backToSessionsBtn.setAttribute('aria-disabled', String(locked));

    renderAllBadges();
}

// ============================================================
// EVENT LISTENERS
// ============================================================
elements.backToSessionsBtn.addEventListener('click', handleBackToSessions);
elements.sendBtn.addEventListener('click', sendMessage);
elements.stopBtn.addEventListener('click', () => {
    elements.vscode.postMessage({ type: 'stopGeneration' });
});
elements.attachBtn.addEventListener('click', () => {
    if (isStreamingActive) {
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

    elements.chat.scrollTop = elements.chat.scrollHeight;
}

function handleRenderSessionsList(message) {
    elements.sessionsList.innerHTML = '';

    if (message.sessions.length === 0) {
        createEmptySessionsCard();
    } else {
        message.sessions.forEach(session => createSessionCard(session));
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
    setStreamingUiLocked(true);
    elements.prompt.disabled = true;
    elements.sendBtn.style.display = 'none';
    elements.stopBtn.style.display = 'flex';
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

    const indicatorContainer = document.createElement('div');
    indicatorContainer.innerHTML = HTML_TEMPLATES.typingIndicator;
    const indicatorNode = indicatorContainer.firstChild;
    msgBubble.appendChild(indicatorNode);

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
    setStreamingUiLocked(false);
    elements.prompt.disabled = false;
    elements.stopBtn.style.display = 'none';
    elements.sendBtn.style.display = 'flex';
    elements.prompt.focus();

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
    setStreamingUiLocked(false);
    elements.prompt.disabled = false;
    elements.stopBtn.style.display = 'none';
    elements.sendBtn.style.display = 'flex';
    elements.prompt.focus();

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
    container.innerHTML = `<div class="message" style="color:var(--vscode-errorForeground)">${message.text}</div>`;
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
    setStreamingUiLocked(false);
    elements.prompt.disabled = false;
    elements.stopBtn.style.display = 'none';
    elements.sendBtn.style.display = 'flex';
    elements.prompt.focus();

    const container = document.createElement('div');
    container.className = 'message-container assistant';
    container.innerHTML = `<div class="message" style="color:var(--vscode-errorForeground)">Generación cancelada</div>`;
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
        const badge = document.createElement('div');
        badge.className = 'attached-file-badge';
        badge.innerHTML = `<span>${HTML_TEMPLATES.attachedFileBadge(file.name)}</span>`;

        const removeBtn = document.createElement('div');
        removeBtn.className = 'remove-file-btn' + (isStreamingActive ? ' is-disabled' : '');
        removeBtn.innerText = '×';
        removeBtn.title = isStreamingActive ? 'No disponible durante la generación' : 'Quitar archivo';
        removeBtn.onclick = () => {
            if (isStreamingActive) { return; }
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
            userContainer.innerHTML = HTML_TEMPLATES.userMessage(message.text);
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
            userContainer.innerHTML = HTML_TEMPLATES.userMessage(text);
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
        copyBtn.title = 'Copiar código';

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
    bubbleNode.innerHTML = parsedHtml;
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
            stableContainer.innerHTML = parsedHtml;
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
    copyBtn.title = 'Copiar al portapapeles';
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
        const badge = document.createElement('div');
        badge.className = 'attached-file-badge';
        badge.innerHTML = `<span>${HTML_TEMPLATES.attachedFileBadge(filename)}</span>`;
        filesContainer.appendChild(badge);
    });

    targetContainer.appendChild(filesContainer);
}

function createSessionCard(session) {
    const card = document.createElement('div');
    card.className = 'session-card';
    card.innerHTML = `
        <div class="session-card-body">
            <div class="session-card-title"></div>
            <div class="session-card-time"></div>
        </div>
        <div class="delete-session-button" title="Eliminar sesión permanentemente">
            ${HTML_TEMPLATES.deleteSessionIcon}
        </div>
    `;

    card.querySelector('.session-card-title').innerText = session.title || "Nueva Sesión";
    card.querySelector('.session-card-time').innerText = session.relativeTime || "";

    card.onclick = () => {
        showChatView();
        elements.activeSessionTitle.innerText = session.title;
        elements.chat.innerHTML = '';
        elements.vscode.postMessage({ type: 'selectSession', sessionId: session.id });
    };

    const deleteBtn = card.querySelector('.delete-session-button');
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
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
    emptyCard.innerHTML = `
        <div class="session-card-body">
            <div class="session-card-title">Inicie una nueva sesion desde el chat</div>
        </div>
    `;
    elements.sessionsList.appendChild(emptyCard);
}

// ============================================================
// UI STATE HELPERS
// ============================================================

function showChatView() {
    elements.sessionsContainer.style.display = 'none';
    elements.sessionsList.style.display = 'none';
    elements.sessionsMainTitle.style.display = 'none';
    elements.activeSessionHeader.style.display = 'flex';
    elements.chat.style.display = 'flex';
}

function handleBackToSessions() {
    if (isStreamingActive) {
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

function toggleModelMenu() {
    if (!elements.modelContextMenu) {
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
    if (!text) return "Nueva Sesión";
    let cleanText = text.replace(/---[\s\S]*?---/g, '');
    cleanText = cleanText.split(/Indicación(?: del usuario)?:/i).pop()?.trim() || cleanText; cleanText = cleanText.replace(/\s+/g, ' ');
    return cleanText.length > 30 ? cleanText.substring(0, 27) + '...' : cleanText;
}
// ============================================================// INITIALIZATION// ============================================================
updateTokenCounter(0, 0, currentModelName);
elements.vscode.postMessage({ type: 'webviewReady' });