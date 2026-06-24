import * as fs from 'node:fs';
import * as path from 'node:path';
import { Parser, Language, type Node as TreeSitterNode } from 'web-tree-sitter';
import { countTokensInText, initializeTokenCounter } from '../../../../utils/tokenCounter';

export interface ChunkingConfig {
    targetChunkTokens?: number;
    maxChunkTokens?: number;
    minChunkTokens?: number;
    fallbackChunkTokens?: number;
}

export interface ChunkWithMetadata {
    text: string;
    index: number;
    totalChunks: number;
    keywordEntities: string[];
    start: number;
    end: number;
}

type SupportedGrammar = 'typescript' | 'tsx' | 'javascript' | 'python' | 'java' | 'json' | 'yaml' | 'xml' | 'ini';

interface NormalizedChunkingConfig {
    targetChunkTokens: number;
    maxChunkTokens: number;
    minChunkTokens: number;
    fallbackChunkTokens: number;
}

interface ChunkDraft {
    start: number;
    end: number;
    nodeType: string;
    tokenCount: number;
}

const DEFAULT_CHUNKING_CONFIG: NormalizedChunkingConfig = {
    targetChunkTokens: 350,
    maxChunkTokens: 512,
    minChunkTokens: 120,
    fallbackChunkTokens: 300
};

const SUPPORTED_NODE_TYPES: Record<SupportedGrammar, Set<string>> = {
    typescript: new Set([
        'class_declaration',
        'function_declaration',
        'method_definition',
        'interface_declaration',
        'type_alias_declaration',
        'enum_declaration',
        'lexical_declaration',
        'import_statement',
        'export_statement'
    ]),
    tsx: new Set([
        'class_declaration',
        'function_declaration',
        'method_definition',
        'interface_declaration',
        'type_alias_declaration',
        'enum_declaration',
        'lexical_declaration',
        'import_statement',
        'export_statement'
    ]),
    javascript: new Set([
        'class_declaration',
        'function_declaration',
        'method_definition',
        'lexical_declaration',
        'variable_declaration',
        'import_statement',
        'export_statement'
    ]),
    python: new Set([
        'class_definition',
        'function_definition',
        'import_statement',
        'import_from_statement',
        'assignment'
    ]),
    java: new Set([
        'class_declaration',
        'interface_declaration',
        'enum_declaration',
        'record_declaration',
        'method_declaration',
        'constructor_declaration',
        'field_declaration',
        'import_declaration'
    ]),
    json: new Set(['object', 'array', 'pair']),
    yaml: new Set(['block_mapping_pair', 'block_mapping', 'block_sequence', 'flow_mapping', 'flow_sequence']),
    xml: new Set(['element', 'STag', 'EmptyElemTag', 'content']),
    ini: new Set(['section', 'property'])
};

const languageCache = new Map<SupportedGrammar, Promise<Language>>();
let parserInitPromise: Promise<void> | null = null;
let tokenCounterInitPromise: Promise<void> | null = null;

function extractKeywordEntities(text: string): string[] {
    const entities = new Set<string>();

    const classMatches = text.match(/(?:class|interface|enum|struct)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
    classMatches.forEach((match) => {
        const name = match.replace(/(?:class|interface|enum|struct)\s+/, '').trim();
        if (name) {
            entities.add(name.toLowerCase());
        }
    });

    const funcMatches = text.match(/(?:function|def|async|public|private|protected)?\s+(?:async\s+)?(?:\w+\s+)*(?:function)?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g) || [];
    funcMatches.forEach((match) => {
        const name = match.replace(/(?:function|def|async|public|private|protected|function)?\s+(?:async\s+)?(?:\w+\s+)*(?:function)?\s*/, '').replace(/\s*\(/, '').trim();
        if (name && name.length > 2) {
            entities.add(name.toLowerCase());
        }
    });

    const varMatches = text.match(/(?:const|let|var|static)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
    varMatches.forEach((match) => {
        const name = match.replace(/(?:const|let|var|static)\s+/, '').trim();
        if (name && name.length > 2) {
            entities.add(name.toLowerCase());
        }
    });

    const importMatches = text.match(/(?:import|from|require)\s+['""]([^'""\n]+)['""]?/g) || [];
    importMatches.forEach((match) => {
        const moduleName = match.replace(/(?:import|from|require)\s+['""]/g, '').replace(/['""].*/, '').trim();
        if (moduleName && moduleName.length > 2) {
            entities.add(moduleName.toLowerCase());
        }
    });

    return Array.from(entities);
}

function normalizeChunkingConfig(config: ChunkingConfig | undefined): NormalizedChunkingConfig {
    const configuredMax = Math.max(64, Math.floor(config?.maxChunkTokens ?? DEFAULT_CHUNKING_CONFIG.maxChunkTokens));
    const configuredTarget = Math.max(32, Math.floor(config?.targetChunkTokens ?? DEFAULT_CHUNKING_CONFIG.targetChunkTokens));
    const configuredMin = Math.max(1, Math.floor(config?.minChunkTokens ?? DEFAULT_CHUNKING_CONFIG.minChunkTokens));
    const configuredFallback = Math.max(32, Math.floor(config?.fallbackChunkTokens ?? DEFAULT_CHUNKING_CONFIG.fallbackChunkTokens));

    return {
        maxChunkTokens: configuredMax,
        targetChunkTokens: Math.min(configuredTarget, configuredMax),
        minChunkTokens: Math.min(configuredMin, configuredMax),
        fallbackChunkTokens: Math.min(configuredFallback, configuredMax)
    };
}

function resolveSupportedGrammar(fileName: string): SupportedGrammar | null {
    const normalizedFileName = fileName.toLowerCase();
    if (normalizedFileName === '.env' || normalizedFileName.startsWith('.env.')) {
        return 'ini';
    }

    switch (path.extname(fileName).toLowerCase()) {
        case '.ts':
            return 'typescript';
        case '.tsx':
            return 'tsx';
        case '.js':
        case '.jsx':
        case '.mjs':
        case '.cjs':
            return 'javascript';
        case '.py':
            return 'python';
        case '.java':
            return 'java';
        case '.json':
            return 'json';
        case '.yaml':
        case '.yml':
            return 'yaml';
        case '.xml':
            return 'xml';
        case '.properties':
            return 'ini';
        default:
            return null;
    }
}

function resolveBundledWasmDir(): string | null {
    const localDistDir = path.join(__dirname, 'wasm');
    if (fs.existsSync(localDistDir)) {
        return localDistDir;
    }

    const repoDistDir = path.resolve(__dirname, '../../../../../dist/wasm');
    if (fs.existsSync(repoDistDir)) {
        return repoDistDir;
    }

    return null;
}

function resolveWasmAsset(fileName: string, packageRequest: string): string {
    const bundledDir = resolveBundledWasmDir();
    if (bundledDir) {
        const bundledPath = path.join(bundledDir, fileName);
        if (fs.existsSync(bundledPath)) {
            return bundledPath;
        }
    }

    return require.resolve(packageRequest);
}

function getGrammarAssetRequest(grammar: SupportedGrammar): { fileName: string; packageRequest: string } {
    switch (grammar) {
        case 'typescript':
            return { fileName: 'tree-sitter-typescript.wasm', packageRequest: '@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm' };
        case 'tsx':
            return { fileName: 'tree-sitter-tsx.wasm', packageRequest: '@vscode/tree-sitter-wasm/wasm/tree-sitter-tsx.wasm' };
        case 'javascript':
            return { fileName: 'tree-sitter-javascript.wasm', packageRequest: '@vscode/tree-sitter-wasm/wasm/tree-sitter-javascript.wasm' };
        case 'python':
            return { fileName: 'tree-sitter-python.wasm', packageRequest: '@vscode/tree-sitter-wasm/wasm/tree-sitter-python.wasm' };
        case 'java':
            return { fileName: 'tree-sitter-java.wasm', packageRequest: '@vscode/tree-sitter-wasm/wasm/tree-sitter-java.wasm' };
        case 'json':
            return { fileName: 'tree-sitter-json.wasm', packageRequest: '@lumis-sh/wasm-json/tree-sitter-json.wasm' };
        case 'yaml':
            return { fileName: 'tree-sitter-yaml.wasm', packageRequest: '@lumis-sh/wasm-yaml/tree-sitter-yaml.wasm' };
        case 'xml':
            return { fileName: 'tree-sitter-xml.wasm', packageRequest: '@lumis-sh/wasm-xml/tree-sitter-xml.wasm' };
        case 'ini':
            return { fileName: 'tree-sitter-ini.wasm', packageRequest: '@vscode/tree-sitter-wasm/wasm/tree-sitter-ini.wasm' };
    }
}

async function ensureParserRuntime(): Promise<void> {
    parserInitPromise ??= Parser.init({
        locateFile() {
            return resolveWasmAsset('web-tree-sitter.wasm', 'web-tree-sitter/web-tree-sitter.wasm');
        }
    });

    await parserInitPromise;
}

async function ensureTokenCounterReady(): Promise<void> {
    tokenCounterInitPromise ??= initializeTokenCounter();
    await tokenCounterInitPromise;
}

async function loadGrammar(grammar: SupportedGrammar): Promise<Language> {
    const existing = languageCache.get(grammar);
    if (existing) {
        return existing;
    }

    const promise = (async () => {
        await ensureParserRuntime();
        const asset = getGrammarAssetRequest(grammar);
        return Language.load(resolveWasmAsset(asset.fileName, asset.packageRequest));
    })();

    languageCache.set(grammar, promise);
    return promise;
}

function createChunkDraft(start: number, end: number, nodeType: string, content: string): ChunkDraft {
    return {
        start,
        end,
        nodeType,
        tokenCount: countTokensInText(content.slice(start, end))
    };
}

function isIgnorableNode(node: TreeSitterNode): boolean {
    return !node.isNamed || node.type === 'comment' || node.type === 'ERROR';
}

function getNodeCandidates(node: TreeSitterNode, grammar: SupportedGrammar): TreeSitterNode[] {
    const namedChildren = node.namedChildren.filter((child) => !isIgnorableNode(child));
    if (namedChildren.length === 0) {
        return [];
    }

    const preferred = SUPPORTED_NODE_TYPES[grammar];
    const preferredChildren = namedChildren.filter((child) => preferred.has(child.type));
    return preferredChildren.length > 0 ? preferredChildren : namedChildren;
}

function splitOversizedText(content: string, start: number, end: number, maxChunkTokens: number, nodeType: string): ChunkDraft[] {
    const drafts: ChunkDraft[] = [];
    let cursor = start;

    while (cursor < end) {
        let low = cursor + 1;
        let high = end;
        let best = Math.min(end, cursor + 1);

        while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            const tokenCount = countTokensInText(content.slice(cursor, middle));
            if (tokenCount <= maxChunkTokens) {
                best = middle;
                low = middle + 1;
            } else {
                high = middle - 1;
            }
        }

        if (best <= cursor) {
            best = Math.min(end, cursor + 1);
        }

        drafts.push(createChunkDraft(cursor, best, nodeType, content));
        cursor = best;
    }

    return drafts;
}

function chunkNode(
    node: TreeSitterNode,
    content: string,
    grammar: SupportedGrammar,
    config: NormalizedChunkingConfig,
    isRoot = false
): ChunkDraft[] {
    if (node.endIndex <= node.startIndex) {
        return [];
    }

    const nodeText = content.slice(node.startIndex, node.endIndex);
    if (!nodeText.trim()) {
        return [];
    }

    const tokenCount = countTokensInText(nodeText);
    const candidates = getNodeCandidates(node, grammar);

    if (!isRoot && tokenCount <= config.maxChunkTokens) {
        return [createChunkDraft(node.startIndex, node.endIndex, node.type, content)];
    }

    if (candidates.length === 0) {
        if (tokenCount <= config.maxChunkTokens) {
            return [createChunkDraft(node.startIndex, node.endIndex, node.type, content)];
        }

        return splitOversizedText(content, node.startIndex, node.endIndex, config.maxChunkTokens, node.type);
    }

    const nested = candidates.flatMap((child) => chunkNode(child, content, grammar, config));
    if (nested.length === 0) {
        if (tokenCount <= config.maxChunkTokens) {
            return [createChunkDraft(node.startIndex, node.endIndex, node.type, content)];
        }

        return splitOversizedText(content, node.startIndex, node.endIndex, config.maxChunkTokens, node.type);
    }

    return nested;
}

function mergeSmallChunks(chunks: ChunkDraft[], content: string, config: NormalizedChunkingConfig): ChunkDraft[] {
    if (chunks.length <= 1) {
        return chunks;
    }

    const merged: ChunkDraft[] = [];
    for (const chunk of chunks) {
        const previous = merged[merged.length - 1];
        if (!previous) {
            merged.push(chunk);
            continue;
        }

        const shouldTryMerge = previous.tokenCount < config.minChunkTokens || chunk.tokenCount < config.minChunkTokens;
        if (!shouldTryMerge) {
            merged.push(chunk);
            continue;
        }

        const combinedStart = previous.start;
        const combinedEnd = chunk.end;
        const combinedTokenCount = countTokensInText(content.slice(combinedStart, combinedEnd));
        if (combinedTokenCount <= config.targetChunkTokens) {
            merged[merged.length - 1] = {
                start: combinedStart,
                end: combinedEnd,
                nodeType: `${previous.nodeType}+${chunk.nodeType}`,
                tokenCount: combinedTokenCount
            };
        } else {
            merged.push(chunk);
        }
    }

    return merged;
}

function manualFallbackChunks(content: string, config: NormalizedChunkingConfig): ChunkDraft[] {
    const drafts: ChunkDraft[] = [];
    const targetTokens = Math.min(config.fallbackChunkTokens, config.maxChunkTokens);
    let chunkStart = 0;
    let cursor = 0;

    while (cursor < content.length) {
        let lineEnd = content.indexOf('\n', cursor);
        if (lineEnd === -1) {
            lineEnd = content.length;
        } else {
            lineEnd += 1;
        }

        const tokenCount = countTokensInText(content.slice(chunkStart, lineEnd));
        if (tokenCount <= targetTokens) {
            cursor = lineEnd;
            continue;
        }

        if (chunkStart === cursor) {
            drafts.push(...splitOversizedText(content, chunkStart, lineEnd, config.maxChunkTokens, 'manual'));
            chunkStart = lineEnd;
            cursor = lineEnd;
            continue;
        }

        drafts.push(createChunkDraft(chunkStart, cursor, 'manual', content));
        chunkStart = cursor;
    }

    if (chunkStart < content.length) {
        const tailTokens = countTokensInText(content.slice(chunkStart));
        if (tailTokens <= config.maxChunkTokens) {
            drafts.push(createChunkDraft(chunkStart, content.length, 'manual', content));
        } else {
            drafts.push(...splitOversizedText(content, chunkStart, content.length, config.maxChunkTokens, 'manual'));
        }
    }

    return drafts;
}

async function createSyntaxChunks(fileName: string, fileContent: string, config: NormalizedChunkingConfig): Promise<ChunkDraft[]> {
    const grammar = resolveSupportedGrammar(fileName);
    if (!grammar) {
        return manualFallbackChunks(fileContent, config);
    }

    const parser = new Parser();
    try {
        parser.setLanguage(await loadGrammar(grammar));
        const tree = parser.parse(fileContent);
        if (!tree) {
            return manualFallbackChunks(fileContent, config);
        }

        const chunks = mergeSmallChunks(chunkNode(tree.rootNode, fileContent, grammar, config, true), fileContent, config);
        return chunks.length > 0 ? chunks : manualFallbackChunks(fileContent, config);
    } catch {
        return manualFallbackChunks(fileContent, config);
    } finally {
        parser.delete();
    }
}

export async function getSplitterForFile(fileName: string, fileContent: string, config?: ChunkingConfig): Promise<ChunkWithMetadata[]> {
    await ensureTokenCounterReady();
    const normalizedConfig = normalizeChunkingConfig(config);
    const drafts = await createSyntaxChunks(fileName, fileContent, normalizedConfig);
    const totalChunks = drafts.length;

    return drafts.map((draft, index) => {
        const text = fileContent.slice(draft.start, draft.end);
        return {
            text,
            index,
            totalChunks,
            keywordEntities: extractKeywordEntities(text),
            start: draft.start,
            end: draft.end
        };
    });
}
