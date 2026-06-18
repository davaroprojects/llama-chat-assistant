import * as assert from 'assert';
import { getWebviewLabels } from '../webview/webviewResources';

suite('webviewResources', () => {
    test('Returns Spanish labels for es locales', () => {
        const labels = getWebviewLabels('es-ES');

        assert.strictEqual(labels.chatTabLabel, 'Chat');
        assert.strictEqual(labels.serverTabLabel, 'Servidor');
        assert.strictEqual(labels.serverStartLabel, 'Iniciar');
    });

    test('Returns English labels for non-es locales', () => {
        const labels = getWebviewLabels('en-US');

        assert.strictEqual(labels.chatTabLabel, 'Chat');
        assert.strictEqual(labels.serverTabLabel, 'Server');
        assert.strictEqual(labels.serverStartLabel, 'Start');
    });
});