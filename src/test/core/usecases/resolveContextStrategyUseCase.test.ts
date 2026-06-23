import * as assert from 'assert';
import { ResolveContextStrategyUseCase } from '../../../core/usecases/resolveContextStrategyUseCase';

suite('ResolveContextStrategyUseCase', () => {
    const useCase = new ResolveContextStrategyUseCase();

    test('No files attached: repository scope active by default', () => {
        const result = useCase.execute([]);
        assert.strictEqual(result.hasExplicitFileContext, false);
        assert.strictEqual(result.hasRepositoryAttachment, true);
        assert.strictEqual(result.shouldUseRepositoryScope, true);
    });

    test('Only explicit files: no repository scope', () => {
        const result = useCase.execute([
            { isRepository: false },
            { isRepository: false },
        ]);
        assert.strictEqual(result.hasExplicitFileContext, true);
        assert.strictEqual(result.hasRepositoryAttachment, false);
        assert.strictEqual(result.shouldUseRepositoryScope, false);
    });

    test('Only repository attachment: repository scope active', () => {
        const result = useCase.execute([{ isRepository: true }]);
        assert.strictEqual(result.hasExplicitFileContext, false);
        assert.strictEqual(result.hasRepositoryAttachment, true);
        assert.strictEqual(result.shouldUseRepositoryScope, true);
    });

    test('Mixed: explicit files and repository attachment', () => {
        const result = useCase.execute([
            { isRepository: false },
            { isRepository: true },
        ]);
        assert.strictEqual(result.hasExplicitFileContext, true);
        assert.strictEqual(result.hasRepositoryAttachment, true);
        assert.strictEqual(result.shouldUseRepositoryScope, true);
    });

    test('File with undefined isRepository treated as explicit file', () => {
        const result = useCase.execute([{}]);
        assert.strictEqual(result.hasExplicitFileContext, true);
        assert.strictEqual(result.hasRepositoryAttachment, false);
        assert.strictEqual(result.shouldUseRepositoryScope, false);
    });
});
