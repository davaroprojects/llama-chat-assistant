export interface MemoryManagementConfig {
    contextWindowSize: number;
    safetyThreshold: number;
    preserveSystemPrompt: boolean;
    preserveRecentMessagesCount: number;
    truncationMarker: string;
}

export const DEFAULT_MEMORY_MANAGEMENT_CONFIG: MemoryManagementConfig = {
    contextWindowSize: 8192,
    safetyThreshold: 6500,
    preserveSystemPrompt: true,
    preserveRecentMessagesCount: 2,
    truncationMarker: '[Code snippet truncated to save memory]'
};

export function isMemoryPruningNeeded(currentTokens: number, config: MemoryManagementConfig): boolean {
    return currentTokens > config.safetyThreshold;
}

export function calculatePruningTarget(config: MemoryManagementConfig): number {
    return Math.floor(config.safetyThreshold * 0.6);
}
