# prrrrr — Architecture Reference

> **Document type:** Architecture Decision Record + Technical Design  
> **Status:** Living document — authoritative source of truth for the development team  
> **Version:** 0.0.1 · June 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Layered Architecture](#2-layered-architecture)
3. [Data Model: Session Objects](#3-data-model-session-objects)
4. [Workflow 1: Indexation Pipeline](#4-workflow-1-indexation-pipeline)
5. [Workflow 2: Retrieval Stage (ChromaDB)](#5-workflow-2-retrieval-stage-chromadb)
6. [Workflow 3: Prompt Construction and LLM Inference](#6-workflow-3-prompt-construction-and-llm-inference)
7. [Cross-Cutting Concerns](#7-cross-cutting-concerns)
8. [Dependency Graph](#8-dependency-graph)

---

## 1. System Overview

prrrrr is a VS Code extension that implements a **local Retrieval-Augmented Generation (RAG) pipeline**. It has no dependency on external cloud APIs. All inference and retrieval run on the developer's own hardware.

```
┌─────────────────────────────────────────────────────────┐
│                     Developer Machine                    │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐   ┌───────────┐  │
│  │  VS Code UI  │◄──►│  prrrrr Ext  │──►│ llama.cpp │  │
│  │  (Webview)   │    │  (this repo) │   │  :8033    │  │
│  └──────────────┘    └──────┬───────┘   └───────────┘  │
│                             │                            │
│                             ▼                            │
│                      ┌──────────────┐                   │
│                      │   ChromaDB   │                   │
│                      │    :8000     │                   │
│                      └──────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

**External process dependencies at runtime:**

| Service | Protocol | Default endpoint | Purpose |
|---|---|---|---|
| llama.cpp server | HTTP/SSE | `http://127.0.0.1:8033` | LLM inference + token streaming |
| ChromaDB | HTTP REST | `http://127.0.0.1:8000` | Vector store for RAG |

---

## 2. Layered Architecture

The codebase follows the **Hexagonal (Ports & Adapters)** pattern with an explicit Domain layer. Dependencies always point inward: outer layers depend on inner layers, never the reverse.

```
┌──────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                              │
│  src/webview/  ·  media/webview.{html,css,js}                    │
│  VS Code Webview (Chat · Settings · About)                       │
│  src/webviewProvider.ts  ·  src/extension.ts                     │
└──────────────────────────┬───────────────────────────────────────┘
                           │ messages (postMessage protocol)
┌──────────────────────────▼───────────────────────────────────────┐
│  APPLICATION / ORCHESTRATION LAYER                               │
│  src/core/usecases/                                              │
│  ├── generateAssistantReplyUseCase.ts   ← RAG + inference        │
│  ├── indexWorkspaceUseCase.ts           ← ingestion pipeline     │
│  └── resolveContextStrategyUseCase.ts  ← context mode selector  │
│  src/helpers/                                                    │
│  ├── promptContextBuilder.ts           ← prompt assembly         │
│  ├── llamaMessageBuilder.ts            ← history normalizer      │
│  ├── sessionPayloadBuilder.ts          ← payload factory         │
│  └── endpointFlowResolver.ts           ← DFS graph traversal     │
└──────────────────────────┬───────────────────────────────────────┘
                           │ interfaces (Ports)
┌──────────────────────────▼───────────────────────────────────────┐
│  DOMAIN LAYER                                                    │
│  src/core/domain/        ← pure types, no side effects           │
│  ├── session.ts          ChatSession, RagIndexState, ChatUiState │
│  ├── llama.ts            ChatMessage, LlamaConfig, ServerProps   │
│  ├── chroma.ts           ChromaDbConnectionConfig, QueryMode     │
│  ├── sessionPayload.ts   FileMetadata, UserMessagePayload        │
│  ├── prompt.ts           RagContextSnippet, PromptContextOptions │
│  ├── promptTemplate.ts   Template types + interpolation fns      │
│  ├── queryIntent.ts      QueryIntentType enum + classifier       │
│  ├── workspace.ts        ProjectComponent, WorkspaceGraph        │
│  └── llamaServer.ts      LlamaServerLaunchConfig                 │
│  src/core/gateways/      ← interface contracts (Ports)           │
│  ├── llamaGateway.ts                                             │
│  ├── ragGateway.ts                                               │
│  ├── repositoryIndexGateway.ts                                   │
│  └── sesionGateway.ts                                            │
└──────────────────────────┬───────────────────────────────────────┘
                           │ implements (Adapters)
┌──────────────────────────▼───────────────────────────────────────┐
│  INFRASTRUCTURE / ADAPTER LAYER                                  │
│  src/adapters/                                                   │
│  ├── llama/                                                      │
│  │   ├── llamaAdapter.ts        HTTP streaming client            │
│  │   ├── llamaConfig.ts         vscode.workspace.getConfiguration│
│  │   └── llamaServerConfig.ts   CLI command builder              │
│  ├── chroma/                                                     │
│  │   ├── chromaAdapter.ts       ChromaDB REST client + indexer   │
│  │   ├── chromaConfig.ts        vscode.workspace.getConfiguration│
│  │   └── workspaceDependencyGraphBuilder.ts  FS walker + parser  │
│  ├── vscode/                                                     │
│  │   ├── sessionAdapter.ts      globalState persistence          │
│  │   └── promptTemplateManager.ts  config-driven template loader │
│  └── logging/                                                    │
│      └── outputLogger.ts        VS Code OutputChannel wrapper    │
└──────────────────────────────────────────────────────────────────┘
```

### 2.1 Presentation Layer

**Components:**

- **`extension.ts`** — VS Code activation entry point. Registers the `LlamaChatViewProvider`, commands, and wires together all adapters and use cases via constructor injection.
- **`webviewProvider.ts`** (`LlamaChatViewProvider`) — Central message dispatcher. Handles the `postMessage` contract between the Webview and the TypeScript backend. Routes messages by `command` key:
  - `askLlama` → triggers `GenerateAssistantReplyUseCase`
  - `indexWorkspace` → triggers `IndexWorkspaceUseCase`
  - `selectSession`, `deleteSession` → delegates to `SesionGateway`
  - `applyCode`, `setActiveTab`, `setSettingsAccordionState` → UI state mutations
- **`media/webview.{html,css,js}`** — Self-contained front-end. Communicates exclusively via `acquireVsCodeApi().postMessage()` / `window.addEventListener('message')`.
- **`src/webview/`** — VS Code API adapters for the extension side:
  - `editorContext.ts` — captures active editor selection or full file.
  - `filePicker.ts` — opens native VS Code file picker.
  - `webviewResources.ts` — resolves Webview URIs and injects CSP-safe HTML.

### 2.2 Application / Orchestration Layer

The use cases contain **all business logic**. They depend on gateway interfaces, never on concrete adapter implementations.

| Use Case | Responsibility |
|---|---|
| `GenerateAssistantReplyUseCase` | Orchestrates: context strategy → RAG retrieval → prompt assembly → LLM streaming |
| `IndexWorkspaceUseCase` | Orchestrates: graph build → ChromaDB availability check → file indexation |
| `ResolveContextStrategyUseCase` | Pure decision: determines whether to use RAG or specific-files mode based on attached file types |

**Helpers** are pure utility modules with no I/O. They are used by use cases and by `webviewProvider.ts`:

| Helper | Responsibility |
|---|---|
| `promptContextBuilder.ts` | Assembles the enriched context block from RAG snippets or attached files |
| `llamaMessageBuilder.ts` | Normalizes the full message history for the `/v1/chat/completions` payload |
| `sessionPayloadBuilder.ts` | Constructs typed `UserMessagePayload` and `AssistantMessagePayload` objects |
| `endpointFlowResolver.ts` | DFS traversal of the workspace dependency graph to resolve endpoint call chains |

### 2.3 Domain Layer

Contains **zero side effects**. All types, interfaces and pure transformation functions live here.

Notable design decisions:
- `ChatMessage.content` is typed as `string | object` to accommodate both plain text assistant messages and structured user payloads (which carry `filesMetadata`).
- `ChatSession` stores raw `ChatMessage[]` — serialization to `globalState` is delegated to `sessionAdapter`.
- `PromptTemplateBuilder` (in `promptTemplate.ts`) is a pure static class; it performs string interpolation and has no dependency on vscode or any external service.

### 2.4 Infrastructure / Adapter Layer

Adapters implement the gateway interfaces and **own all I/O**:

- **`llamaAdapter.ts`** — Calls `POST /v1/chat/completions` with `stream: true`. Reads the SSE stream and emits tokens via the `onToken` callback. Reads model props via `GET /props` to extract `n_ctx`.
- **`chromaAdapter.ts`** — Implements both `RagGateway` and `RepositoryIndexGateway`. Manages ChromaDB collections, chunking via `@langchain/textsplitters`, and vector similarity search with cosine distance filtering.
- **`sessionAdapter.ts`** — Wraps `vscode.ExtensionContext.globalState` for persistent session storage.
- **`workspaceDependencyGraphBuilder.ts`** — Walks the filesystem, parses import/require statements and Java imports with regex, and produces a `WorkspaceGraph` JSON file used by `endpointFlowResolver.ts`.

---

## 3. Data Model: Session Objects

### 3.1 Core Types

```typescript
// src/core/domain/session.ts
interface ChatSession {
    id: string;          // Unix timestamp string of creation time
    title: string;       // First user message (truncated)
    createdAt: number;   // Unix timestamp (ms)
    messages: ChatMessage[];
}

// src/core/domain/llama.ts
interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | UserMessagePayload | AssistantMessagePayload;
}

// src/core/domain/sessionPayload.ts
interface UserMessagePayload {
    text: string;
    filesMetadata: FileMetadata[];
}

interface AssistantMessagePayload {
    text: string;
    time: string;        // Response duration in seconds ("1.42")
    tokens: number;      // Token count reported by llama.cpp
}

interface FileMetadata {
    name: string;        // "file.ts" or "file.ts:8-10" for selections
    content: string;     // Raw text content
    isAutomatic: boolean;// true = injected from active editor; false = manually attached
}
```

### 3.2 Session Lifecycle

```
┌────────────────────────────────────────────────────────┐
│                  SESSION LIFECYCLE                      │
│                                                         │
│  [User sends first message]                             │
│         │                                               │
│         ▼                                               │
│  SessionAdapter.createSession(title)                    │
│  → id = Date.now().toString()                           │
│  → persisted to globalState['llamaChatSessions']        │
│         │                                               │
│         ▼                                               │
│  [Each exchange]                                        │
│  SessionAdapter.addMessageToCurrentSession(             │
│    role,                                                │
│    content: string | UserMessagePayload                 │
│  )                                                      │
│         │                                               │
│         ▼                                               │
│  [Session persists across VS Code restarts]             │
│  globalState is read on extension activation            │
│         │                                               │
│         ▼                                               │
│  [User deletes session]                                 │
│  SessionAdapter.deleteSession(id)                       │
│  → filtered from globalState array                      │
└────────────────────────────────────────────────────────┘
```

### 3.3 globalState Serialisation Format

```jsonc
// VS Code globalState key: "llamaChatSessions"
[
  {
    "id": "1718615000000",
    "title": "How does UserService work?",
    "createdAt": 1718615000000,
    "messages": [
      {
        "role": "user",
        "content": {
          "text": "How does UserService work?",
          "filesMetadata": [
            {
              "name": "userService.ts:12-24",
              "content": "export class UserService { ... }",
              "isAutomatic": true
            }
          ]
        }
      },
      {
        "role": "assistant",
        "content": {
          "text": "The UserService class is responsible for...",
          "time": "3.14",
          "tokens": 256
        }
      }
    ]
  }
]
```

### 3.4 UI State (non-persistent, in-memory)

```typescript
// src/core/domain/session.ts
interface ChatUiState {
    activeTab: 'chat' | 'settings' | 'about';
    activeScreens: Array<'chat' | 'settings' | 'about'>;
    settingsAccordionState: {
        llamaOpen: boolean;
        chromadbOpen: boolean;
    };
    currentSessionId: string | null;
    ragIndexState: {
        status: 'idle' | 'indexing' | 'indexed';
        indexedAt: number | null;
        indexedFiles: number;
    };
}
```

`ChatUiState` is held in memory by `webviewProvider.ts` and pushed to the Webview on every relevant state mutation. It is **not persisted** to `globalState`.

### 3.5 Token Window Awareness

The token window budget is resolved at query time, not stored in the session:

```
n_ctx  ←  GET /props  →  LlamaAdapter.extractContextWindow()
  │
  │  Budget consumed by:
  ├── system prompt tokens
  ├── session history tokens (all previous messages)
  ├── RAG context snippets  ← up to MAX_RAG_CONTEXT_CHARS (12,000 chars)
  └── current user prompt
```

`MAX_RAG_CONTEXT_CHARS = 12,000` and `MAX_CONTEXT_SNIPPET_CHARS = 2,500` are hard-coded safety limits in `promptContextBuilder.ts`. Individual snippets exceeding `MAX_CONTEXT_SNIPPET_CHARS` are truncated with a `[truncated]` marker before assembly.

---

## 4. Workflow 1: Indexation Pipeline

### 4.1 End-to-End Flow

```
User clicks "Index Workspace"
        │
        ▼
webviewProvider.ts
  → IndexWorkspaceUseCase.execute({
      workspaceRoot,
      cacheRoot,
      chromaConfig
    })
        │
        ▼
┌───────────────────────────────────────────────────────┐
│  PHASE 1: Dependency Graph Build                       │
│  WorkspaceDependencyGraphBuilder.build()               │
│                                                        │
│  1. List code files (walk FS, apply excludeDirs +      │
│     excludeFileGlobs filters)                          │
│  2. For each file: parseImportReferences(content)      │
│     → regex extraction of ES/TS imports, require(),    │
│       and Java import statements                       │
│  3. detectEndpointTriggers(content)                    │
│     → regex scan for @GetMapping, @PostMapping,        │
│       app.get(), router.post(), etc.                   │
│  4. extractDeclaredSymbols(content)                    │
│     → exported class/function/interface names          │
│  5. Resolve edges: static path resolution +            │
│     symbol-to-file lookup                              │
│  6. Write WorkspaceGraph JSON to cacheRoot             │
└───────────────────────────────────────────────────────┘
        │
        ▼
ChromaAdapter.isAvailable(config)
  → HTTP GET {url}:{port}/api/v1/heartbeat
  → if false: abort, return { availability: false }
        │
        ▼
┌───────────────────────────────────────────────────────┐
│  PHASE 2: Chunking and Vector Ingestion                │
│  ChromaAdapter.indexAll(workspaceRoot, config)         │
│                                                        │
│  For each eligible source file:                        │
│                                                        │
│  ┌─────────────────────────────────────────────────┐  │
│  │  READ FILE  →  content: string                  │  │
│  │  (skip if size > maxFileSizeKb)                 │  │
│  └──────────────────┬──────────────────────────────┘  │
│                     │                                  │
│  ┌──────────────────▼──────────────────────────────┐  │
│  │  CHUNK  (RecursiveCharacterTextSplitter)         │  │
│  │  chunkSize    = chunkSizeChars  (default 2000)   │  │
│  │  chunkOverlap = chunkOverlapChars (default 300)  │  │
│  └──────────────────┬──────────────────────────────┘  │
│                     │                                  │
│  ┌──────────────────▼──────────────────────────────┐  │
│  │  EMBED  (ChromaDB default embedding function)   │  │
│  │  dimensionality: EMBEDDING_DIM = 64             │  │
│  │  (fixed; ChromaDB computes embeddings           │  │
│  │   server-side on ingestion)                     │  │
│  └──────────────────┬──────────────────────────────┘  │
│                     │                                  │
│  ┌──────────────────▼──────────────────────────────┐  │
│  │  STORE  in ChromaDB collection                  │  │
│  │  collection name = {prefix}-{sha256(root)[0:12]}│  │
│  │  document  = chunk text                         │  │
│  │  metadata  = { source: relativePath }           │  │
│  │  id        = sha256(relativePath + chunkIndex)  │  │
│  └─────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
        │
        ▼
IndexWorkspaceResult { availability: true, result: RagIndexResult }
  → webviewProvider dispatches ragIndexState update to Webview
```

### 4.2 Configuration Impact on Ingestion

#### `chunkSizeChars` (default: `2000`)

Controls the maximum character length of each stored document chunk.

| Value | Effect |
|---|---|
| **Small** (e.g. 500) | Higher granularity. More precise retrieval for short patterns. Risk: cuts multi-method classes, losing cross-method context. Higher storage volume. |
| **Large** (e.g. 5000) | Entire files or large classes stored as single chunks. Better structural context. Risk: relevant signal diluted by irrelevant surrounding code; chunks may exceed `MAX_CONTEXT_SNIPPET_CHARS` and be truncated at query time. |
| **Recommended** | 1500–2500 chars. Balances function-level granularity with sufficient context for semantic understanding. |

#### `chunkOverlapChars` (default: `300`)

Each chunk repeats the last N characters of the previous chunk at its start.

```
Chunk 1:  [===========CONTENT_A===========]
Chunk 2:            [===OVERLAP===CONTENT_B================]
                         ↑ 300 chars shared
```

| Value | Effect |
|---|---|
| `0` | No overlap. Semantic boundaries (e.g. a function signature) that fall at a chunk cut will be missed. |
| **Low** (50–100) | Minimal redundancy, reduces storage. Suitable for well-structured code with clear delimiters. |
| **High** (500–800) | Higher redundancy, significantly increases storage and index time. Useful for prose-heavy files (READMEs, config docs). |
| **Recommended** | 200–400 chars. Ensures that a function signature at chunk N is always present in chunk N+1 as well. |

The relationship between chunk size and overlap directly affects the **total number of vectors** stored:

```
approximate_chunks ≈ (file_chars - chunkOverlapChars) / (chunkSizeChars - chunkOverlapChars)
```

#### Embedding Dimensionality

The current implementation uses `EMBEDDING_DIM = 64` (set as a constant in `chromaAdapter.ts`), which is the dimension of ChromaDB's built-in default embedding function. This is intentional for performance: a 64-dimensional space is fast to build and query on consumer hardware, at the cost of some semantic precision versus high-dimensional models (384, 768, 1536 dimensions). Changing the embedding model requires re-indexing the entire workspace.

---

## 5. Workflow 2: Retrieval Stage (ChromaDB)

### 5.1 End-to-End Flow

```
User sends message  →  webviewProvider.ts
        │
        ▼
GenerateAssistantReplyUseCase.resolveRagContext(input)
        │
        ▼
ResolveContextStrategyUseCase.execute(filesMetadata)
  ┌─────────────────────────────────────────────────────┐
  │  hasExplicitFileContext  = any file where !isRepository│
  │  hasRepositoryAttachment = any file where isRepository │
  │                           OR no explicit files         │
  │  shouldUseRepositoryScope = hasRepositoryAttachment   │
  │                           OR !hasExplicitFileContext   │
  └────────────────────────────┬────────────────────────┘
                               │
              ┌────────────────▼──────────────────┐
              │ shouldUseRepositoryScope?          │
              │  NO  → return []  (skip RAG)       │
              │  YES → continue                    │
              └────────────────┬──────────────────┘
                               │
                               ▼
                RagGateway.isAvailable(config)
                  → HTTP GET /api/v1/heartbeat
                  → if false: return []
                               │
                               ▼
┌──────────────────────────────────────────────────────────┐
│  STRUCTURED FLOW  (endpoint intent detected)             │
│  endpointFlowPaths provided from EndpointFlowResolver    │
│                                                          │
│  RagGateway.queryByMode(                                 │
│    queryText   = userPrompt,                             │
│    config,                                               │
│    maxResults  = chromaConfig.maxQueryResults,           │
│    mode        = chromaQueryMode,      // primary        │
│    signal,                                               │
│    filePathFilter = endpointFlowPaths  // DFS subgraph   │
│  )                                                       │
│                                                          │
│  Fallback cascade if results.length === 0:               │
│    1st fallback: retry with 'semantic' mode              │
│    2nd fallback: retry with 'lexical' mode               │
└──────────────────────────────┬───────────────────────────┘
                               │  OR
┌──────────────────────────────▼───────────────────────────┐
│  SEMANTIC (CONCEPTUAL) FLOW  (general query)             │
│                                                          │
│  RagGateway.queryConceptual(                             │
│    queryText,                                            │
│    config,                                               │
│    {                                                     │
│      topK:               vectorCandidatePool (50),       │
│      minCosineSimilarity: minCosineSimilarity (0.2),     │
│      signal                                              │
│    }                                                     │
│  )                                                       │
└──────────────────────────────────────────────────────────┘
        │
        ▼
RagContextMatch[] = [{ path, content, distance }, ...]
  → passed to buildPromptContext() in next stage
```

### 5.2 Configuration Impact on Retrieval

#### `maxQueryResults` (default: `12`) / `vectorCandidatePool` (default: `50`)

These two parameters work together in a **candidate expansion + post-filter** pattern:

```
ChromaDB query: nResults = vectorCandidatePool (50)
        │
        ▼
Raw candidates (up to 50)
        │
        ▼
Filter: distance < (1.0 - minCosineSimilarity)
        │
        ▼
Trim to maxQueryResults (12)
        │
        ▼
Final RAG context snippets injected into prompt
```

| Parameter | Effect if increased | Effect if decreased |
|---|---|---|
| `vectorCandidatePool` | More candidates evaluated → better recall, higher latency on ChromaDB query | Faster query, may miss relevant distant chunks |
| `maxQueryResults` | More snippets injected → broader context, **direct cost on LLM context window** | Fewer snippets → context window preserved, potential information gaps |

**Critical constraint:** Each snippet is capped at `MAX_CONTEXT_SNIPPET_CHARS = 2,500` characters. With `maxQueryResults = 12`, the worst-case RAG block is 30,000 characters, but the entire block is also subject to `MAX_RAG_CONTEXT_CHARS = 12,000`. Exceeding this limit causes chunks to be dropped silently.

#### `minCosineSimilarity` (default: `0.2`)

ChromaDB stores distances as `L2` or `cosine` depending on the collection's distance metric. The adapter applies this threshold as a post-query filter:

```
relevance_score = 1.0 - cosine_distance
keep_chunk_if:  relevance_score >= minCosineSimilarity
```

| Value | Effect |
|---|---|
| `0.0` | All candidates pass; maximum recall, high noise risk |
| `0.2` (default) | Filters weakly related chunks. Suitable for general code queries |
| `0.5` | Only highly similar chunks pass. Useful for precise symbol lookups; risks zero results on abstract queries |
| `0.8+` | Near-exact match only. Rarely useful for natural language queries |

#### `queryMode`: `"semantic"` vs `"lexical"`

| Mode | Mechanism | Best for |
|---|---|---|
| `semantic` | ChromaDB vector similarity (embedding-based cosine search) | Conceptual questions: "How does authentication work?" |
| `lexical` | Keyword/BM25-style full-text search on stored document text | Precise symbol lookups: "Where is `UserRepository` used?" |

In structured flow, both modes are attempted with automatic fallback (see §5.1).

#### `metadataFilter` (implicit via `filePathFilter`)

When `endpointFlowPaths` is populated by `EndpointFlowResolver`, the ChromaDB query includes a `where` filter on the `source` metadata field. This restricts the candidate pool to files in the resolved execution flow subgraph, dramatically improving precision for endpoint-centric questions.

```typescript
// chromaAdapter.ts — applied when filePathFilter is provided
where: {
  source: { $in: filePathFilter }
}
```

---

## 6. Workflow 3: Prompt Construction and LLM Inference

### 6.1 End-to-End Flow

```
GenerateAssistantReplyUseCase.execute()
  (after RAG snippets resolved)
        │
        ▼
ResolveContextStrategyUseCase.execute(filesMetadata)
  → contextStrategy { hasExplicitFileContext, hasRepositoryAttachment, ... }
        │
        ▼
buildPromptContext({
  userPrompt,
  attachedFiles: filesMetadata,
  ragSnippets,
  hasRepositoryAttachment,
  ragModeTemplate:           PromptTemplateManager.getRagModeTemplate(),
  specificFilesModeTemplate: PromptTemplateManager.getSpecificFilesModeTemplate()
})
        │
        ├── if (hasRepositoryAttachment && ragSnippets.length > 0)
        │         → buildPromptContextRag()
        │
        └── else
                  → buildPromptContextSpecificFiles()
        │
        ▼
contextPrompt: string
        │
        ▼
LlamaMessageBuilder.prepareMessagesForLlama(
  baseMessages,       // full session history
  contextPrompt,      // enriched current prompt
  systemPrompt        // from LlamaConfig
)
        │
        ▼
LlmMessage[] (final payload)
        │
        ▼
LlamaGateway.streamResponse(messages, llamaConfig, onToken, abortSignal)
  → POST /v1/chat/completions  { stream: true }
  → SSE stream parsed token by token
  → onToken(chunk) → webviewProvider → postMessage → Webview
        │
        ▼
LlmGenerationResult { totalText, tokenCount, serverUsageTokens }
  → GenerateAssistantReplyResult { ...result, durationSeconds, ragSnippetsCount, contextStrategy }
```

### 6.2 Anatomy of the Final Prompt

The final payload sent to llama.cpp has the following structure:

```
POST /v1/chat/completions
{
  "model": "local",
  "stream": true,
  "max_tokens": 2048,
  "temperature": 0.2,
  "messages": [

    // 1. SYSTEM MESSAGE  (injected by LlamaMessageBuilder as first message)
    {
      "role": "system",
      "content": "You are a Principal Software Engineer specialized in code
                  navigation and architecture..."
    },

    // 2. SESSION HISTORY  (all prior turns, with file attachments inlined)
    {
      "role": "user",
      "content": "--- ATTACHED FILE: userService.ts:12-24 ---\n...\nUser instruction:\n<previous question>"
    },
    {
      "role": "assistant",
      "content": "The UserService class..."
    },
    // ... more turns ...

    // 3. CURRENT TURN — ENRICHED PROMPT  (last user message, assembled by buildPromptContext)
    {
      "role": "user",
      "content": "<modo_ejecucion>\nSCOPE: Global Project Analysis (RAG).\nInstruction: ...\n</modo_ejecucion>\n\n
                  <contexto_recuperado>\n
                  Fragment 1 | Source: src/services/userService.ts distance=0.1832\n```\nexport class UserService...\n```\n\n
                  Fragment 2 | Source: src/repositories/userRepository.ts distance=0.2401\n```\n...\n```\n
                  </contexto_recuperado>\n\n
                  User Query: How does UserService interact with the database?"
    }
  ]
}
```

### 6.3 Configuration Impact on Inference

#### `contextSize` / `numCtx` (llama.cpp `--ctx-size`, default: `16384`)

This is the **physical token budget** of the model. It represents the hard limit of the sliding window that the transformer's attention mechanism can span.

```
n_ctx budget allocation:
┌──────────────────────────────────────────────────────┐
│  system prompt          ~100–500 tokens               │
│  session history        variable (grows per turn)     │
│  RAG context block      up to ~3,000 tokens (12k chars│
│                         at ~4 chars/token)            │
│  current user prompt    ~50–200 tokens                │
│  response tokens        max_tokens (default 2048)     │
├──────────────────────────────────────────────────────┤
│  TOTAL                  must be ≤ n_ctx               │
└──────────────────────────────────────────────────────┘
```

**Consequence:** As session history grows, the effective space for RAG snippets shrinks. The extension does not currently implement automatic history truncation; long sessions on small context models (n_ctx ≤ 4096) will experience degraded retrieval quality or llama.cpp context overflow errors.

**Recommended minimum:** `n_ctx = 16384` for standard RAG sessions. `32768` or higher for complex multi-file analysis sessions.

#### `temperature` (default: `0.2`)

Controls the probability distribution sharpness at each token sampling step.

```
Logits → SoftMax(logits / temperature) → sampling distribution
```

| Value | Effect on code generation |
|---|---|
| `0.0` | Greedy decoding — always picks the highest probability token. Fully deterministic, but can loop or produce overly repetitive code. |
| `0.1–0.3` (recommended) | Near-deterministic. Appropriate for code navigation and explanation tasks where syntactic correctness matters. |
| `0.7–1.0` | High creativity. Increases the probability of syntactically invalid or hallucinated API calls. Avoid for code-focused assistants. |
| `> 1.0` | Flat distribution approaching uniform sampling. Output becomes incoherent. |

**Recommendation:** Keep `temperature ≤ 0.3` for code-related queries. `0.2` is the validated default.

#### `maxTokens` (default: `2048`)

Maximum number of tokens the model may generate in a single response. Does **not** include the input tokens.

Setting this too high relative to `n_ctx` will cause the combined input + output to overflow the context window. Rule of thumb:

```
maxTokens ≤ n_ctx - (input_tokens_estimate)
```

#### Stop Tokens (model-dependent)

Stop tokens instruct the model to cease generation when encountered. In llama.cpp with Jinja template mode (`--jinja`), the chat template defined in the model's metadata handles `<|im_end|>`, `</s>`, and other model-specific stop sequences automatically. The extension does not manually inject stop tokens in the request body — it relies on the model's built-in chat template.

**Anti-infinite-generation safeguard:** `maxTokens` (enforced by llama.cpp server) is the primary hard stop.

### 6.4 RAG vs Specific Files Mode Decision

```
attachedFiles analysis by ResolveContextStrategyUseCase:

  ┌──────────────────────────────────────────────────────┐
  │  attachedFiles: []  (empty)                          │
  │  → hasExplicitFileContext = false                    │
  │  → hasRepositoryAttachment = true  (implicit)        │
  │  → shouldUseRepositoryScope = true                   │
  │  → MODE: RAG                                         │
  └──────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────┐
  │  attachedFiles: [{ isAutomatic: true }]  (editor ctx)│
  │  → isAutomatic = true treated as explicit file       │
  │  → hasExplicitFileContext = true                     │
  │  → hasRepositoryAttachment = false                   │
  │  → shouldUseRepositoryScope = false                  │
  │  → MODE: Specific Files                              │
  └──────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────┐
  │  attachedFiles: [{ isRepository: true }, { isRepository: false }]│
  │  → hasExplicitFileContext = true  (non-repo file present)        │
  │  → hasRepositoryAttachment = true (repo file present)            │
  │  → shouldUseRepositoryScope = true                               │
  │  → MODE: RAG  (repository wins when both are present)            │
  └──────────────────────────────────────────────────────┘
```

---

## 7. Cross-Cutting Concerns

### 7.1 Logging

`OutputLogger` (`adapters/logging/outputLogger.ts`) wraps a VS Code `OutputChannel`. All log calls are scoped:

```typescript
logger.debug('rag', 'Resolved prompt context source', { ragSnippets: 3 });
logger.info('rag', 'Repository indexing completed', { indexedFiles: 142 });
logger.warn('rag', 'ChromaDB unavailable');
logger.error('llama', 'Stream failed', error);
```

Debug output is suppressed unless `llamaChat.chat.debug = true`. When enabled, runtime metrics (token counts, latency, RAG snippet counts) are logged every request.

### 7.2 Abort / Cancellation

`AbortSignal` is threaded through the entire use case execution chain:

```
webviewProvider (user cancels)
  → AbortController.abort()
  → GenerateAssistantReplyUseCase.execute({ abortSignal })
      → this.throwIfAborted(signal)  (checked after each async boundary)
      → RagGateway.queryByMode(..., signal)
      → LlamaGateway.streamResponse(..., signal)
          → fetch(..., { signal })  (native browser/Node abort)
```

### 7.3 Security: Content Security Policy

The Webview HTML is served with a strict CSP header set by `webviewResources.ts`:

```
Content-Security-Policy:
  default-src 'none';
  script-src  {nonce};
  style-src   {webview.cspSource};
  img-src     {webview.cspSource} data:;
```

All scripts loaded in the Webview carry a per-load cryptographic nonce. Inline scripts without the nonce are blocked by the browser engine.

### 7.4 Dependency Injection

All use cases receive their dependencies via constructor injection. The wiring is performed in `extension.ts` at activation time:

```typescript
// extension.ts (simplified)
const logger         = new OutputLogger(context);
const sessionAdapter = new SessionAdapter(context);
const llamaAdapter   = new LlamaAdapter();
const chromaAdapter  = new ChromaAdapter();
const contextStrategyUseCase = new ResolveContextStrategyUseCase();

const generateReplyUseCase = new GenerateAssistantReplyUseCase(
    chromaAdapter,   // RagGateway
    llamaAdapter,    // LlamaGateway
    contextStrategyUseCase,
    logger
);

const indexUseCase = new IndexWorkspaceUseCase(
    chromaAdapter,   // RepositoryIndexGateway
    chromaAdapter,   // RagGateway
    logger
);
```

This design makes all use cases **unit-testable in isolation** by substituting mock gateway implementations.

---

## 8. Dependency Graph

```
extension.ts
│
├── webviewProvider.ts (LlamaChatViewProvider)
│   ├── core/usecases/generateAssistantReplyUseCase.ts
│   │   ├── core/gateways/ragGateway.ts          ← impl: adapters/chroma/chromaAdapter.ts
│   │   ├── core/gateways/llamaGateway.ts         ← impl: adapters/llama/llamaAdapter.ts
│   │   ├── core/usecases/resolveContextStrategyUseCase.ts
│   │   ├── helpers/promptContextBuilder.ts
│   │   │   └── core/domain/promptTemplate.ts
│   │   ├── helpers/llamaMessageBuilder.ts
│   │   └── adapters/vscode/promptTemplateManager.ts
│   │       └── core/domain/promptTemplate.ts
│   ├── core/usecases/indexWorkspaceUseCase.ts
│   │   ├── core/gateways/repositoryIndexGateway.ts  ← impl: adapters/chroma/chromaAdapter.ts
│   │   └── core/gateways/ragGateway.ts
│   ├── helpers/sessionPayloadBuilder.ts
│   ├── helpers/endpointFlowResolver.ts
│   │   └── core/domain/workspace.ts
│   ├── core/domain/queryIntent.ts
│   └── adapters/vscode/sessionAdapter.ts
│       └── core/gateways/sesionGateway.ts
│
├── adapters/llama/llamaConfig.ts
│   └── adapters/llama/llamaServerConfig.ts
│
└── adapters/chroma/chromaConfig.ts
```

All `core/domain/` files are leaves — they import nothing from this codebase. All `core/gateways/` files import only from `core/domain/`. This enforces the **Dependency Rule**: source code dependencies point only inward toward higher-level policies.
