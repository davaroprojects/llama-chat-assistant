/**
 * Tests for memory management configuration
 */

import * as assert from 'assert';
import {
    isMemoryPruningNeeded,
    calculatePruningTarget,
    DEFAULT_MEMORY_MANAGEMENT_CONFIG
} from '../../../core/domain/memoryConfig';

suite('Memory Management Configuration', () => {
    suite('isMemoryPruningNeeded', () => {
        test('should return false when under threshold', () => {
            const needed = isMemoryPruningNeeded(5000, DEFAULT_MEMORY_MANAGEMENT_CONFIG);

            assert.strictEqual(needed, false);
        });

        test('should return true when exceeding threshold', () => {
            const needed = isMemoryPruningNeeded(7000, DEFAULT_MEMORY_MANAGEMENT_CONFIG);

            assert.strictEqual(needed, true);
        });

        test('should use config safety threshold', () => {
            const customConfig = {
                ...DEFAULT_MEMORY_MANAGEMENT_CONFIG,
                safetyThreshold: 5000
            };

            assert.strictEqual(isMemoryPruningNeeded(4999, customConfig), false);
            assert.strictEqual(isMemoryPruningNeeded(5000, customConfig), false);
        });
    });

    suite('calculatePruningTarget', () => {
        test('should return 60% of safety threshold', () => {
            const target = calculatePruningTarget(DEFAULT_MEMORY_MANAGEMENT_CONFIG);

            assert.strictEqual(target, 3900); // 60% of 6500
        });

        test('should respect custom safety thresholds', () => {
            const customConfig = {
                ...DEFAULT_MEMORY_MANAGEMENT_CONFIG,
                safetyThreshold: 10000
            };

            const target = calculatePruningTarget(customConfig);

            assert.strictEqual(target, 6000); // 60% of 10000
        });

        test('should floor the result', () => {
            const customConfig = {
                ...DEFAULT_MEMORY_MANAGEMENT_CONFIG,
                safetyThreshold: 5555
            };

            const target = calculatePruningTarget(customConfig);

            assert.strictEqual(Number.isInteger(target), true);
        });
    });

    suite('DEFAULT_MEMORY_MANAGEMENT_CONFIG', () => {
        test('should have reasonable defaults', () => {
            assert.strictEqual(DEFAULT_MEMORY_MANAGEMENT_CONFIG.contextWindowSize, 8192);
            assert.strictEqual(DEFAULT_MEMORY_MANAGEMENT_CONFIG.safetyThreshold, 6500);
            assert.strictEqual(DEFAULT_MEMORY_MANAGEMENT_CONFIG.preserveSystemPrompt, true);
            assert.strictEqual(DEFAULT_MEMORY_MANAGEMENT_CONFIG.preserveRecentMessagesCount, 2);
        });

        test('should have truncation marker defined', () => {
            assert.ok(DEFAULT_MEMORY_MANAGEMENT_CONFIG.truncationMarker.includes('[Code snippet truncated'));
        });
    });
});
