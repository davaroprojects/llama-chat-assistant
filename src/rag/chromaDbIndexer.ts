import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ChromaClient } from 'chromadb';

export interface RagIndexResult {
    status: 'indexed';
    indexedAt: number;
    indexedFiles: number;
}

export interface ChromaDbConnectionConfig {
    url: string;
    port: number;
    collectionPrefix: string;
    excludeDirs: string[];
    excludeFileGlobs: string[];
    maxFileSizeKb: number;
    maxIndexedFiles: number;
    chunkSizeChars: number;
    chunkOverlapChars: number;
    vectorCandidatePool: number;
    maxQueryResults: number;
}

export interface ChromaSearchResult {
    path: string;
    content: string;
    distance?: number;
}

export type ChromaQueryMode = 'semantic' | 'lexical';

const EMBEDDING_DIM = 64;

interface IndexedChunk {
    id: string;
    relativePath: string;
    fileName: string;
    extension: string;
    folder: string;
    language: string;
    chunkIndex: number;
    chunkCount: number;
    chunkStart: number;
    chunkEnd: number;
    content: string;
}

function getClient(config: ChromaDbConnectionConfig, signal?: AbortSignal): ChromaClient {
    const parsedUrl = new URL(config.url);
    return new ChromaClient({
        host: parsedUrl.hostname,
        port: config.port,
        ssl: parsedUrl.protocol === 'https:',
        fetchOptions: signal ? ({ signal } as any) : undefined
    } as any);
}

function computeEmbedding(text: string): number[] {
    const vec = new Array<number>(EMBEDDING_DIM).fill(0);
    for (let i = 0; i < text.length; i += 1) {
        const slot = i % EMBEDDING_DIM;
        vec[slot] += text.charCodeAt(i) / 65535;
    }

    const norm = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0));
    if (norm > 0) {
        for (let i = 0; i < vec.length; i += 1) {
            vec[i] = vec[i] / norm;
        }
    }

    return vec;
}

function normalizeExtension(fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex < 0 || dotIndex === fileName.length - 1) {
        return '';
    }

    return fileName.slice(dotIndex + 1).toLowerCase();
}

function detectLanguage(fileName: string): string {
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
        sql: 'sql',
        sh: 'shell'
    };

    return languageByExtension[extension] || 'text';
}

function chunkContent(
    content: string,
    chunkSizeChars: number,
    chunkOverlapChars: number
): Array<{ text: string; start: number; end: number }> {
    if (!content) {
        return [];
    }

    const chunks: Array<{ text: string; start: number; end: number }> = [];
    let start = 0;

    while (start < content.length) {
        const end = Math.min(content.length, start + chunkSizeChars);
        const text = content.slice(start, end);
        chunks.push({ text, start, end });

        if (end >= content.length) {
            break;
        }

        start = Math.max(end - chunkOverlapChars, start + 1);
    }

    return chunks;
}

function buildEmbeddingInput(chunk: IndexedChunk): string {
    return [
        chunk.relativePath,
        chunk.fileName,
        chunk.extension,
        chunk.folder,
        chunk.language,
        chunk.content
    ].join('\n');
}

function tokenizeText(value: string): string[] {
    return value
        .toLowerCase()
        .split(/[^a-z0-9_.\/-]+/)
        .filter((token) => token.length >= 2);
}

function lexicalPathScore(queryText: string, metadata: Record<string, unknown> | undefined): number {
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

function getMetadataString(metadata: Record<string, unknown> | undefined, key: string, fallback = ''): string {
    const value = metadata?.[key];
    return typeof value === 'string' ? value : fallback;
}

function looksBinaryContent(content: string): boolean {
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

function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function globToRegExp(pattern: string): RegExp {
    const normalized = pattern.split('\\').join('/');
    const escaped = escapeRegex(normalized)
        .replace(/\\\*\\\*/g, '::DOUBLE_STAR::')
        .replace(/\\\*/g, '[^/]*')
        .replace(/::DOUBLE_STAR::/g, '.*');

    return new RegExp(`^${escaped}$`, 'i');
}

function shouldExcludeFile(relativePath: string, excludeRegexes: RegExp[]): boolean {
    return excludeRegexes.some((regex) => regex.test(relativePath));
}

async function listTextFiles(workspaceRoot: string, config: ChromaDbConnectionConfig): Promise<IndexedChunk[]> {
    const indexed: IndexedChunk[] = [];
    const ignoredDirs = new Set((config.excludeDirs || []).map((dir) => dir.trim()).filter(Boolean));
    const excludeRegexes = (config.excludeFileGlobs || [])
        .map((pattern) => pattern.trim())
        .filter(Boolean)
        .map((pattern) => globToRegExp(pattern));
    const maxFileSizeBytes = Math.max(1, config.maxFileSizeKb) * 1024;
    const maxIndexedFiles = Math.max(1, config.maxIndexedFiles);
    const chunkSizeChars = Math.max(200, config.chunkSizeChars);
    const chunkOverlapChars = Math.max(0, Math.min(config.chunkOverlapChars, chunkSizeChars - 1));

    async function walk(currentDir: string): Promise<void> {
        if (indexed.length >= maxIndexedFiles) {
            return;
        }

        let entries;
        try {
            entries = await fs.readdir(currentDir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            if (indexed.length >= maxIndexedFiles) {
                return;
            }

            const absolutePath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                if (!ignoredDirs.has(entry.name)) {
                    await walk(absolutePath);
                }
                continue;
            }

            if (!entry.isFile()) {
                continue;
            }

            try {
                const stat = await fs.stat(absolutePath);
                if (stat.size > maxFileSizeBytes) {
                    continue;
                }

                const content = await fs.readFile(absolutePath, 'utf8');
                if (!content.trim()) {
                    continue;
                }

                if (looksBinaryContent(content)) {
                    continue;
                }

                const relativePath = path.relative(workspaceRoot, absolutePath).split(path.sep).join('/');
                if (shouldExcludeFile(relativePath, excludeRegexes)) {
                    continue;
                }
                const fileName = path.basename(relativePath);
                const extension = normalizeExtension(fileName);
                const folder = path.dirname(relativePath).split(path.sep).join('/');
                const language = detectLanguage(fileName);
                const chunks = chunkContent(content, chunkSizeChars, chunkOverlapChars);

                chunks.forEach((chunk, index) => {
                    indexed.push({
                        id: `${relativePath}::chunk-${index}`,
                        relativePath,
                        fileName,
                        extension,
                        folder: folder === '.' ? '' : folder,
                        language,
                        chunkIndex: index,
                        chunkCount: chunks.length,
                        chunkStart: chunk.start,
                        chunkEnd: chunk.end,
                        content: chunk.text
                    });
                });
            } catch {
                // Skip unreadable/binary files.
            }
        }
    }

    await walk(workspaceRoot);
    return indexed;
}

async function cleanupEphemeralCollections(client: ChromaClient, collectionPrefix: string): Promise<void> {
    try {
        const collections = await client.listCollections({ limit: 500, offset: 0 });
        for (const collection of collections) {
            if (collection.name.startsWith(collectionPrefix)) {
                try {
                    await client.deleteCollection({ name: collection.name });
                } catch {
                    // Best effort cleanup.
                }
            }
        }
    } catch {
        // Ignore cleanup errors.
    }
}

async function getLatestEphemeralCollectionName(client: ChromaClient, collectionPrefix: string): Promise<string | null> {
    const collections = await client.listCollections({ limit: 500, offset: 0 });
    const ephemeralCollectionNames = collections
        .map((collection) => collection.name)
        .filter((name) => name.startsWith(`${collectionPrefix}-`));

    if (ephemeralCollectionNames.length === 0) {
        return null;
    }

    ephemeralCollectionNames.sort((a, b) => {
        const aStamp = Number(a.slice(collectionPrefix.length + 1));
        const bStamp = Number(b.slice(collectionPrefix.length + 1));
        return bStamp - aStamp;
    });

    return ephemeralCollectionNames[0] || null;
}

export async function isChromaDbAvailable(config: ChromaDbConnectionConfig): Promise<boolean> {
    try {
        const client = getClient(config);
        await client.heartbeat();
        return true;
    } catch {
        return false;
    }
}

export async function indexAllWithChromaDb(
    workspaceRoot: string,
    config: ChromaDbConnectionConfig
): Promise<RagIndexResult> {
    const indexedAt = Date.now();
    const client = getClient(config);

    await cleanupEphemeralCollections(client, config.collectionPrefix);

    const collectionName = `${config.collectionPrefix}-${indexedAt}`;
    const collection = await client.createCollection({ name: collectionName });

    const files = await listTextFiles(workspaceRoot, config);
    const batchSize = 64;

    for (let i = 0; i < files.length; i += batchSize) {
        const chunk = files.slice(i, i + batchSize);
        await collection.add({
            ids: chunk.map((item) => item.id),
            documents: chunk.map((item) => item.content),
            embeddings: chunk.map((item) => computeEmbedding(buildEmbeddingInput(item))),
            metadatas: chunk.map((item) => ({
                path: item.relativePath,
                fileName: item.fileName,
                extension: item.extension,
                folder: item.folder,
                language: item.language,
                chunkIndex: String(item.chunkIndex),
                chunkCount: String(item.chunkCount),
                chunkStart: String(item.chunkStart),
                chunkEnd: String(item.chunkEnd)
            }))
        });
    }

    return {
        status: 'indexed',
        indexedAt,
        indexedFiles: files.length
    };
}

export async function queryRelevantContextFromChromaDb(
    queryText: string,
    config: ChromaDbConnectionConfig,
    maxResults = config.maxQueryResults,
    mode: ChromaQueryMode = 'semantic',
    signal?: AbortSignal
): Promise<ChromaSearchResult[]> {
    if (mode === 'lexical') {
        return queryRelevantContextFromChromaDbLexical(queryText, config, maxResults, signal);
    }

    return queryRelevantContextFromChromaDbSemantic(queryText, config, maxResults, signal);
}

export async function queryRelevantContextFromChromaDbSemantic(
    queryText: string,
    config: ChromaDbConnectionConfig,
    maxResults = config.maxQueryResults,
    signal?: AbortSignal
): Promise<ChromaSearchResult[]> {
    if (!queryText.trim()) {
        return [];
    }

    if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }

    const client = getClient(config, signal);
    const collectionName = await getLatestEphemeralCollectionName(client, config.collectionPrefix);
    if (!collectionName) {
        return [];
    }

    if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }

    const collection = await client.getCollection({ name: collectionName });
    const queryResult = await collection.query({
        queryEmbeddings: [computeEmbedding(queryText)],
        nResults: Math.max(maxResults, config.vectorCandidatePool),
        include: ['documents', 'metadatas', 'distances']
    } as any);

    const documents = queryResult.documents?.[0] ?? [];
    const metadatas = queryResult.metadatas?.[0] ?? [];
    const distances = queryResult.distances?.[0] ?? [];

    const ranked: Array<ChromaSearchResult & { vectorScore: number }> = [];
    documents.forEach((content, index) => {
        if (typeof content !== 'string') {
            return;
        }

        const metadata = metadatas[index] as Record<string, unknown> | undefined;
        const pathValue = getMetadataString(metadata, 'path', `document-${index + 1}`);
        const distance = typeof distances[index] === 'number' ? distances[index] : undefined;
        const vectorScore = distance === undefined ? 0 : 1 / (1 + Math.max(0, distance));

        const chunkIndex = getMetadataString(metadata, 'chunkIndex');
        const chunkCount = getMetadataString(metadata, 'chunkCount');
        const chunkSuffix = chunkIndex && chunkCount
            ? ` [chunk ${Number(chunkIndex) + 1}/${chunkCount}]`
            : '';

        ranked.push({
            path: `${pathValue}${chunkSuffix}`,
            content,
            distance,
            vectorScore
        });
    });

    ranked.sort((a, b) => b.vectorScore - a.vectorScore);
    return ranked.slice(0, maxResults).map((item) => ({
        path: item.path,
        content: item.content,
        distance: item.distance
    }));
}

export async function queryRelevantContextFromChromaDbLexical(
    queryText: string,
    config: ChromaDbConnectionConfig,
    maxResults = config.maxQueryResults,
    signal?: AbortSignal
): Promise<ChromaSearchResult[]> {
    if (!queryText.trim()) {
        return [];
    }

    if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }

    const client = getClient(config, signal);
    const collectionName = await getLatestEphemeralCollectionName(client, config.collectionPrefix);
    if (!collectionName) {
        return [];
    }

    const collection = await client.getCollection({ name: collectionName });
    const pageSize = 500;
    let offset = 0;
    const matches: Array<ChromaSearchResult & { lexicalScore: number }> = [];

    while (true) {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        const page = await collection.get({
            limit: pageSize,
            offset,
            include: ['documents', 'metadatas']
        } as any);

        const ids = page.ids ?? [];
        const documents = page.documents ?? [];
        const metadatas = page.metadatas ?? [];
        if (ids.length === 0) {
            break;
        }

        for (let i = 0; i < ids.length; i += 1) {
            const content = documents[i];
            if (typeof content !== 'string') {
                continue;
            }

            const metadata = metadatas[i] as Record<string, unknown> | undefined;
            const lexicalScore = lexicalPathScore(queryText, metadata);
            if (lexicalScore <= 0) {
                continue;
            }

            const pathValue = getMetadataString(metadata, 'path', `document-${i + offset + 1}`);
            const chunkIndex = getMetadataString(metadata, 'chunkIndex');
            const chunkCount = getMetadataString(metadata, 'chunkCount');
            const chunkSuffix = chunkIndex && chunkCount
                ? ` [chunk ${Number(chunkIndex) + 1}/${chunkCount}]`
                : '';

            matches.push({
                path: `${pathValue}${chunkSuffix}`,
                content,
                lexicalScore
            });
        }

        if (ids.length < pageSize) {
            break;
        }

        offset += pageSize;
    }

    matches.sort((a, b) => b.lexicalScore - a.lexicalScore);
    return matches.slice(0, maxResults).map((item) => ({
        path: item.path,
        content: item.content,
        distance: undefined
    }));
}