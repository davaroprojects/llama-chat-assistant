# Change Log

All notable changes to the "La Llama Chat Assistant" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added

- **Phase 2 cross-encoder reranking** via `@eidentic/transformers` ([src/adapters/chroma/utils/search/transformersReranker.ts](src/adapters/chroma/utils/search/transformersReranker.ts)): Semantic ranking now uses dual-phase retrieval — Phase 1 hybrid scoring followed by Phase 2 cross-encoder re-ranking to significantly improve relevance.
- Metadata-enriched reranking: Candidate text now includes path, class name, method name, keyword entities, and content for richer cross-encoder scoring context.
- **Comprehensive RAG logging** across indexation, query dispatch, ranking phases, and ReAct agent steps. Logs are emitted to the **RAG** output channel when `laLlamaChat.chat.debug = true`.
- Structured diagnostic logs with error sampling: File scan failures now log up to 12 representative error samples (path + reason) instead of just total error counts ([src/adapters/chroma/chromaAdapter.ts](src/adapters/chroma/chromaAdapter.ts) line ~300).
- **Enhanced lexical scoring** in Phase 1: Lexical similarity now includes class names, method names, and keyword entities as searchable fields (not just file paths).
- Two-Phase Ranking documentation: [CHROMADB_QUERIES.md](CHROMADB_QUERIES.md) documents Phase 1 hybrid scoring and Phase 2 cross-encoder reranking with configuration examples.
- Debugging guide in [CONTRIBUTING.md](CONTRIBUTING.md) § "Debugging RAG Pipeline" with log markers and troubleshooting scenarios.
- Tree-sitter WASM syntax-aware chunking in [src/adapters/chroma/utils/text/textSplitter.ts](src/adapters/chroma/utils/text/textSplitter.ts) for TypeScript/TSX/JavaScript/Python/Java/JSON/YAML/XML/properties/.env files.
- Manual token-based fallback chunking for unsupported grammars (including `.conf`) controlled by `laLlamaChat.chromaDb.fallbackChunkTokens`.
- New chunk tuning settings:
	- `laLlamaChat.chromaDb.targetChunkTokens` (default `350`)
	- `laLlamaChat.chromaDb.maxChunkTokens` (default `512`)
	- `laLlamaChat.chromaDb.minChunkTokens` (default `120`)
	- `laLlamaChat.chromaDb.fallbackChunkTokens` (default `300`)
- Dist asset copy script [scripts/copy-dist-assets.js](scripts/copy-dist-assets.js) to package media and wasm grammar assets.

### Fixed

- **Critical: Tree-sitter Parser initialization order** ([src/adapters/chroma/utils/text/textSplitter.ts](src/adapters/chroma/utils/text/textSplitter.ts#L24)): Must call `await Parser.init()` before constructing `new Parser()` instance. This fix eliminated 175+ read errors during indexing and restored the indexed chunk count from 16 to 365+ chunks.
- **ReAct action parser robustness** ([src/core/usecases/runReactAgentConversationUseCase.ts](src/core/usecases/runReactAgentConversationUseCase.ts#L100)): Per-line regex parsing now correctly handles quoted strings with inner quotes (e.g., `Action: search("text with 'inner' quotes")`), preventing ReAct loop format correction loops.

### Changed

- Replaced character-based chunking parameters with token-based parameters in [package.json](package.json), [package.nls.json](package.nls.json), and [src/adapters/chroma/chromaConfig.ts](src/adapters/chroma/chromaConfig.ts).
- Updated indexing metadata to store real chunk offsets (`chunkStart`/`chunkEnd`) from parser output in [src/adapters/chroma/chromaAdapter.ts](src/adapters/chroma/chromaAdapter.ts).
- Kept indexing filters (`excludeDirs`, `excludeFileGlobs`) unchanged in traversal behavior.
- Updated About/settings text to remove deprecated chunk char mentions and document token-based controls in [src/webview/webviewResources.ts](src/webview/webviewResources.ts).

### Dependencies

- Added: `web-tree-sitter`, `@vscode/tree-sitter-wasm`, `@lumis-sh/wasm-json`, `@lumis-sh/wasm-yaml`, `@lumis-sh/wasm-xml`, `@eidentic/transformers` (v0.1.4, requires Node.js ≥22).
- Added: `@langchain/core` (for message type definitions).
- Removed: `@langchain/textsplitters`.