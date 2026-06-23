import { Logger } from '../../logging/outputLogger';
import { LlamaGateway, LlmGenerationConfig, LlmGenerationResult, LlmMessage } from '../../core/gateways/llamaGateway';
import { ChatMessage, LlamaConfig, LlamaServerProps } from '../../core/domain/llama';

export interface StreamingState {
    isActive: boolean;
    abortController: AbortController | null;
    accumulatedText: string;
    characterCount: number;
    serverTokens: number;
    startTime: number;
}

export interface StreamChunk {
    choices?: Array<{
        delta?: { content?: string };
        text?: string;
    }>;
    usage?: { completion_tokens?: number };
}

export class LlamaAdapter implements LlamaGateway {
    private static readonly REQUEST_TIMEOUT_MS = 60_000;
    private static readonly STREAM_READ_TIMEOUT_MS = 10_000;
    private static logger: Logger | null = null;

    static setLogger(logger: Logger): void {
        this.logger = logger;
    }

    private static createCompositeAbortSignal(externalSignal?: AbortSignal): AbortSignal {
        const timeoutController = new AbortController();
        const timeoutHandle = setTimeout(() => timeoutController.abort(), this.REQUEST_TIMEOUT_MS);

        if (!externalSignal) {
            timeoutController.signal.addEventListener('abort', () => clearTimeout(timeoutHandle), { once: true });
            return timeoutController.signal;
        }

        const compositeController = new AbortController();
        const abortComposite = () => {
            clearTimeout(timeoutHandle);
            if (!compositeController.signal.aborted) {
                compositeController.abort();
            }
        };

        timeoutController.signal.addEventListener('abort', abortComposite, { once: true });
        externalSignal.addEventListener('abort', abortComposite, { once: true });
        return compositeController.signal;
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
            content: typeof msg.content === 'string'
                ? msg.content
                : String((msg.content as Record<string, unknown>)?.['text'] ?? '')
        }));

        try {
            const requestPayload = {
                model: config.model,
                messages: openAiCompliantMessages,
                temperature: config.temperature,
                max_tokens: config.maxTokens,
                stream: true
            };

            if (config.debug) {
                this.logger?.debug('llama', 'Streaming payload', requestPayload);
            }

            const response = await globalThis.fetch(config.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload),
                signal: this.createCompositeAbortSignal(abortSignal)
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

            const readWithTimeout = async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
                let timeoutId: ReturnType<typeof setTimeout> | undefined;
                try {
                    return await Promise.race([
                        reader.read(),
                        new Promise<never>((_, reject) => {
                            timeoutId = setTimeout(() => {
                                reject(new Error('Timed out while reading streaming response.'));
                            }, this.STREAM_READ_TIMEOUT_MS);
                        })
                    ]);
                } finally {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }
                }
            };

            while (true) {
                const readResult = await readWithTimeout();

                const { done, value } = readResult;
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
                    } catch (err) {
                        this.logger?.warn('llama', 'Failed to parse SSE chunk', { chunk: cleanLine, error: String(err) });
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
            this.logger?.error('llama', 'Error during llama.cpp streaming', error);
            throw error;
        }
    }

    async streamResponse(
        messages: LlmMessage[],
        config: LlmGenerationConfig,
        onToken: (token: string) => void,
        abortSignal?: AbortSignal
    ): Promise<LlmGenerationResult> {
        return LlamaAdapter.streamLlamaResponse(
            messages as ChatMessage[],
            config as LlamaConfig,
            onToken,
            abortSignal
        );
    }

    private static extractTokenFromResponse(response: StreamChunk): string {
        if (response.choices && response.choices.length > 0) {
            const choice = response.choices[0];
            return choice.delta?.content ?? choice.text ?? '';
        }
        return '';
    }

    static calculateDuration(startTime: number): string {
        const endTime = performance.now();
        const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
        return durationSeconds;
    }

    static async fetchServerProps(apiUrl: string): Promise<LlamaServerProps | null> {
        try {
            const propsUrl = this.buildPropsUrl(apiUrl);
            const response = await globalThis.fetch(propsUrl, {
                signal: AbortSignal.timeout(2000)
            });
            if (response.ok) {
                return await response.json() as LlamaServerProps;
            }
        } catch { }
        return null;
    }

    static extractContextWindow(props: LlamaServerProps | null): number {
        if (!props) {
            return 0;
        }

        if (typeof props.n_ctx === 'number') {
            return props.n_ctx;
        }

        const nestedNctx = props.default_generation_settings?.n_ctx;
        return typeof nestedNctx === 'number' ? nestedNctx : 0;
    }

    static extractModelName(props: LlamaServerProps | null): string {
        if (!props) {
            return 'local';
        }

        const nestedParams = props.default_generation_settings?.params || {};
        const nestedName = [
            nestedParams['model_name'],
            nestedParams['model'],
            nestedParams['model_alias']
        ].find(value => typeof value === 'string' && value.trim().length > 0);

        const directName = [props.model_name, props.model, props.model_alias]
            .find(value => typeof value === 'string' && value.trim().length > 0);
        if (typeof directName === 'string') {
            return directName.trim();
        }

        if (typeof nestedName === 'string') {
            return nestedName.trim();
        }

        const modelPathCandidates = [
            props.model_path,
            typeof nestedParams['model_path'] === 'string' ? nestedParams['model_path'] : undefined
        ];

        const modelPath = modelPathCandidates.find(value => typeof value === 'string' && value.trim().length > 0);
        if (typeof modelPath === 'string') {
            const fileName = modelPath.split(/[\\/]/).pop() || modelPath;
            return fileName.trim();
        }

        return 'local';
    }

    static buildPropsUrl(apiUrl: string): string {
        try {
            const parsed = new URL(apiUrl);
            parsed.pathname = '/props';
            parsed.search = '';
            parsed.hash = '';
            return parsed.toString();
        } catch {
            const baseUrl = apiUrl.replace(/\/v1\/.*$/, '');
            return `${baseUrl}/props`;
        }
    }
}
