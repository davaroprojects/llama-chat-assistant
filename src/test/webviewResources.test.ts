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
        assert.strictEqual(labels.generationCanceledLabel, 'Generación cancelada');
        assert.strictEqual(labels.backToSessionsTitle, 'Volver a las sesiones');
        assert.strictEqual(labels.sessionsMainTitle, 'Sesiones');
        assert.strictEqual(labels.promptPlaceholder, 'Pregúntale a tu Llama local o pide cambios...');
        assert.strictEqual(labels.attachFileTitle, 'Agregar archivo al contexto');
        assert.strictEqual(labels.sendMessageTitle, 'Enviar mensaje');
        assert.strictEqual(labels.stopGenerationTitle, 'Detener generación');
        assert.strictEqual(labels.modelMenuTitle, 'Ver modelo actual');
        assert.strictEqual(labels.modelLabel, 'Modelo');
        assert.strictEqual(labels.removeFileTitle, 'Quitar archivo');
        assert.strictEqual(labels.unavailableShortLabel, 'No disponible');
        assert.strictEqual(labels.copyCodeTitle, 'Copiar código');
        assert.strictEqual(labels.copyClipboardTitle, 'Copiar al portapapeles');
        assert.strictEqual(labels.newSessionLabel, 'Nueva Sesión');
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
        assert.strictEqual(labels.generationCanceledLabel, 'Generation canceled');
        assert.strictEqual(labels.backToSessionsTitle, 'Back to sessions');
        assert.strictEqual(labels.sessionsMainTitle, 'Sessions');
        assert.strictEqual(labels.promptPlaceholder, 'Ask your local Llama or request changes...');
        assert.strictEqual(labels.attachFileTitle, 'Add file to context');
        assert.strictEqual(labels.sendMessageTitle, 'Send message');
        assert.strictEqual(labels.stopGenerationTitle, 'Stop generation');
        assert.strictEqual(labels.modelMenuTitle, 'View current model');
        assert.strictEqual(labels.modelLabel, 'Model');
        assert.strictEqual(labels.removeFileTitle, 'Remove file');
        assert.strictEqual(labels.unavailableShortLabel, 'Unavailable');
        assert.strictEqual(labels.copyCodeTitle, 'Copy code');
        assert.strictEqual(labels.copyClipboardTitle, 'Copy to clipboard');
        assert.strictEqual(labels.newSessionLabel, 'New Session');
    });
});