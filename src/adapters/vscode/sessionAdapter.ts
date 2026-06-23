import * as vscode from 'vscode';
import * as crypto from 'node:crypto';
import {
    ChatSession,
    ChatUiState,
    RagIndexState,
    SettingsAccordionState
} from '../../core/model/session';
import { SesionGateway } from '../../core/gateways/sesionGateway';

interface StoredChatState {
    sessions: ChatSession[];
    uiState: ChatUiState;
}

export class SessionAdapter implements SesionGateway {
    private sessions: Map<string, ChatSession> = new Map();
    private currentSessionId: string | null = null;
    private readonly STORAGE_KEY = 'llamaChatSessions';
    private uiState: ChatUiState = {
        activeTab: 'chat',
        activeScreens: ['chat'],
        settingsAccordionState: {
            llamaOpen: true,
            chromadbOpen: false
        },
        currentSessionId: null,
        ragIndexState: {
            status: 'idle',
            indexedAt: null,
            indexedFiles: 0,
            collectionId: null
        }
    };

    constructor(private readonly context: vscode.ExtensionContext) {
        const storedState = this.context.globalState.get<StoredChatState | ChatSession[]>(this.STORAGE_KEY, []);

        if (Array.isArray(storedState)) {
            this.sessions = new Map(storedState.map(s => [s.id, s]));
            return;
        }

        this.sessions = new Map((storedState.sessions || []).map(s => [s.id, s]));
        this.uiState = {
            ...this.uiState,
            ...(storedState.uiState || {}),
            ragIndexState: {
                ...this.uiState.ragIndexState,
                ...(storedState.uiState?.ragIndexState || {})
            }
        };

        if (this.uiState.activeTab !== 'chat' && this.uiState.activeTab !== 'settings' && this.uiState.activeTab !== 'about') {
            this.uiState.activeTab = 'chat';
        }

        this.uiState.activeScreens = (this.uiState.activeScreens || [])
            .map((screen: string) => (screen === 'chat' || screen === 'settings' || screen === 'about' ? screen : 'settings'));

        if (this.uiState.activeScreens.length === 0) {
            this.uiState.activeScreens = [this.uiState.activeTab];
        }

        const accordionState = this.uiState.settingsAccordionState || { llamaOpen: true, chromadbOpen: false };
        const normalizedAccordionState: SettingsAccordionState = {
            llamaOpen: !!accordionState.llamaOpen,
            chromadbOpen: !!accordionState.chromadbOpen
        };

        if (normalizedAccordionState.llamaOpen && normalizedAccordionState.chromadbOpen) {
            normalizedAccordionState.chromadbOpen = false;
        }

        if (!normalizedAccordionState.llamaOpen && !normalizedAccordionState.chromadbOpen) {
            normalizedAccordionState.llamaOpen = true;
        }

        this.uiState.settingsAccordionState = normalizedAccordionState;

        this.currentSessionId = this.uiState.currentSessionId;
    }

    public getAllSessions(): { id: string; title: string; relativeTime: string }[] {
        return Array.from(this.sessions.values())
            .map(session => ({
                id: session.id,
                title: session.title,
                relativeTime: this.getRelativeTime(session.createdAt)
            }))
            .reverse();
    }

    public createSession(firstQuestion: string): ChatSession {
        const newSession: ChatSession = {
            id: crypto.randomUUID(),
            title: this.truncateTitle(firstQuestion),
            createdAt: Date.now(),
            messages: []
        };
        this.sessions.set(newSession.id, newSession);
        this.currentSessionId = newSession.id;
        this.saveToDisk();
        return newSession;
    }

    public setCurrentSession(sessionId: string | null): void {
        this.currentSessionId = sessionId;
        this.uiState.currentSessionId = sessionId;
        this.saveToDisk();
    }

    public getCurrentSession(): ChatSession | null {
        if (!this.currentSessionId) { return null; }
        return this.sessions.get(this.currentSessionId) || null;
    }

    public addMessageToCurrentSession(role: string, content: string | object): void {
        const currentSession = this.getCurrentSession();
        if (currentSession) {
            currentSession.messages.push({ role, content });
            this.saveToDisk();
        }
    }

    public deleteSession(sessionId: string): void {
        this.sessions.delete(sessionId);
        if (this.currentSessionId === sessionId) {
            this.currentSessionId = null;
            this.uiState.currentSessionId = null;
        }
        this.saveToDisk();
    }

    public getUiState(): ChatUiState {
        return { ...this.uiState };
    }

    public setActiveTab(activeTab: 'chat' | 'settings' | 'about'): void {
        this.uiState.activeTab = activeTab;
        if (!this.uiState.activeScreens.includes(activeTab)) {
            this.uiState.activeScreens.push(activeTab);
        }
        this.saveToDisk();
    }

    public setSettingsAccordionState(state: SettingsAccordionState): void {
        const nextState: SettingsAccordionState = {
            llamaOpen: !!state.llamaOpen,
            chromadbOpen: !!state.chromadbOpen
        };

        if (nextState.llamaOpen && nextState.chromadbOpen) {
            nextState.chromadbOpen = false;
        }

        if (!nextState.llamaOpen && !nextState.chromadbOpen) {
            nextState.llamaOpen = true;
        }

        this.uiState.settingsAccordionState = nextState;
        this.saveToDisk();
    }

    public getRagIndexState(): RagIndexState {
        return { ...this.uiState.ragIndexState };
    }

    public setRagIndexState(state: RagIndexState): void {
        this.uiState.ragIndexState = { ...state };
        this.saveToDisk();
    }

    public getSessionTokenEstimate(): number {
        const session = this.getCurrentSession();
        if (!session) { return 0; }

        const totalChars = session.messages.reduce((sum: number, msg: any) => {
            let text = '';
            if (typeof msg.content === 'string') {
                text = msg.content;
            } else if (typeof msg.content === 'object' && msg.content !== null) {
                const c = msg.content as Record<string, unknown>;
                text = typeof c.text === 'string' ? c.text : '';
                if (Array.isArray(c.filesMetadata)) {
                    for (const f of c.filesMetadata as Array<Record<string, unknown>>) {
                        if (typeof f.content === 'string') { text += f.content; }
                    }
                }
            }
            return sum + text.length;
        }, 0);

        return Math.round(totalChars / 4);
    }

    private saveToDisk(): void {
        const storedState: StoredChatState = {
            sessions: Array.from(this.sessions.values()),
            uiState: {
                ...this.uiState,
                currentSessionId: this.currentSessionId
            }
        };
        this.context.globalState.update(this.STORAGE_KEY, storedState);
    }

    private truncateTitle(text: string): string {
        const cleanText = text.split(/Indicación del usuario:|User instruction:/)[1]?.trim() || text;
        return cleanText.length > 40 ? cleanText.substring(0, 37) + '...' : cleanText;
    }

    private getRelativeTime(timestamp: number): string {
        const now = Date.now();
        const diffMs = now - timestamp;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) { return 'Just now'; }
        if (diffMins < 60) { return `${diffMins} min ago`; }
        if (diffHours < 24) { return `${diffHours} h ago`; }
        if (diffDays === 1) { return 'Yesterday'; }
        return `${diffDays} days ago`;
    }
}
