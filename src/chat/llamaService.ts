export interface ChatMessage {
    role: string;
    content: string | object;
}

export interface LlamaConfig {
    apiUrl: string;
    temperature: number;
    systemPrompt: string;
    debug: boolean;
}

export interface StreamingState {
    isActive: boolean;
    abortController: AbortController | null;
    accumulatedText: string;
    characterCount: number;
    serverTokens: number;
    startTime: number;
}

export class LlamaService {

    static prepareMessagesForLlama(
        baseMessages: ChatMessage[],
        userContextPrompt: string,
        systemPrompt: string
    ): ChatMessage[] {
        // Find the last message index that owns each base file name
        const lastIndexByBase = new Map<string, number>();
        baseMessages.forEach((msg, idx) => {
            if (msg.role === 'user') {
                this.getFilesFromPayload(msg.content).forEach(f => {
                    lastIndexByBase.set(this.getBaseName(f.name), idx);
                });
            }
        });

        const messagesForLlama = baseMessages.map((msg, index) => {
            const isLastMessage = index === baseMessages.length - 1;

            if (msg.role === 'user' && isLastMessage) {
                return { role: 'user', content: userContextPrompt };
            }

            if (msg.role === 'user') {
                return { role: 'user', content: this.buildHistoryUserContent(msg.content, index, lastIndexByBase) };
            }

            if (msg.role === 'assistant') {
                return { role: 'assistant', content: this.extractTextOnly(msg.content) };
            }

            return msg;
        });

        const hasSystemPrompt = messagesForLlama.some(m => m.role === 'system');
        return hasSystemPrompt
            ? messagesForLlama
            : [{ role: 'system', content: systemPrompt }, ...messagesForLlama];
    }

    private static getBaseName(name: string): string {
        return name.replace(/:\d+(?:-\d+)?$/, '');
    }

    private static getFilesFromPayload(content: unknown): Array<{ name: string; content: string }> {
        if (typeof content !== 'object' || content === null) { return []; }
        const payload = content as Record<string, unknown>;
        return Array.isArray(payload.filesMetadata)
            ? (payload.filesMetadata as Array<{ name: string; content: string }>)
            : [];
    }

    private static buildHistoryUserContent(
        content: unknown,
        msgIndex: number,
        lastIndexByBase: Map<string, number>
    ): string {
        let text = '';
        if (typeof content === 'string') {
            text = content;
        } else if (typeof content === 'object' && content !== null) {
            const payload = content as Record<string, unknown>;
            text = typeof payload.text === 'string' ? payload.text : '';
        }

        // Only include files for which this message is the LATEST
        const activeFiles = this.getFilesFromPayload(content)
            .filter(f => lastIndexByBase.get(this.getBaseName(f.name)) === msgIndex);

        if (activeFiles.length === 0) {
            return `Indicación del usuario:\n${text}`;
        }

        let ctx = '';
        activeFiles.forEach(file => {
            ctx += `--- ARCHIVO ADJUNTO: ${file.name} ---\n${file.content}\n--- FIN ARCHIVO ---\n\n`;
        });
        ctx += `Indicación del usuario:\n${text}`;
        return ctx;
    }

    private static extractTextOnly(content: unknown): string {
        if (typeof content === 'string') { return content; }
        if (typeof content === 'object' && content !== null) {
            const payload = content as Record<string, unknown>;
            return typeof payload.text === 'string' ? payload.text : '';
        }
        return '';
    }

    static async streamLlamaResponse(
        messages: ChatMessage[],
        config: LlamaConfig,
        onToken: (token: string) => void,
        abortSignal?: AbortSignal
    ): Promise<{ totalText: string; tokenCount: number; serverUsageTokens: number, errorMsg?: string }> {
        let accumulatedText = "";
        let characterCount = 0;
        let serverUsageTokens = 0;

        const openAiCompliantMessages = messages.map(msg => ({
            role: msg.role,
            content: (msg as any).text || (msg as any).content || ""
        }));

        try {
            const requestPayload = {
                model: 'local',
                messages: openAiCompliantMessages,
                temperature: config.temperature,
                max_tokens: 2048,
                stream: true
            };

            if (config.debug) {
                console.log("=== LLAMA.CPP REQUEST PAYLOAD ===");
                console.log(JSON.stringify(requestPayload, null, 2));
                console.log("=================================");
            }

            const response = await globalThis.fetch(config.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload),
                signal: abortSignal
            });

            if (!response.ok) {
                throw new Error(`Server responded: ${response.status}`);
            }

            if (!response.body) {
                throw new Error('No response body received.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const cleanLine = line.trim();
                    if (!cleanLine || !cleanLine.startsWith('data:')) {
                        continue;
                    }

                    const jsonString = cleanLine.substring(5).trim();
                    if (jsonString === '[DONE]') {
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
                    } catch {
                    }
                }
            }

            return {
                totalText: accumulatedText,
                tokenCount: serverUsageTokens > 0
                    ? serverUsageTokens
                    : Math.round(characterCount / 3.2),
                serverUsageTokens
            };
        } catch (error: any) {
            console.error("Error during Llama.cpp streaming:", error);
            throw error;
        }
    }

    private static extractTokenFromResponse(response: any): string {
        if (response.choices && response.choices.length > 0) {
            const choice = response.choices[0];
            if (choice.delta?.content) {
                return choice.delta.content;
            }
            if (choice.text) {
                return choice.text;
            }
            return '';
        }
        return '';
    }

    static calculateDuration(startTime: number): string {
        const endTime = performance.now();
        const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
        return durationSeconds;
    }
}
