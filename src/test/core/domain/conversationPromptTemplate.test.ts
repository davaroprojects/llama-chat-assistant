import * as assert from 'assert';
import {
    DEFAULT_DEEP_REACT_TEMPLATE,
    DEFAULT_DIRECT_LLM_TEMPLATE,
    DEFAULT_GLOBAL_REACT_TEMPLATE,
    DEFAULT_LOCAL_RAG_TEMPLATE,
    interpolateConversationPrompt,
    normalizeConversationPromptTemplate
} from '../../../core/model/conversationPromptTemplate';

suite('conversationPromptTemplate', () => {
    test('returns defaults when template is undefined', () => {
        const result = normalizeConversationPromptTemplate(undefined, DEFAULT_DIRECT_LLM_TEMPLATE);
        assert.deepStrictEqual(result, DEFAULT_DIRECT_LLM_TEMPLATE);
    });

    test('merges modern keys', () => {
        const result = normalizeConversationPromptTemplate({ systemPrompt: 'sys', userPrompt: 'usr' }, DEFAULT_DIRECT_LLM_TEMPLATE);
        assert.strictEqual(result.systemPrompt, 'sys');
        assert.strictEqual(result.userPrompt, 'usr');
    });

    test('merges legacy keys', () => {
        const result = normalizeConversationPromptTemplate({ system: 'legacy sys', user: 'legacy user' }, DEFAULT_DIRECT_LLM_TEMPLATE);
        assert.strictEqual(result.systemPrompt, 'legacy sys');
        assert.strictEqual(result.userPrompt, 'legacy user');
    });

    test('interpolates query and target files placeholders', () => {
        const result = interpolateConversationPrompt(DEFAULT_DEEP_REACT_TEMPLATE.userPrompt, {
            userQuery: 'Where is this handled?',
            targetFiles: 'File: foo.ts'
        });
        assert.ok(result.includes('Where is this handled?'));
        assert.ok(result.includes('File: foo.ts'));
    });

    test('default templates keep expected scopes', () => {
        assert.ok(DEFAULT_GLOBAL_REACT_TEMPLATE.userPrompt.includes('Global Project Analysis'));
        assert.ok(DEFAULT_LOCAL_RAG_TEMPLATE.userPrompt.includes('RAG: Disabled'));
    });
});
