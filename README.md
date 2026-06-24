# La Llama Chat

![Version](https://img.shields.io/badge/version-0.0.1-blue?style=flat-square) ![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.120.0-007ACC?style=flat-square&logo=visualstudiocode) ![License](https://img.shields.io/badge/license-GPLv3-blue?style=flat-square) ![Build](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)

**La Llama Chat** is a VS Code extension that brings AI-powered code intelligence directly into your editor — running entirely on your local machine, with no data leaving your environment.

Chat with your codebase, explore execution flows, and retrieve semantically relevant context using [llama.cpp](https://github.com/ggerganov/llama.cpp) as the LLM backend and [ChromaDB](https://www.trychroma.com/) as the vector store.

---

## ✨ Features

- **Local-first AI** — all inference runs via llama.cpp; no cloud API keys required.
- **RAG (Retrieval-Augmented Generation)** — index your entire workspace into ChromaDB and let the model answer queries grounded in your actual source files.
- **Specific file context** — manually attach one or more files to focus the model's attention on exactly the code you care about.
- **Automatic editor context** — the current selection (or full file) is automatically injected into every message; remove the badge to suppress it.
- **Streaming responses** — tokens arrive incrementally with full Markdown rendering (syntax-highlighted code, tables, lists).
- **Persistent session history** — conversations are stored in VS Code `globalState` and survive restarts.
- **Integrated llama.cpp server launcher** — start, stop and monitor the inference server from within the extension panel.
- **Customizable prompt templates** — override RAG and specific-files prompt structures from `settings.json`.
- **Token usage tracking** — live token counter reads the model's context window directly from `GET /props`.
- **Memory pruning** — automatic context window management trims old messages when the token budget is exceeded.
- **Debug mode** — verbose logs and runtime metrics available on demand.

---

## 🔧 Prerequisites

### 1. llama.cpp server

```bash
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp
cmake -B build -DLLAMA_CURL=ON
cmake --build build --config Release -j$(nproc)
```

You will also need a compatible GGUF model (e.g. `qwen2.5-coder-7b-instruct-q4_k_m.gguf`). Models can be downloaded from [Hugging Face](https://huggingface.co/models).

### 2. ChromaDB

```bash
docker run -d \
  --name chromadb \
  -p 8000:8000 \
  chromadb/chroma:latest
```

Or via pip:

```bash
pip install chromadb
chroma run --path ./chroma-data --port 8000
```

### 3. VS Code

Minimum version: `1.120.0`.

---

## 📦 Installation

### From the VS Code Marketplace

1. Open VS Code.
2. Press `Ctrl+Shift+X` to open the Extensions view.
3. Search for **La Llama Chat** and click **Install**.

### From a `.vsix` file

```bash
code --install-extension llama-chat-0.0.1.vsix
```

---

## ⚙️ Configuration

### llama.cpp Connection

```jsonc
{
  "laLlamaChat.llamaCpp.executablePath": "./build/bin/llama-server",
  "laLlamaChat.llamaCpp.modelPath": "./models/qwen2.5-coder-7b-instruct-q4_k_m.gguf",
  "laLlamaChat.llamaCpp.host": "127.0.0.1",
  "laLlamaChat.llamaCpp.port": 8033,
  "laLlamaChat.llamaCpp.gpuLayers": 99,
  "laLlamaChat.llamaCpp.contextSize": 16384,
  "laLlamaChat.llamaCpp.flashAttention": true
}
```

### ChromaDB Connection

```jsonc
{
  "laLlamaChat.chromaDb.url": "http://127.0.0.1",
  "laLlamaChat.chromaDb.port": 8000,
  "laLlamaChat.chromaDb.excludeDirs": [
    ".git", "node_modules", "dist", "out", "build", "coverage", "target", ".vscode"
  ],
  "laLlamaChat.chromaDb.excludeFileGlobs": ["**/*.bin", "**/*.class", "**/*.jar", "**/*.lock"],
  "laLlamaChat.chromaDb.maxFileSizeKb": 512,
  "laLlamaChat.chromaDb.maxIndexedFiles": 2000,
  "laLlamaChat.chromaDb.chunkSizeChars": 2000,
  "laLlamaChat.chromaDb.chunkOverlapChars": 300,
  "laLlamaChat.chromaDb.vectorCandidatePool": 50,
  "laLlamaChat.chromaDb.maxQueryResults": 12,
  "laLlamaChat.chromaDb.minCosineSimilarity": 0.2
}
```

### Chat Behaviour

```jsonc
{
  "laLlamaChat.chat.temperature": 0.2,
  "laLlamaChat.chat.maxTokens": 2048,
  "laLlamaChat.chat.maxAttachedFileSizeKb": 256,
  "laLlamaChat.chat.debug": false
}
```

### Memory Management

```jsonc
{
  "laLlamaChat.memory.contextWindowSize": 8192,
  "laLlamaChat.memory.safetyThreshold": 6500,
  "laLlamaChat.memory.preserveSystemPrompt": true,
  "laLlamaChat.memory.preserveRecentMessagesCount": 2
}
```

### Full Settings Reference

| Setting | Default | Description |
|---|---|---|
| `laLlamaChat.llamaCpp.host` | `127.0.0.1` | llama.cpp server host |
| `laLlamaChat.llamaCpp.port` | `8033` | llama.cpp server port |
| `laLlamaChat.llamaCpp.executablePath` | `./build/bin/llama-server` | Path to llama-server binary |
| `laLlamaChat.llamaCpp.modelPath` | `./models/qwen2.5-coder-7b-instruct-q4_k_m.gguf` | Path to GGUF model |
| `laLlamaChat.llamaCpp.gpuLayers` | `99` | GPU layers to offload |
| `laLlamaChat.llamaCpp.contextSize` | `16384` | Context window in tokens |
| `laLlamaChat.llamaCpp.flashAttention` | `true` | Enable flash attention |
| `laLlamaChat.llamaCpp.chatCompletionsPath` | `/v1/chat/completions` | Chat endpoint path |
| `laLlamaChat.llamaCpp.jinja` | `true` | Enable `--jinja` flag |
| `laLlamaChat.llamaCpp.tools` | `all` | Value passed to `--tools` |
| `laLlamaChat.chromaDb.url` | `http://127.0.0.1` | ChromaDB base URL |
| `laLlamaChat.chromaDb.port` | `8000` | ChromaDB port |
| `laLlamaChat.chromaDb.excludeDirs` | see defaults | Folders skipped during indexing |
| `laLlamaChat.chromaDb.excludeFileGlobs` | `["**/*.bin", ...]` | File patterns skipped during indexing |
| `laLlamaChat.chromaDb.maxFileSizeKb` | `512` | Max file size to index (KB) |
| `laLlamaChat.chromaDb.maxIndexedFiles` | `2000` | Max chunks/files per index run |
| `laLlamaChat.chromaDb.chunkSizeChars` | `2000` | Chunk size in characters |
| `laLlamaChat.chromaDb.chunkOverlapChars` | `300` | Chunk overlap in characters |
| `laLlamaChat.chromaDb.vectorCandidatePool` | `50` | Candidate pool for semantic retrieval |
| `laLlamaChat.chromaDb.maxQueryResults` | `12` | Max results returned per query |
| `laLlamaChat.chromaDb.minCosineSimilarity` | `0.2` | Minimum cosine similarity threshold |
| `laLlamaChat.chat.temperature` | `0.2` | Generation temperature |
| `laLlamaChat.chat.maxTokens` | `2048` | Max tokens per response |
| `laLlamaChat.chat.debug` | `false` | Enable verbose logs |
| `laLlamaChat.chat.maxAttachedFileSizeKb` | `256` | Max size for manually attached files |
| `laLlamaChat.memory.contextWindowSize` | `8192` | Total context window token budget |
| `laLlamaChat.memory.safetyThreshold` | `6500` | Token threshold that triggers pruning |
| `laLlamaChat.memory.preserveSystemPrompt` | `true` | Keep system prompt during pruning |
| `laLlamaChat.memory.preserveRecentMessagesCount` | `2` | Recent messages always preserved during pruning |

---

## 🚀 Usage

### Step 1 — Start the llama.cpp server

Click **Start Server** in the extension panel, or run manually:

```bash
./build/bin/llama-server \
  --model ./models/qwen2.5-coder-7b-instruct-q4_k_m.gguf \
  --host 127.0.0.1 \
  --port 8033 \
  --ctx-size 16384 \
  --n-gpu-layers 99 \
  --jinja
```

### Step 2 — Index your workspace into ChromaDB

Open the La Llama Chat panel in the Activity Bar and click **Index Workspace**. The extension will:

1. Walk your project files (respecting `excludeDirs` and `excludeFileGlobs`).
2. Chunk file contents into overlapping segments.
3. Compute 384-dimensional vector embeddings using `Xenova/all-MiniLM-L6-v2` (runs locally via `@huggingface/transformers`, ~22 MB cached).
4. Store everything in ChromaDB under a workspace-specific collection.

> Re-index after significant refactors to keep context fresh.

### Step 3 — Ask questions about your code

```
Where is the payment processing flow initiated?
Which services depend on UserRepository?
Explain the authentication middleware chain.
```

The extension selects a conversation flow automatically:

| Condition | Flow | Behaviour |
|---|---|---|
| No files attached, RAG enabled | `GLOBAL_REACT_AGENT` | ReAct loop iteratively searches ChromaDB |
| Files attached, RAG enabled | `DEEP_REACT_AGENT` | ReAct loop starts from attached files, expands dependencies via ChromaDB |
| Files attached, RAG disabled | `LOCAL_RAG` | Isolated analysis of attached code, no retrieval |
| No files, RAG disabled | `DIRECT_LLM` | Plain chat with model knowledge only |

### Step 4 — Attach specific files

Click the **Attach** button (📎) to add individual files to the context:

```
[config.yml attached] What environment variables does this service require?
```

### Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Send message | `Enter` |
| New line in input | `Shift+Enter` |

---

## 🖥️ Interface

La Llama Chat adds a sidebar panel with three tabs:

| Tab | Description |
|---|---|
| **Chat** | Main conversational interface with streamed Markdown responses and live token counter. |
| **Settings** | Quick-access panel for server and ChromaDB configuration. |
| **About** | Extension version and diagnostic information. |

---

## 🛠️ Conversation Flow Roles

Each conversation mode assigns a specific role to the LLM by default. Here's what each role does:

| Conversation Flow | Role | System Prompt Defines | Customization Key |
|---|---|---|---|
| **DIRECT_LLM** | General Software Engineer | Answers development Q&A using pre-trained knowledge; no RAG or file context | `laLlamaChat.chat.directLlmTemplate` |
| **LOCAL_RAG** | Deep Code Analyst | Analyzes ONLY attached files in isolation; warns about external dependencies | `laLlamaChat.chat.localRagTemplate` |
| **GLOBAL_REACT_AGENT** | Code Navigator & Architect | Iteratively searches the entire codebase using ChromaDB; builds comprehensive understanding of architecture | `laLlamaChat.chat.globalReactTemplate` |
| **DEEP_REACT_AGENT** | Cross-File Dependency Expert | Analyzes attached files, then expands to dependencies using ChromaDB search; resolves external references | `laLlamaChat.chat.deepReactTemplate` |

**ReAct flows** use the `Thought/Action/Observation` format:
- Each `Thought` reasons about what to search next
- Each `Action` calls `lalamachat_agent_search(terms)` to query ChromaDB
- `Observation` shows the search results
- Loop continues until sufficient context is gathered, then emits `Final Answer`

---

## 🛠️ Customizing Prompt Templates

You can override the **system prompt and user prompt** for each conversation flow to customize the LLM's behavior. Edit any of the following settings in your `settings.json`:

```jsonc
{
  "laLlamaChat.chat.directLlmTemplate": {
    "systemPrompt": "Your custom system prompt here for DIRECT_LLM mode",
    "userPrompt": "Your custom user prompt template with {{user_query}} placeholder"
  },
  "laLlamaChat.chat.globalReactTemplate": {
    "systemPrompt": "Your custom system prompt here for GLOBAL_REACT_AGENT mode",
    "userPrompt": "Your custom user prompt template"
  },
  "laLlamaChat.chat.localRagTemplate": {
    "systemPrompt": "Your custom system prompt here for LOCAL_RAG mode",
    "userPrompt": "Your custom user prompt template with {{target_files}} placeholder"
  },
  "laLlamaChat.chat.deepReactTemplate": {
    "systemPrompt": "Your custom system prompt here for DEEP_REACT_AGENT mode",
    "userPrompt": "Your custom user prompt template with {{target_files}} placeholder"
  }
}
```

**Available placeholders:**
- `{{user_query}}` — replaced with the user's message
- `{{target_files}}` — replaced with attached file contents (LOCAL_RAG and DEEP_REACT only)

### Legacy RAG Mode & Specific Files Mode Templates

These templates control the formatting of retrieved context and target files display (used internally for non-ReAct flows):

**RAG mode** (`laLlamaChat.chat.ragModeTemplate`):

```json
{
  "executionMode": {
    "header": "<execution_mode>",
    "scope": "SCOPE: Global Project Analysis (RAG).",
    "instruction": "Synthesize the retrieved fragments to answer the query."
  },
  "retrievedContext": {
    "header": "<retrieved_context>",
    "footer": "</retrieved_context>",
    "fragmentFormat": "Fragment {index} | Source: {path}{distance}\n```\n{content}\n```"
  },
  "query": {
    "label": "User Query: {prompt}"
  }
}
```

**Specific files mode** (`laLlamaChat.chat.specificFilesModeTemplate`):

```json
{
  "executionMode": {
    "header": "<execution_mode>",
    "scope": "SCOPE: Selected Specific Files.",
    "instruction": "Answer based only on the code inside <target_files>."
  },
  "targetFiles": {
    "header": "<target_files>",
    "footer": "</target_files>",
    "fileFormat": "File: {name}\nType: {type}\nExtension: {extension}\n```\n{content}\n```"
  },
  "query": {
    "label": "User Query: {prompt}"
  }
}
```

### Default Prompt Content

For detailed information about the **default system prompts** used in each conversation flow (Principal Software Engineer roles, ReAct format requirements, etc.), see [ARCHITECTURE.md §6.3bis](ARCHITECTURE.md#63bis-prompt-templates-for-each-conversation-flow) and [§6.7](ARCHITECTURE.md#67-react-loop-continuation-prompts).

### Prompt Template Key Policy

Prompt template keys and values are English-only. Use `executionMode`, `retrievedContext`, `targetFiles`, `query`, `scope`, `instruction`, `fragmentFormat`, and `fileFormat`.

---

## Donate

If this extension helps your workflow and you want to support its growth, you can donate here:

[Donate via PayPal](https://www.paypal.com/donate/?business=RMF78A8HF9NTG&no_recurring=1&item_name=I+would+greatly+appreciate+it+if+you+could+make+a+donation+to+support+the+development+of+new+features+for+this+plugin.&currency_code=USD)

I want to bring new capabilities to this plugin, including:

- Content replacement directly in files
- Sub-agent management
- Graphical/UI improvements
- New chat interaction flows

---

## 🤝 Contributing

1. Fork the repository and create a feature branch.
2. Install dependencies: `npm install`.
3. Run the build in watch mode: `npm run watch`.
4. Run tests: `npm test`.
5. Validate the build: `npm run compile` must exit with code `0`.
6. Open a Pull Request against `main`.

### Code conventions

- TypeScript strict mode is enforced.
- All new logic must include unit tests under `src/test/` mirroring the source structure.
- ESLint rules must pass.
- No comments in source code.

---

## Data structures

### Session storage (`globalState` key: `laLlamaChatSessions`)

```json
[
  {
    "id": "1718615000000",
    "title": "How does streaming work?",
    "createdAt": 1718615000000,
    "messages": [
      {
        "role": "user",
        "content": {
          "text": "How does streaming work?",
          "filesMetadata": [
            {
              "name": "stream.ts:8-10",
              "content": "const reader = body.getReader();",
              "isAutomatic": true
            }
          ]
        }
      },
      {
        "role": "assistant",
        "content": {
          "text": "Streaming works by reading chunks from the response body...",
          "time": "1.42",
          "tokens": 128
        }
      }
    ]
  }
]
```

### Request sent to llama.cpp

```json
{
  "model": "local",
  "messages": [
    { "role": "system", "content": "You are a Principal Software Engineer..." },
    {
      "role": "user",
      "content": "--- ATTACHED FILE: stream.ts:8-10 ---\nconst reader = body.getReader();\n--- END FILE ---\n\nUser instruction:\nHow does streaming work?"
    },
    { "role": "assistant", "content": "Streaming works by reading chunks..." },
    {
      "role": "user",
      "content": "--- ATTACHED FILE: stream.ts ---\nfull file content here\n--- END FILE ---\n\nUser instruction:\nCan you explain the buffer logic?"
    }
  ],
  "temperature": 0.2,
  "max_tokens": 2048,
  "stream": true
}
```

### llama.cpp server props (`GET /props`)

```json
{
  "model_path": "/models/qwen2.5-coder-7b-instruct-q8_0.gguf",
  "n_ctx": 32768,
  "n_ctx_train": 131072,
  "n_embd": 4096
}
```

---

## Development

```bash
npm run compile   # typecheck + lint + build
npm run watch     # watch mode
npm run test      # run unit tests
```

## Tests

Unit tests cover: session timing/state persistence, editor context labels, payload deduplication, conversation flow resolution, prompt template normalization/interpolation, token counting and memory pruning thresholds, ChromaDB config defaults/overrides, llamaServerConfig command/url generation, and LlamaAdapter server props extraction.

## 📄 License

Distributed under the **GNU GPL v3.0 License**. See [`LICENSE`](LICENSE) for full text.

## Third-Party Notice

- This project includes DOMPurify (`media/purify.min.js`) under the Apache-2.0 / MPL-2.0 dual license.

---

> Built with ❤️ for developers who value privacy, performance and full control over their toolchain.
