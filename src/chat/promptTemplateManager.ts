import * as vscode from 'vscode';
import {
    RagModeTemplate,
    SpecificFilesModeTemplate,
    DEFAULT_RAG_MODE_TEMPLATE,
    DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE,
    normalizeRagModeTemplate,
    normalizeSpecificFilesModeTemplate
} from './promptTemplates';

/**
 * Manager for loading and configuring prompt templates from VS Code settings.
 */
export class PromptTemplateManager {
    /**
     * Load RAG mode template from VS Code configuration.
     * Falls back to default if not configured or invalid.
     */
    static getRagModeTemplate(): RagModeTemplate {
        const config = vscode.workspace.getConfiguration('llamaChat');
        const customTemplate = config.get<Partial<RagModeTemplate>>('ragModeTemplate');
        return normalizeRagModeTemplate(customTemplate, DEFAULT_RAG_MODE_TEMPLATE);
    }

    /**
     * Load Specific Files mode template from VS Code configuration.
     * Falls back to default if not configured or invalid.
     */
    static getSpecificFilesModeTemplate(): SpecificFilesModeTemplate {
        const config = vscode.workspace.getConfiguration('llamaChat');
        const customTemplate = config.get<Partial<SpecificFilesModeTemplate>>('specificFilesModeTemplate');
        return normalizeSpecificFilesModeTemplate(customTemplate, DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE);
    }
}
