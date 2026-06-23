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

interface LegacyRagModeTemplate {
    modoEjecucion?: {
        header?: string;
        alcance?: string;
        instruccion?: string;
    };
    contextoRecuperado?: {
        header?: string;
        footer?: string;
        fragmentoFormat?: string;
    };
    consulta?: {
        label?: string;
    };
}

interface LegacySpecificFilesModeTemplate {
    modoEjecucion?: {
        header?: string;
        alcance?: string;
        instruccion?: string;
    };
    archivosObjetivo?: {
        header?: string;
        footer?: string;
        archivoFormat?: string;
    };
    consulta?: {
        label?: string;
    };
}

export const DEFAULT_RAG_MODE_TEMPLATE: RagModeTemplate = {
    executionMode: {
        header: '<modo_ejecucion>',
        scope: 'SCOPE: Global Project Analysis (RAG).',
        instruction: 'You are given multiple independent fragments retrieved from the project database. Synthesize them to explain the requested concept and cite file paths when describing relationships.'
    },
    retrievedContext: {
        header: '<contexto_recuperado>',
        footer: '</contexto_recuperado>',
        fragmentFormat: 'Fragment {index} | Source: {path}{distance}\n```\n{content}\n```'
    },
    query: {
        label: 'User Query: {prompt}'
    }
};

export const DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE: SpecificFilesModeTemplate = {
    executionMode: {
        header: '<modo_ejecucion>',
        scope: 'SCOPE: Selected Specific Files.',
        instruction: 'Analyze the code provided inside <archivos_objetivo> tags to answer the user query. Ignore assumptions not grounded in the visible code.'
    },
    targetFiles: {
        header: '<archivos_objetivo>',
        footer: '</archivos_objetivo>',
        fileFormat: 'File: {name}\nType: {type}\nExtension: {extension}\n```\n{content}\n```'
    },
    query: {
        label: 'User Query: {prompt}'
    }
};

export function normalizeRagModeTemplate(
    template: Partial<RagModeTemplate & LegacyRagModeTemplate> | undefined,
    defaults: RagModeTemplate = DEFAULT_RAG_MODE_TEMPLATE
): RagModeTemplate {
    if (!template) {
        return defaults;
    }

    const executionMode = {
        ...defaults.executionMode,
        ...(template.executionMode || {}),
        ...(template.modoEjecucion
            ? {
                header: template.modoEjecucion.header,
                scope: template.modoEjecucion.alcance,
                instruction: template.modoEjecucion.instruccion
            }
            : {})
    };

    const retrievedContext = {
        ...defaults.retrievedContext,
        ...(template.retrievedContext || {}),
        ...(template.contextoRecuperado
            ? {
                header: template.contextoRecuperado.header,
                footer: template.contextoRecuperado.footer,
                fragmentFormat: template.contextoRecuperado.fragmentoFormat
            }
            : {})
    };

    const query = {
        ...defaults.query,
        ...(template.query || {}),
        ...(template.consulta || {})
    };

    return {
        executionMode,
        retrievedContext,
        query
    };
}

export function normalizeSpecificFilesModeTemplate(
    template: Partial<SpecificFilesModeTemplate & LegacySpecificFilesModeTemplate> | undefined,
    defaults: SpecificFilesModeTemplate = DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE
): SpecificFilesModeTemplate {
    if (!template) {
        return defaults;
    }

    const executionMode = {
        ...defaults.executionMode,
        ...(template.executionMode || {}),
        ...(template.modoEjecucion
            ? {
                header: template.modoEjecucion.header,
                scope: template.modoEjecucion.alcance,
                instruction: template.modoEjecucion.instruccion
            }
            : {})
    };

    const targetFiles = {
        ...defaults.targetFiles,
        ...(template.targetFiles || {}),
        ...(template.archivosObjetivo
            ? {
                header: template.archivosObjetivo.header,
                footer: template.archivosObjetivo.footer,
                fileFormat: template.archivosObjetivo.archivoFormat
            }
            : {})
    };

    const query = {
        ...defaults.query,
        ...(template.query || {}),
        ...(template.consulta || {})
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

export function interpolateConsulta(template: string, prompt: string): string {
    return template.replace('{prompt}', prompt);
}

export function interpolateQueryLabel(template: string, prompt: string): string {
    return interpolateConsulta(template, prompt);
}

export class PromptTemplateBuilder {
    static buildRagModeExecution(
        template: RagModeTemplate = DEFAULT_RAG_MODE_TEMPLATE
    ): string {
        const { header, scope, instruction } = template.executionMode;
        return `${header}\n${scope}\nInstruction: ${instruction}\n</modo_ejecucion>`;
    }

    static buildSpecificFilesModeExecution(
        template: SpecificFilesModeTemplate = DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE
    ): string {
        const { header, scope, instruction } = template.executionMode;
        return `${header}\n${scope}\nInstruction: ${instruction}\n</modo_ejecucion>`;
    }
}
