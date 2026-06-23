export interface ContextAttachmentInput {
    isRepository?: boolean;
}

export interface ContextStrategyResult {
    hasExplicitFileContext: boolean;
    hasRepositoryAttachment: boolean;
    shouldUseRepositoryScope: boolean;
}

export class ResolveContextStrategyUseCase {
    execute(attachedFiles: ContextAttachmentInput[]): ContextStrategyResult {
        const hasExplicitFileContext = attachedFiles.some((file) => !file.isRepository);
        const hasRepositoryAttachment = attachedFiles.some((file) => !!file.isRepository) || !hasExplicitFileContext;
        const shouldUseRepositoryScope = hasRepositoryAttachment || !hasExplicitFileContext;

        return {
            hasExplicitFileContext,
            hasRepositoryAttachment,
            shouldUseRepositoryScope
        };
    }
}
