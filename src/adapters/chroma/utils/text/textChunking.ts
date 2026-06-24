import { getSplitterForFile, ChunkingConfig } from './textSplitter';

export interface TextChunk {
    text: string;
    start: number;
    end: number;
}

export async function processAndChunkFile(filePath: string, content: string, tuning?: ChunkingConfig): Promise<TextChunk[]> {
    const fileName = filePath.split('/').pop() || filePath;
    const chunks = await getSplitterForFile(fileName, content, tuning);

    return chunks.map((chunk) => ({
        text: chunk.text,
        start: chunk.start,
        end: chunk.end
    }));
}
