export enum QueryIntentType {
    STRUCTURED_FOCUSED = 'STRUCTURED_FOCUSED',
    OPEN_CONCEPTUAL = 'OPEN_CONCEPTUAL'
}

/**
 * Classifies user intent to route either endpoint-structured retrieval
 * or broad conceptual retrieval.
 */
export function classifyUserIntent(userQuestion: string): QueryIntentType {
    const normalizedText = userQuestion.toLowerCase().trim();

    const structuredPatterns = [
        /\/(api|v1|v2)\//,
        /\b(get|post|put|delete|patch)\b/,
        /\b(flow|trace|path|route)\b/,
        /\b(connects|calls|invokes|passes through)\b/,
        /\b(controller|handler|endpoint)\b/,
        /@[a-z]+mapping/
    ];

    const isStructured = structuredPatterns.some((pattern) => pattern.test(normalizedText));
    if (isStructured) {
        return QueryIntentType.STRUCTURED_FOCUSED;
    }

    const openConceptualPatterns = [
        /\b(how it works|what it does|explain|understand)\b/,
        /\b(refactor|optimize|improve|clean)\b/,
        /\b(pattern|architecture|best practices|design)\b/,
        /\b(where is handled|which part)\b/
    ];

    const isOpenConceptual = openConceptualPatterns.some((pattern) => pattern.test(normalizedText));
    if (isOpenConceptual) {
        return QueryIntentType.OPEN_CONCEPTUAL;
    }

    return QueryIntentType.OPEN_CONCEPTUAL;
}

// Backward-compatible aliases for existing imports.
export const TipoConsulta = {
    PUNTUAL_ESTRUCTURADA: QueryIntentType.STRUCTURED_FOCUSED,
    ABIERTA_CONCEPTUAL: QueryIntentType.OPEN_CONCEPTUAL
} as const;
export const clasificarIntencionUsuario = classifyUserIntent;
