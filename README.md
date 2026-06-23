# prrrrr

![Version](https://img.shields.io/badge/version-0.0.1-blue?style=flat-square) ![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.120.0-007ACC?style=flat-square&logo=visualstudiocode) ![License](https://img.shields.io/badge/license-MIT-green?style=flat-square) ![Build](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)

**prrrrr** is a VS Code extension that brings AI-powered code intelligence directly into your editor — running entirely on your local machine, with no data leaving your environment.

Chat with your codebase, explore execution flows, and retrieve semantically relevant context using [llama.cpp](https://github.com/ggerganov/llama.cpp) as the LLM backend and [ChromaDB](https://www.trychroma.com/) as the vector store. Whether you are navigating an unfamiliar project or designing a new feature, prrrrr gives you an always-available AI assistant that understands your code, your way.

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
- **Debug mode** — verbose logs and runtime metrics available on demand.

---

## 🔧 Prerequisites

Before installing prrrrr, ensure the following services are available:

### 1. llama.cpp server

Build llama.cpp with server support, or download a pre-built binary, and have it ready to run:

```bash
# Example: build from source
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
cmake -B build -DLLAMA_CURL=ON
cmake --build build --config Release -j$(nproc)
```

You will also need a compatible GGUF model (e.g. `qwen2.5-coder-7b-instruct-q4_k_m.gguf`). Models can be downloaded from [Hugging Face](https://huggingface.co/models).

### 2. ChromaDB

ChromaDB must be running and reachable on the network. The recommended approach is Docker:

```bash
docker run -d \
  --name chromadb \
  -p 8000:8000 \
  chromadb/chroma:latest
```

Alternatively, install via pip:

```bash
pip install chromadb
chroma run --path ./chroma-data --port 8000
```

### 3. VS Code

| Requirement | Minimum version |
|---|---|
| Visual Studio Code | `1.120.0` |

---

## 📦 Installation

### From the VS Code Marketplace

1. Open VS Code.
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on macOS) to open the Extensions view.
3. Search for **prrrrr**.
4. Click **Install**.

### From a `.vsix` file

```bash
code --install-extension prrrrr-0.0.1.vsix
```

Or via the Extensions view: click the `...` menu → **Install from VSIX…** and select the file.

---

## ⚙️ Configuration

Open your VS Code `settings.json` (`Ctrl+Shift+P` → **Preferences: Open User Settings (JSON)**) and add the following blocks as needed.

### llama.cpp Connection

```jsonc
{
  // Path to the llama-server binary
  "llamaChat.llamaCpp.executablePath": "./build/bin/llama-server",

  // Path to the GGUF model file
  "llamaChat.llamaCpp.modelPath": "./models/qwen2.5-coder-7b-instruct-q4_k_m.gguf",

  // Inference server host and port
  "llamaChat.llamaCpp.host": "127.0.0.1",
  "llamaChat.llamaCpp.port": 8033,

  // GPU layers to offload (-1 = all, 0 = CPU only)
  "llamaChat.llamaCpp.gpuLayers": 99,

  // Context window size in tokens
  "llamaChat.llamaCpp.contextSize": 16384,

  // Enable flash attention (recommended)
  "llamaChat.llamaCpp.flashAttention": true
}
```

### ChromaDB Connection

```jsonc
{
  "llamaChat.chromaDb.url": "http://127.0.0.1",
  "llamaChat.chromaDb.port": 8000,

  // Directories to skip when indexing
  "llamaChat.chromaDb.excludeDirs": [
    ".git", "node_modules", "dist", "out", "build", "coverage", "target", ".vscode"
  ],

  // File patterns to skip
  "llamaChat.chromaDb.excludeFileGlobs": ["**/*.bin", "**/*.class", "**/*.jar", "**/*.lock"],

  // Indexing limits
  "llamaChat.chromaDb.maxFileSizeKb": 512,
  "llamaChat.chromaDb.maxIndexedFiles": 2000,
  "llamaChat.chromaDb.chunkSizeChars": 2000,
  "llamaChat.chromaDb.chunkOverlapChars": 300,

  // Query tuning
  "llamaChat.chromaDb.vectorCandidatePool": 50,
  "llamaChat.chromaDb.maxQueryResults": 12,
  "llamaChat.chromaDb.minCosineSimilarity": 0.2
}
```

### Chat Behaviour

```jsonc
{
  "llamaChat.chat.temperature": 0.2,
  "llamaChat.chat.maxTokens": 2048,
  "llamaChat.chat.maxAttachedFileSizeKb": 256,
  "llamaChat.chat.debug": false,

  // Override the system prompt sent on every request
  "llamaChat.chat.systemPrompt": "You are a Principal Software Engineer..."
}
```

### Full Settings Reference

| Setting | Default | Description |
|---|---|---|
| `llamaChat.llamaCpp.host` | `127.0.0.1` | llama.cpp server host |
| `llamaChat.llamaCpp.port` | `8033` | llama.cpp server port |
| `llamaChat.llamaCpp.executablePath` | `./build/bin/llama-server` | Path to llama-server binary |
| `llamaChat.llamaCpp.modelPath` | `./models/qwen2.5-coder-7b-instruct-q4_k_m.gguf` | Path to GGUF model |
| `llamaChat.llamaCpp.gpuLayers` | `99` | GPU layers to offload |
| `llamaChat.llamaCpp.contextSize` | `16384` | Context window in tokens |
| `llamaChat.llamaCpp.flashAttention` | `true` | Enable flash attention |
| `llamaChat.chromaDb.url` | `http://127.0.0.1` | ChromaDB base URL |
| `llamaChat.chromaDb.port` | `8000` | ChromaDB port |
| `llamaChat.chromaDb.maxFileSizeKb` | `512` | Max file size to index (KB) |
| `llamaChat.chromaDb.maxIndexedFiles` | `2000` | Max files per index run |
| `llamaChat.chat.temperature` | `0.2` | Generation temperature |
| `llamaChat.chat.maxTokens` | `2048` | Max tokens per response |
| `llamaChat.chat.debug` | `false` | Enable verbose logs |

---

## 🚀 Usage

### Step 1 — Start the llama.cpp server

You can start it manually or use the **Start Server** button in the extension panel:

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

Open the prrrrr panel in the Activity Bar and click **Index Workspace**. The extension will:

1. Walk your project files (respecting `excludeDirs` and `excludeFileGlobs`).
2. Chunk file contents and compute vector embeddings.
3. Store everything in ChromaDB under a workspace-specific collection.

> **Tip:** Re-index after significant refactors to keep context fresh.

### Step 3 — Ask questions about your code

Type your question in the chat input and press **Enter** (or click **Send**). Examples:

```
Where is the payment processing flow initiated?
```

```
Which services depend on UserRepository?
```

```
Explain the authentication middleware chain.
```

The model retrieves the most relevant code fragments from ChromaDB, injects them as context, and streams the response with Markdown formatting.

### Step 4 — Attach specific files

Click the **Attach** button (📎) to add individual files to the context for a targeted question:

```
[config.yml attached] What environment variables does this service require?
```

### Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Send message | `Enter` |
| New line in input | `Shift+Enter` |
| Open prrrrr panel | *(set via VS Code keybindings)* |

---

## 🖥️ Interface

prrrrr adds a **sidebar panel** to the VS Code Activity Bar with three tabs:

| Tab | Description |
|---|---|
| **Chat** | Main conversational interface. Displays streamed responses with Markdown rendering and a live token counter. |
| **Settings** | Quick-access form for the most common configuration values (server paths, ports, temperature). Changes are written directly to `settings.json`. |
| **About** | Extension version, links and diagnostic information. |

The panel also exposes:

- **Server status indicator** — shows whether llama.cpp is running and reachable.
- **Session list** — persistent conversation history; click any session to restore it.
- **Context badge** — displays the active file/selection being injected. Click to dismiss.

---

## 🛠️ Customizing Prompt Templates

Both RAG and specific-files modes support full template overrides via `settings.json`.

**RAG mode** (`llamaChat.chat.ragModeTemplate`):

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

**Specific files mode** (`llamaChat.chat.specificFilesModeTemplate`):

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

---

## 🤝 Contributing

Contributions are welcome. Please follow these steps:

1. **Fork** the repository and create a feature branch: `git checkout -b feat/my-feature`.
2. **Install dependencies**: `npm install`.
3. **Run the build in watch mode**: `npm run watch` (compiles TypeScript + ESBuild).
4. **Run tests**: `npm test`.
5. **Validate the build**: `npm run compile` must exit with code `0` before submitting a PR.
6. Open a **Pull Request** against `main` with a clear description of the change.

### Code conventions

- TypeScript strict mode is enforced — no `any`, no implicit `unknown`.
- All new logic must include unit tests under `src/test/` mirroring the source structure.
- ESLint rules must pass — run `npm run lint` before committing.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for full text.

---

> Built with ❤️ for developers who value privacy, performance and full control over their toolchain.

## Features

- Token streaming with incremental markdown rendering.
- Manual file attachment to context.
- Automatic editor context capture:
  - If there is a selection, only the selection is used (`file.ts:8-10`).
  - If there is no selection, the full file is used.
  - Removing the automatic context badge suppresses it until the editor is interacted with again.
- Persistent session history in VS Code `globalState`.

## Requirements

- An endpoint compatible with `POST /v1/chat/completions` and `stream: true`.
- VS Code `^1.120.0`.

## Configuration

| Setting | Default | Description |
|---|---|---|
| `llamaChat.chat.temperature` | `0.2` | Generation temperature |
| `llamaChat.chat.systemPrompt` | *(built-in)* | System prompt |
| `llamaChat.chat.debug` | `false` | Enable verbose logs and runtime metrics every 10 requests |
| `llamaChat.chat.maxAttachedFileSizeKb` | `256` | Max size in KB for manually attached files |
| `llamaChat.llamaCpp.host` | `127.0.0.1` | llama.cpp host |
| `llamaChat.llamaCpp.port` | `8033` | llama.cpp port |
| `llamaChat.chromaDb.url` | `http://127.0.0.1` | ChromaDB URL |
| `llamaChat.chromaDb.port` | `8000` | ChromaDB port |

Token counter total is not configurable: it is always read from llama.cpp `GET /props` (`n_ctx`).

### Customizable Prompt Templates

You can customize the execution mode prompts for both **RAG (Global Analysis)** and **Specific Files** modes through VS Code settings. Templates support variable interpolation:

**RAG Mode Template** (`chat.ragModeTemplate`):
```json
{
  "executionMode": {
    "header": "<modo_ejecucion>",
    "scope": "SCOPE: ...",
    "instruction": "You are given multiple retrieved fragments..."
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

**Specific Files Mode Template** (`chat.specificFilesModeTemplate`):
```json
{
  "executionMode": {
    "header": "<modo_ejecucion>",
    "scope": "SCOPE: Selected Specific Files...",
    "instruction": "Analyze only the code provided inside target tags..."
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

Add these to your VS Code `settings.json` under `llamaChat.chat` scope to override defaults.
Legacy Spanish keys are still accepted for backward compatibility.
## File attachment rules

- All attachments live in a single array: `{ name, content, isAutomatic }`.
- No distinction between manual and automatic in session storage or prompts.
- Previous messages retain their file context in the llama request history.

---

## Data structures

### Session storage (VS Code `globalState` key: `llamaChatSessions`)

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
              "content": "const reader = body.getReader();\nconst decoder = new TextDecoder();\nlet buffer = '';",
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

History messages are reconstructed with their original file context. The current message receives the same treatment.

```json
{
  "model": "local",
  "messages": [
    {
      "role": "system",
      "content": "Return answers directly. If you generate code, wrap it in markdown blocks."
    },
    {
      "role": "user",
      "content": "--- ATTACHED FILE: stream.ts:8-10 ---\nconst reader = body.getReader();\nconst decoder = new TextDecoder();\nlet buffer = '';\n--- END FILE ---\n\nUser instruction:\nHow does streaming work?"
    },
    {
      "role": "assistant",
      "content": "Streaming works by reading chunks from the response body..."
    },
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

The extension stores the full response payload for future use and currently reads `n_ctx` for the token counter.

```json
{
  "model_path": "/models/qwen2.5-coder-7b-instruct-q8_0.gguf",
  "chat_template": "<|im_start|>{{ role }}\n{{ content }}<|im_end|>",
  "n_ctx": 32768,
  "n_ctx_train": 131072,
  "n_embd": 4096,
  "n_layer": 32,
  "n_head": 32,
  "rope_freq_base": 10000,
  "rope_freq_scale": 1,
  "quantization": "Q8_0"
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

Unit tests cover:

- Session relative time calculation.
- Editor context label generation (selection range vs full file).
- Payload deduplication and neutral attachment labels.

## Third-Party Notice

- This project includes DOMPurify (`media/purify.min.js`) under the Apache-2.0 / MPL-2.0 dual license.
