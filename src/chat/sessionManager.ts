import * as vscode from 'vscode';

export interface ChatMessage {
    role: string;
    content: unknown;
}

export interface ChatSession {
    id: string;
    title: string;
    createdAt: number;
    messages: ChatMessage[];
}

export class SessionManager {
    private sessions: Map<string, ChatSession> = new Map();
    private currentSessionId: string | null = null;
    private readonly STORAGE_KEY = 'llamaChatSessions';

    constructor(private readonly context: vscode.ExtensionContext) {
        this.sessions = new Map(this.context.globalState.get<ChatSession[]>(this.STORAGE_KEY, []).map(s => [s.id, s]));
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
            id: Date.now().toString(),
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
    }

    public getCurrentSession(): ChatSession | null {
        if (!this.currentSessionId) { return null; }
        return this.sessions.get(this.currentSessionId) || null;
    }

    public addMessageToCurrentSession(role: string, content: unknown): void {
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
        }
        this.saveToDisk();
    }

    private saveToDisk(): void {
        this.context.globalState.update(this.STORAGE_KEY, Array.from(this.sessions.values()));
    }

    private truncateTitle(text: string): string {
        const cleanText = text.split('Instrucción:').pop()?.trim() || text;
        return cleanText.length > 40 ? cleanText.substring(0, 37) + '...' : cleanText;
    }

    private getRelativeTime(timestamp: number): string {
        const now = Date.now();
        const diffMs = now - timestamp;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) { return 'Ahora mismo'; }
        if (diffMins < 60) { return `Hace ${diffMins} min`; }
        if (diffHours < 24) { return `Hace ${diffHours} h`; }
        if (diffDays === 1) { return 'Ayer'; }
        return `Hace ${diffDays} días`;
    }
}
