import * as assert from 'assert';
import * as vscode from 'vscode';
import { PromptTemplateManager } from '../../../adapters/vscode/promptTemplateManager';
import { DEFAULT_RAG_MODE_TEMPLATE, DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE } from '../../../core/model/promptTemplate';

function mockVscodeConfig(settings: Record<string, unknown>): void {
    const original = vscode.workspace.getConfiguration;
    (vscode.workspace as unknown as Record<string, unknown>).getConfiguration = () => ({
        get: <T>(key: string): T | undefined => settings[key] as T | undefined
    });
    after(() => {
        (vscode.workspace as unknown as Record<string, unknown>).getConfiguration = original;
    });
}

suite('PromptTemplateManager - getRagModeTemplate', () => {
    test('Returns default RAG template when no config is set', () => {
        mockVscodeConfig({});
        const result = PromptTemplateManager.getRagModeTemplate();
        assert.deepStrictEqual(result, DEFAULT_RAG_MODE_TEMPLATE);
    });

    test('Merges partial override from chat.ragModeTemplate', () => {
        mockVscodeConfig({
            'chat.ragModeTemplate': {
                executionMode: { header: '<custom>' }
            }
        });
        const result = PromptTemplateManager.getRagModeTemplate();
        assert.strictEqual(result.executionMode.header, '<custom>');
        assert.strictEqual(result.executionMode.scope, DEFAULT_RAG_MODE_TEMPLATE.executionMode.scope);
    });

    test('Falls back to legacy ragModeTemplate key when primary is absent', () => {
        mockVscodeConfig({
            'ragModeTemplate': {
                query: { label: 'Legacy: {prompt}' }
            }
        });
        const result = PromptTemplateManager.getRagModeTemplate();
        assert.strictEqual(result.query.label, 'Legacy: {prompt}');
    });
});

suite('PromptTemplateManager - getSpecificFilesModeTemplate', () => {
    test('Returns default specific files template when no config is set', () => {
        mockVscodeConfig({});
        const result = PromptTemplateManager.getSpecificFilesModeTemplate();
        assert.deepStrictEqual(result, DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE);
    });

    test('Merges partial override from chat.specificFilesModeTemplate', () => {
        mockVscodeConfig({
            'chat.specificFilesModeTemplate': {
                targetFiles: { header: '<files_custom>' }
            }
        });
        const result = PromptTemplateManager.getSpecificFilesModeTemplate();
        assert.strictEqual(result.targetFiles.header, '<files_custom>');
        assert.strictEqual(result.targetFiles.footer, DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE.targetFiles.footer);
    });

    test('Falls back to legacy specificFilesModeTemplate key when primary is absent', () => {
        mockVscodeConfig({
            'specificFilesModeTemplate': {
                query: { label: 'Old query: {prompt}' }
            }
        });
        const result = PromptTemplateManager.getSpecificFilesModeTemplate();
        assert.strictEqual(result.query.label, 'Old query: {prompt}');
    });
});
