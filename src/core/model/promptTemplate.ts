export interface RagModeTemplate {
    executionMode: {
        header: string;
        scope: string;
        instruction: string;
    };
    retrievedContext: {
        header: string;
        footer: string;
        fragmentFormat: string;
    };
    query: {
        label: string;
    };
}

export interface SpecificFilesModeTemplate {
    executionMode: {
        header: string;
        scope: string;
        instruction: string;
    };
    targetFiles: {
        header: string;
        footer: string;
        fileFormat: string;
    };
    query: {
        label: string;
    };
}

export const DEFAULT_RAG_MODE_TEMPLATE: RagModeTemplate = {
    executionMode: {
        header: '<execution_mode>',
        scope: 'SCOPE: Global Project Analysis (RAG).',
        instruction: 'You are given multiple independent fragments retrieved from the project database. Synthesize them to explain the requested concept and cite file paths when describing relationships.'
    },
    retrievedContext: {
        header: '<retrieved_context>',
        footer: '</retrieved_context>',
        fragmentFormat: 'Fragment {index} | Source: {path}{distance}\n```\n{content}\n```'
    },
    query: {
        label: 'User Query: {prompt}'
    }
};

export const DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE: SpecificFilesModeTemplate = {
    executionMode: {
        header: '<execution_mode>',
        scope: 'SCOPE: Selected Specific Files.',
        instruction: 'Analyze the code provided inside <target_files> tags to answer the user query. Ignore assumptions not grounded in the visible code.'
    },
    targetFiles: {
        header: '<target_files>',
        footer: '</target_files>',
        fileFormat: 'File: {name}\nType: {type}\nExtension: {extension}\n```\n{content}\n```'
    },
    query: {
        label: 'User Query: {prompt}'
    }
};

export function normalizeRagModeTemplate(
    template: Partial<RagModeTemplate> | undefined,
    defaults: RagModeTemplate = DEFAULT_RAG_MODE_TEMPLATE
): RagModeTemplate {
    if (!template) {
        return defaults;
    }

    const executionMode = {
        ...defaults.executionMode,
        ...(template.executionMode || {})
    };

    const retrievedContext = {
        ...defaults.retrievedContext,
        ...(template.retrievedContext || {})
    };

    const query = {
        ...defaults.query,
        ...(template.query || {})
    };

    return {
        executionMode,
        retrievedContext,
        query
    };
}

export function normalizeSpecificFilesModeTemplate(
    template: Partial<SpecificFilesModeTemplate> | undefined,
    defaults: SpecificFilesModeTemplate = DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE
): SpecificFilesModeTemplate {
    if (!template) {
        return defaults;
    }

    const executionMode = {
        ...defaults.executionMode,
        ...(template.executionMode || {})
    };

    const targetFiles = {
        ...defaults.targetFiles,
        ...(template.targetFiles || {})
    };

    const query = {
        ...defaults.query,
        ...(template.query || {})
    };

    return {
        executionMode,
        targetFiles,
        query
    };
}

export function interpolateRagFragment(
    template: string,
    index: number,
    path: string,
    distance: string,
    content: string
): string {
    return template
        .replace('{index}', String(index))
        .replace('{path}', path)
        .replace('{distance}', distance)
        .replace('{content}', content);
}

export function interpolateSpecificFile(
    template: string,
    name: string,
    type: string,
    extension: string,
    content: string
): string {
    return template
        .replace('{name}', name)
        .replace('{type}', type)
        .replace('{extension}', extension)
        .replace('{content}', content);
}

export function interpolateQueryLabel(template: string, prompt: string): string {
    return template.replace('{prompt}', prompt);
}

export class PromptTemplateBuilder {
    static buildRagModeExecution(
        template: RagModeTemplate = DEFAULT_RAG_MODE_TEMPLATE
    ): string {
        const { header, scope, instruction } = template.executionMode;
        return `${header}\n${scope}\nInstruction: ${instruction}\n</execution_mode>`;
    }

    static buildSpecificFilesModeExecution(
        template: SpecificFilesModeTemplate = DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE
    ): string {
        const { header, scope, instruction } = template.executionMode;
        return `${header}\n${scope}\nInstruction: ${instruction}\n</execution_mode>`;
    }
}
