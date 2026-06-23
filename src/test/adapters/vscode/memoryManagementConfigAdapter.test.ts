/**
 * Tests for memory management configuration adapter
 */

import * as vscode from 'vscode';
import { MemoryManagementConfigAdapter } from '../../../adapters/vscode/memoryManagementConfigAdapter';

jest.mock('vscode', () => ({
    workspace: {
        getConfiguration: jest.fn(),
        onDidChangeConfiguration: jest.fn()
    }
}));

describe('Memory Management Configuration Adapter', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('loadFromWorkspaceConfig', () => {
        it('should load memory configuration from workspace settings', () => {
            const mockConfig = {
                get: jest.fn((key: string) => {
                    const values: Record<string, unknown> = {
                        contextWindowSize: 16384,
                        safetyThreshold: 13000,
                        preserveSystemPrompt: true,
                        preserveRecentMessagesCount: 3
                    };
                    return values[key];
                })
            };

            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

            const config = MemoryManagementConfigAdapter.loadFromWorkspaceConfig();

            expect(config.contextWindowSize).toBe(16384);
            expect(config.safetyThreshold).toBe(13000);
            expect(config.preserveSystemPrompt).toBe(true);
            expect(config.preserveRecentMessagesCount).toBe(3);
        });

        it('should use defaults when settings are not configured', () => {
            const mockConfig = {
                get: jest.fn(() => undefined)
            };

            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

            const config = MemoryManagementConfigAdapter.loadFromWorkspaceConfig();

            expect(config.contextWindowSize).toBe(8192);
            expect(config.safetyThreshold).toBe(6500);
            expect(config.preserveSystemPrompt).toBe(true);
            expect(config.preserveRecentMessagesCount).toBe(2);
        });

        it('should query llamaChat.memory configuration section', () => {
            const mockConfig = {
                get: jest.fn(() => undefined)
            };

            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

            MemoryManagementConfigAdapter.loadFromWorkspaceConfig();

            expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('llamaChat.memory');
        });
    });

    describe('onConfigurationChange', () => {
        it('should register listener for memory configuration changes', () => {
            const mockDisposable = { dispose: jest.fn() };
            const mockCallback = jest.fn();

            (vscode.workspace.onDidChangeConfiguration as jest.Mock).mockReturnValue(mockDisposable);

            const disposable = MemoryManagementConfigAdapter.onConfigurationChange(mockCallback);

            expect(disposable).toBe(mockDisposable);
        });

        it('should trigger callback on memory configuration changes', () => {
            const mockCallback = jest.fn();
            let configChangeListener: (event: any) => void;

            (vscode.workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((callback) => {
                configChangeListener = callback;
                return { dispose: jest.fn() };
            });

            MemoryManagementConfigAdapter.onConfigurationChange(mockCallback);

            // Simulate a configuration change
            configChangeListener!({
                affectsConfiguration: (section: string) => section === 'llamaChat.memory'
            });

            expect(mockCallback).toHaveBeenCalled();
        });

        it('should not trigger callback for unrelated configuration changes', () => {
            const mockCallback = jest.fn();
            let configChangeListener: (event: any) => void;

            (vscode.workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((callback) => {
                configChangeListener = callback;
                return { dispose: jest.fn() };
            });

            MemoryManagementConfigAdapter.onConfigurationChange(mockCallback);

            // Simulate a configuration change for different section
            configChangeListener!({
                affectsConfiguration: (section: string) => section === 'other.config'
            });

            expect(mockCallback).not.toHaveBeenCalled();
        });
    });
});
