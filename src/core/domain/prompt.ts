import { RagModeTemplate, SpecificFilesModeTemplate } from './promptTemplate';
import { FileMetadata } from './sessionPayload';

export interface RagContextSnippet {
    path: string;
    content: string;
    distance?: number;
}

export interface PromptContextOptions {
    userPrompt: string;
    attachedFiles: FileMetadata[];
    ragSnippets: RagContextSnippet[];
    hasRepositoryAttachment?: boolean;
    ragModeTemplate?: RagModeTemplate;
    specificFilesModeTemplate?: SpecificFilesModeTemplate;
}
