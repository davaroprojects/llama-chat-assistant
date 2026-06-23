import { getSplitterForFile, ChunkTuning } from './textSplitter';

export interface TextChunk {
    text: string;
    start: number;
    end: number;
}

export async function processAndChunkFile(filePath: string, content: string, tuning?: ChunkTuning): Promise<TextChunk[]> {
    const fileName = filePath.split('/').pop() || filePath;
    const chunks = await getSplitterForFile(fileName, content, tuning);

    return chunks.map((chunk) => ({
        text: chunk.text,
        start: 0,
        end: chunk.text.length
    }));
}
