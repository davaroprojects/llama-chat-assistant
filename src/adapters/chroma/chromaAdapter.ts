import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ChromaClient } from 'chromadb';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import {
    ChromaConceptualKnnOptions,
    ChromaDbConnectionConfig,
    ChromaQueryLogger,
    ChromaQueryMode,
    ChromaSearchResult,
    RagIndexResult
} from '../../core/domain/chroma';
import { RagGateway } from '../../core/gateways/ragGateway';
import { RepositoryIndexGateway } from '../../core/gateways/repositoryIndexGateway';
import { WorkspaceDependencyGraphBuilder } from './workspaceDependencyGraphBuilder';
import { Logger } from '../../logging/outputLogger';

const EMBEDDING_DIM = 64;

interface IndexedChunk {
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
}

type ChromaWhereFilter = {
    file_path: {
        $in: string[];
    };
};

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

function createLocalEmbeddingFunction() {
    return {
        generate: async (texts: string[]) => texts.map((text) => computeEmbedding(text))
    } as any;
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
        properties: 'properties',
        env: 'properties',
        sql: 'sql',
        sh: 'shell'
    };

    return languageByExtension[extension] || 'text';
}

function classifyFileType(fileName: string, language: string): string {
    const extension = normalizeExtension(fileName).toLowerCase();
    const configExtensions = new Set(['xml', 'yaml', 'yml', 'properties', 'env', 'json', 'toml', 'ini', 'conf', 'config']);
    const configKeywords = /(?:config|settings|application|deployment|manifest|pom|gradle|build|docker|k8s|kubernetes)/i;

    if (configExtensions.has(extension) || configKeywords.test(fileName)) {
        return 'configuration';
    }

    return 'source_code';
}

function getEcosystemLanguage(language: string, projectType: string): string {
    if (projectType === 'java') {
        if (language === 'xml' || language === 'properties' || language === 'json' || language === 'yaml') {
            return 'java-ecosystem';
        }
        return language === 'java' ? 'java' : 'java-ecosystem';
    }

    if (projectType === 'node') {
        if (language === 'yaml' || language === 'json' || language === 'properties') {
            return 'node-ecosystem';
        }
        return language === 'javascript' || language === 'typescript' ? language : 'node-ecosystem';
    }

    if (projectType === 'python') {
        if (language === 'yaml' || language === 'properties' || language === 'text') {
            return 'python-ecosystem';
        }
        return language === 'python' ? 'python' : 'python-ecosystem';
    }

    return language;
}

interface TextChunk {
    text: string;
    start: number;
    end: number;
}

interface ChunkTuning {
    chunkSizeChars?: number;
    chunkOverlapChars?: number;
}

function resolveChunkTuning(
    tuning: ChunkTuning | undefined,
    defaultChunkSize: number,
    defaultChunkOverlap: number
): { chunkSize: number; chunkOverlap: number } {
    const configuredSize = Math.max(200, Math.floor(tuning?.chunkSizeChars ?? defaultChunkSize));
    const configuredOverlap = Math.max(0, Math.floor(tuning?.chunkOverlapChars ?? defaultChunkOverlap));

    return {
        chunkSize: configuredSize,
        chunkOverlap: Math.min(configuredOverlap, Math.max(configuredSize - 1, 0))
    };
}

function getSplitterForFile(fileName: string, tuning?: ChunkTuning): RecursiveCharacterTextSplitter {
    const extension = path.extname(fileName).toLowerCase();

    switch (extension) {
        case '.java':
            {
                const chunk = resolveChunkTuning(tuning, 1000, 150);
            return new RecursiveCharacterTextSplitter({
                chunkSize: chunk.chunkSize,
                chunkOverlap: chunk.chunkOverlap,
                separators: [
                    '\n\n',
                    '\npublic\n',
                    '\nprotected\n',
                    '\nprivate\n',
                    '\nclass ',
                    '\ninterface ',
                    '\n}',
                    '\n'
                ]
            });
            }

        case '.py':
            {
                const chunk = resolveChunkTuning(tuning, 800, 100);
            return new RecursiveCharacterTextSplitter({
                chunkSize: chunk.chunkSize,
                chunkOverlap: chunk.chunkOverlap,
                separators: ['\n\n', '\ndef ', '\nclass ', '\n', ' ']
            });
            }

        case '.xml':
            {
                const chunk = resolveChunkTuning(tuning, 600, 50);
            return new RecursiveCharacterTextSplitter({
                chunkSize: chunk.chunkSize,
                chunkOverlap: chunk.chunkOverlap,
                separators: ['</bean>', '</dependency>', '</plugin>', '\n\n', '\n']
            });
            }

        case '.yaml':
        case '.yml':
            {
                const chunk = resolveChunkTuning(tuning, 500, 50);
            return new RecursiveCharacterTextSplitter({
                chunkSize: chunk.chunkSize,
                chunkOverlap: chunk.chunkOverlap,
                separators: ['\n\n', '\n-', '\n  ', '\n']
            });
            }

        case '.properties':
        case '.env':
        case '.conf':
            {
                const chunk = resolveChunkTuning(tuning, 400, 0);
            return new RecursiveCharacterTextSplitter({
                chunkSize: chunk.chunkSize,
                chunkOverlap: chunk.chunkOverlap,
                separators: ['\n\n', '\n']
            });
            }

        default:
            {
                const chunk = resolveChunkTuning(tuning, 800, 100);
            return new RecursiveCharacterTextSplitter({
                chunkSize: chunk.chunkSize,
                chunkOverlap: chunk.chunkOverlap,
                separators: ['\n\n', '\n', ' ']
            });
            }
    }
}

async function processAndChunkFile(filePath: string, content: string, tuning?: ChunkTuning): Promise<TextChunk[]> {
    const fileName = path.basename(filePath);
    const splitter = getSplitterForFile(fileName, tuning);

    const chunkTexts = await splitter.splitText(content);

    const chunks: TextChunk[] = [];
    let currentPos = 0;

    for (const chunkText of chunkTexts) {
        const startPos = content.indexOf(chunkText, currentPos);
        const start = startPos >= 0 ? startPos : currentPos;
        const end = start + chunkText.length;

        chunks.push({
            text: chunkText,
            start,
            end
        });

        currentPos = end;
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
        chunk.fileType,
        chunk.className,
        chunk.methodName,
        chunk.projectType,
        chunk.content
    ].join('\n');
}

function buildEmbeddingInputFromDocument(content: string, metadata: Record<string, unknown> | undefined): string {
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

function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) {
        return 0;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i += 1) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    if (normA <= 0 || normB <= 0) {
        return 0;
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
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

function normalizeFilePathFilter(filePaths?: string[]): string[] {
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

function buildWhereFilter(filePaths?: string[]): ChromaWhereFilter | undefined {
    const normalizedPaths = normalizeFilePathFilter(filePaths);
    if (normalizedPaths.length === 0) {
        return undefined;
    }

    return {
        file_path: {
            $in: normalizedPaths
        }
    };
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

function extractJavaSymbolMetadata(content: string, chunkEnd: number): { className: string; methodName: string } {
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

async function exists(absolutePath: string): Promise<boolean> {
    try {
        await fs.access(absolutePath);
        return true;
    } catch {
        return false;
    }
}

async function detectProjectType(workspaceRoot: string): Promise<string> {
    if (await exists(path.join(workspaceRoot, 'pom.xml')) || await exists(path.join(workspaceRoot, 'build.gradle'))) {
        return 'java';
    }

    if (await exists(path.join(workspaceRoot, 'package.json'))) {
        return 'node';
    }

    if (await exists(path.join(workspaceRoot, 'pyproject.toml')) || await exists(path.join(workspaceRoot, 'requirements.txt'))) {
        return 'python';
    }

    if (await exists(path.join(workspaceRoot, 'Cargo.toml'))) {
        return 'rust';
    }

    if (await exists(path.join(workspaceRoot, 'go.mod'))) {
        return 'go';
    }

    return 'generic';
}

async function listTextFiles(
    workspaceRoot: string,
    config: ChromaDbConnectionConfig,
    projectType: string
): Promise<IndexedChunk[]> {
    const indexed: IndexedChunk[] = [];
    const ignoredDirs = new Set((config.excludeDirs || []).map((dir) => dir.trim()).filter(Boolean));
    const excludeRegexes = (config.excludeFileGlobs || [])
        .map((pattern) => pattern.trim())
        .filter(Boolean)
        .map((pattern) => globToRegExp(pattern));
    const maxFileSizeBytes = Math.max(1, config.maxFileSizeKb) * 1024;
    const maxIndexedFiles = Math.max(1, config.maxIndexedFiles);

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
                const fileType = classifyFileType(fileName, language);
                const ecosystemLanguage = getEcosystemLanguage(language, projectType);
                const chunks = await processAndChunkFile(relativePath, content, {
                    chunkSizeChars: config.chunkSizeChars,
                    chunkOverlapChars: config.chunkOverlapChars
                });

                chunks.forEach((chunk, index) => {
                    const javaMetadata = language === 'java'
                        ? extractJavaSymbolMetadata(content, chunk.end)
                        : { className: '', methodName: '' };

                    indexed.push({
                        id: `${relativePath}::chunk-${index}`,
                        relativePath,
                        fileName,
                        extension,
                        folder: folder === '.' ? '' : folder,
                        language: ecosystemLanguage,
                        fileType,
                        className: javaMetadata.className,
                        methodName: javaMetadata.methodName,
                        projectType,
                        chunkIndex: index,
                        chunkCount: chunks.length,
                        chunkStart: chunk.start,
                        chunkEnd: chunk.end,
                        content: chunk.text
                    });
                });
            } catch (error) {
            }
        }
    }

    await walk(workspaceRoot);
    return indexed;
}

async function cleanupEphemeralCollections(client: ChromaClient, collectionPrefix: string, logger?: ChromaQueryLogger): Promise<void> {
    try {
        const collections = await client.listCollections({ limit: 500, offset: 0 });
        for (const collection of collections) {
            if (collection.name.startsWith(collectionPrefix)) {
                try {
                    await client.deleteCollection({ name: collection.name });
                    logger?.info('rag', 'Deleted ephemeral collection', { name: collection.name });
                } catch (err) {
                    logger?.warn('rag', 'Failed to delete ephemeral collection', { name: collection.name, error: String(err) });
                }
            }
        }
    } catch (err) {
        logger?.warn('rag', 'Failed to list collections during cleanup', { error: String(err) });
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
    config: ChromaDbConnectionConfig,
    logger?: ChromaQueryLogger
): Promise<RagIndexResult> {
    const indexedAt = Date.now();
    const client = getClient(config);

    logger?.info('rag', 'Starting workspace indexing', { collectionPrefix: config.collectionPrefix, workspaceRoot });

    await cleanupEphemeralCollections(client, config.collectionPrefix, logger);

    const collectionName = `${config.collectionPrefix}-${indexedAt}`;
    const collection = await client.createCollection({
        name: collectionName,
        embeddingFunction: createLocalEmbeddingFunction()
    } as any);

    const projectType = await detectProjectType(workspaceRoot);
    const files = await listTextFiles(workspaceRoot, config, projectType);
    const batchSize = 64;

    for (let i = 0; i < files.length; i += batchSize) {
        const chunk = files.slice(i, i + batchSize);
        await collection.add({
            ids: chunk.map((item) => item.id),
            documents: chunk.map((item) => item.content),
            embeddings: chunk.map((item) => computeEmbedding(buildEmbeddingInput(item))),
            metadatas: chunk.map((item) => ({
                path: item.relativePath,
                file_path: item.relativePath,
                file_type: item.fileType,
                extension: item.extension,
                fileName: item.fileName,
                folder: item.folder,
                language: item.language,
                class_name: item.className,
                method_name: item.methodName,
                project_type: item.projectType,
                chunkIndex: String(item.chunkIndex),
                chunkCount: String(item.chunkCount),
                chunkStart: String(item.chunkStart),
                chunkEnd: String(item.chunkEnd)
            }))
        });
    }

    logger?.info('rag', 'Workspace indexing complete', { collectionName, indexedFiles: files.length });

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
    signal?: AbortSignal,
    filePathFilter?: string[],
    logger?: ChromaQueryLogger
): Promise<ChromaSearchResult[]> {
    logger?.debug('rag', 'Chroma query dispatch', {
        mode,
        maxResults,
        queryLength: queryText.length,
        filterPaths: filePathFilter?.length ?? 0
    });

    if (mode === 'lexical') {
        return queryRelevantContextFromChromaDbLexical(queryText, config, maxResults, signal, filePathFilter, logger);
    }

    return queryRelevantContextFromChromaDbSemantic(queryText, config, maxResults, signal, filePathFilter, logger);
}

export async function queryRelevantContextFromChromaDbSemantic(
    queryText: string,
    config: ChromaDbConnectionConfig,
    maxResults = config.maxQueryResults,
    signal?: AbortSignal,
    filePathFilter?: string[],
    logger?: ChromaQueryLogger
): Promise<ChromaSearchResult[]> {
    if (!queryText.trim()) {
        logger?.debug('rag', 'Skipped semantic query: empty query text');
        return [];
    }

    if (signal?.aborted) {
        logger?.warn('rag', 'Aborted semantic query before execution');
        throw new DOMException('Aborted', 'AbortError');
    }

    logger?.debug('rag', 'Starting semantic Chroma query', {
        maxResults,
        vectorCandidatePool: config.vectorCandidatePool,
        filterPaths: filePathFilter?.length ?? 0
    });

    const client = getClient(config, signal);
    const collectionName = await getLatestEphemeralCollectionName(client, config.collectionPrefix);
    if (!collectionName) {
        logger?.warn('rag', 'Semantic query skipped: no indexed Chroma collection found', {
            collectionPrefix: config.collectionPrefix
        });
        return [];
    }

    logger?.debug('rag', 'Using Chroma collection for semantic query', { collectionName });

    if (signal?.aborted) {
        logger?.warn('rag', 'Aborted semantic query before collection query');
        throw new DOMException('Aborted', 'AbortError');
    }

    try {
        const collection = await client.getCollection({
            name: collectionName,
            embeddingFunction: createLocalEmbeddingFunction()
        } as any);
        const where = buildWhereFilter(filePathFilter);
        const queryResult = await collection.query({
            queryEmbeddings: [computeEmbedding(queryText)],
            nResults: Math.max(maxResults, config.vectorCandidatePool),
            include: ['documents', 'metadatas', 'distances'],
            where
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
        const results = ranked.slice(0, maxResults).map((item) => ({
            path: item.path,
            content: item.content,
            distance: item.distance
        }));

        logger?.info('rag', 'Semantic Chroma query finished', {
            collectionName,
            retrievedDocuments: documents.length,
            rankedMatches: ranked.length,
            returnedResults: results.length,
            filteredByPath: !!buildWhereFilter(filePathFilter)
        });

        return results;
    } catch (error) {
        logger?.error('rag', 'Semantic Chroma query failed', error);
        throw error;
    }
}

export async function queryRelevantContextFromChromaDbLexical(
    queryText: string,
    config: ChromaDbConnectionConfig,
    maxResults = config.maxQueryResults,
    signal?: AbortSignal,
    filePathFilter?: string[],
    logger?: ChromaQueryLogger
): Promise<ChromaSearchResult[]> {
    if (!queryText.trim()) {
        logger?.debug('rag', 'Skipped lexical query: empty query text');
        return [];
    }

    if (signal?.aborted) {
        logger?.warn('rag', 'Aborted lexical query before execution');
        throw new DOMException('Aborted', 'AbortError');
    }

    logger?.debug('rag', 'Starting lexical Chroma query', {
        maxResults,
        filterPaths: filePathFilter?.length ?? 0
    });

    const client = getClient(config, signal);
    const collectionName = await getLatestEphemeralCollectionName(client, config.collectionPrefix);
    if (!collectionName) {
        logger?.warn('rag', 'Lexical query skipped: no indexed Chroma collection found', {
            collectionPrefix: config.collectionPrefix
        });
        return [];
    }

    logger?.debug('rag', 'Using Chroma collection for lexical query', { collectionName });

    try {
        const collection = await client.getCollection({
            name: collectionName,
            embeddingFunction: createLocalEmbeddingFunction()
        } as any);
        const where = buildWhereFilter(filePathFilter);
        const pageSize = 500;
        let offset = 0;
        let scannedDocuments = 0;
        const matches: Array<ChromaSearchResult & { lexicalScore: number }> = [];

        while (true) {
            if (signal?.aborted) {
                logger?.warn('rag', 'Aborted lexical query while paging', { offset });
                throw new DOMException('Aborted', 'AbortError');
            }

            const page = await collection.get({
                limit: pageSize,
                offset,
                include: ['documents', 'metadatas'],
                where
            } as any);

            const ids = page.ids ?? [];
            const documents = page.documents ?? [];
            const metadatas = page.metadatas ?? [];
            scannedDocuments += ids.length;
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
        const results = matches.slice(0, maxResults).map((item) => ({
            path: item.path,
            content: item.content,
            distance: undefined
        }));

        logger?.info('rag', 'Lexical Chroma query finished', {
            collectionName,
            scannedDocuments,
            lexicalMatches: matches.length,
            returnedResults: results.length,
            filteredByPath: !!buildWhereFilter(filePathFilter)
        });

        return results;
    } catch (error) {
        logger?.error('rag', 'Lexical Chroma query failed', error);
        throw error;
    }
}

export async function queryRelevantContextFromChromaDbConceptualKnn(
    queryText: string,
    config: ChromaDbConnectionConfig,
    options?: ChromaConceptualKnnOptions
): Promise<ChromaSearchResult[]> {
    if (!queryText.trim()) {
        return [];
    }

    const topK = Math.max(1, options?.topK ?? config.maxQueryResults);
    const minCosineSimilarity = options?.minCosineSimilarity ?? 0.2;
    const signal = options?.signal;

    if (signal?.aborted) {
        (options as { logger?: ChromaQueryLogger } | undefined)?.logger?.warn('rag', 'Aborted conceptual KNN query before execution');
        throw new DOMException('Aborted', 'AbortError');
    }

    const logger = (options as { logger?: ChromaQueryLogger } | undefined)?.logger;
    logger?.debug('rag', 'Starting conceptual KNN Chroma query', {
        topK,
        minCosineSimilarity
    });

    const client = getClient(config, signal);
    const collectionName = await getLatestEphemeralCollectionName(client, config.collectionPrefix);
    if (!collectionName) {
        logger?.warn('rag', 'Conceptual KNN query skipped: no indexed Chroma collection found', {
            collectionPrefix: config.collectionPrefix
        });
        return [];
    }

    logger?.debug('rag', 'Using Chroma collection for conceptual KNN query', { collectionName });

    try {
        const collection = await client.getCollection({
            name: collectionName,
            embeddingFunction: createLocalEmbeddingFunction()
        } as any);
        const queryEmbedding = computeEmbedding(queryText);

        const pageSize = 500;
        let offset = 0;
        let scannedDocuments = 0;
        const ranked: Array<ChromaSearchResult & { cosineScore: number }> = [];

        while (true) {
            if (signal?.aborted) {
                logger?.warn('rag', 'Aborted conceptual KNN query while paging', { offset });
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
            scannedDocuments += ids.length;
            if (ids.length === 0) {
                break;
            }

            for (let i = 0; i < ids.length; i += 1) {
                const content = documents[i];
                if (typeof content !== 'string') {
                    continue;
                }

                const metadata = metadatas[i] as Record<string, unknown> | undefined;
                const docEmbedding = computeEmbedding(buildEmbeddingInputFromDocument(content, metadata));
                const cosineScore = cosineSimilarity(queryEmbedding, docEmbedding);
                if (cosineScore < minCosineSimilarity) {
                    continue;
                }

                const pathValue = getMetadataString(metadata, 'path', `document-${offset + i + 1}`);
                const chunkIndex = getMetadataString(metadata, 'chunkIndex');
                const chunkCount = getMetadataString(metadata, 'chunkCount');
                const chunkSuffix = chunkIndex && chunkCount
                    ? ` [chunk ${Number(chunkIndex) + 1}/${chunkCount}]`
                    : '';

                ranked.push({
                    path: `${pathValue}${chunkSuffix}`,
                    content,
                    distance: 1 - cosineScore,
                    cosineScore
                });
            }

            if (ids.length < pageSize) {
                break;
            }

            offset += pageSize;
        }

        ranked.sort((a, b) => b.cosineScore - a.cosineScore);
        const results = ranked.slice(0, topK).map((item) => ({
            path: item.path,
            content: item.content,
            distance: item.distance
        }));

        logger?.info('rag', 'Conceptual KNN Chroma query finished', {
            collectionName,
            scannedDocuments,
            minCosineSimilarity,
            rankedMatches: ranked.length,
            returnedResults: results.length
        });

        return results;
    } catch (error) {
        logger?.error('rag', 'Conceptual KNN Chroma query failed', error);
        throw error;
    }
}

export class ChromaAdapter implements RagGateway, RepositoryIndexGateway {
    constructor(private readonly logger: Logger) {}

    async isAvailable(config: ChromaDbConnectionConfig): Promise<boolean> {
        return isChromaDbAvailable(config);
    }

    async queryConceptual(
        queryText: string,
        config: ChromaDbConnectionConfig,
        options: ChromaConceptualKnnOptions
    ): Promise<ChromaSearchResult[]> {
        return queryRelevantContextFromChromaDbConceptualKnn(queryText, config, {
            ...options,
            logger: options.logger || this.logger
        });
    }

    async queryByMode(
        queryText: string,
        config: ChromaDbConnectionConfig,
        maxResults: number,
        mode: ChromaQueryMode,
        signal?: AbortSignal,
        filePathFilter?: string[]
    ): Promise<ChromaSearchResult[]> {
        return queryRelevantContextFromChromaDb(
            queryText,
            config,
            maxResults,
            mode,
            signal,
            filePathFilter,
            this.logger
        );
    }

    async buildWorkspaceGraph(workspaceRoot: string, chromaConfig: ChromaDbConnectionConfig, cacheRoot: string): Promise<void> {
        const graphBuilder = new WorkspaceDependencyGraphBuilder(workspaceRoot, chromaConfig, cacheRoot);
        await graphBuilder.build();
    }

    async indexAll(workspaceRoot: string, chromaConfig: ChromaDbConnectionConfig): Promise<RagIndexResult> {
        return indexAllWithChromaDb(workspaceRoot, chromaConfig, this.logger);
    }
}