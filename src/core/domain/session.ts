import { ChatMessage } from './llama';

export interface ChatSession {
    id: string;
    title: string;
    createdAt: number;
    messages: ChatMessage[];
}

export interface SettingsAccordionState {
    llamaOpen: boolean;
    chromadbOpen: boolean;
}

export interface RagIndexState {
    status: 'idle' | 'indexing' | 'indexed';
    indexedAt: number | null;
    indexedFiles: number;
}

export interface ChatUiState {
    activeTab: 'chat' | 'settings' | 'about';
    activeScreens: Array<'chat' | 'settings' | 'about'>;
    settingsAccordionState: SettingsAccordionState;
    currentSessionId: string | null;
    ragIndexState: RagIndexState;
}
