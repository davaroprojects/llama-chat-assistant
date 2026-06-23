import { ChatSession, ChatUiState, RagIndexState, SettingsAccordionState } from '../model/session';

export interface SesionGateway {
    getAllSessions(): { id: string; title: string; relativeTime: string }[];
    createSession(firstQuestion: string): ChatSession;
    setCurrentSession(sessionId: string | null): void;
    getCurrentSession(): ChatSession | null;
    addMessageToCurrentSession(role: string, content: unknown): void;
    deleteSession(sessionId: string): void;
    getUiState(): ChatUiState;
    setActiveTab(activeTab: 'chat' | 'settings' | 'about'): void;
    setSettingsAccordionState(state: SettingsAccordionState): void;
    getRagIndexState(): RagIndexState;
    setRagIndexState(state: RagIndexState): void;
    getSessionTokenEstimate(): number;
}
