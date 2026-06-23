import { ChromaClient } from 'chromadb';
import { ChromaQueryLogger } from '../../../../core/model/chroma';

export async function collectionExists(client: ChromaClient, collectionName: string): Promise<boolean> {
    try {
        await client.getCollection({ name: collectionName } as any);
        return true;
    } catch {
        return false;
    }
}

export async function clearCollection(client: ChromaClient, collectionName: string, logger?: ChromaQueryLogger): Promise<void> {
    try {
        await client.deleteCollection({ name: collectionName });
        logger?.info('rag', 'Deleted existing Chroma collection before reindex', { name: collectionName });
    } catch (err) {
        logger?.warn('rag', 'Failed to delete existing Chroma collection before reindex', {
            name: collectionName,
            error: String(err)
        });
        throw err;
    }
}
