import { Logger } from '../../adapters/vscode/outputLogger';
import { ChromaDbConnectionConfig } from '../model/chroma';
import { RagContextMatch, RagGateway } from '../gateways/ragGateway';

export interface LlamaChatAgentSearchResult {
    queryText: string;
    matches: RagContextMatch[];
    observationText: string;
}

function formatObservation(queryText: string, matches: RagContextMatch[]): string {
    if (matches.length === 0) {
        return [
            'Tool: llamachat_agent_search',
            `Query: ${queryText}`,
            'No indexed code matched the query.'
        ].join('\n');
    }

    const sections = matches.map((match, index) => [
        `Result ${index + 1} | Source: ${match.path}`,
        '```',
        match.content,
        '```'
    ].join('\n'));

    return [
        'Tool: llamachat_agent_search',
        `Query: ${queryText}`,
        '',
        ...sections
    ].join('\n');
}

export class LlamaChatAgentSearchUseCase {
    constructor(
        private readonly ragGateway: RagGateway,
        private readonly logger: Logger
    ) {}

    async execute(
        queryText: string,
        config: ChromaDbConnectionConfig,
        signal?: AbortSignal
    ): Promise<LlamaChatAgentSearchResult> {
        const normalizedQuery = queryText.trim();
        if (!normalizedQuery) {
            this.logger.warn('rag', 'llamachat_agent_search skipped because query text is empty');
            return {
                queryText: normalizedQuery,
                matches: [],
                observationText: 'Tool: llamachat_agent_search\nQuery: \nNo indexed code matched the query.'
            };
        }

        const isAvailable = await this.ragGateway.isAvailable(config);
        if (!isAvailable) {
            this.logger.warn('rag', 'llamachat_agent_search skipped because ChromaDB is unavailable', {
                queryText: normalizedQuery,
                collectionId: config.collectionId
            });
            return {
                queryText: normalizedQuery,
                matches: [],
                observationText: [
                    'Tool: llamachat_agent_search',
                    `Query: ${normalizedQuery}`,
                    'ChromaDB is unavailable or the repository is not indexed.'
                ].join('\n')
            };
        }

        this.logger.debug('rag', 'Executing llamachat_agent_search', { queryText: normalizedQuery });

        // Hybrid search: semantic + lexical in parallel, then combine results with deduplication
        const [semanticResults, lexicalResults] = await Promise.all([
            this.ragGateway.queryByMode(
                normalizedQuery,
                config,
                Math.min(config.maxQueryResults, 5),
                'semantic',
                signal,
                undefined
            ),
            this.ragGateway.queryByMode(
                normalizedQuery,
                config,
                Math.min(config.maxQueryResults, 5),
                'lexical',
                signal,
                undefined
            )
        ]);

        // Combine results: prioritize matches appearing in both, then add unique semantic, then unique lexical
        const seenPaths = new Set<string>();
        const combinedMatches: RagContextMatch[] = [];

        // First: add intersection (found in both semantic and lexical)
        semanticResults.forEach((semantic) => {
            const lexicalMatch = lexicalResults.find((lex) => lex.path === semantic.path);
            if (lexicalMatch && !seenPaths.has(semantic.path)) {
                combinedMatches.push(semantic);
                seenPaths.add(semantic.path);
            }
        });

        // Second: add remaining semantic results
        semanticResults.forEach((semantic) => {
            if (!seenPaths.has(semantic.path)) {
                combinedMatches.push(semantic);
                seenPaths.add(semantic.path);
            }
        });

        // Third: add remaining lexical results
        lexicalResults.forEach((lexical) => {
            if (!seenPaths.has(lexical.path)) {
                combinedMatches.push(lexical);
                seenPaths.add(lexical.path);
            }
        });

        const matches = combinedMatches.slice(0, Math.min(config.maxQueryResults, 5));

        this.logger.info('rag', 'llamachat_agent_search completed (hybrid semantic+lexical)', {
            queryText: normalizedQuery,
            collectionId: config.collectionId,
            semanticMatches: semanticResults.length,
            lexicalMatches: lexicalResults.length,
            combinedMatches: matches.length,
            topPaths: matches.slice(0, 3).map((match) => match.path)
        });

        return {
            queryText: normalizedQuery,
            matches,
            observationText: formatObservation(normalizedQuery, matches)
        };
    }
}
