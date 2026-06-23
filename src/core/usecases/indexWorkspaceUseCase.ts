import { ChromaDbConnectionConfig, RagIndexResult } from '../domain/chroma';
import { Logger } from '../../logging/outputLogger';
import { RagGateway } from '../gateways/ragGateway';
import { RepositoryIndexGateway } from '../gateways/repositoryIndexGateway';

export interface IndexWorkspaceInput {
    workspaceRoot: string;
    cacheRoot: string;
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

        await this.repositoryIndexGateway.buildWorkspaceGraph(
            input.workspaceRoot,
            input.chromaConfig,
            input.cacheRoot
        );

        const available = await this.ragGateway.isAvailable(input.chromaConfig);
        if (!available) {
            this.logger.warn('rag', 'Skipping indexing because ChromaDB is unavailable');
            return { availability: false };
        }

        const result = await this.repositoryIndexGateway.indexAll(input.workspaceRoot, input.chromaConfig);
        this.logger.info('rag', 'Repository indexing completed', {
            indexedAt: result.indexedAt,
            indexedFiles: result.indexedFiles
        });

        return {
            availability: true,
            result
        };
    }
}
