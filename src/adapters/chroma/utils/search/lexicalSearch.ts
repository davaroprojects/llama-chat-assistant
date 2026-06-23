export function tokenizeText(value: string): string[] {
    return value
        .toLowerCase()
        .split(/[^a-z0-9_.\/-]+/)
        .filter((token) => token.length >= 2);
}

export function lexicalPathScore(queryText: string, metadata: Record<string, unknown> | undefined): number {
    if (!metadata) {
        return 0;
    }

    const searchable = [
        typeof metadata.path === 'string' ? metadata.path : '',
        typeof metadata.fileName === 'string' ? metadata.fileName : '',
        typeof metadata.folder === 'string' ? metadata.folder : '',
        typeof metadata.extension === 'string' ? metadata.extension : '',
        typeof metadata.language === 'string' ? metadata.language : ''
    ].join(' ').toLowerCase();

    if (!searchable.trim()) {
        return 0;
    }

    const queryTokens = tokenizeText(queryText);
    if (queryTokens.length === 0) {
        return 0;
    }

    let hits = 0;
    queryTokens.forEach((token) => {
        if (searchable.includes(token)) {
            hits += 1;
        }
    });

    return hits / queryTokens.length;
}

export function normalizeFilePathFilter(filePaths?: string[]): string[] {
    if (!filePaths || filePaths.length === 0) {
        return [];
    }

    const normalized = new Set<string>();
    filePaths.forEach((filePath) => {
        const trimmed = filePath.trim();
        if (!trimmed) {
            return;
        }

        const candidate = trimmed.split('\\').join('/');
        const segments = candidate.split('/');
        if (segments.some((segment) => segment === '.' || segment === '..')) {
            return;
        }

        if (candidate.startsWith('/')) {
            return;
        }

        if (!/^[A-Za-z0-9_./-]+$/.test(candidate)) {
            return;
        }

        normalized.add(candidate);
    });

    return Array.from(normalized);
}
