import * as assert from 'assert';
import * as vscode from 'vscode';
import { buildEditorContextMessage } from '../webview/editorContext';

function createMockEditor(fullText: string, selectedText: string): vscode.TextEditor {
    return {
        document: {
            getText: (selection?: vscode.Selection) => {
                return selection ? selectedText : fullText;
            }
        }
    } as unknown as vscode.TextEditor;
}

suite('EditorContext', () => {
    test('Builds range-based selection label', () => {
        const selection = {
            isEmpty: false,
            start: { line: 7 },
            end: { line: 9 }
        } as vscode.Selection;

        const message = buildEditorContextMessage(
            'archivo.ts',
            createMockEditor('full file', 'linea 8\nlinea 9\nlinea 10'),
            selection
        );

        assert.strictEqual(message.name, 'archivo.ts:8-10');
        assert.strictEqual(message.baseName, 'archivo.ts');
        assert.strictEqual(message.content, 'linea 8\nlinea 9\nlinea 10');
    });

    test('Uses full file label when selection is empty', () => {
        const selection = {
            isEmpty: true,
            start: { line: 0 },
            end: { line: 0 }
        } as vscode.Selection;

        const message = buildEditorContextMessage(
            'archivo.ts',
            createMockEditor('archivo completo', ''),
            selection
        );

        assert.strictEqual(message.name, 'archivo.ts');
        assert.strictEqual(message.baseName, 'archivo.ts');
        assert.strictEqual(message.content, 'archivo completo');
    });
});
