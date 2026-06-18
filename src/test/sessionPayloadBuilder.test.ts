import * as assert from 'assert';
import { SessionPayloadBuilder } from '../chat/sessionPayloadBuilder';

suite('SessionPayloadBuilder', () => {
    test('Deduplicates exact duplicated file attachments', () => {
        const files = SessionPayloadBuilder.collectFilesMetadata([
            { name: 'a.ts', content: 'const a = 1;', isAutomatic: true },
            { name: 'a.ts', content: 'const a = 1;', isAutomatic: true },
            { name: 'a.ts', content: 'const a = 2;', isAutomatic: true }
        ]);

        assert.strictEqual(files.length, 2);
        assert.deepStrictEqual(files[0], { name: 'a.ts', content: 'const a = 1;', isAutomatic: true });
        assert.deepStrictEqual(files[1], { name: 'a.ts', content: 'const a = 2;', isAutomatic: true });
    });

    test('Builds prompt with neutral attachment labels', () => {
        const prompt = SessionPayloadBuilder.buildLlamaContextPrompt('haz cambios', [
            { name: 'main.ts:8-10', content: 'const x = 1;', isAutomatic: true },
            { name: 'utils.ts', content: 'export const y = 2;', isAutomatic: false }
        ]);

        assert.ok(prompt.includes('--- ARCHIVO ADJUNTO: main.ts:8-10 ---'));
        assert.ok(prompt.includes('--- ARCHIVO ADJUNTO: utils.ts ---'));
        assert.ok(!prompt.includes('MANUAL'));
    });
});
