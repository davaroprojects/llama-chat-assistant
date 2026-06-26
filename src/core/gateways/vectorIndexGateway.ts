import { ChromaDbConnectionConfig, RagIndexResult } from '../model/chroma';
import { RepositoryChunk } from '../model/repositoryChunk';

export interface VectorIndexGateway {
    replaceAll(
        workspaceRoot: string,
        config: ChromaDbConnectionConfig,
        chunks: RepositoryChunk[],
        embeddings: number[][]
    ): Promise<RagIndexResult>;
}
