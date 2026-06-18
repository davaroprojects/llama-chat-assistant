import * as vscode from 'vscode';
import { SessionManager } from './chat/sessionManager';
import { LlamaChatViewProvider } from './webviewProvider';

let activeProvider: LlamaChatViewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
    const sessionManager = new SessionManager(context);

    let settingsCommand = vscode.commands.registerCommand('llama-chat-assistant.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'Llama Chat Assistant');
    });
    context.subscriptions.push(settingsCommand);

    const provider = new LlamaChatViewProvider(context.extensionUri, context, sessionManager);
    activeProvider = provider;
    context.subscriptions.push(
        provider,
        vscode.window.registerWebviewViewProvider('llama-chat-view', provider)
    );
}

export function deactivate() {
    activeProvider?.dispose();
    activeProvider = undefined;
}