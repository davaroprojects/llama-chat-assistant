import { ChromaDbConnectionConfig } from '../model/chroma';
import { RepositoryChunk } from '../model/repositoryChunk';

export interface ChunkProviderGateway {
    collectChunks(workspaceRoot: string, config: ChromaDbConnectionConfig): Promise<RepositoryChunk[]>;
}
