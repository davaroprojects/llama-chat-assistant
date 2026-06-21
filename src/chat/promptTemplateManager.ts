import * as vscode from 'vscode';
import {
    RagModeTemplate,
    SpecificFilesModeTemplate,
    DEFAULT_RAG_MODE_TEMPLATE,
    DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE,
    normalizeRagModeTemplate,
    normalizeSpecificFilesModeTemplate
} from './promptTemplates';

export class PromptTemplateManager {
    static getRagModeTemplate(): RagModeTemplate {
        const config = vscode.workspace.getConfiguration('llamaChat');
        const customTemplate = config.get<Partial<RagModeTemplate>>('chat.ragModeTemplate')
            ?? config.get<Partial<RagModeTemplate>>('ragModeTemplate');
        return normalizeRagModeTemplate(customTemplate, DEFAULT_RAG_MODE_TEMPLATE);
    }

    static getSpecificFilesModeTemplate(): SpecificFilesModeTemplate {
        const config = vscode.workspace.getConfiguration('llamaChat');
        const customTemplate = config.get<Partial<SpecificFilesModeTemplate>>('chat.specificFilesModeTemplate')
            ?? config.get<Partial<SpecificFilesModeTemplate>>('specificFilesModeTemplate');
        return normalizeSpecificFilesModeTemplate(customTemplate, DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE);
    }
}
