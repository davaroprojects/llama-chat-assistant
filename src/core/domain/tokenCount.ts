/**
 * Domain model for token counting
 * Encapsulates token counting logic and token count information
 */

export interface TokenCountResult {
    totalTokens: number;
    messageTokenCounts: Map<number, number>;
    calculatedAt: Date;
}

export interface TokenCountConfiguration {
    encodingModel: 'cl100k_base' | 'p50k_base' | 'p50k_edit' | 'r50k_base';
}

export const DEFAULT_TOKEN_COUNT_CONFIGURATION: TokenCountConfiguration = {
    encodingModel: 'cl100k_base'
};

/**
 * Calculate safety threshold for token limit
 * Typically 80% of context window for safe buffer
 */
export function calculateSafetyThreshold(contextLimit: number, safetyMargin: number = 0.8): number {
    return Math.floor(contextLimit * safetyMargin);
}

/**
 * Check if token count exceeds safety threshold
 */
export function isTokenCountExceeded(currentTokens: number, safetyThreshold: number): boolean {
    return currentTokens > safetyThreshold;
}
