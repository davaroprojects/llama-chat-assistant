# ChromaDB Queries

This document explains what the ChromaDB queries in this extension are for, how they work, and which variables influence them.

## Objective

The ChromaDB query layer exists to retrieve the most relevant indexed code fragments so the assistant can answer questions with project-specific context instead of relying only on the language model's general knowledge.

In practice, the query layer is used to:

- find code that is semantically related to the user's question,
- prioritize exact file-name and path matches when the user asks about a specific file,
- return small, grounded chunks that can be injected into the prompt,
- keep the answer anchored to the indexed repository contents.

## Where queries are used

The main query path is triggered by the ReAct search flow:

1. The assistant produces an `Action` such as `lalamachat_agent_search(...)`.
2. `LaLlamaChatAgentSearchUseCase` sends the request to the RAG gateway.
3. `ChromaAdapter.query()` runs the ChromaDB search.
4. The top matches are returned as observations to the agent.
5. The agent uses those observations to continue reasoning or to produce the final answer.

There is also a conceptual query path exposed by the gateway interface, but the current ReAct flow uses the main `query()` path.

## Query flow

```mermaid
flowchart TD
    A[User question or agent action] --> B[LaLlamaChatAgentSearchUseCase]
    B --> C[ragGateway.query()]
    C --> D[ChromaAdapter.queryRelevantContextFromChromaDbSemantic()]
    D --> E[Build optional file path filter]
    E --> F[Create query embedding from queryText]
    F --> G[Query Chroma collection]
    G --> H[Rank results]
    H --> I[Return matches and observation text]
    I --> J[Agent receives observation]
```

## Query types

### 1. Semantic query

This is the default query path.

It uses the user query text to create an embedding, then compares it with the indexed chunk embeddings stored in ChromaDB.

What it tries to optimize:

- conceptual relevance,
- code snippets that describe the same feature or behavior,
- snippets that answer the intent even if the exact file name was not mentioned.

### 2. Conceptual KNN query

This path is available in the adapter and scans stored documents in pages, computing cosine similarity against rebuilt embeddings.

It is useful when a caller wants a full conceptual pass over the collection, with an explicit similarity threshold.

Current main flow does not call it directly, but the gateway exposes it.

## What gets queried

The index stores chunks of source text plus metadata. Each chunk can include:

- `path`
- `file_path`
- `file_type`
- `extension`
- `fileName`
- `folder`
- `language`
- `class_name`
- `method_name`
- `project_type`
- `chunkIndex`
- `chunkCount`
- `chunkStart`
- `chunkEnd`
- `keyword_entities`

The text used for embedding is built from:

- path,
- file name,
- extension,
- folder,
- language,
- file type,
- class name,
- method name,
- project type,
- chunk content.

That means the query is not only searching raw file content. It is also searching the structural metadata that was stored during indexing.

## Ranking behavior

The current ranking combines two signals:

- vector similarity from the chunk content,
- lexical path scoring from file/path/name metadata.

This matters when the user asks for a specific file or a path-like fragment.

Example:

- If the question mentions a class or function behavior, the semantic score usually dominates.
- If the question mentions an exact file name, folder, or extension, the lexical score helps surface the correct chunk faster.

## Variables that influence queries

### Input variables

| Variable | Where it appears | Purpose |
|---|---|---|
| `queryText` | search call | Natural-language query or code-focused search text |
| `maxResults` | Chroma query | Maximum number of final results returned to the caller |
| `signal` | Chroma query | Aborts a long-running query when the user cancels or the flow stops |
| `filePathFilter` | Chroma query | Restricts results to specific indexed paths |

### Configuration variables

| Variable | Default | Purpose |
|---|---|---|
| `collectionId` | session-specific | Identifies the Chroma collection for the current workspace |
| `vectorCandidatePool` | `50` | Number of candidates requested from Chroma before final ranking |
| `maxQueryResults` | `12` | Default upper bound for returned matches |
| `minCosineSimilarity` | `0.2` | Similarity threshold used by conceptual KNN queries |

### Index/session variables

| Variable | Purpose |
|---|---|
| `indexedAt` | Timestamp of the last successful indexing run |
| `indexedFiles` | Number of indexed chunks/files returned by the index run |
| `status` | `idle`, `indexing`, or `indexed` |
| `previousCollectionId` | Old collection removed when a workspace collection changes |

### Ranking variables

| Variable | Purpose |
|---|---|
| `vectorScore` | Similarity derived from Chroma distances |
| `lexicalScore` | Match score for path/file/folder/extension tokens |
| `combinedScore` | Final sort score used to order the results |

## How the file path filter works

If a caller passes `filePathFilter`, the adapter normalizes the file paths and builds a Chroma `where` clause.

This is used to narrow retrieval to specific files or paths, which is useful when the prompt or the calling flow already knows the target area.

If the filter is invalid or empty, the query falls back to the full collection.

## How a query becomes an observation

The agent search use case transforms query results into a text observation:

- if there are matches, it lists each source path and the matched content,
- if there are no matches, it returns a clear no-match observation,
- if ChromaDB is unavailable, it reports that the repository is not indexed or the database is unavailable.

That observation is then sent back into the ReAct loop so the model can continue reasoning with concrete repository evidence.

## Why these variables matter

The query layer is deliberately configurable because the best retrieval behavior depends on the size and structure of the workspace.

- A higher `vectorCandidatePool` increases recall but costs more ranking work.
- A higher `maxQueryResults` gives the model more context, but can increase prompt size.
- A stricter `minCosineSimilarity` removes weak matches but can hide useful edge cases.
- `filePathFilter` is the strongest way to force retrieval to a known file scope.
- Lexical ranking helps when the question is about a file name rather than a concept.

## Practical takeaway

ChromaDB queries are not meant to answer the user directly. Their job is to locate the best indexed evidence so the assistant can answer with grounded context.

If the retrieval feels wrong, the first things to review are:

1. whether the workspace was indexed successfully,
2. whether the target file is actually present in the collection,
3. whether the query text mentions the file name or path clearly,
4. whether the file path filter or lexical scoring should be tightened.

## Phase 2: Reranking with Cross-Encoder

### Overview

After semantic retrieval and hybrid ranking (Phase 1), the query pipeline optionally applies a **second ranking phase** using a cross-encoder transformer model from `@eidentic/transformers`.

The reranker (`LocalReranker` with `ms-marco-MiniLM-L-6-v2` model) receives the candidate pool and re-scores them based on deep semantic understanding of the relationship between the query and the candidate text.

### When reranking helps

- **Exact class/method queries**: "Show me the QueryHandler execute method" benefits from the reranker understanding that `className` and `methodName` are important structural signals.
- **File path queries**: "Find the schema.ts file" gets boosted when the reranker sees the filename in context.
- **Conceptual queries with specificity**: "How does the caching mechanism work in StorageAdapter?" benefits from the reranker distinguishing between truly relevant implementations vs. tangentially related code.

### Configuration

Reranking is controlled by three settings in VS Code configuration (`laLlamaChat.chromaDb.*` or legacy `rag.*`):

| Variable | Default | Description |
|---|---|---|
| `rerankEnabled` | `true` | Enable/disable the reranker in Phase 2 |
| `rerankTimeoutMs` | `5000` | Maximum time (ms) to load model and rerank candidates; exceeding triggers fallback |
| `rerankFallbackToHybrid` | `true` | If reranker fails or times out, fall back to hybrid (vector + lexical) ranking instead of returning empty results |

### Behavior

**Phase 2 pipeline:**

1. Phase 1 produces ranked candidates sorted by `combinedScore` (0.7×vector + 0.3×lexical for semantic; 0.75×cosine + 0.25×lexical for KNN).
2. If `rerankEnabled` is `true`, candidates are sent to `LocalReranker.rerank(queryText, candidates)`.
3. Reranker scores each candidate's `content` field against the `queryText`.
4. Results are sorted by `rerankScore` (descending) and top `maxQueryResults` are returned.
5. If reranker fails or times out, and `rerankFallbackToHybrid` is `true`, results are sorted by hybrid score and returned.

**Log entries:**

- `[RerankerSingleton] LocalReranker loaded successfully (Xms)` — Model loaded and cached.
- `[rag] Starting reranking phase { candidateCount: N, rerankTimeoutMs: 5000 }` — Reranking phase initiated.
- `[rag] Reranking failed, falling back to hybrid ranking { error: "..." }` — Reranker timed out or errored; using Phase 1 scores.
- `[rag] Reranking phase completed { candidateCount: N, appliedReranking: true }` — Reranking successful.

### Model details

- **Model**: `ms-marco-MiniLM-L-6-v2` (via `@eidentic/transformers`)
- **Size**: ~33MB (downloaded once, cached in `~/.cache`)
- **Latency**: ~10-100ms per candidate (varies by hardware and model cache state)
- **Architecture**: Cross-encoder (takes query + candidate text together) vs. bi-encoder (embeds separately)

Cross-encoders are more accurate for ranking but slower than bi-encoders, so reranking is applied only after Phase 1 narrowing.

### Scoring formula (Phase 2)

```
rerankScore = LocalReranker output score in range [0, 1]
  where 1.0 = most relevant
        0.0 = least relevant
```

The reranker is trained on MS MARCO (Microsoft Machine Reading Comprehension) data and understands relevance from a search/ranking perspective.

### Fallback and error handling

If the reranker is disabled, unavailable, or times out:
- Log warning with reason (timeout, load error, etc.)
- If `rerankFallbackToHybrid` is `true`, use hybrid ranking from Phase 1
- If `rerankFallbackToHybrid` is `false`, return empty results (rare; use only if you want strict reranker-only mode)

### Example: Before and after reranking

**Phase 1 (Hybrid ranking) result:**

```
Candidate A: "function doQuery(...) { ... }"
  vectorScore:   0.75
  lexicalScore:  0.40
  combinedScore: 0.65

Candidate B: "class QueryHandler { execute() { ... } }"
  vectorScore:   0.72
  lexicalScore:  0.15
  combinedScore: 0.62  ← Phase 1 ranking (lexical penalizes long path)
```

**Phase 2 (Reranking):**

```
Candidate A: rerankScore = 0.52  (function doQuery is relevant but generic)
Candidate B: rerankScore = 0.89  ← Cross-encoder sees "QueryHandler" + "execute" + semantics
```

**Final ranking after Phase 2:** Candidate B is now first (as it should be).

