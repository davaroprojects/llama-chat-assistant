import * as vscode from 'vscode';
import { SessionManager } from './chat/sessionManager';
import { LlamaChatViewProvider } from './webviewProvider';

export function activate(context: vscode.ExtensionContext) {
    const sessionManager = new SessionManager(context);

    let settingsCommand = vscode.commands.registerCommand('llama-chat-assistant.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'Llama Chat Assistant');
    });
    context.subscriptions.push(settingsCommand);

    const provider = new LlamaChatViewProvider(context.extensionUri, context, sessionManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('llama-chat-view', provider)
    );
}