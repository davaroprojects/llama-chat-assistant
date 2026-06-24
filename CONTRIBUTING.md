# Contributing to La Llama Chat Assistant

Thank you for your interest in contributing. This guide covers everything you need to get the project running locally, understand the codebase conventions, and submit quality changes.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Setup](#2-local-setup)
3. [Project Structure](#3-project-structure)
4. [Architecture Conventions](#4-architecture-conventions)
5. [Development Workflow](#5-development-workflow)
6. [Running Tests](#6-running-tests)
7. [Code Style](#7-code-style)
8. [Legal Policy](#8-legal-policy)
9. [Submitting Changes](#9-submitting-changes)
10. [Key Documentation](#10-key-documentation)

---

## 1. Prerequisites

| Tool | Minimum version | Purpose |
|---|---|---|
| Node.js | 22.x | Runtime and package manager |
| npm | bundled with Node | Dependency management |
| VS Code | 1.120.0 | Extension host for development |
| [llama.cpp server](https://github.com/ggerganov/llama.cpp) | any recent build | LLM inference at `http://127.0.0.1:8033` |
| [ChromaDB](https://docs.trychroma.com/) | any recent release | Vector store at `http://127.0.0.1:8000` |

> llama.cpp and ChromaDB are only required for manual end-to-end testing. Unit tests run without either service.

---

## 2. Local Setup

```bash
# Clone the repository
git clone https://github.com/davaroprojects/llama-chat-assistant.git
cd llama-chat-assistant

# Install all dependencies
npm install

# Compile the extension
npm run compile
```

To launch the extension in a VS Code development host, press `F5` from VS Code with this workspace open. This starts the **Extension Development Host** with the compiled extension loaded.

---

## 3. Project Structure

```
src/
├── extension.ts                      # Extension entry point, registers commands and providers
├── webviewProvider.ts                # LaLlamaChatViewProvider — manages the webview panel lifecycle
│
├── core/                             # Domain layer — no external dependencies
│   ├── domain/                       # Value objects and domain models
│   │   ├── memoryConfig.ts           # Memory pruning configuration
│   │   └── tokenCount.ts             # Token count result and threshold logic
│   ├── gateways/                     # Port interfaces (contracts for adapters)
│   │   ├── llamaGateway.ts
│   │   ├── ragGateway.ts
│   │   ├── repositoryIndexGateway.ts
│   │   └── sesionGateway.ts
│   ├── model/                        # Domain entities and types
│   │   ├── chroma.ts                 # ChromaDB config + result types
│   │   ├── conversationFlow.ts       # Conversation flow enum
│   │   ├── conversationPromptTemplate.ts
│   │   ├── llama.ts                  # LLM message and request types
│   │   ├── llamaServer.ts            # Server config model
│   │   ├── promptTemplate.ts         # Template types, normalize/interpolate functions
│   │   ├── session.ts                # Chat session model
│   │   └── sessionPayload.ts         # Payload sent to the LLM
│   └── usecases/                     # Application use cases (orchestration)
│       ├── generateAssistantReplyUseCase.ts
│       ├── indexWorkspaceUseCase.ts
│       ├── laLlamaChatAgentSearchUseCase.ts
│       ├── memoryPruningUseCase.ts
│       ├── resolveConversationFlowUseCase.ts
│       └── runReactAgentConversationUseCase.ts
│
├── adapters/                         # Infrastructure layer — implements gateway interfaces
│   ├── chroma/                       # ChromaDB adapter
│   │   ├── chromaAdapter.ts          # Implements RagGateway + RepositoryIndexGateway
│   │   ├── chromaConfig.ts           # Reads laLlamaChat.chromaDb.* VS Code settings
│   │   └── utils/
│   │       ├── analysis/             # Language, ecosystem, and metadata detection
│   │       ├── chroma/               # Client and collection helpers
│   │       ├── embeddings/           # HuggingFace transformers pipeline
│   │       ├── filesystem/           # File walking and binary detection
│   │       ├── search/               # Vector similarity and lexical search
│   │       └── text/                 # Tree-sitter syntax chunking + token-aware fallback
│   ├── llama/                        # llama.cpp HTTP adapter
│   │   ├── llamaAdapter.ts           # Implements LlamaGateway
│   │   ├── llamaConfig.ts            # Reads laLlamaChat.chat.* VS Code settings
│   │   └── llamaServerConfig.ts      # Reads laLlamaChat.llamaCpp.* VS Code settings
│   └── vscode/                       # VS Code-specific adapters
│       ├── memoryManagementConfigAdapter.ts
│       ├── outputLogger.ts           # VS Code Output Channel logger
│       ├── promptTemplateManager.ts  # Loads/merges prompt templates from settings
│       └── sessionAdapter.ts         # Persists sessions in globalState
│
├── helpers/                          # Stateless builder utilities
│   ├── conversationPromptBuilder.ts
│   ├── llamaMessageBuilder.ts
│   └── sessionPayloadBuilder.ts
│
├── utils/
│   └── tokenCounter.ts               # Token counting via js-tiktoken (dynamic import)
│
└── webview/
    ├── editorContext.ts              # Captures active editor context for attachments
    ├── filePicker.ts                 # File picker dialog integration
    └── webviewResources.ts           # Resolves webview asset URIs
```

---

## 4. Architecture Conventions

The project follows **Hexagonal (Ports & Adapters)** architecture. These rules must be respected:

### Dependency direction

```
Presentation → Use Cases → Domain ← Adapters
```

- `core/domain` and `core/gateways` have **zero external dependencies** — no `vscode`, no `fs`, no npm packages.
- `core/usecases` may only import from `core/domain`, `core/gateways`, and `core/model`.
- `adapters/` implement gateway interfaces; they import from `core/` but `core/` never imports from `adapters/`.

### Naming

| Concept | Convention |
|---|---|
| VS Code command IDs | `laLlamaChat.<commandName>` |
| VS Code setting keys | `laLlamaChat.<group>.<property>` |
| Session storage key | `laLlamaChatSessions` |
| ReAct tool label in prompts | `lalamachat_agent_search` |
| Test files | `*.test.ts` co-located in `src/test/` mirroring `src/` |

### No re-export wrappers

Do not create files whose sole purpose is to re-export another module. Types must live in their canonical `core/domain` or `core/model` location and be imported directly.

### English only

All source code identifiers, comments, log messages, and documentation must be written in **English**.

---

## 5. Development Workflow

### Watch mode (recommended during development)

```bash
npm run watch
```

This runs in parallel:
- `watch:esbuild` — incremental bundle rebuild via esbuild
- `watch:tsc` — TypeScript type checking in watch mode (no emit)

### Full compile + lint

```bash
npm run compile
```

Runs in sequence: type check → ESLint → esbuild bundle → copy media assets.

### Type check only

```bash
npm run check-types
# or with extra strictness (catches unused locals/params):
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
```

### Lint only

```bash
npm run lint
```

### Debugging RAG Pipeline

To debug indexation and query performance, enable debug logging in the test/dev VS Code instance:

```jsonc
// settings.json in the development workspace
{
  "laLlamaChat.chat.debug": true
}
```

Then open the **RAG** output channel (`Ctrl+Shift+U` → select **RAG**) to view structured logs during:

- **Indexing:** File walk results, parser initialization, chunk assembly, embedding computation
- **Querying:** Phase 1 semantic retrieval scores, Phase 2 cross-encoder reranking scores
- **ReAct loop:** Action parsing, query execution, observation formatting

**Common debugging scenarios:**

| Problem | Log marker to search | Debugging steps |
|---|---|---|
| Many files skipped during indexing | `readErrors`, `errorSamples` | Check if tree-sitter parser initialization failed; see `INDEXING_PROCESS.md` § 2b |
| Queries return no results | `query.results` shows `count: 0` | Verify ChromaDB collection exists; run manual index first |
| Poor retrieval quality | `query.ranking_phase1`, `query.ranking_phase2` | Check if lexical score includes metadata (path, class_name, method_name); verify reranker model loaded |
| ReAct loop stuck in format correction | `action.extract` shows `success: false` | Check if model output contains valid `Action:` line; see `runReactAgentConversationUseCase.ts` line ~100 |

---

## 6. Running Tests

Tests use **Mocha** with the `@vscode/test-cli` runner. The test suite requires VS Code to be installed (tests run inside the Extension Development Host).

```bash
# Compile tests (uses tsconfig.test.json → outputs to out/test/)
npm run compile-tests

# Run the full test suite (compiles everything first)
npm test
```

### Watch tests during development

```bash
npm run watch-tests
```

### Test conventions

- Use `suite` / `test` / `setup` / `suiteTeardown` + `assert` from Node's built-in `assert` module.
- Do **not** use Jest-specific APIs (`jest.fn`, `expect`) unless a Jest runner is explicitly added.
- Test files mirror the source structure: `src/test/core/usecases/` tests code in `src/core/usecases/`.
- Use `tsconfig.test.json` for test compilation — it includes `src/**/*.test.ts` which is excluded from the main `tsconfig.json`.

---

## 7. Code Style

The project uses **ESLint** with `typescript-eslint`. Configuration is in `eslint.config.mjs`.

Key rules enforced:
- All `if`/`for`/`while` blocks must use curly braces (no single-line braceless bodies).
- No unused variables or imports (enforced by `check-types` + ESLint).
- Dynamic `import()` is preferred for ESM/CommonJS compatibility (e.g. `@huggingface/transformers`, `js-tiktoken`).

---

## 8. Legal Policy

This project is distributed under **GPL-3.0-or-later**.

- Contributors retain copyright in their own contributions.
- By contributing code, documentation, tests, or assets, you agree that your contribution is distributed under **GPL-3.0-or-later**.
- **DCO (Developer Certificate of Origin)** is enforced through signed commits.
- **CLA (Contributor License Agreement)** is required for pull requests and is handled through CLA Assistant Lite.

Use:

```bash
git commit -s
```

This adds a `Signed-off-by:` line certifying that you have the right to submit the contribution.

### CLA workflow

Before opening a pull request, review [`CLA.md`](CLA.md). When a pull request is opened, CLA Assistant Lite will comment with signing instructions if your signature is not yet recorded.

- Signatures are stored automatically by the workflow.
- Do not create or edit the signatures file manually.
- Bot users may be allowlisted in the workflow configuration.

---

## 9. Submitting Changes

1. **Branch** off `main` with a descriptive name: `feat/hybrid-search-tuning`, `fix/chroma-timeout`.
2. **Keep changes focused** — one logical concern per pull request.
3. **Run the full validation suite** before opening a PR:
   ```bash
   npm run compile && npm test
   ```
4. **Update documentation** if your change affects the indexing pipeline, RAG query mechanics, or any public configuration setting. Relevant docs are in `ARCHITECTURE.md` and `INDEXING_PROCESS.md`.
5. **Do not force-push** to shared branches.
6. **Sign your commits** with DCO attestation: `git commit -s`.
7. **Complete the CLA signature flow** if the PR bot requests it.

---

## 10. Key Documentation

| Document | Contents |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layered architecture, conversation flow routing, data models, dependency graph |
| [INDEXING_PROCESS.md](INDEXING_PROCESS.md) | Full workspace indexing pipeline — chunking parameters, embedding model, ChromaDB schema |
| [resources/PROMPT_TEMPLATES.md](resources/PROMPT_TEMPLATES.md) | Prompt template variables and customisation guide |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

## Notes

Add any reviewer context, migration notes, or follow-up work here.
