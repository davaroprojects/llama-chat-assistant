/**
 * Tests for token count domain model
 */

import {
    calculateSafetyThreshold,
    isTokenCountExceeded,
    DEFAULT_TOKEN_COUNT_CONFIGURATION
} from '../../../core/domain/tokenCount';

describe('Token Count Domain Model', () => {
    describe('calculateSafetyThreshold', () => {
        it('should calculate 80% of context window by default', () => {
            const contextLimit = 8192;
            const threshold = calculateSafetyThreshold(contextLimit);

            expect(threshold).toBe(6553); // 80% of 8192
        });

        it('should apply custom safety margin', () => {
            const contextLimit = 8192;
            const margin = 0.75;
            const threshold = calculateSafetyThreshold(contextLimit, margin);

            expect(threshold).toBe(6144); // 75% of 8192
        });

        it('should handle small context windows', () => {
            const contextLimit = 1000;
            const threshold = calculateSafetyThreshold(contextLimit);

            expect(threshold).toBe(800); // 80% of 1000
        });

        it('should handle very large context windows', () => {
            const contextLimit = 128000;
            const threshold = calculateSafetyThreshold(contextLimit);

            expect(threshold).toBe(102400); // 80% of 128000
        });

        it('should floor the result', () => {
            const contextLimit = 1000;
            const threshold = calculateSafetyThreshold(contextLimit, 0.777);

            expect(Number.isInteger(threshold)).toBe(true);
        });
    });

    describe('isTokenCountExceeded', () => {
        it('should return false when under threshold', () => {
            const exceeded = isTokenCountExceeded(5000, 6500);

            expect(exceeded).toBe(false);
        });

        it('should return true when exceeding threshold', () => {
            const exceeded = isTokenCountExceeded(7000, 6500);

            expect(exceeded).toBe(true);
        });

        it('should return true when equal to threshold', () => {
            const exceeded = isTokenCountExceeded(6500, 6500);

            expect(exceeded).toBe(true);
        });

        it('should handle zero tokens', () => {
            const exceeded = isTokenCountExceeded(0, 6500);

            expect(exceeded).toBe(false);
        });

        it('should handle zero threshold', () => {
            const exceeded = isTokenCountExceeded(100, 0);

            expect(exceeded).toBe(true);
        });
    });

    describe('DEFAULT_TOKEN_COUNT_CONFIGURATION', () => {
        it('should use cl100k_base encoding model', () => {
            expect(DEFAULT_TOKEN_COUNT_CONFIGURATION.encodingModel).toBe('cl100k_base');
        });
    });
});
