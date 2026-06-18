import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function getHtmlForWebview(extensionUri: vscode.Uri, webview: vscode.Webview): string {
    const htmlPath = path.join(extensionUri.fsPath, 'dist', 'media', 'webview.html');
    const cssPath = path.join(extensionUri.fsPath, 'dist', 'media', 'webview.css');
    const jsPath = path.join(extensionUri.fsPath, 'dist', 'media', 'webview.js');
    const prismJsPath = path.join(extensionUri.fsPath, 'dist', 'media', 'prism.min.js');
    const markedJsPath = path.join(extensionUri.fsPath, 'dist', 'media', 'marked.min.js');

    if (!fs.existsSync(htmlPath) || !fs.existsSync(cssPath) || !fs.existsSync(jsPath)) {
        return '<h3>Error: Resources not found in dist/media. Run npm run compile.</h3>';
    }

    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const cssUri = webview.asWebviewUri(vscode.Uri.file(cssPath));
    const jsUri = webview.asWebviewUri(vscode.Uri.file(jsPath));
    const prismJsUri = webview.asWebviewUri(vscode.Uri.file(prismJsPath));
    const markedJsUri = webview.asWebviewUri(vscode.Uri.file(markedJsPath));

    const styleLink = `<link rel="stylesheet" type="text/css" href="${cssUri}">`;
    const scriptSrc = `<script src="${prismJsUri}"></script><script src="${markedJsUri}"></script><script src="${jsUri}"></script>`;

    htmlContent = htmlContent.replace('{{stylePlaceholder}}', styleLink);
    return htmlContent.replace('{{scriptPlaceholder}}', scriptSrc);
}
