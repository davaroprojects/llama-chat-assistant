import * as assert from 'assert';
import * as vscode from 'vscode';
import { SessionManager } from '../chat/sessionManager';

function createMockContext(storedSessions: unknown[] = []): vscode.ExtensionContext {
    const store = new Map<string, unknown>([['llamaChatSessions', storedSessions]]);

    return {
        globalState: {
            get: <T>(key: string, defaultValue?: T) => {
                return (store.has(key) ? store.get(key) : defaultValue) as T;
            },
            update: async (key: string, value: unknown) => {
                store.set(key, value);
            }
        }
    } as unknown as vscode.ExtensionContext;
}

suite('SessionManager', () => {
    test('Calculates relative time in hours correctly', () => {
        const originalNow = Date.now;
        const initialNow = 1_700_000_000_000;

        Date.now = () => initialNow;
        const manager = new SessionManager(createMockContext());
        manager.createSession('First question');

        Date.now = () => initialNow + 2 * 60 * 60 * 1000;
        const sessions = manager.getAllSessions();

        assert.strictEqual(sessions.length, 1);
        assert.strictEqual(sessions[0].relativeTime, '2 h ago');

        Date.now = originalNow;
    });

    test('Persists active tab and current session id in stored state', () => {
        const context = createMockContext();
        const manager = new SessionManager(context);
        const session = manager.createSession('First question');

        manager.setActiveTab('server');
        manager.setCurrentSession(session.id);

        const storedState = context.globalState.get<any>('llamaChatSessions');
        assert.strictEqual(storedState.uiState.activeTab, 'server');
        assert.strictEqual(storedState.uiState.currentSessionId, session.id);
    });
});
