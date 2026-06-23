import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ProjectComponent, WorkspaceGraph } from '../core/domain/workspace';

interface WorkspaceGraphFilePayload {
    components?: WorkspaceGraph;
}

const MAX_GRAPH_DEPTH = 100;
const MAX_VISITED_NODES = 10_000;

export function searchFlowByEndpoint(graph: WorkspaceGraph, searchedEndpoint: string): string[] {
    let initialController: string | null = null;
    const normalizedEndpoint = searchedEndpoint.toLowerCase().trim();

    if (!normalizedEndpoint) {
        return [];
    }

    for (const [filePath, metadata] of Object.entries(graph)) {
        if (metadata.triggers && metadata.triggers.length > 0) {
            const matches = metadata.triggers.some((trigger) =>
                typeof trigger === 'string' && trigger.toLowerCase().includes(normalizedEndpoint)
            );

            if (matches) {
                initialController = filePath;
                break;
            }
        }
    }

    if (!initialController) {
        return [];
    }

    const detectedFlow: string[] = [];
    const visited = new Set<string>();
    const stack: Array<{ filePath: string; depth: number }> = [{ filePath: initialController, depth: 0 }];

    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) {
            continue;
        }

        if (visited.size >= MAX_VISITED_NODES || current.depth > MAX_GRAPH_DEPTH) {
            break;
        }

        if (visited.has(current.filePath)) {
            continue;
        }

        visited.add(current.filePath);
        detectedFlow.push(current.filePath);

        const componentData = graph[current.filePath];
        const outgoingCalls = Array.isArray(componentData?.calls) ? componentData.calls : [];

        if (outgoingCalls.length > 0) {
            for (const targetFile of outgoingCalls) {
                if (typeof targetFile === 'string' && graph[targetFile] && !visited.has(targetFile)) {
                    stack.push({ filePath: targetFile, depth: current.depth + 1 });
                }
            }
        }
    }

    return detectedFlow;
}

function looksLikeComponentMap(value: unknown): value is WorkspaceGraph {
    if (!value || typeof value !== 'object') {
        return false;
    }

    return Object.values(value as Record<string, unknown>).every((item) => {
        if (!item || typeof item !== 'object') {
            return false;
        }

        const candidate = item as ProjectComponent;
        const componentType = candidate.type;
        const calls = candidate.calls;

        return typeof componentType === 'string'
            && Array.isArray(candidate.triggers)
            && Array.isArray(calls);
    });
}

export class EndpointFlowResolver {
    constructor(private readonly cacheRootPath: string) { }

    public async resolveFlowFromPrompt(userPrompt: string): Promise<string[]> {
        const searchedEndpoint = this.extractEndpoint(userPrompt);
        if (!searchedEndpoint) {
            return [];
        }

        const graph = await this.loadWorkspaceGraph();
        if (!graph) {
            return [];
        }

        return searchFlowByEndpoint(graph, searchedEndpoint);
    }

    private async loadWorkspaceGraph(): Promise<WorkspaceGraph | null> {
        const graphPath = path.join(this.cacheRootPath, 'workspace_graph.json');

        let raw = '';
        try {
            raw = await fs.readFile(graphPath, 'utf8');
        } catch {
            return null;
        }

        try {
            const parsed = JSON.parse(raw) as WorkspaceGraphFilePayload | WorkspaceGraph;
            if (looksLikeComponentMap(parsed)) {
                return parsed;
            }

            if (parsed && typeof parsed === 'object' && 'components' in parsed && looksLikeComponentMap(parsed.components)) {
                return parsed.components;
            }
        } catch {
            return null;
        }

        return null;
    }

    private extractEndpoint(prompt: string): string | null {
        const endpointMatch = prompt.match(/\/[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=%]*/);
        if (!endpointMatch || !endpointMatch[0]) {
            return null;
        }

        const cleaned = endpointMatch[0].replace(/[.,;!?\)]*$/, '').trim();
        if (!cleaned.startsWith('/')) {
            return null;
        }

        return cleaned;
    }
}
