import * as assert from 'assert';
import { SessionPayloadBuilder } from '../../helpers/sessionPayloadBuilder';

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

    test('Preserves repository metadata in deduplicated attachments', () => {
        const files = SessionPayloadBuilder.collectFilesMetadata([
            { name: 'Repository', content: 'repo-index', isAutomatic: false, isRepository: true }
        ]);

        assert.strictEqual(files.length, 1);
        assert.strictEqual(files[0].isRepository, true);
    });
});

