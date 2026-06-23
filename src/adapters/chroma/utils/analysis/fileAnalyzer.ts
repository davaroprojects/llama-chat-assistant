export function normalizeExtension(fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex < 0 || dotIndex === fileName.length - 1) {
        return '';
    }

    return fileName.slice(dotIndex + 1).toLowerCase();
}

export function detectLanguage(fileName: string): string {
    const extension = normalizeExtension(fileName);
    const languageByExtension: Record<string, string> = {
        ts: 'typescript',
        tsx: 'typescript',
        js: 'javascript',
        jsx: 'javascript',
        mjs: 'javascript',
        cjs: 'javascript',
        json: 'json',
        md: 'markdown',
        py: 'python',
        java: 'java',
        cs: 'csharp',
        cpp: 'cpp',
        c: 'c',
        h: 'c',
        go: 'go',
        rs: 'rust',
        rb: 'ruby',
        php: 'php',
        html: 'html',
        css: 'css',
        scss: 'scss',
        yml: 'yaml',
        yaml: 'yaml',
        xml: 'xml',
        properties: 'properties',
        env: 'properties',
        sql: 'sql',
        sh: 'shell'
    };

    return languageByExtension[extension] || 'text';
}

export function classifyFileType(fileName: string): string {
    const extension = normalizeExtension(fileName).toLowerCase();
    const configExtensions = new Set(['xml', 'yaml', 'yml', 'properties', 'env', 'json', 'toml', 'ini', 'conf', 'config']);
    const configKeywords = /(?:config|settings|application|deployment|manifest|pom|gradle|build|docker|k8s|kubernetes)/i;

    if (configExtensions.has(extension) || configKeywords.test(fileName)) {
        return 'configuration';
    }

    return 'source_code';
}
