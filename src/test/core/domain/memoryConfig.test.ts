/**
 * Tests for memory management configuration
 */

import {
    isMemoryPruningNeeded,
    calculatePruningTarget,
    DEFAULT_MEMORY_MANAGEMENT_CONFIG
} from '../../../core/domain/memoryConfig';

describe('Memory Management Configuration', () => {
    describe('isMemoryPruningNeeded', () => {
        it('should return false when under threshold', () => {
            const needed = isMemoryPruningNeeded(5000, DEFAULT_MEMORY_MANAGEMENT_CONFIG);

            expect(needed).toBe(false);
        });

        it('should return true when exceeding threshold', () => {
            const needed = isMemoryPruningNeeded(7000, DEFAULT_MEMORY_MANAGEMENT_CONFIG);

            expect(needed).toBe(true);
        });

        it('should use config safety threshold', () => {
            const customConfig = {
                ...DEFAULT_MEMORY_MANAGEMENT_CONFIG,
                safetyThreshold: 5000
            };

            expect(isMemoryPruningNeeded(4999, customConfig)).toBe(false);
            expect(isMemoryPruningNeeded(5000, customConfig)).toBe(true);
        });
    });

    describe('calculatePruningTarget', () => {
        it('should return 60% of safety threshold', () => {
            const target = calculatePruningTarget(DEFAULT_MEMORY_MANAGEMENT_CONFIG);

            expect(target).toBe(3900); // 60% of 6500
        });

        it('should respect custom safety thresholds', () => {
            const customConfig = {
                ...DEFAULT_MEMORY_MANAGEMENT_CONFIG,
                safetyThreshold: 10000
            };

            const target = calculatePruningTarget(customConfig);

            expect(target).toBe(6000); // 60% of 10000
        });

        it('should floor the result', () => {
            const customConfig = {
                ...DEFAULT_MEMORY_MANAGEMENT_CONFIG,
                safetyThreshold: 5555
            };

            const target = calculatePruningTarget(customConfig);

            expect(Number.isInteger(target)).toBe(true);
        });
    });

    describe('DEFAULT_MEMORY_MANAGEMENT_CONFIG', () => {
        it('should have reasonable defaults', () => {
            expect(DEFAULT_MEMORY_MANAGEMENT_CONFIG.contextWindowSize).toBe(8192);
            expect(DEFAULT_MEMORY_MANAGEMENT_CONFIG.safetyThreshold).toBe(6500);
            expect(DEFAULT_MEMORY_MANAGEMENT_CONFIG.preserveSystemPrompt).toBe(true);
            expect(DEFAULT_MEMORY_MANAGEMENT_CONFIG.preserveRecentMessagesCount).toBe(2);
        });

        it('should have truncation marker defined', () => {
            expect(DEFAULT_MEMORY_MANAGEMENT_CONFIG.truncationMarker).toContain('[Code snippet truncated');
        });
    });
});
