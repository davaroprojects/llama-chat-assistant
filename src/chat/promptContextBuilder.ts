import { FileMetadata } from './sessionPayloadBuilder';
import * as path from 'node:path';
import {
    RagModeTemplate,
    SpecificFilesModeTemplate,
    DEFAULT_RAG_MODE_TEMPLATE,
    DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE,
    interpolateRagFragment,
    interpolateSpecificFile,
    interpolateQueryLabel,
    PromptTemplateBuilder
} from './promptTemplates';

export interface RagContextSnippet {
    path: string;
    content: string;
    distance?: number;
}

export interface PromptContextOptions {
    userPrompt: string;
    attachedFiles: FileMetadata[];
    ragSnippets: RagContextSnippet[];
    hasRepositoryAttachment?: boolean;
    ragModeTemplate?: RagModeTemplate;
    specificFilesModeTemplate?: SpecificFilesModeTemplate;
}

const MAX_CONTEXT_SNIPPET_CHARS = 2500;
const MAX_RAG_CONTEXT_CHARS = 12000;

function sanitizeContextText(value: string): string {
    return value
        .replace(/\u0000/g, '')
        .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
}

function escapeXmlContent(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function sanitizeForXml(value: string): string {
    return escapeXmlContent(sanitizeContextText(value));
}

function trimToLimit(value: string, maxChars: number): string {
    if (value.length <= maxChars) {
        return value;
    }

    return `${value.slice(0, maxChars)}\n[truncated]`;
}

/**
 * Classify file type based on extension and name patterns.
 * Returns 'configuration' for config files, 'source_code' for source code.
 */
function classifyFileTypeForPrompt(fileName: string): string {
    const extension = path.extname(fileName).toLowerCase();
    const configExtensions = new Set(['xml', 'yaml', 'yml', 'properties', 'env', 'json', 'toml', 'ini', 'conf', 'config']);
    const configKeywords = /(?:config|settings|application|deployment|manifest|pom|gradle|build|docker|k8s|kubernetes)/i;

    if (configExtensions.has(extension.slice(1)) || configKeywords.test(fileName)) {
        return 'configuration';
    }

    return 'source_code';
}

function buildRagContextGlobal(
    ragSnippets: RagContextSnippet[],
    template: RagModeTemplate = DEFAULT_RAG_MODE_TEMPLATE
): string {
    if (ragSnippets.length === 0) {
        return '';
    }

    const sections = ragSnippets.map((snippet, index) => {
        const rank = index + 1;
        const distance = typeof snippet.distance === 'number'
            ? ` distance=${snippet.distance.toFixed(4)}`
            : '';
        const content = trimToLimit(sanitizeForXml(snippet.content), MAX_CONTEXT_SNIPPET_CHARS);
        return interpolateRagFragment(
            template.retrievedContext.fragmentFormat,
            rank,
            sanitizeForXml(snippet.path),
            distance,
            content
        );
    });

    const joined = sections.join('\n\n');
    return trimToLimit(joined, MAX_RAG_CONTEXT_CHARS);
}

function buildAttachedFilesContextSpecific(
    attachedFiles: FileMetadata[],
    template: SpecificFilesModeTemplate = DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE
): string {
    const sections = attachedFiles
        .filter((file) => !file.isRepository)
        .map((file) => {
            const fileType = classifyFileTypeForPrompt(file.name);
            const extension = path.extname(file.name) || 'no extension';
            const content = trimToLimit(sanitizeForXml(file.content), MAX_CONTEXT_SNIPPET_CHARS);
            return interpolateSpecificFile(
                template.targetFiles.fileFormat,
                sanitizeForXml(file.name),
                fileType,
                sanitizeForXml(extension),
                content
            );
        });

    return sections.join('\n\n');
}

export function buildPromptContext(options: PromptContextOptions): string {
    const hasRepository = options.hasRepositoryAttachment ?? false;
    const ragTemplate = options.ragModeTemplate ?? DEFAULT_RAG_MODE_TEMPLATE;
    const specificFilesTemplate = options.specificFilesModeTemplate ?? DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE;

    if (hasRepository && options.ragSnippets.length > 0) {
        // Mode: Global Project Analysis (RAG)
        return buildPromptContextRag(options, ragTemplate);
    }

    // Mode: Specific Files Analysis
    return buildPromptContextSpecificFiles(options, specificFilesTemplate);
}

function buildPromptContextRag(
    options: PromptContextOptions,
    template: RagModeTemplate = DEFAULT_RAG_MODE_TEMPLATE
): string {
    const parts: string[] = [];

    // Add execution mode header using template builder
    const executionModeText = PromptTemplateBuilder.buildRagModeExecution(template);
    parts.push(executionModeText);

    // Add RAG context
    const ragContext = buildRagContextGlobal(options.ragSnippets, template);
    if (ragContext) {
        parts.push(
            `${template.retrievedContext.header}\n${ragContext}\n${template.retrievedContext.footer}`
        );
    }

    // Add user query
    const userQueryText = interpolateQueryLabel(template.query.label, options.userPrompt);
    parts.push(userQueryText);

    return parts.join('\n\n');
}

function buildPromptContextSpecificFiles(
    options: PromptContextOptions,
    template: SpecificFilesModeTemplate = DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE
): string {
    const parts: string[] = [];

    // Add execution mode header using template builder
    const executionModeText = PromptTemplateBuilder.buildSpecificFilesModeExecution(template);
    parts.push(executionModeText);

    // Add attached files as specific files
    const specificFiles = buildAttachedFilesContextSpecific(options.attachedFiles, template);
    if (specificFiles) {
        parts.push(
            `${template.targetFiles.header}\n${specificFiles}\n${template.targetFiles.footer}`
        );
    }

    // Add user query
    const userQueryText = interpolateQueryLabel(template.query.label, options.userPrompt);
    parts.push(userQueryText);

    return parts.join('\n\n');
}
