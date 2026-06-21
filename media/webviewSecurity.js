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
    template.innerHTML = unsafeHtml;

    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
    const nodesToRemove = [];

    while (walker.nextNode()) {
        const element = walker.currentNode;
        const tagName = element.tagName.toLowerCase();

        if (BLOCKED_HTML_TAGS.has(tagName)) {
            nodesToRemove.push(element);
            continue;
        }

        const attributes = Array.from(element.attributes);
        attributes.forEach((attr) => {
            const attrName = attr.name.toLowerCase();
            if (attrName.startsWith('on')) {
                element.removeAttribute(attr.name);
                return;
            }

            const isUrlAttribute = attrName === 'href' || attrName === 'src' || attrName === 'xlink:href';
            if (isUrlAttribute && !isSafeUrl(attr.value)) {
                element.removeAttribute(attr.name);
            }
        });

        if (tagName === 'a') {
            const href = element.getAttribute('href');
            if (href && !isSafeUrl(href)) {
                element.removeAttribute('href');
            }
            element.setAttribute('rel', 'noopener noreferrer');
            element.setAttribute('target', '_blank');
        }
    }

    nodesToRemove.forEach((node) => node.remove());

    return template.innerHTML;
}

window.webviewSecurity = {
    sanitizeHtml,
    isSafeUrl
};
