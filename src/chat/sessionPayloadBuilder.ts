export interface FileMetadata {
    name: string;
    content: string;
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

    static buildLlamaContextPrompt(
        userPrompt: string,
        currentEditorName: string,
        currentEditorContext: string,
        attachedFiles: FileMetadata[]
    ): string {
        let context = "";

        if (currentEditorContext) {
            context += `--- ARCHIVO EN EDITOR ACTIVO: ${currentEditorName} ---\n`;
            context += `${currentEditorContext}\n`;
            context += `--- FIN ARCHIVO ---\n\n`;
        }

        attachedFiles.forEach((file) => {
            if (file.name === currentEditorName && currentEditorContext) {
                return; 
            }
            context += `--- ARCHIVO ADJUNTO MANUAL: ${file.name} ---\n`;
            context += `${file.content}\n`;
            context += `--- FIN ARCHIVO ---\n\n`;
        });

        context += `Indicación del usuario:\n${userPrompt}`;

        return context;
    }

    static collectFilesMetadata(
        currentEditorName: string,
        currentEditorContent: string,
        attachedFiles: FileMetadata[]
    ): FileMetadata[] {
        const filesMetadata: FileMetadata[] = [];

        if (currentEditorContent) {
            filesMetadata.push({
                name: currentEditorName,
                content: currentEditorContent
            });
        }

        const fileNames = new Set(filesMetadata.map(f => f.name));
        attachedFiles.forEach((file) => {
            if (!fileNames.has(file.name)) {
                filesMetadata.push(file);
            }
        });

        return filesMetadata;
    }
}
