import * as assert from 'assert';
import { classifyUserIntent, QueryIntentType } from '../chat/queryIntentClassifier';

suite('QueryIntentClassifier - classifyUserIntent', () => {
    test('Classifies endpoint question as STRUCTURED_FOCUSED', () => {
        const intent = classifyUserIntent('What flow does /api/users follow on GET?');
        assert.strictEqual(intent, QueryIntentType.STRUCTURED_FOCUSED);
    });

    test('Classifies conceptual question as OPEN_CONCEPTUAL', () => {
        const intent = classifyUserIntent('Explain how the module architecture works');
        assert.strictEqual(intent, QueryIntentType.OPEN_CONCEPTUAL);
    });

    test('Uses OPEN_CONCEPTUAL as fallback', () => {
        const intent = classifyUserIntent('hello');
        assert.strictEqual(intent, QueryIntentType.OPEN_CONCEPTUAL);
    });
});
