export enum QueryIntentType {
    STRUCTURED_FOCUSED = 'STRUCTURED_FOCUSED',
    OPEN_CONCEPTUAL = 'OPEN_CONCEPTUAL'
}

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
