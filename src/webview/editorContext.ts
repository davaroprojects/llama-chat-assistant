import * as vscode from 'vscode';
import * as path from 'node:path';

export interface EditorContext {
    name: string;
    content: string;
}

interface SendEditorContextOptions {
    isPickerOpen: boolean;
    isGenerationActive: boolean;
}

export function sendActiveEditorContext(
    webviewView: vscode.WebviewView,
    editor: vscode.TextEditor | undefined,
    options: SendEditorContextOptions
): void {
    if (options.isPickerOpen || options.isGenerationActive) {
        return;
    }

    if (editor && editor.document.uri.scheme === 'file') {
        const fileName = path.basename(editor.document.fileName);
        const message = buildEditorContextMessage(fileName, editor, editor.selection);
        webviewView.webview.postMessage(message);
        return;
    }

    webviewView.webview.postMessage({ type: 'clearActiveEditorContext' });
}

export function buildEditorContextMessage(
    fileName: string,
    editor: vscode.TextEditor,
    selection: vscode.Selection
): { type: 'codeSelectionCaptured'; name: string; content: string } {
    if (!selection.isEmpty) {
        const selectedText = editor.document.getText(selection);
        const startLine = selection.start.line + 1;
        const endLine = selection.end.line + 1;
        const lineSuffix = (startLine === endLine)
            ? `:${startLine}`
            : `:${startLine}-${endLine}`;

        return {
            type: 'codeSelectionCaptured',
            name: `${fileName}${lineSuffix}`,
            content: selectedText
        };
    }

    return {
        type: 'codeSelectionCaptured',
        name: fileName,
        content: editor.document.getText()
    };
}

export function getActiveEditorContext(): EditorContext {
    const editor = vscode.window.activeTextEditor;
    let name = '';
    let content = '';

    if (editor && editor.document.uri.scheme === 'file') {
        name = path.basename(editor.document.fileName);
        const selection = editor.document.getText(editor.selection);
        content = selection || editor.document.getText();
    }

    return { name, content };
}
