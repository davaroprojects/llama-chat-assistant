import * as vscode from 'vscode';
import { SessionAdapter } from './adapters/vscode/sessionAdapter';
import { LaLlamaChatViewProvider } from './webviewProvider';
import { OutputLogger } from './adapters/vscode/outputLogger';
import { LlamaAdapter } from './adapters/llama/llamaAdapter';

let activeProvider: LaLlamaChatViewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
    const sessionManager = new SessionAdapter(context);
    const laLlamaChatConfig = vscode.workspace.getConfiguration('laLlamaChat');
    const debugEnabled = laLlamaChatConfig.get<boolean>('chat.debug') ?? laLlamaChatConfig.get<boolean>('debug') ?? false;
    const logger = new OutputLogger('La Llama Chat', debugEnabled);
    context.subscriptions.push(logger);
    LlamaAdapter.setLogger(logger);

    let settingsCommand = vscode.commands.registerCommand('laLlamaChat.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'laLlamaChat');
    });
    context.subscriptions.push(settingsCommand);

    const moveSidebarRightCommand = vscode.commands.registerCommand('laLlamaChat.moveSidebarRight', async () => {
        await vscode.workspace.getConfiguration('workbench').update('sideBar.location', 'right', vscode.ConfigurationTarget.Global);
        await vscode.commands.executeCommand('workbench.view.extension.llama-chat-assistant-sidebar');
    });
    context.subscriptions.push(moveSidebarRightCommand);

    const provider = new LaLlamaChatViewProvider(context.extensionUri, context, sessionManager, logger);
    activeProvider = provider;
    context.subscriptions.push(
        provider,
        vscode.window.registerWebviewViewProvider('llama-chat-assistant-view', provider)
    );
}

export function deactivate() {
    activeProvider?.dispose();
    activeProvider = undefined;
}