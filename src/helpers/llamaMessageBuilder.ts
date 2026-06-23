import { ChatMessage } from '../core/domain/llama';
import { FileMetadata } from '../core/domain/sessionPayload';

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
        return `--- ATTACHED FILE: ${file.name} ---\n${file.content}\n--- END FILE ---`;
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
