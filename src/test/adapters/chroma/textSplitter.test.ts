import * as assert from 'assert';
import { getSplitterForFile } from '../../../adapters/chroma/utils/text/textSplitter';

suite('textSplitter', () => {
    test('chunks supported TypeScript files with syntax-aware offsets', async () => {
        const chunks = await getSplitterForFile(
            'example.ts',
            [
                'export class Greeter {',
                '  constructor(private readonly name: string) {}',
                '  greet(): string {',
                '    return `Hello ${this.name}`;',
                '  }',
                '}',
                '',
                'export function helper(): string {',
                '  return "ok";',
                '}'
            ].join('\n'),
            {
                targetChunkTokens: 60,
                maxChunkTokens: 80,
                minChunkTokens: 20,
                fallbackChunkTokens: 40
            }
        );

        assert.ok(chunks.length >= 1);
        assert.ok(chunks.every((chunk) => chunk.start >= 0 && chunk.end > chunk.start));
        assert.ok(chunks.every((chunk) => chunk.text.trim().length > 0));
    });

    test('falls back to manual chunking for unsupported conf files', async () => {
        const content = Array.from({ length: 40 }, (_, index) => `entry_${index}=value_${index}`).join('\n');
        const chunks = await getSplitterForFile('service.conf', content, {
            targetChunkTokens: 40,
            maxChunkTokens: 60,
            minChunkTokens: 10,
            fallbackChunkTokens: 30
        });

        assert.ok(chunks.length > 1);
        assert.ok(chunks.every((chunk) => chunk.end > chunk.start));
        assert.ok(chunks.every((chunk) => chunk.totalChunks === chunks.length));
    });
});