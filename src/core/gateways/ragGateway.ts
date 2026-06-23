import { ChromaConceptualKnnOptions, ChromaDbConnectionConfig, ChromaQueryMode } from '../domain/chroma';

export interface RagContextMatch {
    path: string;
    content: string;
    distance?: number;
}

export interface RagGateway {
    isAvailable(config: ChromaDbConnectionConfig): Promise<boolean>;

    queryConceptual(
        queryText: string,
        config: ChromaDbConnectionConfig,
        options: ChromaConceptualKnnOptions
    ): Promise<RagContextMatch[]>;

    queryByMode(
        queryText: string,
        config: ChromaDbConnectionConfig,
        maxResults: number,
        mode: ChromaQueryMode,
        signal?: AbortSignal,
        filePathFilter?: string[]
    ): Promise<RagContextMatch[]>;
}
