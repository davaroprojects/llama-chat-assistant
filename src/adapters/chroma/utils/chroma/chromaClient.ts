import { ChromaClient } from 'chromadb';
import { ChromaDbConnectionConfig } from '../../../../core/model/chroma';

export function getClient(config: ChromaDbConnectionConfig, signal?: AbortSignal): ChromaClient {
    const parsedUrl = new URL(config.url);
    return new ChromaClient({
        host: parsedUrl.hostname,
        port: config.port,
        ssl: parsedUrl.protocol === 'https:',
        fetchOptions: signal ? ({ signal } as any) : undefined
    } as any);
}
