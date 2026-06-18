# Llama Chat Assistant

VS Code extension to chat with a local OpenAI-compatible server (e.g. `llama.cpp`) from the sidebar.

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
| `llamaChat.apiUrl` | `http://127.0.0.1:8033/v1/chat/completions` | Backend URL |
| `llamaChat.temperature` | `0.2` | Generation temperature |
| `llamaChat.systemPrompt` | *(built-in)* | System prompt |
| `llamaChat.debug` | `false` | Enable verbose logs and runtime metrics every 10 requests |
| `llamaChat.maxAttachedFileSizeKb` | `256` | Max size in KB for manually attached files |

Token counter total is not configurable: it is always read from llama.cpp `GET /props` (`n_ctx`).
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
      "content": "--- ARCHIVO ADJUNTO: stream.ts:8-10 ---\nconst reader = body.getReader();\nconst decoder = new TextDecoder();\nlet buffer = '';\n--- FIN ARCHIVO ---\n\nIndicación del usuario:\nHow does streaming work?"
    },
    {
      "role": "assistant",
      "content": "Streaming works by reading chunks from the response body..."
    },
    {
      "role": "user",
      "content": "--- ARCHIVO ADJUNTO: stream.ts ---\nfull file content here\n--- FIN ARCHIVO ---\n\nIndicación del usuario:\nCan you explain the buffer logic?"
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
