import { getSplitterForFile, ChunkTuning } from './textSplitter';

export interface TextChunk {
    text: string;
    start: number;
    end: number;
}

export async function processAndChunkFile(filePath: string, content: string, tuning?: ChunkTuning): Promise<TextChunk[]> {
    const fileName = filePath.split('/').pop() || filePath;
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
