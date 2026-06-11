"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate
});
module.exports = __toCommonJS(extension_exports);
var vscode2 = __toESM(require("vscode"));

// src/sessionManager.ts
var SessionManager = class {
  constructor(context) {
    this.context = context;
    this.sessions = this.context.globalState.get(this.STORAGE_KEY, []);
  }
  context;
  sessions = [];
  currentSessionId = null;
  STORAGE_KEY = "llamaChatSessions";
  getAllSessions() {
    return this.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      relativeTime: this.getRelativeTime(session.createdAt)
    })).reverse();
  }
  createSession(firstQuestion) {
    const newSession = {
      id: Date.now().toString(),
      title: this.truncateTitle(firstQuestion),
      createdAt: Date.now(),
      messages: []
    };
    this.sessions.push(newSession);
    this.currentSessionId = newSession.id;
    this.saveToDisk();
    return newSession;
  }
  setCurrentSession(sessionId) {
    this.currentSessionId = sessionId;
  }
  getCurrentSession() {
    if (!this.currentSessionId) {
      return null;
    }
    return this.sessions.find((s) => s.id === this.currentSessionId) || null;
  }
  addMessageToCurrentSession(role, content) {
    const currentSession = this.getCurrentSession();
    if (currentSession) {
      currentSession.messages.push({ role, content });
      this.saveToDisk();
    }
  }
  saveToDisk() {
    this.context.globalState.update(this.STORAGE_KEY, this.sessions);
  }
  truncateTitle(text) {
    const cleanText = text.split("Instrucci\xF3n:").pop()?.trim() || text;
    return cleanText.length > 40 ? cleanText.substring(0, 37) + "..." : cleanText;
  }
  getRelativeTime(timestamp) {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 6e4);
    const diffHours = Math.floor(diffMins / 600);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) {
      return "Ahora mismo";
    }
    if (diffMins < 60) {
      return `Hace ${diffMins} min`;
    }
    if (diffHours < 24) {
      return `Hace ${diffHours} h`;
    }
    if (diffDays === 1) {
      return "Ayer";
    }
    return `Hace ${diffDays} d\xEDas`;
  }
  deleteSession(sessionId) {
    this.sessions = this.sessions.filter((s) => s.id !== sessionId);
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }
    this.saveToDisk();
  }
};

// src/webviewProvider.ts
var vscode = __toESM(require("vscode"));
var fs = __toESM(require("node:fs"));
var path = __toESM(require("node:path"));
var LlamaChatViewProvider = class {
  constructor(_extensionUri, context, sessionManager) {
    this._extensionUri = _extensionUri;
    this.context = context;
    this.sessionManager = sessionManager;
  }
  _extensionUri;
  context;
  sessionManager;
  currentAbortController = null;
  _view;
  resolveWebviewView(webviewView, context, _token) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    let isPickerOpen = false;
    let isGenerationActive = false;
    const sendActiveEditorContext = (editor) => {
      if (isPickerOpen || isGenerationActive) {
        return;
      }
      if (editor) {
        const document = editor.document;
        if (document.uri.scheme === "file") {
          const fileName = path.basename(document.fileName);
          const selection = editor.selection;
          if (!selection.isEmpty) {
            const selectedText = document.getText(selection);
            const startLine = selection.start.line + 1;
            const endLine = selection.end.line + 1;
            const lineSuffix = startLine === endLine ? `:${startLine}` : `:${startLine}-${endLine}`;
            webviewView.webview.postMessage({
              type: "codeSelectionCaptured",
              name: `${fileName}${lineSuffix}`,
              content: selectedText
            });
          } else {
            const fullContent = document.getText();
            webviewView.webview.postMessage({
              type: "codeSelectionCaptured",
              name: fileName,
              content: fullContent
            });
          }
        }
      } else {
        webviewView.webview.postMessage({ type: "clearActiveEditorContext" });
      }
    };
    webviewView.webview.onDidReceiveMessage(async (data) => {
      if (data.type === "webviewReady") {
        const activeSession = this.sessionManager.getCurrentSession();
        if (activeSession) {
          webviewView.webview.postMessage({ type: "restoreActiveChat", title: activeSession.title, messages: activeSession.messages });
        } else {
          const initialSessions = this.sessionManager.getAllSessions();
          if (initialSessions.length > 0) {
            webviewView.webview.postMessage({ type: "renderSessionsList", sessions: initialSessions });
          }
        }
        if (!activeSession) {
          sendActiveEditorContext(vscode.window.activeTextEditor);
        }
      }
      if (data.type === "stopGeneration") {
        if (this.currentAbortController) {
          this.currentAbortController.abort();
          this.currentAbortController = null;
        }
      } else if (data.type === "openFilePicker") {
        isPickerOpen = true;
        const fileUri = await vscode.window.showOpenDialog({
          canSelectMany: false,
          openLabel: "Agregar al contexto",
          filters: { "C\xF3digo": ["ts", "js", "json", "py", "go", "rs", "txt", "html", "css", "md", "java", "cpp"] }
        });
        if (fileUri && fileUri[0]) {
          try {
            const filePath = fileUri[0].fsPath;
            const fileName = path.basename(filePath);
            const fileContent = fs.readFileSync(filePath, "utf8");
            webviewView.webview.postMessage({
              type: "fileSelected",
              name: fileName,
              content: fileContent
            });
          } catch (err) {
            vscode.window.showErrorMessage(`Error al leer archivo: ${err.message}`);
          }
        }
        setTimeout(() => {
          isPickerOpen = false;
        }, 400);
      } else if (data.type === "selectSession") {
        this.sessionManager.setCurrentSession(data.sessionId);
        const activeSession = this.sessionManager.getCurrentSession();
        if (activeSession) {
          webviewView.webview.postMessage({
            type: "restoreActiveChat",
            title: activeSession.title,
            messages: activeSession.messages
          });
        }
      } else if (data.type === "askLlama") {
        const userPrompt = data.value;
        const editor = vscode.window.activeTextEditor;
        let currentEditorContext = "";
        let currentEditorName = "";
        if (editor && editor.document.uri.scheme === "file") {
          currentEditorName = path.basename(editor.document.fileName);
          const textSelection = editor.document.getText(editor.selection);
          currentEditorContext = textSelection ? textSelection : editor.document.getText();
        }
        const startTime = performance.now();
        let generatedCharactersLength = 0;
        let serverUsageTokens = 0;
        let assistantReplyAccumulator = "";
        isGenerationActive = true;
        let userContentWithContext = "";
        const uniqueFilesSet = /* @__PURE__ */ new Set();
        const filesMetadata = [];
        if (currentEditorContext) {
          uniqueFilesSet.add(currentEditorName);
        }
        if (data.attachedFiles && Array.isArray(data.attachedFiles)) {
          data.attachedFiles.forEach((file) => {
            uniqueFilesSet.add(file.name);
            filesMetadata.push({ name: file.name, content: file.content });
          });
        }
        const uniqueFilesNames = [...uniqueFilesSet];
        if (currentEditorContext) {
          userContentWithContext += `--- ARCHIVO EN EDITOR ACTIVO: ${currentEditorName} ---
${currentEditorContext}
--- FIN ARCHIVO ---

`;
        }
        if (data.attachedFiles && Array.isArray(data.attachedFiles)) {
          data.attachedFiles.forEach((file) => {
            if (file.name === currentEditorName && currentEditorContext) {
              return;
            }
            userContentWithContext += `--- ARCHIVO ADJUNTO MANUAL: ${file.name} ---
${file.content}
--- FIN ARCHIVO ---

`;
          });
        }
        userContentWithContext += `Indicaci\xF3n del usuario:
${userPrompt}`;
        let currentSession = this.sessionManager.getCurrentSession();
        if (!currentSession) {
          currentSession = this.sessionManager.createSession(userPrompt);
        }
        const richUserPayloadObj = {
          text: userPrompt,
          filesMetadata
        };
        this.sessionManager.addMessageToCurrentSession("user", richUserPayloadObj);
        webviewView.webview.postMessage({
          type: "addMessage",
          role: "user",
          text: userPrompt,
          filesMetadata
        });
        webviewView.webview.postMessage({ type: "startStreaming" });
        try {
          this.currentAbortController = new AbortController();
          const config = vscode.workspace.getConfiguration("llamaChat");
          const apiUrl = config.get("apiUrl") || "http://127.0.0";
          const temperature = config.get("temperature") ?? 0.2;
          const systemPrompt = config.get("systemPrompt") || "Eres un asistente de programaci\xF3n para VS Code.";
          const updatedSession = this.sessionManager.getCurrentSession();
          const baseMessages = updatedSession ? [...updatedSession.messages] : [];
          const messagesForLlama = baseMessages.map((msg) => {
            if (msg.role === "user" && msg === baseMessages[baseMessages.length - 1]) {
              return { role: "user", content: userContentWithContext };
            }
            if (msg.role === "user") {
              if (typeof msg.content === "object" && msg.content.text) {
                return { role: "user", content: msg.content.text };
              }
            }
            if (msg.role === "assistant") {
              if (typeof msg.content === "object" && msg.content.text) {
                return { role: "assistant", content: msg.content.text };
              }
            }
            return msg;
          });
          const hasSystemPrompt = messagesForLlama.some((m) => m.role === "system");
          const fullMessagesPayload = hasSystemPrompt ? messagesForLlama : [{ role: "system", content: systemPrompt }, ...messagesForLlama];
          const response = await globalThis.fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "local",
              messages: fullMessagesPayload,
              temperature,
              stream: true
            }),
            signal: this.currentAbortController.signal
          });
          if (!response.ok) {
            throw new Error(`Servidor respondi\xF3: ${response.status}`);
          }
          if (!response.body) {
            throw new Error("No se recibi\xF3 cuerpo de respuesta.");
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const cleanLine = line.trim();
              if (!cleanLine || !cleanLine.startsWith("data:")) {
                continue;
              }
              const jsonString = cleanLine.substring(5).trim();
              if (jsonString === "[DONE]") {
                break;
              }
              try {
                const parsed = JSON.parse(jsonString);
                if (parsed.choices && parsed.choices.length > 0) {
                  const choice = parsed.choices[0];
                  const tokenText = choice.delta && choice.delta.content ? choice.delta.content : choice.text || "";
                  if (tokenText) {
                    generatedCharactersLength += tokenText.length;
                    assistantReplyAccumulator += tokenText;
                    webviewView.webview.postMessage({
                      type: "appendToken",
                      text: tokenText
                    });
                  }
                }
                if (parsed.usage && parsed.usage.completion_tokens) {
                  serverUsageTokens = parsed.usage.completion_tokens;
                }
              } catch (e) {
              }
            }
          }
          if (assistantReplyAccumulator) {
            const endTime = performance.now();
            const durationSeconds = ((endTime - startTime) / 1e3).toFixed(2);
            const finalTokensCount = serverUsageTokens > 0 ? serverUsageTokens : Math.round(generatedCharactersLength / 3.2);
            const richAssistantPayload = {
              text: assistantReplyAccumulator,
              time: durationSeconds,
              tokens: finalTokensCount
            };
            this.sessionManager.addMessageToCurrentSession("assistant", richAssistantPayload);
            webviewView.webview.postMessage({
              type: "endStreaming",
              time: durationSeconds,
              tokens: finalTokensCount
            });
          }
        } catch (error) {
          console.error("Error durante la generaci\xF3n:", error);
          const endTime = performance.now();
          const durationSeconds = ((endTime - startTime) / 1e3).toFixed(2);
          const finalTokensCount = Math.round(generatedCharactersLength / 3.2);
          if (error.name === "AbortError") {
            if (assistantReplyAccumulator) {
              const richAssistantPayload = {
                text: assistantReplyAccumulator,
                time: durationSeconds,
                tokens: finalTokensCount
              };
              this.sessionManager.addMessageToCurrentSession("assistant", richAssistantPayload);
            }
            webviewView.webview.postMessage({
              type: "endStreaming",
              time: durationSeconds,
              tokens: finalTokensCount
            });
          } else {
          }
        } finally {
          this.currentAbortController = null;
          isGenerationActive = false;
          sendActiveEditorContext(vscode.window.activeTextEditor);
        }
      } else if (data.type === "applyCode") {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          editor.edit((editBuilder) => {
            if (!editor.selection.isEmpty) {
              editBuilder.replace(editor.selection, data.value);
            } else {
              editBuilder.insert(editor.selection.active, data.value);
            }
          });
        }
      } else if (data.type === "deleteSession") {
        this.sessionManager.deleteSession(data.sessionId);
        const updatedSessions = this.sessionManager.getAllSessions();
        if (updatedSessions.length > 0) {
          webviewView.webview.postMessage({
            type: "renderSessionsList",
            sessions: updatedSessions
          });
        } else {
          webviewView.webview.postMessage({
            type: "renderSessionsList",
            sessions: []
          });
        }
      } else if (data.type === "requestSessionsUpdate") {
        const freshSessions = this.sessionManager.getAllSessions();
        webviewView.webview.postMessage({
          type: "renderSessionsList",
          sessions: freshSessions
        });
      } else if (data.type === "requestActiveEditorRefresh") {
        sendActiveEditorContext(vscode.window.activeTextEditor);
      }
    });
    const activeEditorListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
      sendActiveEditorContext(editor);
    });
    this.context.subscriptions.push(activeEditorListener);
    const selectionListener = vscode.window.onDidChangeTextEditorSelection((event) => {
      sendActiveEditorContext(event.textEditor);
    });
    this.context.subscriptions.push(selectionListener);
  }
  getHtmlForWebview(webview) {
    const htmlPath = path.join(this._extensionUri.fsPath, "dist", "media", "webview.html");
    const cssPath = path.join(this._extensionUri.fsPath, "dist", "media", "webview.css");
    const jsPath = path.join(this._extensionUri.fsPath, "dist", "media", "webview.js");
    if (!fs.existsSync(htmlPath) || !fs.existsSync(cssPath) || !fs.existsSync(jsPath)) {
      return `<h3>Error: Resources not found in dist/media. Run npm run compile.</h3>`;
    }
    let htmlContent = fs.readFileSync(htmlPath, "utf8");
    const cssUri = webview.asWebviewUri(vscode.Uri.file(cssPath));
    const jsUri = webview.asWebviewUri(vscode.Uri.file(jsPath));
    const styleLink = `<link rel="stylesheet" type="text/css" href="${cssUri}">`;
    const scriptSrc = `<script src="${jsUri}"></script>`;
    htmlContent = htmlContent.replace("{{stylePlaceholder}}", styleLink);
    return htmlContent.replace("{{scriptPlaceholder}}", scriptSrc);
  }
};

// src/extension.ts
function activate(context) {
  const sessionManager = new SessionManager(context);
  let settingsCommand = vscode2.commands.registerCommand("llama-chat-assistant.openSettings", () => {
    vscode2.commands.executeCommand("workbench.action.openSettings", "Llama Chat Assistant");
  });
  context.subscriptions.push(settingsCommand);
  const provider = new LlamaChatViewProvider(context.extensionUri, context, sessionManager);
  context.subscriptions.push(
    vscode2.window.registerWebviewViewProvider("llama-chat-view", provider)
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate
});
//# sourceMappingURL=extension.js.map
