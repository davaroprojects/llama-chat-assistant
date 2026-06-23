import * as vscode from 'vscode';
import { SessionAdapter } from './adapters/vscode/sessionAdapter';
import { LlamaChatViewProvider } from './webviewProvider';
import { OutputLogger } from './adapters/logging/outputLogger';
import { LlamaAdapter } from './adapters/llama/llamaAdapter';

let activeProvider: LlamaChatViewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
    const sessionManager = new SessionAdapter(context);
    const llamaChatConfig = vscode.workspace.getConfiguration('llamaChat');
    const debugEnabled = llamaChatConfig.get<boolean>('chat.debug') ?? llamaChatConfig.get<boolean>('debug') ?? false;
    const logger = new OutputLogger('prrrrr', debugEnabled);
    context.subscriptions.push(logger);
    LlamaAdapter.setLogger(logger);

    let settingsCommand = vscode.commands.registerCommand('prrrrr.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'llamaChat');
    });
    context.subscriptions.push(settingsCommand);

    const moveSidebarRightCommand = vscode.commands.registerCommand('prrrrr.moveSidebarRight', async () => {
        await vscode.workspace.getConfiguration('workbench').update('sideBar.location', 'right', vscode.ConfigurationTarget.Global);
        await vscode.commands.executeCommand('workbench.view.extension.prrrrr-sidebar');
    });
    context.subscriptions.push(moveSidebarRightCommand);

    const provider = new LlamaChatViewProvider(context.extensionUri, context, sessionManager, logger);
    activeProvider = provider;
    context.subscriptions.push(
        provider,
        vscode.window.registerWebviewViewProvider('prrrrr-view', provider)
    );
}

export function deactivate() {
    activeProvider?.dispose();
    activeProvider = undefined;
}