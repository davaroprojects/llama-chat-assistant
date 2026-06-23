import * as assert from 'assert';
import { buildPromptContext } from '../../helpers/promptContextBuilder';
import { DEFAULT_RAG_MODE_TEMPLATE, DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE } from '../../core/model/promptTemplate';
import type { PromptContextOptions } from '../../core/model/prompt';

const RAG_SNIPPET = {
    path: 'src/services/userService.ts',
    content: 'export class UserService { getUser() {} }',
    distance: 0.1234,
};

const ATTACHED_FILE = {
    name: 'config.json',
    content: '{"key": "value"}',
    isAutomatic: false,
};

suite('buildPromptContext - RAG mode', () => {
    test('Includes executionMode header in RAG output', () => {
        const options: PromptContextOptions = {
            userPrompt: 'How does UserService work?',
            ragSnippets: [RAG_SNIPPET],
            attachedFiles: [],
            hasRepositoryAttachment: true,
        };
        const result = buildPromptContext(options);
        assert.ok(result.includes(DEFAULT_RAG_MODE_TEMPLATE.executionMode.header));
    });

    test('Includes retrieved context header and footer in RAG output', () => {
        const options: PromptContextOptions = {
            userPrompt: 'explain this',
            ragSnippets: [RAG_SNIPPET],
            attachedFiles: [],
            hasRepositoryAttachment: true,
        };
        const result = buildPromptContext(options);
        assert.ok(result.includes(DEFAULT_RAG_MODE_TEMPLATE.retrievedContext.header));
        assert.ok(result.includes(DEFAULT_RAG_MODE_TEMPLATE.retrievedContext.footer));
    });

    test('Includes snippet path and content in RAG output', () => {
        const options: PromptContextOptions = {
            userPrompt: 'test',
            ragSnippets: [RAG_SNIPPET],
            attachedFiles: [],
            hasRepositoryAttachment: true,
        };
        const result = buildPromptContext(options);
        assert.ok(result.includes('src/services/userService.ts'));
        assert.ok(result.includes('UserService'));
    });

    test('Includes user prompt at the end', () => {
        const options: PromptContextOptions = {
            userPrompt: 'What does UserService do?',
            ragSnippets: [RAG_SNIPPET],
            attachedFiles: [],
            hasRepositoryAttachment: true,
        };
        const result = buildPromptContext(options);
        assert.ok(result.includes('What does UserService do?'));
    });

    test('Falls back to specific files mode when RAG snippets are empty', () => {
        const options: PromptContextOptions = {
            userPrompt: 'test',
            ragSnippets: [],
            attachedFiles: [ATTACHED_FILE],
            hasRepositoryAttachment: true,
        };
        const result = buildPromptContext(options);
        assert.ok(result.includes(DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE.executionMode.header));
    });

    test('Uses custom RAG template when provided', () => {
        const customTemplate = {
            ...DEFAULT_RAG_MODE_TEMPLATE,
            retrievedContext: {
                ...DEFAULT_RAG_MODE_TEMPLATE.retrievedContext,
                header: '<custom_ctx>',
                footer: '</custom_ctx>',
            }
        };
        const options: PromptContextOptions = {
            userPrompt: 'test',
            ragSnippets: [RAG_SNIPPET],
            attachedFiles: [],
            hasRepositoryAttachment: true,
            ragModeTemplate: customTemplate,
        };
        const result = buildPromptContext(options);
        assert.ok(result.includes('<custom_ctx>'));
        assert.ok(result.includes('</custom_ctx>'));
    });
});

suite('buildPromptContext - Specific files mode', () => {
    test('Uses specific files mode when hasRepositoryAttachment is false', () => {
        const options: PromptContextOptions = {
            userPrompt: 'Review this file',
            ragSnippets: [],
            attachedFiles: [ATTACHED_FILE],
            hasRepositoryAttachment: false,
        };
        const result = buildPromptContext(options);
        assert.ok(result.includes(DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE.executionMode.header));
    });

    test('Includes attached file name and content', () => {
        const options: PromptContextOptions = {
            userPrompt: 'analyze',
            ragSnippets: [],
            attachedFiles: [ATTACHED_FILE],
            hasRepositoryAttachment: false,
        };
        const result = buildPromptContext(options);
        assert.ok(result.includes('config.json'));
        assert.ok(result.includes('"key": "value"'));
    });

    test('Excludes repository attachments from specific files context', () => {
        const repoFile = { name: 'repo', content: 'repo content', isAutomatic: true };
        const options: PromptContextOptions = {
            userPrompt: 'test',
            ragSnippets: [],
            attachedFiles: [repoFile, ATTACHED_FILE],
            hasRepositoryAttachment: false,
        };
        const result = buildPromptContext(options);
        assert.ok(!result.includes('repo content'));
        assert.ok(result.includes('"key": "value"'));
    });

    test('Escapes XML special characters in file content', () => {
        const fileWithXml = { name: 'file.ts', content: '<Tag attr="val" />', isAutomatic: false };
        const options: PromptContextOptions = {
            userPrompt: 'test',
            ragSnippets: [],
            attachedFiles: [fileWithXml],
            hasRepositoryAttachment: false,
        };
        const result = buildPromptContext(options);
        assert.ok(!result.includes('<Tag attr="val" />'));
        assert.ok(result.includes('&lt;Tag'));
        assert.ok(result.includes('&quot;val&quot;'));
    });

    test('Includes user prompt in specific files mode output', () => {
        const options: PromptContextOptions = {
            userPrompt: 'What does this config do?',
            ragSnippets: [],
            attachedFiles: [ATTACHED_FILE],
            hasRepositoryAttachment: false,
        };
        const result = buildPromptContext(options);
        assert.ok(result.includes('What does this config do?'));
    });

    test('Classifies json files as configuration type', () => {
        const options: PromptContextOptions = {
            userPrompt: 'test',
            ragSnippets: [],
            attachedFiles: [ATTACHED_FILE],
            hasRepositoryAttachment: false,
        };
        const result = buildPromptContext(options);
        assert.ok(result.includes('configuration'));
    });

    test('Classifies ts files as source_code type', () => {
        const tsFile = { name: 'app.ts', content: 'const x = 1;', isAutomatic: false };
        const options: PromptContextOptions = {
            userPrompt: 'test',
            ragSnippets: [],
            attachedFiles: [tsFile],
            hasRepositoryAttachment: false,
        };
        const result = buildPromptContext(options);
        assert.ok(result.includes('source_code'));
    });
});

suite('buildPromptContext - sanitization', () => {
    test('Strips null bytes from content', () => {
        const fileWithNull = { name: 'file.ts', content: 'hello\u0000world', isAutomatic: false };
        const options: PromptContextOptions = {
            userPrompt: 'test',
            ragSnippets: [],
            attachedFiles: [fileWithNull],
            hasRepositoryAttachment: false,
        };
        const result = buildPromptContext(options);
        assert.ok(!result.includes('\u0000'));
        assert.ok(result.includes('helloworld'));
    });

    test('Truncates content exceeding max chars', () => {
        const longContent = 'a'.repeat(10_000);
        const options: PromptContextOptions = {
            userPrompt: 'test',
            ragSnippets: [{ path: 'big.ts', content: longContent, distance: 0.1 }],
            attachedFiles: [],
            hasRepositoryAttachment: true,
        };
        const result = buildPromptContext(options);
        assert.ok(result.includes('[truncated]'));
    });
});
