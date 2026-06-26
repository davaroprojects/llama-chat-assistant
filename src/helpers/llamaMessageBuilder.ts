import { ChatMessage } from '../core/model/llama';
import { FileMetadata } from '../core/model/sessionPayload';

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

function getBaseName(name: string): string {
    return name.replace(/:\d+(?:-\d+)?$/, '');
}

function getFilesFromPayload(content: unknown): FileMetadata[] {
    if (typeof content !== 'object' || content === null) {
        return [];
    }

    const payload = content as Record<string, unknown>;
    if (!Array.isArray(payload.filesMetadata)) {
        return [];
    }

    return payload.filesMetadata as FileMetadata[];
}

function extractTextOnly(content: unknown): string {
    if (typeof content === 'string') {
        return content;
    }

    if (typeof content === 'object' && content !== null) {
        const payload = content as Record<string, unknown>;
        return typeof payload.text === 'string' ? payload.text : '';
    }

    return '';
}

function buildHistoryUserContent(
    content: unknown,
    msgIndex: number,
    lastIndexByBase: Map<string, number>
): string {
    const text = extractTextOnly(content);
    const activeFiles = getFilesFromPayload(content)
        .filter((file) => !file.isRepository)
        .filter((file) => lastIndexByBase.get(getBaseName(file.name)) === msgIndex);

    if (activeFiles.length === 0) {
        return `User instruction:\n${text}`;
    }

    const attachments = activeFiles.map((file) => {
        const safeName = escapeXml(file.name);
        const safeContent = escapeXml(sanitizePromptContent(file.content));
        return ['<attached_file>', `<name>${safeName}</name>`, '<content>', safeContent, '</content>', '</attached_file>'].join('\n');
    }).join('\n\n');

    return `${attachments}\n\nUser instruction:\n${text}`;
}

export class LlamaMessageBuilder {
    static prepareMessagesForLlama(
        baseMessages: ChatMessage[],
        userContextPrompt: string,
        systemPrompt: string
    ): ChatMessage[] {
        const lastIndexByBase = new Map<string, number>();

        baseMessages.forEach((msg, idx) => {
            if (msg.role !== 'user') {
                return;
            }

            getFilesFromPayload(msg.content)
                .filter((file) => !file.isRepository)
                .forEach((file) => {
                    lastIndexByBase.set(getBaseName(file.name), idx);
                });
        });

        const messagesForLlama = baseMessages.map((msg, index) => {
            const isLastMessage = index === baseMessages.length - 1;

            if (msg.role === 'user' && isLastMessage) {
                return { role: 'user', content: userContextPrompt };
            }

            if (msg.role === 'user') {
                return {
                    role: 'user',
                    content: buildHistoryUserContent(msg.content, index, lastIndexByBase)
                };
            }

            if (msg.role === 'assistant') {
                return { role: 'assistant', content: extractTextOnly(msg.content) };
            }

            return msg;
        });

        const hasSystemPrompt = messagesForLlama.some((message) => message.role === 'system');
        return hasSystemPrompt
            ? messagesForLlama
            : [{ role: 'system', content: systemPrompt }, ...messagesForLlama];
    }
}
