import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface FileQuickPickItem extends vscode.QuickPickItem {
    uri: vscode.Uri;
    displayName: string;
}

export async function openFilePicker(webviewView: vscode.WebviewView): Promise<void> {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showWarningMessage(vscode.l10n.t('No workspace is open.'));
            return;
        }

        const projectFiles = await vscode.workspace.findFiles(
            '**/*',
            '**/{.git,node_modules,dist,out,build,coverage,.vscode}/**'
        );

        if (projectFiles.length === 0) {
            vscode.window.showInformationMessage(vscode.l10n.t('No project files were found.'));
            return;
        }

        const items: FileQuickPickItem[] = projectFiles.map((uri) => {
            const filePath = uri.fsPath;
            const relativePath = vscode.workspace.asRelativePath(uri, false);
            const fileName = path.basename(filePath);

            return {
                label: fileName,
                description: relativePath,
                uri,
                displayName: relativePath
            };
        });

        const selected = await pickProjectFile(items);
        if (selected) {
            processSelectedFile(selected.uri, webviewView);
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : vscode.l10n.t('Unknown error');
        vscode.window.showErrorMessage(`${vscode.l10n.t('Error reading file')}: ${message}`);
    }
}

async function pickProjectFile(items: FileQuickPickItem[]): Promise<FileQuickPickItem | undefined> {
    return new Promise((resolve) => {
        const quickPick = vscode.window.createQuickPick<FileQuickPickItem>();
        quickPick.placeholder = vscode.l10n.t('Search by file name...');
        quickPick.matchOnDescription = true;
        quickPick.ignoreFocusOut = false;

        const applyFilter = (query: string) => {
            const normalizedQuery = query.trim().toLowerCase();
            const filtered = normalizedQuery
                ? items.filter((item) => item.label.toLowerCase().includes(normalizedQuery) || item.description?.toLowerCase().includes(normalizedQuery))
                : items;

            quickPick.items = filtered.slice(0, 10);
        };

        applyFilter('');

        quickPick.onDidChangeValue((value) => {
            applyFilter(value);
        });

        quickPick.onDidAccept(() => {
            const selected = quickPick.selectedItems[0];
            quickPick.hide();
            resolve(selected);
        });

        quickPick.onDidHide(() => {
            quickPick.dispose();
            resolve(undefined);
        });

        quickPick.show();
    });
}

function processSelectedFile(fileUri: vscode.Uri, webviewView: vscode.WebviewView): void {
    try {
        const filePath = fileUri.fsPath;
        const fileName = path.basename(filePath);
        const config = vscode.workspace.getConfiguration('llamaChat');
        const maxFileSizeKb = config.get<number>('maxAttachedFileSizeKb') ?? 256;
        const fileStats = fs.statSync(filePath);

        if (fileStats.size > maxFileSizeKb * 1024) {
            vscode.window.showWarningMessage(
                vscode.l10n.t('The file {0} exceeds the {1}KB limit.', fileName, String(maxFileSizeKb))
            );
            return;
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');

        webviewView.webview.postMessage({
            type: 'fileSelected',
            name: fileName,
            content: fileContent
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : vscode.l10n.t('Unknown error');
        vscode.window.showErrorMessage(`${vscode.l10n.t('Error reading file')}: ${message}`);
    }
}
