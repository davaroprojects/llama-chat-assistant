import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

export async function openFilePicker(webviewView: vscode.WebviewView): Promise<void> {
    try {
        const fileUri = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Agregar al contexto',
            filters: {
                'Código': ['ts', 'js', 'json', 'py', 'go', 'rs', 'txt', 'html', 'css', 'md', 'java', 'cpp']
            }
        });

        if (fileUri?.[0]) {
            processSelectedFile(fileUri[0], webviewView);
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Error al leer archivo: ${message}`);
    }
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
                `El archivo ${fileName} excede el límite de ${maxFileSizeKb}KB.`
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
        const message = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Error al leer archivo: ${message}`);
    }
}
