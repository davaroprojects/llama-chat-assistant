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
    references?: string[];
}
