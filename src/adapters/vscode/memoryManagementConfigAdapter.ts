/**
 * Memory management configuration adapter
 * Reads memory settings from VS Code workspace configuration
 */

import * as vscode from 'vscode';
import { MemoryManagementConfig, DEFAULT_MEMORY_MANAGEMENT_CONFIG } from '../../core/domain/memoryConfig';

export class MemoryManagementConfigAdapter {
    /**
     * Load memory management configuration from VS Code settings
     */
    static loadFromWorkspaceConfig(): MemoryManagementConfig {
        const workspaceConfig = vscode.workspace.getConfiguration('llamaChat.memory');

        return {
            contextWindowSize: workspaceConfig.get('contextWindowSize') ?? DEFAULT_MEMORY_MANAGEMENT_CONFIG.contextWindowSize,
            safetyThreshold: workspaceConfig.get('safetyThreshold') ?? DEFAULT_MEMORY_MANAGEMENT_CONFIG.safetyThreshold,
            preserveSystemPrompt: workspaceConfig.get('preserveSystemPrompt') ?? DEFAULT_MEMORY_MANAGEMENT_CONFIG.preserveSystemPrompt,
            preserveRecentMessagesCount: workspaceConfig.get('preserveRecentMessagesCount') ?? DEFAULT_MEMORY_MANAGEMENT_CONFIG.preserveRecentMessagesCount,
            truncationMarker: DEFAULT_MEMORY_MANAGEMENT_CONFIG.truncationMarker
        };
    }

    /**
     * Watch for configuration changes and notify listeners
     */
    static onConfigurationChange(callback: () => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('llamaChat.memory')) {
                callback();
            }
        });
    }
}
