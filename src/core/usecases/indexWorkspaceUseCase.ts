import { ChromaDbConnectionConfig, RagIndexResult } from '../model/chroma';
import { Logger } from '../../adapters/vscode/outputLogger';
import { RagGateway } from '../gateways/ragGateway';
import { ChunkProviderGateway } from '../gateways/chunkProviderGateway';
import { EmbeddingGateway } from '../gateways/embeddingGateway';
import { VectorIndexGateway } from '../gateways/vectorIndexGateway';
import { buildEmbeddingInput, IndexedChunk } from '../../adapters/chroma/utils/analysis/metadataBuilder';

export interface IndexWorkspaceInput {
    workspaceRoot: string;
    chromaConfig: ChromaDbConnectionConfig;
}

export interface IndexWorkspaceResult {
    availability: boolean;
    result?: RagIndexResult;
}

export class IndexWorkspaceUseCase {
    constructor(
        private readonly chunkProviderGateway: ChunkProviderGateway,
        private readonly embeddingGateway: EmbeddingGateway,
        private readonly vectorIndexGateway: VectorIndexGateway,
        private readonly ragGateway: RagGateway,
        private readonly logger: Logger
    ) {}

    async execute(input: IndexWorkspaceInput): Promise<IndexWorkspaceResult> {
        this.logger.info('rag', 'Starting repository indexing');

        try {
            const available = await this.ragGateway.isAvailable(input.chromaConfig);
            if (!available) {
                this.logger.warn('rag', 'Skipping indexing because ChromaDB is unavailable');
                return { availability: false };
            }

            this.logger.debug('rag', 'ChromaDB is available, proceeding with chunk collection');
            const chunks = await this.chunkProviderGateway.collectChunks(input.workspaceRoot, input.chromaConfig);
            this.logger.info('rag', 'Repository chunk collection completed', {
                chunkCount: chunks.length,
                workspaceRoot: input.workspaceRoot
            });

            if (chunks.length === 0) {
                this.logger.warn('rag', 'No chunks collected, skipping embedding generation');
                return { availability: true, result: undefined };
            }

            this.logger.debug('rag', 'Starting embedding generation', {
                chunkCount: chunks.length,
                batchSize: input.chromaConfig.embeddingBatchSize
            });
            const embeddingInputs = chunks.map((chunk) => buildEmbeddingInput(chunk as IndexedChunk));
            this.logger.debug('rag', 'Embedding inputs prepared', { inputCount: embeddingInputs.length });

            const embeddings: number[][] = [];
            const embeddingBatchSize = Math.max(1, Math.floor(input.chromaConfig.embeddingBatchSize));
            const totalBatches = Math.ceil(embeddingInputs.length / embeddingBatchSize);
            for (let offset = 0; offset < embeddingInputs.length; offset += embeddingBatchSize) {
                const batchIndex = Math.floor(offset / embeddingBatchSize) + 1;
                const batchInputs = embeddingInputs.slice(offset, offset + embeddingBatchSize);
                this.logger.debug('rag', 'Embedding batch started', {
                    batchIndex,
                    totalBatches,
                    batchSize: batchInputs.length
                });

                const batchEmbeddings = await this.embeddingGateway.computeEmbeddings(batchInputs);
                embeddings.push(...batchEmbeddings);

                this.logger.debug('rag', 'Embedding batch completed', {
                    batchIndex,
                    totalBatches,
                    producedEmbeddings: batchEmbeddings.length,
                    accumulatedEmbeddings: embeddings.length
                });
            }

            this.logger.info('rag', 'Embedding generation completed', {
                chunkCount: chunks.length,
                embeddingCount: embeddings.length
            });

            if (embeddings.length !== chunks.length) {
                throw new Error(
                    `Embedding count mismatch: expected ${chunks.length} embeddings, got ${embeddings.length}`
                );
            }

            this.logger.debug('rag', 'Starting vector index replacement');
            const result = await this.vectorIndexGateway.replaceAll(
                input.workspaceRoot,
                input.chromaConfig,
                chunks,
                embeddings
            );
            this.logger.info('rag', 'Repository indexing completed', {
                collectionId: result.collectionId,
                indexedAt: result.indexedAt,
                indexedFiles: result.indexedFiles
            });

            return {
                availability: true,
                result
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error('rag', 'RAG indexing failed', {
                error: errorMessage,
                stack: errorStack,
                workspaceRoot: input.workspaceRoot
            });
            throw error;
        }
    }
}
