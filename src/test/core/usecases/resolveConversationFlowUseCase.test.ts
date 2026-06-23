import * as assert from 'assert';
import { ResolveConversationFlowUseCase } from '../../../core/usecases/resolveConversationFlowUseCase';
import { ConversationFlowType } from '../../../core/model/conversationFlow';

suite('ResolveConversationFlowUseCase', () => {
    const useCase = new ResolveConversationFlowUseCase();

    test('selects direct LLM for generic query without RAG and without code', () => {
        const result = useCase.execute([], false);
        assert.strictEqual(result.type, ConversationFlowType.DIRECT_LLM);
    });

    test('selects global ReAct for generic query with RAG and without code', () => {
        const result = useCase.execute([], true);
        assert.strictEqual(result.type, ConversationFlowType.GLOBAL_REACT_AGENT);
    });

    test('selects local analysis for explicit code without RAG', () => {
        const result = useCase.execute([{ name: 'app.ts', content: 'const x = 1;', isRepository: false }], false);
        assert.strictEqual(result.type, ConversationFlowType.LOCAL_RAG);
    });

    test('selects deep ReAct for explicit code with RAG', () => {
        const result = useCase.execute([{ name: 'app.ts', content: 'const x = 1;', isRepository: false }], true);
        assert.strictEqual(result.type, ConversationFlowType.DEEP_REACT_AGENT);
    });
});
