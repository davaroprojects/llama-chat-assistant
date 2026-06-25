export interface EmbeddingGateway {
    computeEmbedding(text: string): Promise<number[]>;
    computeEmbeddings(texts: string[]): Promise<number[][]>;
}
