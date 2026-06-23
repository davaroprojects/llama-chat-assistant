let pipeline: any = null;
let envInitialized = false;

async function initializeEnvironment() {
    if (envInitialized) {
        return;
    }
    
    try {
        const { env } = await import('@huggingface/transformers');
        env.allowRemoteModels = true;
        env.allowLocalModels = false;
        envInitialized = true;
    } catch (error) {
        console.warn('[Embeddings] Failed to initialize environment:', error);
    }
}

async function initializeEmbeddingPipeline() {
    if (pipeline) {
        return pipeline;
    }

    await initializeEnvironment();
    console.log('[Embeddings] Initializing HuggingFace transformers pipeline...');
    try {
        const { pipeline: pipelineFactory } = await import('@huggingface/transformers');
        pipeline = await pipelineFactory(
            'feature-extraction',
            'Xenova/all-MiniLM-L6-v2'
        );
        console.log('[Embeddings] Pipeline initialized successfully');
        return pipeline;
    } catch (error) {
        console.error('[Embeddings] Failed to initialize pipeline:', error);
        throw new Error(`Failed to initialize embedding model: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function computeEmbedding(text: string): Promise<number[]> {
    try {
        const p = await initializeEmbeddingPipeline();
        const normalizedText = text
            .slice(0, 512)  // Limit to 512 tokens (~2000 chars)
            .trim()
            .replace(/\s+/g, ' ');

        if (!normalizedText) {
            return new Array(384).fill(0);
        }

        const result = await p(normalizedText, {
            pooling: 'mean',
            normalize: true
        });

        const embedding = (Array.from((result?.data as any) || (result as any)) as number[]) || [];
        const norm = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
        if (norm > 0) {
            return embedding.map((val: number) => val / norm);
        }

        return embedding;
    } catch (error) {
        console.error('[Embeddings] Error computing embedding:', error);
        throw error;
    }
}

export async function computeEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
        return [];
    }

    try {
        const p = await initializeEmbeddingPipeline();
        const normalizedTexts = texts.map(text =>
            text
                .slice(0, 512)
                .trim()
                .replace(/\s+/g, ' ')
        );

        const result = await p(normalizedTexts, {
            pooling: 'mean',
            normalize: true
        });

        const embeddings: number[][] = [];
        for (let i = 0; i < texts.length; i += 1) {
            const resultData = (result as any)?.[i]?.data || (result as any)?.[i] || (result as any)?.data;
            const embedding = (Array.from(resultData) as number[]) || [];
            const norm = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
            if (norm > 0) {
                embeddings.push(embedding.map((val: number) => val / norm));
            } else {
                embeddings.push(embedding);
            }
        }

        return embeddings;
    } catch (error) {
        console.error('[Embeddings] Error computing batch embeddings:', error);
        throw error;
    }
}

export function createHuggingFaceEmbeddingFunction() {
    return {
        generate: async (texts: string[]) => {
            return computeEmbeddings(texts);
        }
    } as any;
}
