import * as assert from 'assert';
import { SessionPayloadBuilder } from '../chat/sessionPayloadBuilder';

suite('SessionPayloadBuilder', () => {
    test('Deduplicates file attachments by name, last occurrence wins', () => {
        const files = SessionPayloadBuilder.collectFilesMetadata([
            { name: 'a.ts', content: 'const a = 1;', isAutomatic: true },
            { name: 'b.ts', content: 'const b = 1;', isAutomatic: false },
            { name: 'a.ts', content: 'const a = 2;', isAutomatic: true }  // same name, newer content
        ]);

        assert.strictEqual(files.length, 2);
        // a.ts: last occurrence wins
        const aFile = files.find(f => f.name === 'a.ts');
        assert.strictEqual(aFile?.content, 'const a = 2;');
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

