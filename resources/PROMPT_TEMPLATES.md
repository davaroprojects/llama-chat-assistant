# Customizable Prompt Templates

This document explains how to customize the prompt templates for RAG (Global Analysis) and Specific Files execution modes in Llama Chat Assistant.

## Overview

Prompt templates are configurable through VS Code settings. Two modes are available:

1. **RAG Mode** (`llamaChat.ragModeTemplate`): Used when a repository is selected
2. **Specific Files Mode** (`llamaChat.specificFilesModeTemplate`): Used when only individual files are attached

## Template Variables

### RAG Mode Variables

- `{index}`: Fragment number (1, 2, 3, ...)
- `{path}`: File path of the fragment
- `{distance}`: Cosine similarity distance (optional, empty if not available)
- `{content}`: Fragment text content
- `{prompt}`: User query

### Specific Files Mode Variables

- `{name}`: File name (e.g., `AuthController.java`)
- `{type}`: File classification: `configuracion` or `codigo_fuente`
- `{extension}`: File extension (e.g., `.java`, `.xml`)
- `{content}`: File text content
- `{prompt}`: User query

## Configuration Examples

### Example 1: Minimal RAG Template

```json
{
  "llamaChat.ragModeTemplate": {
    "modoEjecucion": {
      "header": "---RAG MODE---",
      "alcance": "Multi-file analysis",
      "instruccion": "Synthesize the provided code fragments to answer the question."
    },
    "contextoRecuperado": {
      "header": "---RETRIEVED CONTEXT---",
      "footer": "---END CONTEXT---",
      "fragmentoFormat": "[Fragment {index}] {path}\n{content}"
    },
    "consulta": {
      "label": "Question: {prompt}"
    }
  }
}
```

### Example 2: Specific Files with File Type Labels

```json
{
  "llamaChat.specificFilesModeTemplate": {
    "archivosObjetivo": {
      "archivoFormat": "=== {name} ({type}) ===\n```\n{content}\n```"
    }
  }
}
```

## How to Apply Templates

1. Open VS Code Settings (Cmd+, / Ctrl+,)
2. Search for "llamaChat"
3. Paste your template configuration directly into the settings

Or edit `.vscode/settings.json`:

```json
{
  "llamaChat.ragModeTemplate": {
    "modoEjecucion": { ... },
    "contextoRecuperado": { ... },
    "consulta": { ... }
  }
}
```

## Deep Merge Behavior

If you only want to customize specific parts (e.g., only the fragment format), the manager will merge your custom template with the default values. You don't need to specify the entire structure.

Example - Change only the fragment format:

```json
{
  "llamaChat.ragModeTemplate": {
    "contextoRecuperado": {
      "fragmentoFormat": "### Segment {index} ({path})\n```\n{content}\n```"
    }
  }
}
```

This will use your custom `fragmentoFormat` while keeping all other default values.

## Default Templates

### Default RAG Mode

```
<modo_ejecucion>
ALCANCE: Análisis Global del Proyecto (RAG).
Instrucción: Se te proveen múltiples fragmentos independientes recuperados de la base de datos del proyecto. Tu tarea es sintetizar esta información para explicar el concepto solicitado. Identifica las relaciones entre los fragmentos citando las rutas de los archivos.
</modo_ejecucion>

<contexto_recuperado>
Fragmento 1 | Origen: src/path/file.java
```
[content]
```

Fragmento 2 | Origen: src/other/service.java
```
[content]
```
</contexto_recuperado>

Consulta General del Usuario: [user prompt]
```

### Default Specific Files Mode

```
<modo_ejecucion>
ALCANCE: Archivos Específicos Seleccionados.
Instrucción: Analiza detalladamente el código provisto en las etiquetas <archivos_objetivo> para responder la consulta del usuario. Ignora cualquier suposición externa al código visible.
</modo_ejecucion>

<archivos_objetivo>
Archivo: src/main/java/AuthController.java
Tipo: codigo_fuente
Extensión: .java
```
[content]
```

Archivo: src/main/resources/application.yml
Tipo: configuracion
Extensión: .yml
```
[content]
```
</archivos_objetivo>

Consulta del Usuario: [user prompt]
```

## Type Definitions

For TypeScript developers working with custom templates:

```typescript
interface RagModeTemplate {
  modoEjecucion: {
    header: string;
    alcance: string;
    instruccion: string;
  };
  contextoRecuperado: {
    header: string;
    footer: string;
    fragmentoFormat: string; // Use {index}, {path}, {distance}, {content}
  };
  consulta: {
    label: string; // Use {prompt}
  };
}

interface SpecificFilesModeTemplate {
  modoEjecucion: {
    header: string;
    alcance: string;
    instruccion: string;
  };
  archivosObjetivo: {
    header: string;
    footer: string;
    archivoFormat: string; // Use {name}, {type}, {extension}, {content}
  };
  consulta: {
    label: string; // Use {prompt}
  };
}
```

## Implementation Details

- **File Location**: `src/chat/promptTemplates.ts`
- **Manager**: `src/chat/promptTemplateManager.ts`
- **Builder**: `src/chat/promptContextBuilder.ts`
- **Configuration Loading**: Via VS Code API (`vscode.workspace.getConfiguration`)
- **Merging Strategy**: Deep merge with defaults (partial overrides supported)

## Troubleshooting

### Templates not applying?

1. Ensure you're using the correct setting names: `llamaChat.ragModeTemplate` and `llamaChat.specificFilesModeTemplate`
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
