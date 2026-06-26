import { EmbeddingGateway } from '../../core/gateways/embeddingGateway';
import { LlamaEmbeddingsRuntimeConfig } from '../../core/model/llama';

interface EmbeddingItem {
    embedding?: number[];
}

interface EmbeddingsResponse {
    data?: EmbeddingItem[];
}

export class LlamaEmbeddingsAdapter implements EmbeddingGateway {
    constructor(private readonly configProvider: () => LlamaEmbeddingsRuntimeConfig) {}

    async computeEmbedding(text: string): Promise<number[]> {
        const [embedding] = await this.computeEmbeddings([text]);
        return embedding || [];
    }

    async computeEmbeddings(texts: string[]): Promise<number[][]> {
        if (!texts.length) {
            return [];
        }

        const config = this.configProvider();
        const normalizedInput = texts.map((text) => text.trim());

        try {
            const response = await fetch(config.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: config.model,
                    input: normalizedInput
                }),
                signal: AbortSignal.timeout(config.timeoutMs)
            });

            if (!response.ok) {
                const errorBody = await response.text().catch(() => '(unable to read response)');
                throw new Error(
                    `Embedding server responded with status ${response.status}: ${errorBody}`
                );
            }

            const payload = await response.json() as EmbeddingsResponse;
            const data = Array.isArray(payload.data) ? payload.data : [];
            const embeddings = data.map((item) => Array.isArray(item.embedding) ? item.embedding : []);

            if (embeddings.length !== texts.length) {
                throw new Error(
                    `Embedding count mismatch: expected ${texts.length}, received ${embeddings.length}`
                );
            }

            return embeddings;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const fullError = new Error(
                `Failed to compute embeddings from ${config.apiUrl}: ${message}`
            );
            throw fullError;
        }
    }
}
