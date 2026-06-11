/**
 * LlamaService - Handles all Llama.cpp API interactions
 * Manages streaming, error handling, and response parsing
 */

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

    private static readonly DEFAULT_CONFIG: LlamaConfig = {
        apiUrl: 'http://127.0.0.1:8033/v1/chat/completions',
        temperature: 0.0,
        systemPrompt: '# REGLAS DE COMPORTAMIENTO (INGENIERO PRINCIPAL)\n- INICIO: Prohibido saludar o introducir. Empieza directamente con el diagnóstico técnico o el bloque de código corregido.\n- CÓDIGO DE SALIDA: Entrega única y exclusivamente las líneas de código modificadas exactas. Prohibido reescribir funciones completas si no cambiaron. Prohibido incluir boilerplate.\n- TONO: Factual, imperativo, absoluto. No uses "creo que", "podría ser" o terminología dubitativa.\n- CONCISIÓN: Elimina explicaciones obvias o de nivel junior. Si el código habla por sí mismo, no agregues texto descriptivo.'
    };

    /**
     * Prepares messages for Llama.cpp API
     * Converts stored session messages to API format with proper context
     * @param baseMessages - Session history messages
     * @param userContextPrompt - Full context for current user prompt
     * @param systemPrompt - System instruction
     * @returns Messages ready for API request
     */
    static prepareMessagesForLlama(
        baseMessages: ChatMessage[],
        userContextPrompt: string,
        systemPrompt: string
    ): ChatMessage[] {
        // Create a deep copy for Llama.cpp with full context
        const messagesForLlama = baseMessages.map((msg, index) => {
            const isLastMessage = index === baseMessages.length - 1;

            if (msg.role === 'user' && isLastMessage) {
                // Replace last user message with full context
                return { role: 'user', content: userContextPrompt };
            }

            // Extract text from stored objects for other messages
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

        // Add system prompt if not already present
        const hasSystemPrompt = messagesForLlama.some(m => m.role === 'system');
        return hasSystemPrompt
            ? messagesForLlama
            : [{ role: 'system', content: systemPrompt }, ...messagesForLlama];
    }

    /**
     * Extracts text content from message object or string
     * @param content - Message content (string or object)
     * @returns Plain text string
     */
    private static extractTextContent(content: string | object): string {
        if (typeof content === 'string') {
            return content;
        }

        if (typeof content === 'object' && (content as any).text) {
            return (content as any).text;
        }

        return '';
    }

    /**
     * Streams response from Llama.cpp API
     * Yields tokens as they arrive from the server
     * @param messages - Messages for API request
     * @param config - API configuration
     * @param onToken - Callback for each received token
     * @returns Promise resolving to { totalText, tokenCount, serverUsageTokens }
     */
    static async streamLlamaResponse(
        messages: ChatMessage[],
        config: LlamaConfig,
        onToken: (token: string) => void
    ): Promise<{ totalText: string; tokenCount: number; serverUsageTokens: number }> {
        const abortController = new AbortController();
        let accumulatedText = "";
        let characterCount = 0;
        let serverUsageTokens = 0;

        // Normalización de la estructura para compatibilidad con la API OpenAI / Llama.cpp
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
                signal: abortController.signal
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

                        // Capture token count from response
                        if (parsed.usage?.completion_tokens) {
                            serverUsageTokens = parsed.usage.completion_tokens;
                        }
                    } catch (e) {
                        // Ignore parse errors on incomplete lines
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
    private static extractTokenFromResponse(response: any): string {
        if (response.choices && response.choices.length > 0) {
            const choice = response.choices[0];
            // Handle streaming format (delta.content) and completion format (text)
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

    /**
     * Calculates response generation time
     * @param startTime - Performance.now() timestamp
     * @returns Duration in seconds as string (fixed to 2 decimals)
     */
    static calculateDuration(startTime: number): string {
        const endTime = performance.now();
        const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
        return durationSeconds;
    }
}
