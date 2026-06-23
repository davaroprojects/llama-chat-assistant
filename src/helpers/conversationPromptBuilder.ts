import * as path from 'node:path';
import { FileMetadata } from '../core/model/sessionPayload';
import { ConversationFlowType } from '../core/model/conversationFlow';
import { ConversationPromptTemplate, interpolateConversationPrompt } from '../core/model/conversationPromptTemplate';

function sanitizePromptContent(value: string): string {
    return value
        .replace(/\u0000/g, '')
        .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function classifyFileType(fileName: string): string {
    const extension = path.extname(fileName).toLowerCase();
    const configExtensions = new Set(['.xml', '.yaml', '.yml', '.properties', '.env', '.json', '.toml', '.ini', '.conf', '.config']);
    const configKeywords = /(?:config|settings|application|deployment|manifest|pom|gradle|build|docker|k8s|kubernetes)/i;

    if (configExtensions.has(extension) || configKeywords.test(fileName)) {
        return 'configuration';
    }

    return 'source_code';
}

function buildTargetFilesPayload(attachedFiles: FileMetadata[]): string {
    return attachedFiles
        .filter((file) => !file.isRepository)
        .map((file) => {
            const extension = path.extname(file.name) || 'no extension';
            const content = escapeXml(sanitizePromptContent(file.content));
            return [
                `File: ${escapeXml(file.name)}`,
                `Type: ${classifyFileType(file.name)}`,
                `Extension: ${escapeXml(extension)}`,
                '```',
                content,
                '```'
            ].join('\n');
        })
        .join('\n\n');
}

export function buildConversationUserPrompt(
    flowType: ConversationFlowType,
    template: ConversationPromptTemplate,
    userQuery: string,
    attachedFiles: FileMetadata[]
): string {
    const targetFiles = flowType === ConversationFlowType.LOCAL_RAG || flowType === ConversationFlowType.DEEP_REACT_AGENT
        ? buildTargetFilesPayload(attachedFiles)
        : '';

    return interpolateConversationPrompt(template.userPrompt, {
        userQuery,
        targetFiles
    });
}
