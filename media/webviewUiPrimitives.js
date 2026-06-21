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
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>'
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" xmlns="http://w3.org"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>';

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

window.webviewUiPrimitives = {
    createTypingIndicator,
    createUserMessageNode,
    createFileBadgeNode,
    createFileBadgeNodeWithSource,
    setServerButtonContent
};
