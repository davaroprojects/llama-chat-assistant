import { ChromaDbConnectionConfig, RagIndexResult } from '../model/chroma';

export interface RepositoryIndexGateway {
    indexAll(workspaceRoot: string, chromaConfig: ChromaDbConnectionConfig): Promise<RagIndexResult>;
}
