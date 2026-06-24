const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function ensureDirectory(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyFile(source, target) {
    ensureDirectory(target);
    fs.copyFileSync(source, target);
}

const staticAssets = [
    ['media/webview.html', 'dist/media/webview.html'],
    ['media/webview.css', 'dist/media/webview.css'],
    ['media/webview.js', 'dist/media/webview.js'],
    ['media/prism.min.js', 'dist/media/prism.min.js'],
    ['media/marked.min.js', 'dist/media/marked.min.js'],
    ['media/purify.min.js', 'dist/media/purify.min.js']
];

for (const [source, target] of staticAssets) {
    copyFile(path.join(repoRoot, source), path.join(repoRoot, target));
}

const wasmAssets = [
    ['web-tree-sitter/web-tree-sitter.wasm', 'web-tree-sitter.wasm'],
    ['@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm', 'tree-sitter-typescript.wasm'],
    ['@vscode/tree-sitter-wasm/wasm/tree-sitter-tsx.wasm', 'tree-sitter-tsx.wasm'],
    ['@vscode/tree-sitter-wasm/wasm/tree-sitter-javascript.wasm', 'tree-sitter-javascript.wasm'],
    ['@vscode/tree-sitter-wasm/wasm/tree-sitter-python.wasm', 'tree-sitter-python.wasm'],
    ['@vscode/tree-sitter-wasm/wasm/tree-sitter-java.wasm', 'tree-sitter-java.wasm'],
    ['@vscode/tree-sitter-wasm/wasm/tree-sitter-ini.wasm', 'tree-sitter-ini.wasm'],
    ['@lumis-sh/wasm-json/tree-sitter-json.wasm', 'tree-sitter-json.wasm'],
    ['@lumis-sh/wasm-yaml/tree-sitter-yaml.wasm', 'tree-sitter-yaml.wasm'],
    ['@lumis-sh/wasm-xml/tree-sitter-xml.wasm', 'tree-sitter-xml.wasm']
];

for (const [request, fileName] of wasmAssets) {
    const source = require.resolve(request);
    const target = path.join(repoRoot, 'dist', 'wasm', fileName);
    copyFile(source, target);
}