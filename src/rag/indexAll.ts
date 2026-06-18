export interface RagIndexResult {
    status: 'indexed';
    indexedAt: number;
    indexedFiles: number;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function indexAll(): Promise<RagIndexResult> {
    const indexedAt = Date.now();
    await sleep(5000);

    return {
        status: 'indexed',
        indexedAt,
        indexedFiles: 0
    };
}
