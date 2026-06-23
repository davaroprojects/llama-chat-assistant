import { ChromaConceptualKnnOptions, ChromaDbConnectionConfig } from '../model/chroma';

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

    query(
        queryText: string,
        config: ChromaDbConnectionConfig,
        maxResults: number,
        signal?: AbortSignal,
        filePathFilter?: string[]
    ): Promise<RagContextMatch[]>;
}
