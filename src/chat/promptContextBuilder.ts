import { FileMetadata } from './sessionPayloadBuilder';

export interface RagContextSnippet {
    path: string;
    content: string;
    distance?: number;
}

export interface PromptContextOptions {
    userPrompt: string;
    attachedFiles: FileMetadata[];
    ragSnippets: RagContextSnippet[];
}

const MAX_CONTEXT_SNIPPET_CHARS = 2500;
const MAX_RAG_CONTEXT_CHARS = 12000;

function sanitizeContextText(value: string): string {
    return value
        .replace(/\u0000/g, '')
        .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
}

function trimToLimit(value: string, maxChars: number): string {
    if (value.length <= maxChars) {
        return value;
    }

    return `${value.slice(0, maxChars)}\n[truncated]`;
}

function buildAttachedFilesContext(attachedFiles: FileMetadata[]): string {
    const sections = attachedFiles
        .filter((file) => !file.isRepository)
        .map((file) => {
            const content = trimToLimit(sanitizeContextText(file.content), MAX_CONTEXT_SNIPPET_CHARS);
            return `--- ATTACHED FILE: ${file.name} ---\n${content}\n--- END FILE ---`;
        });

    return sections.join('\n\n');
}

function buildRagContext(ragSnippets: RagContextSnippet[]): string {
    if (ragSnippets.length === 0) {
        return '';
    }

    const sections = ragSnippets.map((snippet, index) => {
        const rank = index + 1;
        const distance = typeof snippet.distance === 'number'
            ? ` distance=${snippet.distance.toFixed(4)}`
            : '';
        const content = trimToLimit(sanitizeContextText(snippet.content), MAX_CONTEXT_SNIPPET_CHARS);
        return `--- RAG CONTEXT ${rank}: ${snippet.path}${distance} ---\n${content}\n--- END RAG CONTEXT ---`;
    });

    const joined = `--- RAG CONTEXT START ---\n${sections.join('\n\n')}\n--- RAG CONTEXT END ---`;
    return trimToLimit(joined, MAX_RAG_CONTEXT_CHARS);
}

export function buildPromptContext(options: PromptContextOptions): string {
    const parts: string[] = [];

    const attachedFilesContext = buildAttachedFilesContext(options.attachedFiles);
    if (attachedFilesContext) {
        parts.push(attachedFilesContext);
    }

    const ragContext = buildRagContext(options.ragSnippets);
    if (ragContext) {
        parts.push(ragContext);
    }

    parts.push(`User instruction:\n${options.userPrompt}`);
    return parts.join('\n\n');
}
