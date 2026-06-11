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

// src/sessionPayloadBuilder.ts
var SessionPayloadBuilder = class {
  /**
   * Creates a user message payload for session storage
   * @param userPrompt - The user's text input
   * @param filesMetadata - Array of attached files with metadata
   * @returns User message payload object
   */
  static createUserMessagePayload(userPrompt, filesMetadata) {
    return {
      text: userPrompt,
      filesMetadata
    };
  }
  /**
   * Creates an assistant message payload for session storage
   * @param assistantText - The generated assistant response
   * @param durationSeconds - Response generation time in seconds
   * @param tokenCount - Number of tokens generated
   * @returns Assistant message payload object
   */
  static createAssistantMessagePayload(assistantText, durationSeconds, tokenCount) {
    return {
      text: assistantText,
      time: durationSeconds,
      tokens: tokenCount
    };
  }
  /**
   * Builds the context string for Llama.cpp (temporary, not stored)
   * @param userPrompt - User's input text
   * @param currentEditorName - Name of currently open editor file
   * @param currentEditorContext - Content of current editor file
   * @param attachedFiles - User-selected files to attach
   * @returns Full context string with file contents and prompt
   */
  static buildLlamaContextPrompt(userPrompt, currentEditorName, currentEditorContext, attachedFiles) {
    let context = "";
    if (currentEditorContext) {
      context += `--- ARCHIVO EN EDITOR ACTIVO: ${currentEditorName} ---
`;
      context += `${currentEditorContext}
`;
      context += `--- FIN ARCHIVO ---

`;
    }
    attachedFiles.forEach((file) => {
      if (file.name === currentEditorName && currentEditorContext) {
        return;
      }
      context += `--- ARCHIVO ADJUNTO MANUAL: ${file.name} ---
`;
      context += `${file.content}
`;
      context += `--- FIN ARCHIVO ---

`;
    });
    context += `Indicaci\xF3n del usuario:
${userPrompt}`;
    return context;
  }
  /**
   * Collects all file metadata from editor and attached files
   * @param currentEditorName - Active editor filename
   * @param currentEditorContent - Active editor content (if exists)
   * @param attachedFiles - User-attached files
   * @returns Array of file metadata objects
   */
  static collectFilesMetadata(currentEditorName, currentEditorContent, attachedFiles) {
    const filesMetadata = [];
    if (currentEditorContent) {
      filesMetadata.push({
        name: currentEditorName,
        content: currentEditorContent
      });
    }
    const fileNames = new Set(filesMetadata.map((f) => f.name));
    attachedFiles.forEach((file) => {
      if (!fileNames.has(file.name)) {
        filesMetadata.push(file);
      }
    });
    return filesMetadata;
  }
};

// src/llamaService.ts
var LlamaService = class {
  static DEFAULT_CONFIG = {
    apiUrl: "http://127.0.0.1:8033/v1/chat/completions",
    temperature: 0.2,
    systemPrompt: "Eres un asistente de programaci\xF3n para VS Code."
  };
  /**
   * Prepares messages for Llama.cpp API
   * Converts stored session messages to API format with proper context
   * @param baseMessages - Session history messages
   * @param userContextPrompt - Full context for current user prompt
   * @param systemPrompt - System instruction
   * @returns Messages ready for API request
   */
  static prepareMessagesForLlama(baseMessages, userContextPrompt, systemPrompt) {
    const messagesForLlama = baseMessages.map((msg, index) => {
      const isLastMessage = index === baseMessages.length - 1;
      if (msg.role === "user" && isLastMessage) {
        return { role: "user", content: userContextPrompt };
      }
      if (msg.role === "user") {
        const content = this.extractTextContent(msg.content);
        return { role: "user", content };
      }
      if (msg.role === "assistant") {
        const content = this.extractTextContent(msg.content);
        return { role: "assistant", content };
      }
      return msg;
    });
    const hasSystemPrompt = messagesForLlama.some((m) => m.role === "system");
    return hasSystemPrompt ? messagesForLlama : [{ role: "system", content: systemPrompt }, ...messagesForLlama];
  }
  /**
   * Extracts text content from message object or string
   * @param content - Message content (string or object)
   * @returns Plain text string
   */
  static extractTextContent(content) {
    if (typeof content === "string") {
      return content;
    }
    if (typeof content === "object" && content.text) {
      return content.text;
    }
    return "";
  }
  /**
   * Streams response from Llama.cpp API
   * Yields tokens as they arrive from the server
   * @param messages - Messages for API request
   * @param config - API configuration
   * @param onToken - Callback for each received token
   * @returns Promise resolving to { totalText, tokenCount, serverUsageTokens }
   */
  static async streamLlamaResponse(messages, config, onToken) {
    const abortController = new AbortController();
    let accumulatedText = "";
    let characterCount = 0;
    let serverUsageTokens = 0;
    try {
      const response = await globalThis.fetch(config.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "local",
          messages,
          temperature: config.temperature,
          stream: true
        }),
        signal: abortController.signal
      });
      if (!response.ok) {
        throw new Error(`Server responded: ${response.status}`);
      }
      if (!response.body) {
        throw new Error("No response body received.");
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
            const token = this.extractTokenFromResponse(parsed);
            if (token) {
              characterCount += token.length;
              accumulatedText += token;
              onToken(token);
            }
            if (parsed.usage?.completion_tokens) {
              serverUsageTokens = parsed.usage.completion_tokens;
            }
          } catch (e) {
          }
        }
      }
      return {
        totalText: accumulatedText,
        tokenCount: serverUsageTokens > 0 ? serverUsageTokens : Math.round(characterCount / 3.2),
        serverUsageTokens
      };
    } catch (error) {
      throw error;
    }
  }
  /**
   * Extracts token text from Llama.cpp response
   * Handles multiple response format variations
   * @param response - Parsed JSON response from API
   * @returns Token text or empty string
   */
  static extractTokenFromResponse(response) {
    if (response.choices && response.choices.length > 0) {
      const choice = response.choices[0];
      if (choice.delta?.content) {
        return choice.delta.content;
      }
      if (choice.text) {
        return choice.text;
      }
      return "";
    }
    return "";
  }
  /**
   * Calculates response generation time
   * @param startTime - Performance.now() timestamp
   * @returns Duration in seconds as string (fixed to 2 decimals)
   */
  static calculateDuration(startTime) {
    const endTime = performance.now();
    const durationSeconds = ((endTime - startTime) / 1e3).toFixed(2);
    return durationSeconds;
  }
};

// src/webviewProvider.ts
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
  isPickerOpen = false;
  isGenerationActive = false;
  resolveWebviewView(webviewView, context, _token) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    this.setupMessageHandlers(webviewView);
    this.setupEditorListeners();
  }
  setupMessageHandlers(webviewView) {
    webviewView.webview.onDidReceiveMessage(async (data) => {
      try {
        await this.routeMessage(data, webviewView);
      } catch (error) {
        console.error("Error handling message:", error);
      }
    });
  }
  async routeMessage(data, webviewView) {
    switch (data.type) {
      case "webviewReady":
        this.handleWebviewReady(webviewView);
        break;
      case "stopGeneration":
        this.handleStopGeneration();
        break;
      case "openFilePicker":
        await this.handleOpenFilePicker(webviewView);
        break;
      case "selectSession":
        this.handleSelectSession(data, webviewView);
        break;
      case "askLlama":
        await this.handleAskLlama(data, webviewView);
        break;
      case "applyCode":
        this.handleApplyCode(data);
        break;
      case "deleteSession":
        this.handleDeleteSession(data, webviewView);
        break;
      case "requestSessionsUpdate":
        this.handleRequestSessionsUpdate(webviewView);
        break;
      case "requestActiveEditorRefresh":
        this.handleRequestActiveEditorRefresh(webviewView);
        break;
    }
  }
  handleWebviewReady(webviewView) {
    const activeSession = this.sessionManager.getCurrentSession();
    if (activeSession) {
      webviewView.webview.postMessage({
        type: "restoreActiveChat",
        title: activeSession.title,
        messages: activeSession.messages
      });
    } else {
      const initialSessions = this.sessionManager.getAllSessions();
      if (initialSessions.length > 0) {
        webviewView.webview.postMessage({
          type: "renderSessionsList",
          sessions: initialSessions
        });
      }
    }
    if (!activeSession) {
      this.sendActiveEditorContext(webviewView, vscode.window.activeTextEditor);
    }
  }
  handleStopGeneration() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }
  async handleOpenFilePicker(webviewView) {
    this.isPickerOpen = true;
    try {
      const fileUri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: "Agregar al contexto",
        filters: {
          "C\xF3digo": ["ts", "js", "json", "py", "go", "rs", "txt", "html", "css", "md", "java", "cpp"]
        }
      });
      if (fileUri?.[0]) {
        this.processSelectedFile(fileUri[0], webviewView);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error al leer archivo: ${error.message}`);
    } finally {
      setTimeout(() => {
        this.isPickerOpen = false;
      }, 400);
    }
  }
  processSelectedFile(fileUri, webviewView) {
    try {
      const filePath = fileUri.fsPath;
      const fileName = path.basename(filePath);
      const fileContent = fs.readFileSync(filePath, "utf8");
      webviewView.webview.postMessage({
        type: "fileSelected",
        name: fileName,
        content: fileContent
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error al leer archivo: ${error.message}`);
    }
  }
  handleSelectSession(data, webviewView) {
    this.sessionManager.setCurrentSession(data.sessionId);
    const activeSession = this.sessionManager.getCurrentSession();
    if (activeSession) {
      webviewView.webview.postMessage({
        type: "restoreActiveChat",
        title: activeSession.title,
        messages: activeSession.messages
      });
    }
  }
  async handleAskLlama(data, webviewView) {
    this.isGenerationActive = true;
    try {
      const userPrompt = data.value;
      const editorContext = this.getActiveEditorContext();
      const filesMetadata = this.collectFilesMetadata(data.attachedFiles, editorContext);
      const userPayload = SessionPayloadBuilder.createUserMessagePayload(userPrompt, filesMetadata);
      this.saveUserMessageToSession(userPayload);
      webviewView.webview.postMessage({
        type: "addMessage",
        role: "user",
        text: userPrompt,
        filesMetadata
      });
      webviewView.webview.postMessage({ type: "startStreaming" });
      await this.generateLlamaResponse(
        userPrompt,
        editorContext,
        filesMetadata,
        webviewView
      );
    } catch (error) {
      console.error("Error in askLlama:", error);
    } finally {
      this.isGenerationActive = false;
    }
  }
  handleApplyCode(data) {
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
  }
  handleDeleteSession(data, webviewView) {
    this.sessionManager.deleteSession(data.sessionId);
    const remainingSessions = this.sessionManager.getAllSessions();
    webviewView.webview.postMessage({
      type: "renderSessionsList",
      sessions: remainingSessions
    });
  }
  handleRequestSessionsUpdate(webviewView) {
    const freshSessions = this.sessionManager.getAllSessions();
    webviewView.webview.postMessage({
      type: "renderSessionsList",
      sessions: freshSessions
    });
  }
  handleRequestActiveEditorRefresh(webviewView) {
    this.sendActiveEditorContext(webviewView, vscode.window.activeTextEditor);
  }
  async generateLlamaResponse(userPrompt, editorContext, filesMetadata, webviewView) {
    try {
      this.currentAbortController = new AbortController();
      const config = this.getLlamaConfig();
      const contextPrompt = SessionPayloadBuilder.buildLlamaContextPrompt(
        userPrompt,
        editorContext.name,
        editorContext.content,
        filesMetadata
      );
      const startTime = performance.now();
      const session = this.sessionManager.getCurrentSession();
      const baseMessages = session ? [...session.messages] : [];
      const messagesForLlama = LlamaService.prepareMessagesForLlama(
        baseMessages,
        contextPrompt,
        config.systemPrompt
      );
      const result = await LlamaService.streamLlamaResponse(
        messagesForLlama,
        config,
        (token) => {
          webviewView.webview.postMessage({
            type: "appendToken",
            text: token
          });
        }
      );
      const duration = LlamaService.calculateDuration(startTime);
      const assistantPayload = SessionPayloadBuilder.createAssistantMessagePayload(
        result.totalText,
        duration,
        result.tokenCount
      );
      this.sessionManager.addMessageToCurrentSession("assistant", assistantPayload);
      webviewView.webview.postMessage({
        type: "endStreaming",
        time: duration,
        tokens: result.tokenCount
      });
    } catch (error) {
      this.handleGenerationError(error, webviewView);
    } finally {
      this.currentAbortController = null;
      this.isGenerationActive = false;
      this.sendActiveEditorContext(webviewView, vscode.window.activeTextEditor);
    }
  }
  handleGenerationError(error, webviewView) {
    if (error.name === "AbortError") {
      return;
    }
    const errorMessage = error.message || "Unknown error during generation";
    webviewView.webview.postMessage({
      type: "errorStreaming",
      text: `\u274C Error: ${errorMessage}`
    });
  }
  setupEditorListeners() {
    const activeEditorListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (this._view) {
        this.sendActiveEditorContext(this._view, editor);
      }
    });
    this.context.subscriptions.push(activeEditorListener);
    const selectionListener = vscode.window.onDidChangeTextEditorSelection((event) => {
      if (this._view) {
        this.sendActiveEditorContext(this._view, event.textEditor);
      }
    });
    this.context.subscriptions.push(selectionListener);
  }
  sendActiveEditorContext(webviewView, editor) {
    if (this.isPickerOpen || this.isGenerationActive) {
      return;
    }
    if (editor && editor.document.uri.scheme === "file") {
      const fileName = path.basename(editor.document.fileName);
      const selection = editor.selection;
      const message = this.buildEditorContextMessage(fileName, editor, selection);
      webviewView.webview.postMessage(message);
    } else {
      webviewView.webview.postMessage({ type: "clearActiveEditorContext" });
    }
  }
  buildEditorContextMessage(fileName, editor, selection) {
    if (!selection.isEmpty) {
      const selectedText = editor.document.getText(selection);
      const startLine = selection.start.line + 1;
      const endLine = selection.end.line + 1;
      const lineSuffix = startLine === endLine ? `:${startLine}` : `:${startLine}-${endLine}`;
      return {
        type: "codeSelectionCaptured",
        name: `${fileName}${lineSuffix}`,
        content: selectedText
      };
    } else {
      const fullContent = editor.document.getText();
      return {
        type: "codeSelectionCaptured",
        name: fileName,
        content: fullContent
      };
    }
  }
  getActiveEditorContext() {
    const editor = vscode.window.activeTextEditor;
    let name = "";
    let content = "";
    if (editor && editor.document.uri.scheme === "file") {
      name = path.basename(editor.document.fileName);
      const selection = editor.document.getText(editor.selection);
      content = selection ? selection : editor.document.getText();
    }
    return { name, content };
  }
  collectFilesMetadata(attachedFiles, editorContext) {
    return SessionPayloadBuilder.collectFilesMetadata(
      editorContext.name,
      editorContext.content,
      attachedFiles || []
    );
  }
  saveUserMessageToSession(payload) {
    let currentSession = this.sessionManager.getCurrentSession();
    if (!currentSession) {
      currentSession = this.sessionManager.createSession(payload.text);
    }
    this.sessionManager.addMessageToCurrentSession("user", payload);
  }
  getLlamaConfig() {
    const config = vscode.workspace.getConfiguration("llamaChat");
    return {
      apiUrl: config.get("apiUrl") || "http://127.0.0.1:8033/v1/chat/completions",
      temperature: config.get("temperature") ?? 0.2,
      systemPrompt: config.get("systemPrompt") || "Eres un asistente de programaci\xF3n para VS Code."
    };
  }
  getHtmlForWebview(webview) {
    const htmlPath = path.join(this._extensionUri.fsPath, "dist", "media", "webview.html");
    const cssPath = path.join(this._extensionUri.fsPath, "dist", "media", "webview.css");
    const jsPath = path.join(this._extensionUri.fsPath, "dist", "media", "webview.js");
    if (!fs.existsSync(htmlPath) || !fs.existsSync(cssPath) || !fs.existsSync(jsPath)) {
      return "<h3>Error: Resources not found in dist/media. Run npm run compile.</h3>";
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
