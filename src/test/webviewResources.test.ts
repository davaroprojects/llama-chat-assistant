import * as assert from 'assert';
import { getWebviewLabels } from '../webview/webviewResources';

suite('webviewResources', () => {
    test('Returns Spanish labels for es locales', () => {
        const labels = getWebviewLabels('es-ES');

        assert.strictEqual(labels.chatTabLabel, 'Chat');
        assert.strictEqual(labels.serverTabLabel, 'Servidor');
        assert.strictEqual(labels.serverStartLabel, 'Iniciar');
        assert.strictEqual(labels.serverStopLabel, 'Detener');
        assert.strictEqual(labels.serverParametersTitle, 'Parámetros');
        assert.strictEqual(labels.propertyLabel, 'Propiedad');
        assert.strictEqual(labels.valueLabel, 'Valor');
        assert.strictEqual(labels.emptyChatReadyLabel, 'Inicie una nueva sesion desde el chat');
        assert.strictEqual(labels.emptyServerStoppedLabel, 'Inicie el servidor para iniciar');
        assert.strictEqual(labels.deleteSessionLabel, 'Eliminar sesión permanentemente');
        assert.strictEqual(labels.sessionUnavailableLabel, 'No disponible mientras el servidor está detenido');
    });

    test('Returns English labels for non-es locales', () => {
        const labels = getWebviewLabels('en-US');

        assert.strictEqual(labels.chatTabLabel, 'Chat');
        assert.strictEqual(labels.serverTabLabel, 'Server');
        assert.strictEqual(labels.serverStartLabel, 'Start');
        assert.strictEqual(labels.serverStopLabel, 'Stop');
        assert.strictEqual(labels.serverParametersTitle, 'Parameters');
        assert.strictEqual(labels.propertyLabel, 'Property');
        assert.strictEqual(labels.valueLabel, 'Value');
        assert.strictEqual(labels.emptyChatReadyLabel, 'Start a new session from chat');
        assert.strictEqual(labels.emptyServerStoppedLabel, 'Start the server to begin');
        assert.strictEqual(labels.deleteSessionLabel, 'Delete session permanently');
        assert.strictEqual(labels.sessionUnavailableLabel, 'Unavailable while the server is stopped');
    });
});