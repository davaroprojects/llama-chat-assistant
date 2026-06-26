# Change Log

All notable changes to the "La Llama Chat Assistant" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added
- Server lifecycle abstraction for starting a selected llama.cpp server type through a gateway, use case, and adapter.
- First-load server state probing so the UI reflects chat and embeddings status once without repeated polling.
- Embeddings launch settings for physical batch and micro-batch sizes (`-b` and `-ub`) exposed through VS Code settings.
- Webview state restoration fallback so the last active tab survives reloads and extension switches more reliably.
- Diagnostic logs for server startup, server state publishing, and webview state updates.

### Changed
- Chat/RAG retrieval continues to use embeddings-backed semantic search, while indexing also uses the embeddings server.
- The settings tree no longer shows hover tooltips on server nodes, and the settings context menu only opens on explicit user action.
- Documentation now reflects the current chat, indexing, and embeddings behavior across the README and architecture notes.

### Fixed
- Prevented the webview from getting stuck in a loading state after server state changes.
- Preserved previously collected server information when starting chat and embeddings servers separately.
- Restored the active webview tab correctly after closing VS Code or switching extension views.

### Added

- Dedicated llama.cpp embeddings server integration via new `LlamaEmbeddingsAdapter` and `/v1/embeddings` endpoint.
- New embeddings server settings: `laLlamaChat.llamaCpp.embeddingsModelPath`, `laLlamaChat.llamaCpp.embeddingsPort`, `laLlamaChat.llamaCpp.embeddingsPath`, and `laLlamaChat.llamaCpp.embeddingsTimeoutMs`.
- Settings UI panel for managing a second llama.cpp process dedicated to embeddings.
- **Comprehensive RAG logging** across indexation, query dispatch, ranking phases, and ReAct agent steps. Logs are emitted to the **RAG** output channel when `laLlamaChat.chat.debug = true`.
- Structured diagnostic logs with error sampling: File scan failures now log up to 12 representative error samples (path + reason) instead of just total error counts ([src/adapters/chroma/chromaAdapter.ts](src/adapters/chroma/chromaAdapter.ts) line ~300).
- **Enhanced lexical scoring** in Phase 1: Lexical similarity now includes class names, method names, and keyword entities as searchable fields (not just file paths).
- Updated query/indexing documentation for single-phase hybrid ranking and llama.cpp-based embeddings.
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
- RAG indexing orchestration moved to `IndexWorkspaceUseCase` with explicit gateways for chunk collection, embeddings, and vector writes.
- Chroma conceptual KNN now uses stored embeddings from Chroma pages instead of rebuilding embeddings document-by-document.
- Removed all reranking behavior; semantic ranking now returns hybrid-ranked candidates directly.

### Dependencies

- Added: `web-tree-sitter`, `@vscode/tree-sitter-wasm`, `@lumis-sh/wasm-json`, `@lumis-sh/wasm-yaml`, `@lumis-sh/wasm-xml`.
- Added: `@langchain/core` (for message type definitions).
- Removed: `@langchain/textsplitters`.
- Removed: `@huggingface/transformers`.