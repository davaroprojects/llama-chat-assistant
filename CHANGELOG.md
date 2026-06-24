# Change Log

All notable changes to the "La Llama Chat Assistant" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added

- Tree-sitter WASM syntax-aware chunking in [src/adapters/chroma/utils/text/textSplitter.ts](src/adapters/chroma/utils/text/textSplitter.ts) for TypeScript/TSX/JavaScript/Python/Java/JSON/YAML/XML/properties/.env files.
- Manual token-based fallback chunking for unsupported grammars (including `.conf`) controlled by `laLlamaChat.chromaDb.fallbackChunkTokens`.
- New chunk tuning settings:
	- `laLlamaChat.chromaDb.targetChunkTokens` (default `350`)
	- `laLlamaChat.chromaDb.maxChunkTokens` (default `512`)
	- `laLlamaChat.chromaDb.minChunkTokens` (default `120`)
	- `laLlamaChat.chromaDb.fallbackChunkTokens` (default `300`)
- Dist asset copy script [scripts/copy-dist-assets.js](scripts/copy-dist-assets.js) to package media and wasm grammar assets.

### Changed

- Replaced character-based chunking parameters with token-based parameters in [package.json](package.json), [package.nls.json](package.nls.json), and [src/adapters/chroma/chromaConfig.ts](src/adapters/chroma/chromaConfig.ts).
- Updated indexing metadata to store real chunk offsets (`chunkStart`/`chunkEnd`) from parser output in [src/adapters/chroma/chromaAdapter.ts](src/adapters/chroma/chromaAdapter.ts).
- Kept indexing filters (`excludeDirs`, `excludeFileGlobs`) unchanged in traversal behavior.
- Updated About/settings text to remove deprecated chunk char mentions and document token-based controls in [src/webview/webviewResources.ts](src/webview/webviewResources.ts).

### Dependencies

- Added: `web-tree-sitter`, `@vscode/tree-sitter-wasm`, `@lumis-sh/wasm-json`, `@lumis-sh/wasm-yaml`, `@lumis-sh/wasm-xml`.
- Removed: `@langchain/textsplitters`.