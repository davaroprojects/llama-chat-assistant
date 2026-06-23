export interface IndexedChunk {
    id: string;
    relativePath: string;
    fileName: string;
    extension: string;
    folder: string;
    language: string;
    fileType: string;
    className: string;
    methodName: string;
    projectType: string;
    chunkIndex: number;
    chunkCount: number;
    chunkStart: number;
    chunkEnd: number;
    content: string;
    keywordEntities: string;
}

export function buildEmbeddingInput(chunk: IndexedChunk): string {
    return [
        chunk.relativePath,
        chunk.fileName,
        chunk.extension,
        chunk.folder,
        chunk.language,
        chunk.fileType,
        chunk.className,
        chunk.methodName,
        chunk.projectType,
        chunk.content
    ].join('\n');
}

export function buildEmbeddingInputFromDocument(content: string, metadata: Record<string, unknown> | undefined): string {
    return [
        getMetadataString(metadata, 'path'),
        getMetadataString(metadata, 'fileName'),
        getMetadataString(metadata, 'extension'),
        getMetadataString(metadata, 'folder'),
        getMetadataString(metadata, 'language'),
        getMetadataString(metadata, 'file_type'),
        getMetadataString(metadata, 'class_name'),
        getMetadataString(metadata, 'method_name'),
        getMetadataString(metadata, 'project_type'),
        content
    ].join('\n');
}

export function getMetadataString(metadata: Record<string, unknown> | undefined, key: string, fallback = ''): string {
    const value = metadata?.[key];
    return typeof value === 'string' ? value : fallback;
}

export function extractJavaSymbolMetadata(content: string, chunkEnd: number): { className: string; methodName: string } {
    const scope = content.slice(0, chunkEnd);
    const classRegex = /\b(?:class|interface|enum|record)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
    const methodRegex = /\b(?:public|protected|private|static|final|synchronized|abstract|native|default|strictfp|\s)*[A-Za-z_][A-Za-z0-9_<>,\[\]\s?]*\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^;{}]*\)\s*\{/g;
    const ignoredMethodNames = new Set(['if', 'for', 'while', 'switch', 'catch', 'try', 'return', 'new']);

    let className = '';
    let match: RegExpExecArray | null;
    while ((match = classRegex.exec(scope)) !== null) {
        className = match[1] || className;
    }

    let methodName = '';
    while ((match = methodRegex.exec(scope)) !== null) {
        const candidate = match[1] || '';
        if (!ignoredMethodNames.has(candidate)) {
            methodName = candidate;
        }
    }

    return { className, methodName };
}
