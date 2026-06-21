import * as vscode from 'vscode';
import { SessionManager } from './chat/sessionManager';
import { LlamaChatViewProvider } from './webviewProvider';
import { OutputLogger } from './logging/outputLogger';
import { LlamaService } from './llamacpp/llamaService';

let activeProvider: LlamaChatViewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
    const sessionManager = new SessionManager(context);
    const logger = new OutputLogger('Llama Chat Assistant', vscode.workspace.getConfiguration('llamaChat').get<boolean>('debug') ?? false);
    context.subscriptions.push(logger);
    LlamaService.setLogger(logger);

    let settingsCommand = vscode.commands.registerCommand('llama-chat-assistant.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'Llama Chat Assistant');
    });
    context.subscriptions.push(settingsCommand);

    const provider = new LlamaChatViewProvider(context.extensionUri, context, sessionManager, logger);
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