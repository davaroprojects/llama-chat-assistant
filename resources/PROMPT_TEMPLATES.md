# Customizable Prompt Templates

This document explains how to customize the prompt templates for RAG (Global Analysis) and Specific Files execution modes in La Llama Chat Assistant.

## Overview

Prompt templates are configurable through VS Code settings. Two modes are available:

1. **RAG Mode** (`laLlamaChat.chat.ragModeTemplate`): Used when a repository is selected
2. **Specific Files Mode** (`laLlamaChat.chat.specificFilesModeTemplate`): Used when only individual files are attached

## Template Variables

### RAG Mode Variables

- `{index}`: Fragment number (1, 2, 3, ...)
- `{path}`: File path of the fragment
- `{distance}`: Cosine similarity distance (optional, empty if not available)
- `{content}`: Fragment text content
- `{prompt}`: User query

### Specific Files Mode Variables

- `{name}`: File name (e.g., `AuthController.java`)
- `{type}`: File classification: `configuration` or `source_code`
- `{extension}`: File extension (e.g., `.java`, `.xml`)
- `{content}`: File text content
- `{prompt}`: User query

## Configuration Examples

### Example 1: Minimal RAG Template

```json
{
  "laLlamaChat.chat.ragModeTemplate": {
    "executionMode": {
      "header": "---RAG MODE---",
      "scope": "Multi-file analysis",
      "instruction": "Synthesize the provided code fragments to answer the question."
    },
    "retrievedContext": {
      "header": "---RETRIEVED CONTEXT---",
      "footer": "---END CONTEXT---",
      "fragmentFormat": "[Fragment {index}] {path}\n{content}"
    },
    "query": {
      "label": "Question: {prompt}"
    }
  }
}
```

### Example 2: Specific Files with File Type Labels

```json
{
  "laLlamaChat.chat.specificFilesModeTemplate": {
    "targetFiles": {
      "fileFormat": "=== {name} ({type}) ===\n```\n{content}\n```"
    }
  }
}
```

## How to Apply Templates

1. Open VS Code Settings (Cmd+, / Ctrl+,)
2. Search for "laLlamaChat"
3. Paste your template configuration directly into the settings

Or edit `.vscode/settings.json`:

```json
{
  "laLlamaChat.chat.ragModeTemplate": {
    "executionMode": { ... },
    "retrievedContext": { ... },
    "query": { ... }
  }
}
```

## Deep Merge Behavior

If you only want to customize specific parts (e.g., only the fragment format), the manager will merge your custom template with the default values. You don't need to specify the entire structure.

Example - Change only the fragment format:

```json
{
  "laLlamaChat.chat.ragModeTemplate": {
    "retrievedContext": {
      "fragmentFormat": "### Segment {index} ({path})\n```\n{content}\n```"
    }
  }
}
```

This will use your custom `fragmentFormat` while keeping all other default values.

## Default Templates

### Default RAG Mode

```
<execution_mode>
SCOPE: Global Project Analysis (RAG).
Instruction: You are provided with multiple independent fragments retrieved from the project database. Your task is to synthesize this information to explain the requested concept and cite file paths when describing relationships.
</execution_mode>

<retrieved_context>
Fragment 1 | Source: src/path/file.java
```
[content]
```

Fragment 2 | Source: src/other/service.java
```
[content]
```
</retrieved_context>

User Query: [user prompt]
```

### Default Specific Files Mode

```
<execution_mode>
SCOPE: Selected Specific Files.
Instruction: Analyze the code inside the <target_files> tags to answer the user query. Ignore assumptions not grounded in the visible code.
</execution_mode>

<target_files>
File: src/main/java/AuthController.java
Type: source_code
Extension: .java
```
[content]
```

File: src/main/resources/application.yml
Type: configuration
Extension: .yml
```
[content]
```
</target_files>

User Query: [user prompt]
```

## Type Definitions

For TypeScript developers working with custom templates:

```typescript
interface RagModeTemplate {
  executionMode: {
    header: string;
    scope: string;
    instruction: string;
  };
  retrievedContext: {
    header: string;
    footer: string;
    fragmentFormat: string; // Use {index}, {path}, {distance}, {content}
  };
  query: {
    label: string; // Use {prompt}
  };
}

interface SpecificFilesModeTemplate {
  executionMode: {
    header: string;
    scope: string;
    instruction: string;
  };
  targetFiles: {
    header: string;
    footer: string;
    fileFormat: string; // Use {name}, {type}, {extension}, {content}
  };
  query: {
    label: string; // Use {prompt}
  };
}
```

## Implementation Details

- **File Location**: `src/core/model/promptTemplate.ts`
- **Manager**: `src/adapters/vscode/promptTemplateManager.ts`
- **Builder**: `src/core/model/promptTemplate.ts` (`PromptTemplateBuilder`)
- **Configuration Loading**: Via VS Code API (`vscode.workspace.getConfiguration`)
- **Merging Strategy**: Deep merge with defaults (partial overrides supported)

## Troubleshooting

### Templates not applying?

1. Ensure you're using the correct setting names: `laLlamaChat.chat.ragModeTemplate` and `laLlamaChat.chat.specificFilesModeTemplate`
2. Check for JSON syntax errors (use VS Code's JSON validator)
3. Restart VS Code to ensure settings are reloaded

### Variable interpolation not working?

Verify you're using the correct variable names:
- RAG: `{index}`, `{path}`, `{distance}`, `{content}`, `{prompt}`
- Specific Files: `{name}`, `{type}`, `{extension}`, `{content}`, `{prompt}`

### Wrong mode being used?

- RAG mode: Requires repository attachment + RAG snippets available
- Specific Files mode: Requires only file attachments (no repository)

Check the "Runtime State" panel in the webview for debugging information.
