# La Llama Chat Assistant — Architecture Reference

> **Document type:** Architecture Decision Record + Technical Design
> **Status:** Living document — authoritative source of truth for the development team
> **Version:** 0.0.1 · June 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Layered Architecture](#2-layered-architecture)
3. [Conversation Flow Routing](#3-conversation-flow-routing)
4. [Indexation Pipeline — Detail](#4-indexation-pipeline--detail)
5. [ChromaDB Query Mechanics — Detail](#5-chromadb-query-mechanics--detail)
6. [LLM Inference and ReAct Loop — Detail](#6-llm-inference-and-react-loop--detail)
7. [Memory Pruning](#7-memory-pruning)
8. [Data Model: Session Objects](#8-data-model-session-objects)
9. [Cross-Cutting Concerns](#9-cross-cutting-concerns)
10. [Dependency Graph](#10-dependency-graph)

---

## 1. System Overview

La Llama Chat Assistant is a VS Code extension that implements a **local Retrieval-Augmented Generation (RAG) pipeline**. It has no dependency on external cloud APIs. All inference and retrieval run on the developer's own hardware.

```
┌─────────────────────────────────────────────────────────┐
│                     Developer Machine                    │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐   ┌───────────┐  │
│  │  VS Code UI  │◄──►│  La Llama Chat Assistant │──►│ llama.cpp │  │
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

The codebase follows the **Hexagonal (Ports & Adapters)** pattern with an explicit Domain layer. Dependencies always point inward.

```
┌──────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                              │
│  src/webview/  ·  media/webview.{html,css,js}                    │
│  src/webviewProvider.ts  ·  src/extension.ts                     │
└──────────────────────────┬───────────────────────────────────────┘
                           │ postMessage protocol
┌──────────────────────────▼───────────────────────────────────────┐
│  APPLICATION / ORCHESTRATION LAYER                               │
│  src/core/usecases/                                              │
│  ├── generateAssistantReplyUseCase.ts                            │
│  ├── resolveConversationFlowUseCase.ts                           │
│  ├── runReactAgentConversationUseCase.ts                         │
│  ├── laLlamaChatAgentSearchUseCase.ts                              │
│  ├── indexWorkspaceUseCase.ts                                    │
│  └── memoryPruningUseCase.ts                                     │
│  src/helpers/                                                    │
│  ├── conversationPromptBuilder.ts                                │
│  ├── llamaMessageBuilder.ts                                      │
│  └── sessionPayloadBuilder.ts                                    │
└──────────────────────────┬───────────────────────────────────────┘
                           │ interfaces (Ports)
┌──────────────────────────▼───────────────────────────────────────┐
│  DOMAIN LAYER                                                    │
│  src/core/model/   ← pure types, no side effects                 │
│  src/core/gateways/ ← interface contracts                        │
│  ├── llamaGateway.ts                                             │
│  ├── ragGateway.ts                                               │
│  ├── repositoryIndexGateway.ts                                   │
│  └── sesionGateway.ts                                            │
└──────────────────────────┬───────────────────────────────────────┘
                           │ implements (Adapters)
┌──────────────────────────▼───────────────────────────────────────┐
│  INFRASTRUCTURE / ADAPTER LAYER                                  │
│  src/adapters/llama/   ← HTTP streaming, server config           │
│  src/adapters/chroma/  ← ChromaDB REST + indexer + embeddings    │
│  src/adapters/vscode/  ← globalState persistence, config loaders │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Conversation Flow Routing

`ResolveConversationFlowUseCase` selects the execution mode on every user message based on two inputs: attached file types and the RAG toggle state.

```
attachedFiles: FileMetadata[]   ragEnabled: boolean
        │                              │
        ▼                              ▼
┌─────────────────────────────────────────────────────┐
│  hasExplicitCodeContext = any file where !isRepository│
│  hasRepositoryAttachment = any file where isRepository│
│  ragActive = ragEnabled && ChromaDB available        │
└────────────────────┬────────────────────────────────┘
                     │
    ┌────────────────┴────────────────────┐
    │                                     │
    ▼                                     ▼
ragActive?                           ragActive?
    YES                                  NO
    │                                    │
    ├─ hasExplicitCodeContext?            ├─ hasExplicitCodeContext?
    │     YES → DEEP_REACT_AGENT         │     YES → LOCAL_RAG
    │     NO  → GLOBAL_REACT_AGENT       │     NO  → DIRECT_LLM
```

| Flow | Class | When used |
|---|---|---|
| `DIRECT_LLM` | plain streaming | No files, RAG off |
| `LOCAL_RAG` | prompt assembly only | Files attached, RAG off |
| `GLOBAL_REACT_AGENT` | ReAct loop | No files, RAG on |
| `DEEP_REACT_AGENT` | ReAct loop | Files attached, RAG on |

`GLOBAL_REACT_AGENT` and `DEEP_REACT_AGENT` both go through `RunReactAgentConversationUseCase`. The difference is the system prompt: DEEP starts with the attached files already visible to the model.

---

## 4. Indexation Pipeline — Detail

### 4.1 End-to-End Flow

```
User clicks "Index Workspace"
        │
        ▼
IndexWorkspaceUseCase.execute({ workspaceRoot, chromaConfig })
        │
        ├─ ChromaAdapter.isAvailable(config)
        │     → GET {url}:{port}/api/v1/heartbeat
        │     → if unavailable: abort, return error
        │
        ▼
ChromaAdapter.indexAll(workspaceRoot, config)
        │
        ▼
listTextFiles(workspaceRoot, config, projectType)
  FS walk → filter → read → chunk → metadata → return IndexedChunk[]
        │
        ▼
batched ChromaDB collection.add() using `laLlamaChat.chromaDb.indexWriteBatchSize`
        │
        ▼
RagIndexResult { status, indexedAt, indexedFiles, collectionId }
```

### 4.2 File Walk and Filtering

The FS walker is a recursive `async function walk(dir)` that scans the workspace tree.

**Filtering is applied in this order:**

1. **Directory exclusion** — any directory whose `entry.name` appears in `excludeDirs` is skipped entirely. Default: `.git`, `node_modules`, `dist`, `out`, `build`, `coverage`, `target`, `.vscode`.
2. **File size filter** — files larger than `maxFileSizeKb × 1024` bytes are skipped. Default: `512 KB`.
3. **Binary content detection** — files containing null bytes or high density of non-printable characters are dropped via `looksBinaryContent()`.
4. **Glob exclusion** — the relative file path is tested against each pattern in `excludeFileGlobs`, compiled to `RegExp` via `globToRegExp()`. Default: `**/*.bin`, `**/*.class`, `**/*.jar`, `**/*.lock`.
5. **Empty file guard** — files whose content is whitespace-only are skipped.
6. **Total limit** — indexing stops when `maxIndexedFiles` chunks have been collected. Default: `2000`.

**Effect of `maxIndexedFiles`:** this is a chunk count, not a file count. A single large file may produce many chunks. Reaching the limit mid-walk causes a hard stop; the remaining files in the walk are silently skipped.

### 4.3 Chunking — Tree-sitter + Token Budgets

Chunking now uses syntax trees as the primary segmentation strategy. Files supported by Tree-sitter are parsed and split by semantic nodes (classes, functions, methods, declarations, config blocks) instead of character separators.

Supported by syntax chunking in this phase:

- `ts`, `tsx`, `js`, `jsx`
- `java`, `py`
- `json`, `yaml`, `xml`
- `properties`, `.env*`

Unsupported formats (for example `.conf`) use a manual fallback chunker.

Token budgets are enforced with `js-tiktoken`:

| Setting | Default | Role |
|---|---|---|
| `targetChunkTokens` | `350` | Target size for syntax-aware chunk assembly |
| `maxChunkTokens` | `512` | Hard cap per chunk |
| `minChunkTokens` | `120` | Preferred minimum before adjacent merge |
| `fallbackChunkTokens` | `300` | Target for manual fallback chunking |

Chunking strategy:

1. Parse file with Tree-sitter when supported.
2. Select semantic candidate nodes.
3. Measure node text with token counter.
4. Keep nodes that fit `maxChunkTokens`.
5. Recursively descend into children for oversized nodes.
6. Merge undersized adjacent nodes up to `targetChunkTokens`.
7. Use manual fallback only for unsupported/unresolvable files.

### 4.4 Keyword Entity Extraction

After splitting, `extractKeywordEntities(chunkText)` runs regex patterns on each chunk to extract structural tokens:

- Class/interface/enum/struct names
- Function and method names
- `const`/`let`/`var`/`static` variable names
- Import module paths

These are stored as a pipe-separated string in the ChromaDB `keyword_entities` metadata field. They feed the lexical scoring path of future queries.

### 4.5 Embedding Computation

Embeddings are generated by a dedicated llama.cpp server instance through the OpenAI-compatible `/v1/embeddings` endpoint.

```
computeEmbedding(text)
  │
  ├─ LlamaEmbeddingsAdapter.computeEmbedding(s)
  │
  ├─ POST http://{host}:{embeddingsPort}/v1/embeddings
  │   body: { model, input: [metadata_enriched_chunk_text] }
  │
  └─ number[]  ← vector returned by the configured GGUF embeddings model
```

**Operational characteristics:**

| Property | Value |
|---|---|
| Runtime | llama.cpp embeddings server (`--embeddings`) |
| Endpoint | Configurable (`laLlamaChat.llamaCpp.embeddingsPath`) |
| Timeout | Configurable (`laLlamaChat.llamaCpp.embeddingsTimeoutMs`) |
| Model source | GGUF file configured in `laLlamaChat.llamaCpp.embeddingsModelPath` |
| Batch size | Configurable (`laLlamaChat.chromaDb.embeddingBatchSize`) |

**What the embedding encodes:** semantic meaning of the chunk's content. Two chunks describing similar concepts (e.g., two different authentication implementations) will have high cosine similarity even if they share no literal tokens. This is why semantic search finds conceptually related code even when the query uses different terminology.

**Effect of the 512-token input limit:** chunks are capped at `maxChunkTokens` (default `512`) before embedding. Syntax-aware chunking aims for `targetChunkTokens` while staying under this hard cap, which keeps embedding calls bounded and reduces truncation risk.

### 4.6 ChromaDB Collection Management

A workspace-specific collection ID is generated at index time:

```
collectionId = sanitize(basename(workspaceRoot)) + '_' + Date.now()
```

`sanitize()` lowercases, collapses spaces/hyphens to underscores, and strips non-alphanumeric characters.

Before creating the new collection, the adapter clears the previous collection (if any) to avoid stale data:

```
if previousCollectionId exists && != newCollectionId:
    clearCollection(previousCollectionId)

if newCollectionId already exists:
    clearCollection(newCollectionId)

createCollection(newCollectionId)
```

Chunks are batched using `laLlamaChat.chromaDb.indexWriteBatchSize`. Each `collection.add()` call stores:

| ChromaDB field | Source |
|---|---|
| `id` | `relativePath::chunk-N` |
| `document` | chunk text |
| `embedding` | Vector from llama.cpp embeddings endpoint using `buildEmbeddingInput(item)` |
| `metadata.path` | relative path (display) |
| `metadata.file_path` | relative path (filter key) |
| `metadata.file_type` | `source_code` or `configuration` |
| `metadata.language` | detected language + ecosystem |
| `metadata.chunkIndex` | chunk position |
| `metadata.chunkCount` | total chunks for this file |
| `metadata.keyword_entities` | pipe-separated keyword tokens |

`buildEmbeddingInput()` concatenates several metadata fields with the chunk text to create a richer embedding input than the raw chunk alone.

---

## 5. ChromaDB Query Mechanics — Detail

### 5.1 Query Pipeline

All ChromaDB queries are routed through `queryRelevantContextFromChromaDb()` → `queryRelevantContextFromChromaDbSemantic()`.

```
queryRelevantContextFromChromaDb(queryText, config, maxResults, signal, filePathFilter)
  │
  ├─ early exit: if queryText.trim() is empty → return []
  ├─ early exit: if signal.aborted → throw AbortError
  ├─ early exit: if config.collectionId is null → return []
  ├─ collectionExists check → if missing → return []
  │
  ▼
collection.query({
  queryEmbeddings: [embeddingGateway.computeEmbedding(queryText)],
  nResults: max(maxResults, vectorCandidatePool),   ← fetch more than needed
  include: ['documents', 'metadatas', 'distances'],
  where: buildWhereFilter(filePathFilter)            ← optional path filter
})
  │
  ▼
raw candidates (up to vectorCandidatePool)
  │
  ├─ for each: vectorScore = 1 / (1 + max(0, distance))
  ├─ sort descending by vectorScore
  ├─ slice to maxResults
  │
  ▼
RagContextMatch[] = [{ path, content, distance }, ...]
```

### 5.2 Semantic Embedding Distance

ChromaDB internally uses **cosine distance** (or L2 distance depending on collection metric) between the query embedding and each stored chunk embedding.

The adapter converts the raw distance to a relevance score:

```
vectorScore = 1 / (1 + max(0, distance))
```

This maps `distance=0` → `score=1.0` (identical) and larger distances → smaller scores asymptotically approaching 0.

**`minCosineSimilarity`** is applied as a post-query filter in the conceptual KNN path:

```
cosineScore = 1.0 - cosineDistance
keep if cosineScore >= minCosineSimilarity
```

| `minCosineSimilarity` | Effect |
|---|---|
| `0.0` | All candidates pass; maximum recall, high noise from weakly-related chunks |
| `0.2` (default) | Filters weakly-related chunks; suitable for general code queries |
| `0.5` | Only closely related chunks pass; precise symbol lookups; risk of zero results on abstract queries |
| `0.8+` | Near-identical content only; rarely useful for natural language queries |

### 5.3 `vectorCandidatePool` and `maxQueryResults` Interaction

```
ChromaDB query: nResults = max(maxQueryResults, vectorCandidatePool)
        │
        ▼
Up to vectorCandidatePool raw candidates ranked by embedding distance
        │
        ▼
Sort by vectorScore (descending)
        │
        ▼
Slice to maxQueryResults
        │
        ▼
RagContextMatch[] returned to caller
```

**Why a candidate pool larger than the final result count?**

ChromaDB's approximate nearest-neighbour index may rank candidates slightly differently than exact cosine distance. Fetching `vectorCandidatePool` (default 50) candidates and then re-ranking them locally by `vectorScore` gives higher-quality final results than asking for exactly `maxQueryResults` directly.

| Parameter | Low value | High value |
|---|---|---|
| `vectorCandidatePool` | Faster query, smaller re-ranking set, may miss relevant distant chunks | More candidates considered, better recall, higher query latency |
| `maxQueryResults` | Fewer snippets in prompt, preserves context window budget | More snippets in prompt, broader context, increases tokens consumed by RAG block |

**Context window cost:** each returned chunk is passed to the LLM. At default settings, `maxQueryResults=12` injects up to ~24,000 characters of code into the prompt (if all chunks are at the 2000-char limit). The system enforces no hard cap on this block beyond the LLM's `n_ctx` budget.

### 5.4 Path Filter (`filePathFilter`)

When a `filePathFilter` is provided, the ChromaDB query includes a `where` clause:

```typescript
where = { file_path: { $in: normalizedPaths } }
```

`normalizeFilePathFilter()` validates each path before use:
- Blocks `..` (path traversal)
- Blocks absolute paths
- Blocks paths containing invalid characters

This filter restricts the candidate pool to a specific subset of files, dramatically improving precision for queries anchored to a known execution subgraph (used in `DEEP_REACT_AGENT` mode after the ReAct agent has identified relevant files).

### 5.5 Conceptual KNN Path (`queryConceptual`)

The `queryConceptual` method is an alternative retrieval path that:

1. Fetches all documents in pages of 500
2. For each document, computes a **fresh embedding** from the stored metadata-enriched representation (`buildEmbeddingInputFromDocument`)
3. Computes exact cosine similarity between query embedding and each document embedding
4. Applies `minCosineSimilarity` filter
5. Returns top `topK` results

This path is slower but more precise than approximate ANN because it uses exact embeddings derived from the enriched metadata representation rather than the original storage-time embedding. It is used by `generateAssistantReplyUseCase` when the `LOCAL_RAG` flow is active.

---

## 6. LLM Inference and ReAct Loop — Detail

### 6.1 Direct Conversation Flow (`DIRECT_LLM` / `LOCAL_RAG`)

```
LlamaMessageBuilder.prepareMessagesForLlama(baseMessages, userContextPrompt, systemPrompt)
  │
  ├─ Build lastIndexByBase map: for each user message with files,
  │    track which message index last mentions each file basename
  │
  ├─ For each message in history:
  │   - user (not last): buildHistoryUserContent()
  │       → include only files whose lastIndex == this message index
  │       → format: "--- ATTACHED FILE: {name} ---\n{content}\n--- END FILE ---"
  │       → append: "User instruction:\n{text}"
  │   - user (last): replace with userContextPrompt as-is
  │   - assistant: extractTextOnly(content)   ← strips metadata, keeps text
  │
  ├─ Prepend system message if not already present
  │
  └─ LlmMessage[]
          │
          ▼
LlamaGateway.streamResponse(messages, config, onToken, abortSignal)
  │
  ├─ POST /v1/chat/completions with stream: true
  ├─ SSE stream: each line "data: {...}" parsed, token extracted
  ├─ onToken(chunk) → webviewProvider → postMessage → Webview
  └─ LlmGenerationResult { totalText, tokenCount, serverUsageTokens }
```

### 6.2 ReAct Loop (`GLOBAL_REACT_AGENT` / `DEEP_REACT_AGENT`)

The ReAct loop is the core of the agentic flows. It implements the **Thought → Action → Observation** cycle defined in the ReAct paper (Yao et al., 2022).

```
RunReactAgentConversationUseCase.execute(input)
  │
  ├─ prepareMessagesForLlama(baseMessages, userPrompt, systemPrompt)
  │     → same history normalization as direct flow
  │
  ├─ MAX_AGENT_STEPS = 6  loop:
  │
  │   ┌─────────────────────────────────────────────────────────┐
  │   │  STEP N                                                 │
  │   │                                                         │
  │   │  1. Memory pruning check (before each LLM call)         │
  │   │     countTokensInMessages(workingMessages)              │
  │   │     if tokens > safetyThreshold: pruneMessages()        │
  │   │                                                         │
  │   │  2. LlamaGateway.streamResponse(workingMessages, ...)   │
  │   │     → silent streaming (onToken = noop inside loop)     │
  │   │     → full response text collected                      │
  │   │                                                         │
  │   │  3. extractFinalAnswer(text)                            │
  │   │     → regex: /Final Answer:\s*([\s\S]*)$/i              │
  │   │                                                         │
  │   │  4. if finalAnswer && toolCalls > 0:                    │
  │   │     → emit to client via input.onToken(finalAnswer)     │
  │   │     → return result                                     │
  │   │                                                         │
  │   │  5. if finalAnswer && toolCalls == 0:                   │
  │   │     → reject: append correction message                 │
  │   │     → force next iteration                              │
  │   │                                                         │
  │   │  6. extractActionQuery(text)                            │
  │   │     → per-line parsing (improved robustness)            │
  │   │     → regex: /^Action:\s*[a-z_]*(?:agent_search|search) │
  │   │              \s*\((.*)\)\s*$/i on each line             │
  │   │     → strip outer quotes only, preserve inner quotes    │
  │   │     → accepts: agent_search, lalamachat_agent_search,    │
  │   │                search, etc.                             │
  │   │                                                         │
  │   │  7. if no action found:                                 │
  │   │     → [DEBUG] log: extractActionQuery failed            │
  │   │     → append format correction prompt                   │
  │   │     → continue                                          │
  │   │                                                         │
  │   │  8. if duplicate query:                                 │
  │   │     → inject "already searched" observation             │
  │   │     → continue                                          │
  │   │                                                         │
  │   │  9. LaLlamaChatAgentSearchUseCase.execute(actionQuery)    │
  │   │     → RagGateway.query(query, config, 5, signal)        │
  │   │     → semantic search in ChromaDB                       │
  │   │     → format observation block                          │
  │   │     → track consulted file paths                        │
  │   │                                                         │
  │   │  10. Append to workingMessages:                         │
  │   │      { role: 'assistant', content: modelOutput }        │
  │   │      { role: 'user',      content: observationPrompt }  │
  │   └─────────────────────────────────────────────────────────┘
  │
  ├─ if MAX_AGENT_STEPS reached:
  │   → final pruning
  │   → append "Stop searching and provide Final Answer:"
  │   → one last LLM call
  │   → extract final answer or use raw output
  │
  └─ return { totalText, tokenCount, toolCalls, retrievedMatches, references }
```

### 6.3 ReAct Message Structure

At each step, the model receives the full growing conversation:

```
[system prompt]
[user original prompt]
[assistant: Thought: ... Action: lalamachat_agent_search("query")]
[user: Observation:\n<search results>\n\nContinue the loop...]
[assistant: Thought: ... Action: ...]
[user: Observation:\n...]
...
```

The **system prompt** (set in `DEFAULT_GLOBAL_REACT_TEMPLATE` or `DEFAULT_DEEP_REACT_TEMPLATE`) defines:
- The model's role as a code-navigation agent
- The single available tool: `lalamachat_agent_search(query_text: string)`
- The strict Thought/Action/Observation format
- The requirement to make at least one tool call before emitting `Final Answer:`

**Format enforcement mechanisms:**

1. `toolCalls === 0` guard: if the model tries to skip straight to `Final Answer`, the loop injects a correction message and forces another iteration.
2. `isPlaceholderFinalAnswer()` check: placeholder strings like `[your answer here]` are rejected.
3. `extractActionQuery()` regex: loosely matches any method name containing `search` or `agent_search`, tolerating variations in how the model formats the call.
4. Format correction prompt: if neither `Final Answer` nor a valid `Action` is found, a structured correction prompt is injected.
5. Duplicate query detection: the `executedQueries` Set prevents the model from running the same search twice; an "already searched" observation is injected instead.

### 6.3bis Prompt Templates for Each Conversation Flow

Four distinct conversation modes exist, each with its own `systemPrompt` and `userPrompt` template. The templates are defined in `src/core/model/conversationPromptTemplate.ts` and loaded by `PromptTemplateManager`. Placeholders like `{{user_query}}` and `{{target_files}}` are interpolated by `interpolateConversationPrompt()`.

Prompt template keys and values follow an English-only policy across configuration and runtime examples.

#### `DEFAULT_DIRECT_LLM_TEMPLATE`

**Use case:** General development questions, no RAG, plain chat.

**System Prompt:**
```
You are a Principal Software Engineer. Your goal is to answer general development 
questions, explain concepts, and provide best practices.
- Provide direct, concise, and highly technical answers.
- When generating code examples, ensure they are clean, production-ready, and 
  follow modern standards.
- If the user query is unrelated to software engineering, politely redirect them 
  to the topic.
```

**User Prompt Template:**
```
<execution_mode>
SCOPE: General Development Inquiry.
RAG: Disabled.
Instruction: Answer the user query directly based on your pre-trained knowledge.
</execution_mode>

User Query: {{user_query}}
```

---

#### `DEFAULT_GLOBAL_REACT_TEMPLATE`

**Use case:** Codebase-wide exploration using ReAct loop with ChromaDB search.

**System Prompt:**
```
You are a Principal Software Engineer specialized in code navigation and 
codebase-wide architecture. Your goal is to answer the user query by iteratively 
exploring the project repository using ChromaDB.

You have access to a single tool:
- `lalamachat_agent_search(query_text: string)`: Searches the vector database 
  for relevant code structures, files, functions, or architectural implementations 
  matching the text.

You MUST reason and act step-by-step using the following strict format for your 
thought process:

Thought: Reason about what you need to find in the codebase or what architectural 
layer you need to inspect next.
Action: lalamachat_agent_search(your specific search terms here)
Observation: [The system will automatically inject the code blocks found here. 
Do not invent this section]

You must perform at least one Action before producing any final conclusion.
Repeat the Thought/Action/Observation loop until you have gathered all necessary 
information to solve the user's query. Once you have complete context, you MUST 
output your final conclusion using this format:

Final Answer: your comprehensive, professional, and detailed architectural answer.
```

**User Prompt Template:**
```
<execution_mode>
SCOPE: Global Project Analysis (RAG / ReAct Agent Mode).
Instruction: Use the `lalamachat_agent_search` tool to discover files and functions 
across the project. Do not guess; find the source code.
First response requirement: emit Thought and Action only. Do not emit Final Answer 
before the first tool call.
</execution_mode>

User Query: {{user_query}}
```

**Key behaviour:** The model must call the tool at least once. If it tries to skip directly to `Final Answer`, the loop injects a correction prompt (`REACT_FORMAT_CORRECTION_PROMPT`) and forces another iteration.

---

#### `DEFAULT_LOCAL_RAG_TEMPLATE`

**Use case:** Isolated code analysis of manually attached files, no RAG retrieval.

**System Prompt:**
```
You are a Principal Software Engineer specialized in deep static code analysis. 
Your goal is to evaluate the provided target files or code snippets isolated from 
the rest of the project.
- Analyze ONLY the code provided inside the <target_files> tags.
- If the code references external functions, classes, or imports not defined 
  within the tags, assume they exist but explicitly warn the user that you cannot 
  inspect their implementation details because RAG is disabled.
- Be extremely precise when identifying bugs, security flaws, or performance 
  bottlenecks in the provided snippet.
```

**User Prompt Template:**
```
<execution_mode>
SCOPE: Selected Specific Files.
RAG: Disabled (Isolated Analysis).
Instruction: Evaluate the snippet below. Do not attempt to look up external 
codebase definitions.
</execution_mode>

<target_files>
{{target_files}}
</target_files>

User Query: {{user_query}}
```

---

#### `DEFAULT_DEEP_REACT_TEMPLATE`

**Use case:** Deep analysis of manually attached files, with ReAct-powered dependency expansion via ChromaDB.

**System Prompt:**
```
You are a Principal Software Engineer specialized in code navigation and deep 
cross-file analysis. Your goal is to evaluate the provided code files and resolve 
their external dependencies using ChromaDB to give a flawless technical answer.

You have access to a single tool:
- `lalamachat_agent_search(query_text: string)`: Searches the project repository 
  for missing functions, classes, imports, or type definitions that are called 
  but not defined in the target files.

You MUST reason and act step-by-step using the following strict format:

Thought: Analyze the current files. Identify what external method, import, or 
class interaction is missing or needs further inspection to fully understand the logic.
Action: lalamachat_agent_search(name of the external function, class, or file to fetch)
Observation: [The system will automatically inject the code blocks found here. 
Do not invent this section]

You must perform at least one Action before producing any final conclusion.
Repeat this loop until you understand the complete cross-file interaction. Once 
you have complete context, you MUST output your final conclusion using this format:

Final Answer: your comprehensive, professional, and highly detailed technical resolution.
```

**User Prompt Template:**
```
<execution_mode>
SCOPE: Selected Specific Files (ReAct Dependency Expansion Mode).
Instruction: Analyze the target files first. Use `lalamachat_agent_search` only 
to resolve external definitions or code references that impact this specific scope.
First response requirement: emit Thought and Action only. Do not emit Final Answer 
before the first tool call.
</execution_mode>

<target_files>
{{target_files}}
</target_files>

User Query: {{user_query}}
```

**Key difference from GLOBAL_REACT:** The attached files are visible upfront in the system context, so the agent begins by analyzing them before expanding outward to dependencies.

### 6.4 Search Result Formatting

Each search result is formatted as an observation block:

```
Tool: lalamachat_agent_search
Query: {queryText}

Result 1 | Source: src/services/userService.ts [chunk 2/4]
```
{code content}
```

Result 2 | Source: src/repositories/userRepository.ts
```
{code content}
```
```

This is injected as a user-role message so the model can read it in the next iteration.

### 6.5 Final Answer References

Throughout the loop, every file path returned by search results is collected in `consultedFilePaths`. When the loop produces a `Final Answer`, `buildSortedReferences()` converts this set to a sorted `string[]`, which is stored as `AssistantMessagePayload.references` in the session. This provides traceable provenance for the answer without embedding file paths in the visible response text.

### 6.6 llama.cpp Inference Parameters

#### `temperature` (default: `0.2`)

Controls probability distribution sharpness during token sampling:

```
P(token) = softmax(logits / temperature)
```

| Value | Behaviour |
|---|---|
| `0.0` | Greedy decoding — always picks highest probability token; deterministic but may loop |
| `0.1–0.3` | Near-deterministic; recommended for code navigation and structured output |
| `0.7–1.0` | High entropy; increases syntactic errors and hallucinated API calls |
| `> 1.0` | Approaches uniform distribution; output incoherent |

#### `maxTokens` (default: `2048`)

Maximum tokens the model may generate in a single response. Does not include input tokens. Rule of thumb:

```
maxTokens ≤ n_ctx - estimated_input_tokens
```

Setting this too close to `n_ctx` while the conversation history is long will cause the combined input + output to overflow the context window.

#### `contextSize` (`--ctx-size`, default: `16384`)

The physical token budget of the model. All inputs and outputs must fit within this window.

```
n_ctx budget breakdown (approximate):
┌──────────────────────────────────────────────────┐
│  system prompt            ~100–500 tokens        │
│  session history          variable (grows)       │
│  RAG context block        variable (per query)   │
│  current user prompt      ~50–200 tokens         │
│  generated response       up to maxTokens        │
├──────────────────────────────────────────────────┤
│  TOTAL must be ≤ n_ctx                           │
└──────────────────────────────────────────────────┘
```

As session history grows, the effective space for new content shrinks. Memory pruning (§7) mitigates this automatically.

#### Stop tokens

The extension does not inject stop tokens manually. With `--jinja` enabled, llama.cpp applies the chat template embedded in the model file (e.g., `<|im_end|>` for Qwen models, `</s>` for others), which defines the stop conditions. `maxTokens` is the hard upper bound enforced server-side.

### 6.7 ReAct Loop Continuation Prompts

Two special prompts are injected during the ReAct loop to enforce format compliance and provide continuity when the model's response contains valid search results.

#### `REACT_CONTINUATION_PROMPT`

Injected as a user message when the model successfully emits an `Action: lalamachat_agent_search(...)` line.

```
Observation:
{{observation}}

Continue the Thought/Action/Observation loop.
If you already have enough context, respond with: Final Answer: <your answer>
```

The `{{observation}}` placeholder is replaced with the formatted search results (see §6.4). This prompt reminds the model to continue iterating or conclude, maintaining the loop structure.

#### `REACT_FORMAT_CORRECTION_PROMPT`

Injected when the model's response does not match the required format (no `Final Answer:` extraction and no valid `Action:` regex match).

```
Your previous response did not follow the required ReAct format.
Do not answer the user yet.
You must respond with exactly these sections:
Thought: <what you need to inspect next>
Action: lalamachat_agent_search("specific codebase search terms")
Do not emit Final Answer before at least one successful tool call.
```

This is appended to the conversation as a user message, forcing the model to restructure its response on the next generation. The loop counter does not increment for format corrections; they are "free" iterations that do not count against `MAX_AGENT_STEPS` (6).

---

## 7. Memory Pruning

`MemoryPruningUseCase` runs before every LLM call inside the ReAct loop to prevent context window overflow.

### 7.1 Trigger

```
safetyThreshold = laLlamaChat.memory.safetyThreshold   (default: 6500 tokens)

if countTokens(workingMessages) > safetyThreshold:
    pruneMessages(workingMessages)
```

### 7.2 Pruning Strategy

Target after pruning: `floor(safetyThreshold × 0.6)` tokens.

```
preservationIndices = {
  0 if messages[0] is SystemMessage (preserveSystemPrompt = true),
  [len-preserveRecentMessagesCount .. len-1]  (default: last 2 messages)
}

prunedMessages = messages.filter(i in preservationIndices)

for i from (len - preserveRecentMessagesCount - 1) down to 0:
  if i in preservationIndices: skip
  if message is observation (starts with "Observation:" or "Tool:"):
    try truncating to "[Code snippet truncated to save memory]"
    if fits in targetTokenCount: prepend truncated version
  else:
    if fits in targetTokenCount: prepend full message
    else: break
  if currentTokens <= targetTokenCount: break
```

**What is always preserved:**

1. System prompt (if `preserveSystemPrompt = true`)
2. The most recent `preserveRecentMessagesCount` messages (default: 2)

**What gets truncated first:** observation messages (search results) are truncated rather than removed outright, since they may contain structural context. Non-observation messages are kept whole or dropped.

### 7.3 Token Counting

Token counting uses `js-tiktoken` with the `cl100k_base` encoding (the same encoding used by GPT-4 and similar models; appropriate for code-heavy content). A synchronous `require()`-based path is used inside the ReAct loop to avoid async overhead on every iteration. A char-based fallback (`1 token ≈ 4 chars`) activates if tiktoken fails to load.

---

## 8. Data Model: Session Objects

### 8.1 Core Types

```typescript
interface ChatSession {
    id: string;
    title: string;
    createdAt: number;
    messages: ChatMessage[];
}

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | UserMessagePayload | AssistantMessagePayload;
}

interface UserMessagePayload {
    text: string;
    filesMetadata: FileMetadata[];
}

interface AssistantMessagePayload {
    text: string;
    time: string;
    tokens: number;
    references?: string[];
}

interface FileMetadata {
    name: string;
    content: string;
    isAutomatic: boolean;
    isRepository?: boolean;
}
```

`references` on `AssistantMessagePayload` is populated by the ReAct loop with the sorted list of file paths consulted during retrieval. It is stored in the session but not rendered in the UI.

### 8.2 Session Lifecycle

Sessions are created on the first user message and persist across VS Code restarts in `globalState['laLlamaChatSessions']`. Each session stores its complete message history including file metadata. On deletion, the session is filtered from the stored array.

### 8.3 UI State (in-memory only)

`ChatUiState` tracks active tab, accordion states, current session ID, and RAG index state. It is held in memory in `webviewProvider.ts` and pushed to the Webview on every relevant mutation. It is not persisted.

---

## 9. Cross-Cutting Concerns

### 9.1 Logging

`OutputLogger` wraps a VS Code `OutputChannel`. Structured logging is emitted across all RAG phases: indexation, query dispatch, and ranking.

**Indexation logs (from `chromaAdapter.indexAllWithChromaDb()`):**

```
[INFO]  [rag] Starting workspace indexing | {"collectionName": "myapp_1719187200000", "workspaceRoot": "/path/to/app"}
[DEBUG] [rag] ChromaDB index.config | {"maxIndexedFiles": 2000, "maxFileSizeKb": 512, ...}
[INFO]  [rag] File scan finished for indexing | {"visitedDirectories": 108, "readErrors": 0, "errorSamples": []}
[INFO]  [rag] Prepared chunks for indexing | {"collectionName": "...", "uniqueFiles": 181, "totalChunks": 365}
[DEBUG] [rag] Indexing batch started | {"batchNumber": 1, "totalBatches": 6, "batchSize": 64}
[DEBUG] [rag] Indexing batch completed | {"batchNumber": 1, "embeddingDurationMs": 2341, ...}
[INFO]  [rag] Workspace indexing complete | {"indexedFiles": 365, "indexingDurationMs": 41868}
```

**Query logs (from `chromaAdapter.queryRelevantContextFromChromaDbSemantic()`):**

```
[DEBUG] [rag] query.dispatch | {"query": "find files with tag handler", "collectionId": "...", "maxResults": 12}
[DEBUG] [rag] query.ranking_phase1 | {"candidates": 50, "vectorTopN": 12, "combinedScoreRange": [0.42, 0.89]}
[DEBUG] [rag] query.semantic.rank.complete | {"topCandidates": [{"path": "src/example.ts", "combinedScore": 0.92}]}
[DEBUG] [rag] query.conceptual.rank.complete | {"topCandidates": [{"path": "src/example.ts", "combinedScore": 0.89}]}
[INFO]  [rag] query.results | {"count": 12, "avgDistance": 0.18, "avgScore": 0.76}
```

**ReAct loop logs:**

```
[DEBUG] [rag] action.extract | {"step": 1, "modelOutput": "Action: lalamachat_agent_search(...)", "success": true}
[DEBUG] [rag] action.query | {"step": 1, "query": "files with tag handler", "previouslyExecuted": false}
[INFO]  [rag] action.observation | {"step": 1, "matches": 5, "files": ["TagHandler.java", ...]}
```

Standard levels:

```typescript
logger.debug('rag', '...', details);   // only when laLlamaChat.chat.debug = true
logger.info('rag', '...',  details);
logger.warn('rag', '...',  details);
logger.error('rag', '...', error);
```

All logs are emitted to the **RAG** output channel in VS Code. Debug output is suppressed unless `laLlamaChat.chat.debug = true`.

### 9.2 Abort / Cancellation

`AbortSignal` is threaded through the entire execution chain:

```
webviewProvider → AbortController.abort()
  → GenerateAssistantReplyUseCase.execute({ abortSignal })
      → throwIfAborted(signal) at each async boundary
      → RagGateway.query(..., signal)
      → LlamaGateway.streamResponse(..., signal)
          → fetch(..., { signal })
```

The ReAct loop checks `input.abortSignal?.aborted` at the top of each iteration.

### 9.3 Security: Content Security Policy

The Webview HTML is served with a strict CSP:

```
default-src 'none';
script-src  {webview.cspSource} 'nonce-{random16bytes}';
style-src   {webview.cspSource};
img-src     {webview.cspSource} data:;
object-src  'none';
base-uri    'none';
frame-src   'none';
worker-src  'none';
form-action 'none';
```

All scripts (including DOMPurify, marked, Prism, and `webview.js`) are loaded with the per-load nonce. Inline scripts are blocked. All user-facing Markdown output is sanitized by DOMPurify before assignment to `innerHTML`.

Message passing is validated bidirectionally:
- Backend: `isIncomingWebviewMessage()` validates type and shape of every incoming message.
- Frontend: `isValidIncomingMessage()` validates every message from the backend against a schema map.

### 9.4 Dependency Injection

All use cases receive their dependencies via constructor injection. Wiring is performed in `extension.ts` at activation time. This makes all use cases unit-testable by substituting mock gateway implementations.

---

## 10. Dependency Graph

```
extension.ts
│
├── webviewProvider.ts (LaLlamaChatViewProvider)
│   ├── core/usecases/generateAssistantReplyUseCase.ts
│   │   ├── core/usecases/resolveConversationFlowUseCase.ts
│   │   ├── core/usecases/runReactAgentConversationUseCase.ts
│   │   │   ├── core/usecases/laLlamaChatAgentSearchUseCase.ts
│   │   │   │   └── core/gateways/ragGateway.ts  ← impl: adapters/chroma/chromaAdapter.ts
│   │   │   ├── core/usecases/memoryPruningUseCase.ts
│   │   │   │   ├── core/domain/memoryConfig.ts
│   │   │   │   └── core/domain/tokenCount.ts
│   │   │   └── utils/tokenCounter.ts
│   │   ├── core/gateways/llamaGateway.ts  ← impl: adapters/llama/llamaAdapter.ts
│   │   ├── helpers/conversationPromptBuilder.ts
│   │   ├── helpers/llamaMessageBuilder.ts
│   │   └── adapters/vscode/promptTemplateManager.ts
│   │       └── core/model/promptTemplate.ts
│   ├── core/usecases/indexWorkspaceUseCase.ts
│   │   ├── core/gateways/repositoryIndexGateway.ts  ← impl: adapters/chroma/chromaAdapter.ts
│   │   └── core/gateways/ragGateway.ts
│   ├── helpers/sessionPayloadBuilder.ts
│   └── adapters/vscode/sessionAdapter.ts
│       └── core/gateways/sesionGateway.ts
│
├── adapters/llama/llamaConfig.ts
│   └── adapters/llama/llamaServerConfig.ts
│
└── adapters/chroma/chromaConfig.ts
    └── adapters/chroma/utils/
        ├── embeddings/huggingfaceEmbedding.ts
        ├── analysis/fileAnalyzer.ts
        ├── analysis/ecosystemDetector.ts
        ├── analysis/metadataBuilder.ts
        ├── text/textSplitter.ts
        ├── search/lexicalSearch.ts
        ├── search/vectorSimilarity.ts
        ├── filesystem/fileSystemUtils.ts
        ├── chroma/chromaClient.ts
        └── chroma/chromaCollections.ts
```

All `core/model/` files are leaves — they import nothing from this codebase. All `core/gateways/` files import only from `core/model/`. This enforces the **Dependency Rule**: source code dependencies point only inward toward higher-level policies.
