import * as assert from 'assert';
import {
    DEFAULT_RAG_MODE_TEMPLATE,
    DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE,
    normalizeRagModeTemplate,
    normalizeSpecificFilesModeTemplate,
    interpolateRagFragment,
    interpolateSpecificFile,
    interpolateQueryLabel,
    interpolateConsulta,
    PromptTemplateBuilder,
} from '../../../core/model/promptTemplate';

suite('promptTemplate - normalizeRagModeTemplate', () => {
    test('Returns defaults when template is undefined', () => {
        const result = normalizeRagModeTemplate(undefined);
        assert.deepStrictEqual(result, DEFAULT_RAG_MODE_TEMPLATE);
    });

    test('Overrides specific fields with modern keys', () => {
        const result = normalizeRagModeTemplate({
            executionMode: { header: '<custom_header>', scope: DEFAULT_RAG_MODE_TEMPLATE.executionMode.scope, instruction: DEFAULT_RAG_MODE_TEMPLATE.executionMode.instruction }
        });
        assert.strictEqual(result.executionMode.header, '<custom_header>');
        assert.strictEqual(result.executionMode.scope, DEFAULT_RAG_MODE_TEMPLATE.executionMode.scope);
        assert.strictEqual(result.executionMode.instruction, DEFAULT_RAG_MODE_TEMPLATE.executionMode.instruction);
    });

    test('Maps legacy modoEjecucion keys to executionMode', () => {
        const result = normalizeRagModeTemplate({
            modoEjecucion: {
                header: '<legacy_header>',
                alcance: 'legacy scope',
                instruccion: 'legacy instruction'
            }
        });
        assert.strictEqual(result.executionMode.header, '<legacy_header>');
        assert.strictEqual(result.executionMode.scope, 'legacy scope');
        assert.strictEqual(result.executionMode.instruction, 'legacy instruction');
    });

    test('Maps legacy contextoRecuperado keys', () => {
        const result = normalizeRagModeTemplate({
            contextoRecuperado: {
                header: '<ctx>',
                footer: '</ctx>',
                fragmentoFormat: 'frag {index}'
            }
        });
        assert.strictEqual(result.retrievedContext.header, '<ctx>');
        assert.strictEqual(result.retrievedContext.footer, '</ctx>');
        assert.strictEqual(result.retrievedContext.fragmentFormat, 'frag {index}');
    });

    test('Merges query.label override', () => {
        const result = normalizeRagModeTemplate({
            query: { label: 'Custom: {prompt}' }
        });
        assert.strictEqual(result.query.label, 'Custom: {prompt}');
    });

    test('Returns custom defaults when provided', () => {
        const customDefault = {
            ...DEFAULT_RAG_MODE_TEMPLATE,
            executionMode: { ...DEFAULT_RAG_MODE_TEMPLATE.executionMode, header: '<custom>' }
        };
        const result = normalizeRagModeTemplate(undefined, customDefault);
        assert.strictEqual(result.executionMode.header, '<custom>');
    });
});

suite('promptTemplate - normalizeSpecificFilesModeTemplate', () => {
    test('Returns defaults when template is undefined', () => {
        const result = normalizeSpecificFilesModeTemplate(undefined);
        assert.deepStrictEqual(result, DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE);
    });

    test('Overrides targetFiles fields', () => {
        const result = normalizeSpecificFilesModeTemplate({
            targetFiles: { header: '<files>', footer: '</files>', fileFormat: DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE.targetFiles.fileFormat }
        });
        assert.strictEqual(result.targetFiles.header, '<files>');
        assert.strictEqual(result.targetFiles.footer, '</files>');
        assert.strictEqual(result.targetFiles.fileFormat, DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE.targetFiles.fileFormat);
    });

    test('Maps legacy archivosObjetivo keys', () => {
        const result = normalizeSpecificFilesModeTemplate({
            archivosObjetivo: {
                header: '<arch>',
                footer: '</arch>',
                archivoFormat: 'File: {name}'
            }
        });
        assert.strictEqual(result.targetFiles.header, '<arch>');
        assert.strictEqual(result.targetFiles.footer, '</arch>');
        assert.strictEqual(result.targetFiles.fileFormat, 'File: {name}');
    });

    test('Maps legacy modoEjecucion keys', () => {
        const result = normalizeSpecificFilesModeTemplate({
            modoEjecucion: {
                header: '<exec>',
                alcance: 'specific scope',
                instruccion: 'specific instruction'
            }
        });
        assert.strictEqual(result.executionMode.header, '<exec>');
        assert.strictEqual(result.executionMode.scope, 'specific scope');
        assert.strictEqual(result.executionMode.instruction, 'specific instruction');
    });
});

suite('promptTemplate - interpolateRagFragment', () => {
    test('Replaces all placeholders', () => {
        const template = 'Fragment {index} | Source: {path}{distance}\n```\n{content}\n```';
        const result = interpolateRagFragment(template, 1, 'src/foo.ts', ' distance=0.1234', 'const x = 1;');
        assert.strictEqual(result, 'Fragment 1 | Source: src/foo.ts distance=0.1234\n```\nconst x = 1;\n```');
    });

    test('Handles empty distance', () => {
        const template = '{index}: {path}{distance} - {content}';
        const result = interpolateRagFragment(template, 2, 'bar.ts', '', 'code here');
        assert.strictEqual(result, '2: bar.ts - code here');
    });
});

suite('promptTemplate - interpolateSpecificFile', () => {
    test('Replaces all placeholders', () => {
        const template = 'File: {name}\nType: {type}\nExt: {extension}\n{content}';
        const result = interpolateSpecificFile(template, 'index.ts', 'source_code', '.ts', 'export default 1;');
        assert.strictEqual(result, 'File: index.ts\nType: source_code\nExt: .ts\nexport default 1;');
    });
});

suite('promptTemplate - interpolateQueryLabel / interpolateConsulta', () => {
    test('Replaces {prompt} placeholder', () => {
        const result = interpolateQueryLabel('User Query: {prompt}', 'How does X work?');
        assert.strictEqual(result, 'User Query: How does X work?');
    });

    test('interpolateConsulta replaces {prompt}', () => {
        const result = interpolateConsulta('Consulta: {prompt}', 'qué hace foo?');
        assert.strictEqual(result, 'Consulta: qué hace foo?');
    });

    test('Returns template unchanged when no placeholder', () => {
        const result = interpolateQueryLabel('No placeholder here', 'anything');
        assert.strictEqual(result, 'No placeholder here');
    });
});

suite('PromptTemplateBuilder', () => {
    test('buildRagModeExecution uses default template fields', () => {
        const result = PromptTemplateBuilder.buildRagModeExecution();
        assert.ok(result.includes(DEFAULT_RAG_MODE_TEMPLATE.executionMode.header));
        assert.ok(result.includes(DEFAULT_RAG_MODE_TEMPLATE.executionMode.scope));
        assert.ok(result.includes(DEFAULT_RAG_MODE_TEMPLATE.executionMode.instruction));
        assert.ok(result.includes('</modo_ejecucion>'));
    });

    test('buildRagModeExecution accepts custom template', () => {
        const custom = {
            ...DEFAULT_RAG_MODE_TEMPLATE,
            executionMode: {
                header: '<custom_exec>',
                scope: 'Custom scope',
                instruction: 'Custom instruction'
            }
        };
        const result = PromptTemplateBuilder.buildRagModeExecution(custom);
        assert.ok(result.includes('<custom_exec>'));
        assert.ok(result.includes('Custom scope'));
        assert.ok(result.includes('Custom instruction'));
    });

    test('buildSpecificFilesModeExecution uses default template fields', () => {
        const result = PromptTemplateBuilder.buildSpecificFilesModeExecution();
        assert.ok(result.includes(DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE.executionMode.header));
        assert.ok(result.includes(DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE.executionMode.scope));
        assert.ok(result.includes(DEFAULT_SPECIFIC_FILES_MODE_TEMPLATE.executionMode.instruction));
        assert.ok(result.includes('</modo_ejecucion>'));
    });
});
