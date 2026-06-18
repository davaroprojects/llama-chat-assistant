export interface FileMetadata {
    name: string;
    content: string;
    isAutomatic?: boolean;
}

export interface UserMessagePayload {
    text: string;
    filesMetadata: FileMetadata[];
}

export interface AssistantMessagePayload {
    text: string;
    time: string;
    tokens: number;
}

export class SessionPayloadBuilder {

    private static buildFileSignature(file: FileMetadata): string {
        return `${file.name}::${file.content}`;
    }

    static createUserMessagePayload(
        userPrompt: string,
        filesMetadata: FileMetadata[]
    ): UserMessagePayload {
        return {
            text: userPrompt,
            filesMetadata: filesMetadata
        };
    }

    static createAssistantMessagePayload(
        assistantText: string,
        durationSeconds: string,
        tokenCount: number
    ): AssistantMessagePayload {
        return {
            text: assistantText,
            time: durationSeconds,
            tokens: tokenCount
        };
    }

    static buildLlamaContextPrompt(
        userPrompt: string,
        attachedFiles: FileMetadata[]
    ): string {
        let context = "";

        attachedFiles.forEach((file) => {
            context += `--- ARCHIVO ADJUNTO: ${file.name} ---\n`;
            context += `${file.content}\n`;
            context += `--- FIN ARCHIVO ---\n\n`;
        });

        context += `Indicación del usuario:\n${userPrompt}`;

        return context;
    }

    static collectFilesMetadata(attachedFiles: FileMetadata[]): FileMetadata[] {
        const deduped: FileMetadata[] = [];
        const seen = new Set<string>();

        (attachedFiles || []).forEach((file) => {
            const normalized: FileMetadata = {
                name: file.name,
                content: file.content,
                isAutomatic: file.isAutomatic ?? false
            };

            const signature = this.buildFileSignature(normalized);
            if (seen.has(signature)) {
                return;
            }

            seen.add(signature);
            deduped.push(normalized);
        });

        return deduped;
    }
}
