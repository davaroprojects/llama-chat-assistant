/**
 * Memory management configuration
 * Defines thresholds and behavior for memory pruning
 */

export interface MemoryManagementConfig {
    contextWindowSize: number;
    safetyThreshold: number;
    preserveSystemPrompt: boolean;
    preserveRecentMessagesCount: number;
    truncationMarker: string;
}

export const DEFAULT_MEMORY_MANAGEMENT_CONFIG: MemoryManagementConfig = {
    contextWindowSize: 8192,
    safetyThreshold: 6500, // 80% of 8192
    preserveSystemPrompt: true,
    preserveRecentMessagesCount: 2,
    truncationMarker: '[Code snippet truncated to save memory]'
};

/**
 * Determine if memory pruning is necessary
 */
export function isMemoryPruningNeeded(currentTokens: number, config: MemoryManagementConfig): boolean {
    return currentTokens > config.safetyThreshold;
}

/**
 * Calculate target token count for pruning (reduce to 60% of safety threshold)
 */
export function calculatePruningTarget(config: MemoryManagementConfig): number {
    return Math.floor(config.safetyThreshold * 0.6);
}
