export interface ChatMessage {
    role: string;
    content: string | object;
}

export interface LlamaConfig {
    apiUrl: string;
    temperature: number;
    systemPrompt: string;
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
        const messagesForLlama = baseMessages.map((msg, index) => {
            const isLastMessage = index === baseMessages.length - 1;

            if (msg.role === 'user' && isLastMessage) {
                return { role: 'user', content: userContextPrompt };
            }

            if (msg.role === 'user') {
                const content = this.extractTextContent(msg.content);
                return { role: 'user', content };
            }

            if (msg.role === 'assistant') {
                const content = this.extractTextContent(msg.content);
                return { role: 'assistant', content };
            }

            return msg;
        });

        const hasSystemPrompt = messagesForLlama.some(m => m.role === 'system');
        return hasSystemPrompt
            ? messagesForLlama
            : [{ role: 'system', content: systemPrompt }, ...messagesForLlama];
    }

    private static extractTextContent(content: string | object): string {
        if (typeof content === 'string') {
            return content;
        }

        if (typeof content === 'object' && (content as any).text) {
            return (content as any).text;
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

            console.log("=== LLAMA.CPP REQUEST PAYLOAD ===");
            console.log(JSON.stringify(requestPayload, null, 2));
            console.log("=================================");

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
                    } catch (e) {
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
