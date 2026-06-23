import { ChromaClient } from 'chromadb';
import { ChromaQueryLogger } from '../../../../core/model/chroma';

export async function cleanupEphemeralCollections(client: ChromaClient, collectionPrefix: string, logger?: ChromaQueryLogger): Promise<void> {
    try {
        const collections = await client.listCollections({ limit: 500, offset: 0 });
        for (const collection of collections) {
            if (collection.name.startsWith(collectionPrefix)) {
                try {
                    await client.deleteCollection({ name: collection.name });
                    logger?.info('rag', 'Deleted ephemeral collection', { name: collection.name });
                } catch (err) {
                    logger?.warn('rag', 'Failed to delete ephemeral collection', { name: collection.name, error: String(err) });
                }
            }
        }
    } catch (err) {
        logger?.warn('rag', 'Failed to list collections during cleanup', { error: String(err) });
    }
}

export async function getLatestEphemeralCollectionName(client: ChromaClient, collectionPrefix: string): Promise<string | null> {
    const collections = await client.listCollections({ limit: 500, offset: 0 });
    const ephemeralCollectionNames = collections
        .map((collection) => collection.name)
        .filter((name) => name.startsWith(`${collectionPrefix}-`));

    if (ephemeralCollectionNames.length === 0) {
        return null;
    }

    ephemeralCollectionNames.sort((a, b) => {
        const aStamp = Number(a.slice(collectionPrefix.length + 1));
        const bStamp = Number(b.slice(collectionPrefix.length + 1));
        return bStamp - aStamp;
    });

    return ephemeralCollectionNames[0] || null;
}
