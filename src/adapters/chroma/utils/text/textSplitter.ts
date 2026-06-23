import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import * as path from 'node:path';

export interface ChunkTuning {
    chunkSizeChars?: number;
    chunkOverlapChars?: number;
}

export interface ChunkWithMetadata {
    text: string;
    index: number;
    totalChunks: number;
    keywordEntities: string[];
}

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

export function resolveChunkTuning(
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

export async function getSplitterForFile(fileName: string, fileContent: string, tuning?: ChunkTuning): Promise<ChunkWithMetadata[]> {
    const extension = path.extname(fileName).toLowerCase();
    let splitter: RecursiveCharacterTextSplitter;

    switch (extension) {
        case '.java': {
            const chunk = resolveChunkTuning(tuning, 1000, 150);
            splitter = new RecursiveCharacterTextSplitter({
                chunkSize: chunk.chunkSize,
                chunkOverlap: chunk.chunkOverlap,
                separators: ['\n\n', '\npublic\n', '\nprotected\n', '\nprivate\n', '\nclass ', '\ninterface ', '\n}', '\n']
            });
            break;
        }
        case '.py': {
            const chunk = resolveChunkTuning(tuning, 800, 100);
            splitter = new RecursiveCharacterTextSplitter({
                chunkSize: chunk.chunkSize,
                chunkOverlap: chunk.chunkOverlap,
                separators: ['\n\n', '\ndef ', '\nclass ', '\n', ' ']
            });
            break;
        }
        case '.xml': {
            const chunk = resolveChunkTuning(tuning, 600, 50);
            splitter = new RecursiveCharacterTextSplitter({
                chunkSize: chunk.chunkSize,
                chunkOverlap: chunk.chunkOverlap,
                separators: ['</bean>', '</dependency>', '</plugin>', '\n\n', '\n']
            });
            break;
        }
        case '.yaml':
        case '.yml': {
            const chunk = resolveChunkTuning(tuning, 500, 50);
            splitter = new RecursiveCharacterTextSplitter({
                chunkSize: chunk.chunkSize,
                chunkOverlap: chunk.chunkOverlap,
                separators: ['\n\n', '\n-', '\n  ', '\n']
            });
            break;
        }
        case '.properties':
        case '.env':
        case '.conf': {
            const chunk = resolveChunkTuning(tuning, 400, 0);
            splitter = new RecursiveCharacterTextSplitter({
                chunkSize: chunk.chunkSize,
                chunkOverlap: chunk.chunkOverlap,
                separators: ['\n\n', '\n']
            });
            break;
        }
        default: {
            const chunk = resolveChunkTuning(tuning, 800, 100);
            splitter = new RecursiveCharacterTextSplitter({
                chunkSize: chunk.chunkSize,
                chunkOverlap: chunk.chunkOverlap,
                separators: ['\n\n', '\n', ' ']
            });
            break;
        }
    }

    const texts = await splitter.splitText(fileContent);
    const totalChunks = texts.length;

    return texts.map((text, index) => ({
        text,
        index,
        totalChunks,
        keywordEntities: extractKeywordEntities(text)
    }));
}
