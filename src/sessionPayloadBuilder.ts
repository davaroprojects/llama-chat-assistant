/**
 * SessionPayloadBuilder - Manages session data structure and serialization
 * Handles creation of user and assistant message payloads
 */

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
    /**
     * Creates a user message payload for session storage
     * @param userPrompt - The user's text input
     * @param filesMetadata - Array of attached files with metadata
     * @returns User message payload object
     */
    static createUserMessagePayload(
        userPrompt: string,
        filesMetadata: FileMetadata[]
    ): UserMessagePayload {
        return {
            text: userPrompt,
            filesMetadata: filesMetadata
        };
    }

    /**
     * Creates an assistant message payload for session storage
     * @param assistantText - The generated assistant response
     * @param durationSeconds - Response generation time in seconds
     * @param tokenCount - Number of tokens generated
     * @returns Assistant message payload object
     */
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

    /**
     * Builds the context string for Llama.cpp (temporary, not stored)
     * @param userPrompt - User's input text
     * @param currentEditorName - Name of currently open editor file
     * @param currentEditorContext - Content of current editor file
     * @param attachedFiles - User-selected files to attach
     * @returns Full context string with file contents and prompt
     */
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
                return; // Skip duplicate
            }
            context += `--- ARCHIVO ADJUNTO MANUAL: ${file.name} ---\n`;
            context += `${file.content}\n`;
            context += `--- FIN ARCHIVO ---\n\n`;
        });

        context += `Indicación del usuario:\n${userPrompt}`;

        return context;
    }

    /**
     * Collects all file metadata from editor and attached files
     * @param currentEditorName - Active editor filename
     * @param currentEditorContent - Active editor content (if exists)
     * @param attachedFiles - User-attached files
     * @returns Array of file metadata objects
     */
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

        // Add attached files (skip duplicates)
        const fileNames = new Set(filesMetadata.map(f => f.name));
        attachedFiles.forEach((file) => {
            if (!fileNames.has(file.name)) {
                filesMetadata.push(file);
            }
        });

        return filesMetadata;
    }
}
