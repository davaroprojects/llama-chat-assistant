import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import * as path from 'node:path';

export interface ChunkTuning {
    chunkSizeChars?: number;
    chunkOverlapChars?: number;
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

export function getSplitterForFile(fileName: string, tuning?: ChunkTuning): RecursiveCharacterTextSplitter {
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
