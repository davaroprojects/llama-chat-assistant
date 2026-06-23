import { ChromaDbConnectionConfig, RagIndexResult } from '../model/chroma';
import { Logger } from '../../adapters/vscode/outputLogger';
import { RagGateway } from '../gateways/ragGateway';
import { RepositoryIndexGateway } from '../gateways/repositoryIndexGateway';

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
        private readonly repositoryIndexGateway: RepositoryIndexGateway,
        private readonly ragGateway: RagGateway,
        private readonly logger: Logger
    ) {}

    async execute(input: IndexWorkspaceInput): Promise<IndexWorkspaceResult> {
        this.logger.info('rag', 'Starting repository indexing');

        const available = await this.ragGateway.isAvailable(input.chromaConfig);
        if (!available) {
            this.logger.warn('rag', 'Skipping indexing because ChromaDB is unavailable');
            return { availability: false };
        }

        const result = await this.repositoryIndexGateway.indexAll(input.workspaceRoot, input.chromaConfig);
        this.logger.info('rag', 'Repository indexing completed', {
            collectionId: result.collectionId,
            indexedAt: result.indexedAt,
            indexedFiles: result.indexedFiles
        });

        return {
            availability: true,
            result
        };
    }
}
