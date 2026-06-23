/**
 * Tests for token count domain model
 */

import * as assert from 'assert';
import {
    calculateSafetyThreshold,
    isTokenCountExceeded,
    DEFAULT_TOKEN_COUNT_CONFIGURATION
} from '../../../core/domain/tokenCount';

suite('Token Count Domain Model', () => {
    suite('calculateSafetyThreshold', () => {
        test('should calculate 80% of context window by default', () => {
            const contextLimit = 8192;
            const threshold = calculateSafetyThreshold(contextLimit);

            assert.strictEqual(threshold, 6553); // 80% of 8192
        });

        test('should apply custom safety margin', () => {
            const contextLimit = 8192;
            const margin = 0.75;
            const threshold = calculateSafetyThreshold(contextLimit, margin);

            assert.strictEqual(threshold, 6144); // 75% of 8192
        });

        test('should handle small context windows', () => {
            const contextLimit = 1000;
            const threshold = calculateSafetyThreshold(contextLimit);

            assert.strictEqual(threshold, 800); // 80% of 1000
        });

        test('should handle very large context windows', () => {
            const contextLimit = 128000;
            const threshold = calculateSafetyThreshold(contextLimit);

            assert.strictEqual(threshold, 102400); // 80% of 128000
        });

        test('should floor the result', () => {
            const contextLimit = 1000;
            const threshold = calculateSafetyThreshold(contextLimit, 0.777);

            assert.strictEqual(Number.isInteger(threshold), true);
        });
    });

    suite('isTokenCountExceeded', () => {
        test('should return false when under threshold', () => {
            const exceeded = isTokenCountExceeded(5000, 6500);

            assert.strictEqual(exceeded, false);
        });

        test('should return true when exceeding threshold', () => {
            const exceeded = isTokenCountExceeded(7000, 6500);

            assert.strictEqual(exceeded, true);
        });

        test('should return false when equal to threshold', () => {
            const exceeded = isTokenCountExceeded(6500, 6500);

            assert.strictEqual(exceeded, false);
        });

        test('should handle zero tokens', () => {
            const exceeded = isTokenCountExceeded(0, 6500);

            assert.strictEqual(exceeded, false);
        });

        test('should handle zero threshold', () => {
            const exceeded = isTokenCountExceeded(100, 0);

            assert.strictEqual(exceeded, true);
        });
    });

    suite('DEFAULT_TOKEN_COUNT_CONFIGURATION', () => {
        test('should use cl100k_base encoding model', () => {
            assert.strictEqual(DEFAULT_TOKEN_COUNT_CONFIGURATION.encodingModel, 'cl100k_base');
        });
    });
});
