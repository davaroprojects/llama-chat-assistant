import * as vscode from 'vscode';
import {
    ConversationPromptTemplate,
    DEFAULT_DEEP_REACT_TEMPLATE,
    DEFAULT_DIRECT_LLM_TEMPLATE,
    DEFAULT_GLOBAL_REACT_TEMPLATE,
    DEFAULT_LOCAL_RAG_TEMPLATE,
    normalizeConversationPromptTemplate
} from '../../core/model/conversationPromptTemplate';
import {
    RagModeTemplate,
    SpecificFilesModeTemplate,
    normalizeRagModeTemplate,
    normalizeSpecificFilesModeTemplate,
    DEFAULT_RAG_MODE_TEMPLATE,
    DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE
} from '../../core/model/promptTemplate';

export class PromptTemplateManager {
    private static getConversationPromptTemplate(
        primaryKey: string,
        legacyKey: string,
        defaults: ConversationPromptTemplate
    ): ConversationPromptTemplate {
        const config = vscode.workspace.getConfiguration('llamaChat');
        const customTemplate = config.get<Partial<ConversationPromptTemplate>>(primaryKey)
            ?? config.get<Partial<ConversationPromptTemplate>>(legacyKey);
        return normalizeConversationPromptTemplate(customTemplate, defaults);
    }

    static getDirectLlmTemplate(): ConversationPromptTemplate {
        return this.getConversationPromptTemplate('chat.directLlmTemplate', 'directLlmTemplate', DEFAULT_DIRECT_LLM_TEMPLATE);
    }

    static getGlobalReactTemplate(): ConversationPromptTemplate {
        return this.getConversationPromptTemplate('chat.globalReactTemplate', 'globalReactTemplate', DEFAULT_GLOBAL_REACT_TEMPLATE);
    }

    static getLocalRagTemplate(): ConversationPromptTemplate {
        return this.getConversationPromptTemplate('chat.localRagTemplate', 'localRagTemplate', DEFAULT_LOCAL_RAG_TEMPLATE);
    }

    static getDeepReactTemplate(): ConversationPromptTemplate {
        return this.getConversationPromptTemplate('chat.deepReactTemplate', 'deepReactTemplate', DEFAULT_DEEP_REACT_TEMPLATE);
    }

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
