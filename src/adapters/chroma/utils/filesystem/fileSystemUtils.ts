import * as fs from 'node:fs/promises';

export function looksBinaryContent(content: string): boolean {
    if (!content) {
        return false;
    }

    const sample = content.slice(0, 4096);
    if (sample.includes('\u0000')) {
        return true;
    }

    let controlCount = 0;
    for (let i = 0; i < sample.length; i += 1) {
        const code = sample.charCodeAt(i);
        const isControl = code < 32 && code !== 9 && code !== 10 && code !== 13;
        if (isControl) {
            controlCount += 1;
        }
    }

    return controlCount / Math.max(sample.length, 1) > 0.08;
}

export function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function globToRegExp(pattern: string): RegExp {
    const normalized = pattern.split('\\').join('/');
    const escaped = escapeRegex(normalized)
        .replace(/\\\*\\\*/g, '::DOUBLE_STAR::')
        .replace(/\\\*/g, '[^/]*')
        .replace(/::DOUBLE_STAR::/g, '.*');

    return new RegExp(`^${escaped}$`, 'i');
}

export function shouldExcludeFile(relativePath: string, excludeRegexes: RegExp[]): boolean {
    return excludeRegexes.some((regex) => regex.test(relativePath));
}

export async function fileExists(absolutePath: string): Promise<boolean> {
    try {
        await fs.access(absolutePath);
        return true;
    } catch {
        return false;
    }
}

export async function readFileContent(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf8');
}

export async function readFileStats(filePath: string): Promise<any> {
    return fs.stat(filePath);
}

export async function listDirectoryEntries(dirPath: string): Promise<any[]> {
    return fs.readdir(dirPath, { withFileTypes: true });
}
