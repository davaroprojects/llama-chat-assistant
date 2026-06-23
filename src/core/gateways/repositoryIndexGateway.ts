import { ChromaDbConnectionConfig, RagIndexResult } from '../model/chroma';

export interface RepositoryIndexGateway {
    buildWorkspaceGraph(workspaceRoot: string, chromaConfig: ChromaDbConnectionConfig, cacheRoot: string): Promise<void>;
    indexAll(workspaceRoot: string, chromaConfig: ChromaDbConnectionConfig): Promise<RagIndexResult>;
}
