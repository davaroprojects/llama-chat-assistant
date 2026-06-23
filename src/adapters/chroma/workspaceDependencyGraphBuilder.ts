import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import type { Dirent } from 'node:fs';
import * as path from 'node:path';
import { ChromaDbConnectionConfig } from '../../core/model/chroma';
import { ProjectComponent, WorkspaceGraph } from '../../core/model/workspace';

const CODE_FILE_EXTENSIONS = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.mts',
    '.cts',
    '.java',
    '.py',
    '.go',
    '.cs'
]);

interface WorkspaceGraphEdge {
    source: string;
    target: string;
}

interface WorkspaceDependencyGraph {
    version: 1;
    generatedAt: number;
    workspaceRoot: string;
    nodes: string[];
    edges: WorkspaceGraphEdge[];
    components: WorkspaceGraph;
}

interface ImportReference {
    moduleSpecifier: string;
    importedNames: string[];
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

function isCodeFile(relativePath: string): boolean {
    return CODE_FILE_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

function toRelativePath(workspaceRoot: string, absolutePath: string): string {
    return path.relative(workspaceRoot, absolutePath).split(path.sep).join('/');
}

function normalizeImportedName(name: string): string {
    return name.replace(/\s+/g, ' ').trim();
}

function parseImportReferences(content: string): ImportReference[] {
    const imports: ImportReference[] = [];
    const importFromRegex = /^\s*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/gm;
    const javaImportRegex = /^\s*import\s+(?:static\s+)?([a-zA-Z0-9_.$*]+)\s*;?/gm;
    const requireRegex = /^\s*(?:const|let|var)\s+([^=]+?)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\);?/gm;

    let match: RegExpExecArray | null;

    while ((match = importFromRegex.exec(content)) !== null) {
        const clause = match[1]?.trim() || '';
        const moduleSpecifier = match[2]?.trim() || '';
        if (!moduleSpecifier) {
            continue;
        }

        const importedNames: string[] = [];
        const namedMatch = clause.match(/\{([\s\S]*?)\}/);

        if (namedMatch && namedMatch[1]) {
            namedMatch[1]
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean)
                .forEach((part) => {
                    const aliasSplit = part.split(/\s+as\s+/i);
                    const imported = normalizeImportedName(aliasSplit[0] || '');
                    if (imported) {
                        importedNames.push(imported);
                    }
                });
        }

        const withoutNamed = clause.replace(/\{[\s\S]*?\}/g, '').trim();
        if (withoutNamed) {
            withoutNamed
                .split(',')
                .map((part) => normalizeImportedName(part))
                .filter((part) => part && part !== 'type' && !part.startsWith('*'))
                .forEach((part) => importedNames.push(part));
        }

        imports.push({
            moduleSpecifier,
            importedNames
        });
    }

    while ((match = requireRegex.exec(content)) !== null) {
        const binding = match[1]?.trim() || '';
        const moduleSpecifier = match[2]?.trim() || '';
        if (!moduleSpecifier) {
            continue;
        }

        const importedNames: string[] = [];
        const destructured = binding.match(/^\{([\s\S]*?)\}$/);
        if (destructured && destructured[1]) {
            destructured[1]
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean)
                .forEach((part) => {
                    const aliasSplit = part.split(':');
                    const imported = normalizeImportedName(aliasSplit[0] || '');
                    if (imported) {
                        importedNames.push(imported);
                    }
                });
        } else {
            const cleaned = normalizeImportedName(binding);
            if (cleaned) {
                importedNames.push(cleaned);
            }
        }

        imports.push({
            moduleSpecifier,
            importedNames
        });
    }

    while ((match = javaImportRegex.exec(content)) !== null) {
        const fullImport = (match[1] || '').trim();
        if (!fullImport) {
            continue;
        }

        const className = fullImport.split('.').pop() || '';
        imports.push({
            moduleSpecifier: fullImport,
            importedNames: className ? [className] : []
        });
    }

    return imports;
}

function normalizePathLike(rawPath: string): string {
    return rawPath.replace(/\\/g, '/');
}

function resolveImportTargetFile(sourceFile: string, moduleSpecifier: string): string | null {
    if (!moduleSpecifier.startsWith('.')) {
        return null;
    }

    const basePath = path.resolve(path.dirname(sourceFile), moduleSpecifier);
    const candidatePaths = [
        basePath,
        `${basePath}.ts`,
        `${basePath}.tsx`,
        `${basePath}.js`,
        `${basePath}.jsx`,
        `${basePath}.mjs`,
        `${basePath}.cjs`,
        `${basePath}.mts`,
        `${basePath}.cts`,
        `${basePath}.java`,
        path.join(basePath, 'index.ts'),
        path.join(basePath, 'index.tsx'),
        path.join(basePath, 'index.js'),
        path.join(basePath, 'index.jsx'),
        path.join(basePath, 'index.mjs'),
        path.join(basePath, 'index.cjs'),
        path.join(basePath, 'index.mts'),
        path.join(basePath, 'index.cts')
    ];

    for (const candidate of candidatePaths) {
        try {
            const stat = fsSync.statSync(candidate);
            if (stat.isFile()) {
                return candidate;
            }
        } catch {
        }
    }

    return null;
}

function classifyComponentType(filePath: string): string {
    const lowerPath = filePath.toLowerCase();
    if (lowerPath.includes('controller')) {
        return 'controller';
    }
    if (lowerPath.includes('router') || lowerPath.includes('routes')) {
        return 'router';
    }
    if (lowerPath.includes('service')) {
        return 'service';
    }
    if (lowerPath.includes('repository') || lowerPath.includes('dao')) {
        return 'repository';
    }
    if (lowerPath.includes('handler')) {
        return 'handler';
    }

    return 'module';
}

function detectEndpointTriggers(content: string): string[] {
    const triggers = new Set<string>();

    const jsRouteRegex = /\b(?:app|router|server)\s*\.\s*(get|post|put|delete|patch|options|head|all|use)\s*\(\s*['"]([^'"]+)['"]/gmi;
    const springRouteRegex = /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*\(([^)]*)\)/gmi;

    let match: RegExpExecArray | null;

    while ((match = jsRouteRegex.exec(content)) !== null) {
        const method = (match[1] || '').toUpperCase();
        const route = (match[2] || '').trim();
        if (route.startsWith('/')) {
            triggers.add(`${method} ${route}`);
        }
    }

    while ((match = springRouteRegex.exec(content)) !== null) {
        const annotation = (match[1] || '').trim();
        const args = match[2] || '';

        const methodByAnnotation: Record<string, string> = {
            GetMapping: 'GET',
            PostMapping: 'POST',
            PutMapping: 'PUT',
            DeleteMapping: 'DELETE',
            PatchMapping: 'PATCH',
            RequestMapping: 'ANY'
        };

        const method = methodByAnnotation[annotation] || 'ANY';
        const valueMatch = args.match(/(?:value|path)\s*=\s*['"]([^'"]+)['"]/i) || args.match(/['"]([^'"]+)['"]/);
        const route = (valueMatch?.[1] || '').trim();

        if (route.startsWith('/')) {
            triggers.add(`${method} ${route}`);
        }
    }

    return Array.from(triggers);
}

function extractDeclaredSymbols(content: string): string[] {
    const symbols = new Set<string>();

    const jsSymbolRegex = /\b(?:class|function|interface|type|enum|const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
    const classLikeRegex = /\b(?:public|private|protected)?\s*(?:abstract\s+|final\s+)?(?:class|interface|enum|record)\s+([A-Za-z_][A-Za-z0-9_]*)/g;

    let match: RegExpExecArray | null;
    while ((match = jsSymbolRegex.exec(content)) !== null) {
        symbols.add(match[1]);
    }

    while ((match = classLikeRegex.exec(content)) !== null) {
        symbols.add(match[1]);
    }

    return Array.from(symbols);
}

export class WorkspaceDependencyGraphBuilder {
    constructor(
        private readonly workspaceRoot: string,
        private readonly config: ChromaDbConnectionConfig,
        private readonly cacheRootPath: string
    ) { }

    public async build(): Promise<string> {
        const codeFiles = await this.listCodeFiles();
        const graph: WorkspaceDependencyGraph = {
            version: 1,
            generatedAt: Date.now(),
            workspaceRoot: this.workspaceRoot,
            nodes: [],
            edges: [],
            components: {}
        };

        const absoluteByRelativePath = new Map<string, string>();
        const fileToImports = new Map<string, ImportReference[]>();
        const fileToTriggers = new Map<string, string[]>();
        const symbolToFilePaths = new Map<string, Set<string>>();

        for (const absoluteFilePath of codeFiles) {
            let content = '';
            try {
                content = await fs.readFile(absoluteFilePath, 'utf8');
            } catch {
                continue;
            }

            if (!content.trim()) {
                continue;
            }

            const relativePath = toRelativePath(this.workspaceRoot, absoluteFilePath);
            absoluteByRelativePath.set(relativePath, absoluteFilePath);
            graph.nodes.push(relativePath);

            const imports = parseImportReferences(content);
            const triggers = detectEndpointTriggers(content);
            const symbols = extractDeclaredSymbols(content);

            fileToImports.set(relativePath, imports);
            fileToTriggers.set(relativePath, triggers);

            symbols.forEach((symbol) => {
                const key = normalizeImportedName(symbol);
                if (!key) {
                    return;
                }

                if (!symbolToFilePaths.has(key)) {
                    symbolToFilePaths.set(key, new Set<string>());
                }

                symbolToFilePaths.get(key)?.add(relativePath);
            });
        }

        const edgeKeySet = new Set<string>();
        const callsBySource = new Map<string, Set<string>>();

        fileToImports.forEach((imports, sourceRelativePath) => {
            const sourceAbsolutePath = absoluteByRelativePath.get(sourceRelativePath);
            if (!sourceAbsolutePath) {
                return;
            }

            imports.forEach((importRef) => {
                const staticTargetAbsolute = resolveImportTargetFile(sourceAbsolutePath, importRef.moduleSpecifier);
                if (staticTargetAbsolute) {
                    const targetRelativePath = toRelativePath(this.workspaceRoot, staticTargetAbsolute);
                    if (absoluteByRelativePath.has(targetRelativePath) && targetRelativePath !== sourceRelativePath) {
                        const edgeKey = `${sourceRelativePath}|${targetRelativePath}`;
                        if (!edgeKeySet.has(edgeKey)) {
                            edgeKeySet.add(edgeKey);
                            graph.edges.push({
                                source: sourceRelativePath,
                                target: targetRelativePath
                            });
                        }

                        if (!callsBySource.has(sourceRelativePath)) {
                            callsBySource.set(sourceRelativePath, new Set<string>());
                        }
                        callsBySource.get(sourceRelativePath)?.add(targetRelativePath);
                    }
                }

                importRef.importedNames.forEach((importedName) => {
                    const normalized = normalizeImportedName(importedName);
                    if (!normalized) {
                        return;
                    }

                    const candidates = symbolToFilePaths.get(normalized);
                    if (!candidates) {
                        return;
                    }

                    candidates.forEach((targetRelativePath) => {
                        if (targetRelativePath === sourceRelativePath) {
                            return;
                        }

                        const edgeKey = `${sourceRelativePath}|${targetRelativePath}`;
                        if (!edgeKeySet.has(edgeKey)) {
                            edgeKeySet.add(edgeKey);
                            graph.edges.push({
                                source: sourceRelativePath,
                                target: targetRelativePath
                            });
                        }

                        if (!callsBySource.has(sourceRelativePath)) {
                            callsBySource.set(sourceRelativePath, new Set<string>());
                        }
                        callsBySource.get(sourceRelativePath)?.add(targetRelativePath);
                    });
                });
            });
        });

        graph.nodes = Array.from(new Set(graph.nodes.map((node) => normalizePathLike(node))));
        graph.edges = graph.edges
            .map((edge) => ({
                source: normalizePathLike(edge.source),
                target: normalizePathLike(edge.target)
            }))
            .sort((a, b) => `${a.source}|${a.target}`.localeCompare(`${b.source}|${b.target}`));

        graph.nodes.forEach((filePath) => {
            const componentType = classifyComponentType(filePath);
            const calls = Array.from(callsBySource.get(filePath) || []).map((p) => normalizePathLike(p));

            graph.components[filePath] = {
                type: componentType,
                triggers: fileToTriggers.get(filePath) || [],
                calls
            };
        });

        await fs.mkdir(this.cacheRootPath, { recursive: true });
        const outputPath = path.join(this.cacheRootPath, 'workspace_graph.json');
        await fs.writeFile(outputPath, JSON.stringify(graph, null, 2), 'utf8');
        return outputPath;
    }

    private async listCodeFiles(): Promise<string[]> {
        const files: string[] = [];
        const ignoredDirs = new Set((this.config.excludeDirs || []).map((dir) => dir.trim()).filter(Boolean));
        const excludeRegexes = (this.config.excludeFileGlobs || [])
            .map((pattern) => pattern.trim())
            .filter(Boolean)
            .map((pattern) => globToRegExp(pattern));
        const maxIndexedFiles = Math.max(1, this.config.maxIndexedFiles);

        const walk = async (currentDir: string): Promise<void> => {
            if (files.length >= maxIndexedFiles) {
                return;
            }

            let entries: Dirent[];
            try {
                entries = await fs.readdir(currentDir, { withFileTypes: true });
            } catch {
                return;
            }

            for (const entry of entries) {
                if (files.length >= maxIndexedFiles) {
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

                const relativePath = toRelativePath(this.workspaceRoot, absolutePath);
                if (shouldExcludeFile(relativePath, excludeRegexes) || !isCodeFile(relativePath)) {
                    continue;
                }

                files.push(absolutePath);
            }
        };

        await walk(this.workspaceRoot);
        return files;
    }
}
