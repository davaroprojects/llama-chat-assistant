export interface FileMetadata {
    name: string;
    content: string;
    isAutomatic?: boolean;
    isRepository?: boolean;
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

    static collectFilesMetadata(attachedFiles: FileMetadata[]): FileMetadata[] {
        const byName = new Map<string, FileMetadata>();
        (attachedFiles || []).forEach(file => {
            byName.set(file.name, {
                name: file.name,
                content: file.content,
                isAutomatic: file.isAutomatic ?? false,
                isRepository: file.isRepository ?? false
            });
        });
        return Array.from(byName.values());
    }
}
