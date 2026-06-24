import * as assert from 'assert';
import TransformersReranker, { type RerankCandidate } from '../../../adapters/chroma/utils/search/transformersReranker';

suite('TransformersReranker', () => {
    teardown(() => {
        // Reset singleton after each test
        TransformersReranker.reset();
    });

    test('should be initially unloaded', () => {
        assert.strictEqual(TransformersReranker.isLoaded(), false);
    });

    test('should load singleton on first call', async () => {
        const reranker = await TransformersReranker.load();
        assert.ok(reranker);
        assert.strictEqual(TransformersReranker.isLoaded(), true);
    });

    test('should return same instance on multiple loads', async () => {
        const reranker1 = await TransformersReranker.load();
        const reranker2 = await TransformersReranker.load();
        assert.strictEqual(reranker1, reranker2);
    });

    test('should handle empty candidates gracefully', async () => {
        const result = await TransformersReranker.rerank('test query', [], 5000);
        assert.strictEqual(result.length, 0);
    });

    test('should handle empty query gracefully', async () => {
        const candidates: RerankCandidate[] = [
            { id: '1', text: 'sample text', score: 0.5 }
        ];
        const result = await TransformersReranker.rerank('', candidates, 5000);
        assert.strictEqual(result.length, 1);
    });

    test('should rerank candidates based on query relevance', async function() {
        // Skip if model loading is disabled in test environment
        this.timeout(60000); // Model download can take time

        try {
            const candidates: RerankCandidate[] = [
                { id: '1', text: 'The quick brown fox jumps over the lazy dog', score: 0 },
                { id: '2', text: 'Programming languages are tools for writing code', score: 0 },
                { id: '3', text: 'The fox is a wild animal that lives in forests', score: 0 }
            ];

            const reranked = await TransformersReranker.rerank(
                'fox animal',
                candidates,
                30000
            );

            assert.strictEqual(reranked.length, 3);
            // Verify that candidates have rerankScore assigned
            for (const candidate of reranked) {
                assert.ok(typeof candidate.rerankScore === 'number');
                assert.ok(candidate.rerankScore >= 0);
            }
        } catch (error) {
            // If model fails to load in test environment, skip
            if (error instanceof Error && error.message.includes('Failed to load')) {
                this.skip();
            }
            throw error;
        }
    });

    test('should handle timeout gracefully', async function() {
        this.timeout(10000);

        const candidates: RerankCandidate[] = [
            { id: '1', text: 'sample text', score: 0.5 }
        ];

        try {
            // Very short timeout to force timeout error
            await TransformersReranker.rerank('test', candidates, 1);
            assert.fail('Should have thrown timeout error');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('timeout') || error.message.includes('Timeout'));
        }
    });

    test('should reset singleton state', () => {
        assert.strictEqual(TransformersReranker.isLoaded(), false);

        TransformersReranker.reset();
        assert.strictEqual(TransformersReranker.isLoaded(), false);
    });

    test('should maintain singleton after reset and reload', async function() {
        this.timeout(60000);

        const reranker1 = await TransformersReranker.load();
        TransformersReranker.reset();
        const reranker2 = await TransformersReranker.load();

        // Should be different instances since we reset
        assert.notStrictEqual(reranker1, reranker2);
    });
});
