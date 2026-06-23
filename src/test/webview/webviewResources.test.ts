import * as assert from 'assert';
import { getWebviewLabels } from '../../webview/webviewResources';

suite('webviewResources', () => {
    test('Returns English labels for any locale', () => {
        const labels = getWebviewLabels('en-US');

        assert.strictEqual(labels.chatTabLabel, 'Chat');
        assert.strictEqual(labels.settingsTabLabel, 'Settings');
        assert.strictEqual(labels.aboutTabLabel, 'About');
        assert.strictEqual(labels.serverStartLabel, 'Start');
        assert.strictEqual(labels.serverStopLabel, 'Stop');
        assert.ok(labels.aboutMarkdown.includes('What Llama Chat does'));
        assert.ok(labels.aboutMarkdown.includes('How to configure each area'));
        assert.ok(labels.aboutMarkdown.includes('click the `...` menu at the top'));
        assert.ok(labels.aboutMarkdown.includes('external or plugin-launched'));
        assert.ok(labels.aboutMarkdown.includes('ReAct flows for complex queries'));
        assert.strictEqual(labels.emptyChatReadyLabel, 'Start a new session from chat');
        assert.strictEqual(labels.emptyServerStoppedLabel, 'Start the server to begin');
        assert.strictEqual(labels.deleteSessionLabel, 'Delete session permanently');
        assert.strictEqual(labels.sessionUnavailableLabel, 'Unavailable while the server is stopped');
        assert.strictEqual(labels.generationCanceledLabel, 'Generation canceled');
        assert.strictEqual(labels.backToSessionsTitle, 'Back to sessions');
        assert.strictEqual(labels.sessionsMainTitle, 'Sessions');
        assert.strictEqual(labels.promptPlaceholder, 'Ask your local Llama or request changes...');
        assert.strictEqual(labels.attachFileTitle, 'Add file to context');
        assert.strictEqual(labels.sendMessageTitle, 'Send message');
        assert.strictEqual(labels.stopGenerationTitle, 'Stop generation');
        assert.strictEqual(labels.modelLabel, 'Model');
        assert.strictEqual(labels.removeFileTitle, 'Remove file');
        assert.strictEqual(labels.unavailableShortLabel, 'Unavailable');
        assert.strictEqual(labels.copyCodeTitle, 'Copy code');
        assert.strictEqual(labels.copyClipboardTitle, 'Copy to clipboard');
        assert.strictEqual(labels.newSessionLabel, 'New Session');

        const esLabels = getWebviewLabels('es-ES');
        assert.strictEqual(esLabels.settingsTabLabel, 'Settings');
        assert.strictEqual(esLabels.newSessionLabel, 'New Session');
    });
});