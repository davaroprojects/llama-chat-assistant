import * as vscode from 'vscode';
import * as assert from 'assert';
import { MemoryManagementConfigAdapter } from '../../../adapters/vscode/memoryManagementConfigAdapter';

suite('MemoryManagementConfigAdapter', () => {
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    const originalOnDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration;

    teardown(() => {
        (vscode.workspace as typeof vscode.workspace & { getConfiguration: typeof vscode.workspace.getConfiguration }).getConfiguration = originalGetConfiguration;
        (vscode.workspace as typeof vscode.workspace & { onDidChangeConfiguration: typeof vscode.workspace.onDidChangeConfiguration }).onDidChangeConfiguration = originalOnDidChangeConfiguration;
    });

    test('loads memory configuration from workspace settings', () => {
        const values: Record<string, unknown> = {
            contextWindowSize: 16384,
            safetyThreshold: 13000,
            preserveSystemPrompt: true,
            preserveRecentMessagesCount: 3
        };

        let capturedSection = '';
        (vscode.workspace as typeof vscode.workspace & { getConfiguration: typeof vscode.workspace.getConfiguration }).getConfiguration = ((section?: string) => {
            capturedSection = String(section || '');
            return {
                get: (key: string) => values[key]
            } as unknown as vscode.WorkspaceConfiguration;
        }) as typeof vscode.workspace.getConfiguration;

        const config = MemoryManagementConfigAdapter.loadFromWorkspaceConfig();

        assert.strictEqual(capturedSection, 'llamaChat.memory');
        assert.strictEqual(config.contextWindowSize, 16384);
        assert.strictEqual(config.safetyThreshold, 13000);
        assert.strictEqual(config.preserveSystemPrompt, true);
        assert.strictEqual(config.preserveRecentMessagesCount, 3);
    });

    test('uses defaults when settings are not configured', () => {
        (vscode.workspace as typeof vscode.workspace & { getConfiguration: typeof vscode.workspace.getConfiguration }).getConfiguration = (() => {
            return {
                get: () => undefined
            } as unknown as vscode.WorkspaceConfiguration;
        }) as typeof vscode.workspace.getConfiguration;

        const config = MemoryManagementConfigAdapter.loadFromWorkspaceConfig();

        assert.strictEqual(config.contextWindowSize, 8192);
        assert.strictEqual(config.safetyThreshold, 6500);
        assert.strictEqual(config.preserveSystemPrompt, true);
        assert.strictEqual(config.preserveRecentMessagesCount, 2);
    });

    test('triggers callback on memory configuration changes only', () => {
        let changeListener: ((event: vscode.ConfigurationChangeEvent) => void) | undefined;
        const callbackHits: number[] = [];

        (vscode.workspace as typeof vscode.workspace & { onDidChangeConfiguration: typeof vscode.workspace.onDidChangeConfiguration }).onDidChangeConfiguration = ((listener: (event: vscode.ConfigurationChangeEvent) => unknown) => {
            changeListener = listener;
            return { dispose: () => undefined };
        }) as typeof vscode.workspace.onDidChangeConfiguration;

        MemoryManagementConfigAdapter.onConfigurationChange(() => {
            callbackHits.push(1);
        });

        changeListener?.({
            affectsConfiguration: (section: string) => section === 'llamaChat.memory'
        } as vscode.ConfigurationChangeEvent);

        changeListener?.({
            affectsConfiguration: (section: string) => section === 'other.config'
        } as vscode.ConfigurationChangeEvent);

        assert.strictEqual(callbackHits.length, 1);
    });
});
