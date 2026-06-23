let pipeline: any = null;

// Initialize environment on first use
let envInitialized = false;

async function initializeEnvironment() {
    if (envInitialized) {
        return;
    }
    
    try {
        const { env } = await import('@huggingface/transformers');
        // Disable local files only to allow remote model loading
        env.allowRemoteModels = true;
        env.allowLocalModels = false;
        envInitialized = true;
    } catch (error) {
        console.warn('[Embeddings] Failed to initialize environment:', error);
        // Continue anyway - may not be critical
    }
}

/**
 * Initialize the embedding pipeline (lazy load on first use)
 * Uses Xenova/all-MiniLM-L6-v2 - a lightweight, efficient model
 * Dimensions: 384
 * Size: ~22MB cached
 */
async function initializeEmbeddingPipeline() {
    if (pipeline) {
        return pipeline;
    }

    await initializeEnvironment();
    console.log('[Embeddings] Initializing HuggingFace transformers pipeline...');
    try {
        // Use dynamic import for ESM module
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

/**
 * Compute embedding for a single text using HuggingFace transformers
 * Returns 384-dimensional vector normalized to unit length
 */
export async function computeEmbedding(text: string): Promise<number[]> {
    try {
        const p = await initializeEmbeddingPipeline();
        
        // Normalize and truncate input text
        const normalizedText = text
            .slice(0, 512)  // Limit to 512 tokens (~2000 chars)
            .trim()
            .replace(/\s+/g, ' ');

        if (!normalizedText) {
            // Return zero vector for empty text
            return new Array(384).fill(0);
        }

        // Generate embedding
        const result = await p(normalizedText, {
            pooling: 'mean',
            normalize: true
        });

        // Convert to array and ensure it's normalized
        const embedding = (Array.from((result?.data as any) || (result as any)) as number[]) || [];
        
        // Normalize to unit length if not already normalized
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

/**
 * Batch compute embeddings for multiple texts
 * More efficient than calling computeEmbedding multiple times
 */
export async function computeEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
        return [];
    }

    try {
        const p = await initializeEmbeddingPipeline();
        
        // Normalize and truncate input texts
        const normalizedTexts = texts.map(text =>
            text
                .slice(0, 512)
                .trim()
                .replace(/\s+/g, ' ')
        );

        // Generate embeddings
        const result = await p(normalizedTexts, {
            pooling: 'mean',
            normalize: true
        });

        // Convert result to array of embeddings
        const embeddings: number[][] = [];
        for (let i = 0; i < texts.length; i += 1) {
            const resultData = (result as any)?.[i]?.data || (result as any)?.[i] || (result as any)?.data;
            const embedding = (Array.from(resultData) as number[]) || [];
            
            // Normalize to unit length
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

/**
 * Create ChromaDB embedding function compatible interface
 * Returns an object with async generate method expected by ChromaDB
 */
export function createHuggingFaceEmbeddingFunction() {
    return {
        generate: async (texts: string[]) => {
            return computeEmbeddings(texts);
        }
    } as any;
}
