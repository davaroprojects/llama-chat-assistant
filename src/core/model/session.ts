import { ChatMessage } from './llama';

export interface ChatSession {
    id: string;
    title: string;
    createdAt: number;
    messages: ChatMessage[];
}

export interface SettingsAccordionState {
    llamaOpen: boolean;
    embeddingsOpen: boolean;
    chromadbOpen: boolean;
}

export interface RagIndexState {
    status: 'idle' | 'indexing' | 'indexed';
    indexedAt: number | null;
    indexedFiles: number;
    collectionId: string | null;
}

export interface ChatUiState {
    activeTab: 'chat' | 'settings';
    activeScreens: Array<'chat' | 'settings'>;
    settingsAccordionState: SettingsAccordionState;
    currentSessionId: string | null;
    ragEnabled: boolean;
    ragIndexState: RagIndexState;
}
