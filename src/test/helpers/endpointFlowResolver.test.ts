import * as assert from 'assert';
import { searchFlowByEndpoint } from '../../helpers/endpointFlowResolver';
import { WorkspaceGraph } from '../../core/model/workspace';

suite('EndpointFlowResolver - searchFlowByEndpoint', () => {
    test('Returns DFS flow from matching trigger', () => {
        const graph: WorkspaceGraph = {
            'src/controllers/usersController.ts': {
                type: 'controller',
                triggers: ['/api/users'],
                calls: ['src/services/usersService.ts']
            },
            'src/services/usersService.ts': {
                type: 'service',
                triggers: [],
                calls: ['src/repositories/usersRepository.ts']
            },
            'src/repositories/usersRepository.ts': {
                type: 'repository',
                triggers: [],
                calls: []
            }
        };

        const flow = searchFlowByEndpoint(graph, '/api/users');
        assert.deepStrictEqual(flow, [
            'src/controllers/usersController.ts',
            'src/services/usersService.ts',
            'src/repositories/usersRepository.ts'
        ]);
    });

    test('Returns empty when endpoint is not found', () => {
        const graph: WorkspaceGraph = {
            'src/controllers/usersController.ts': {
                type: 'controller',
                triggers: ['/api/users'],
                calls: ['src/services/usersService.ts']
            },
            'src/services/usersService.ts': {
                type: 'service',
                triggers: [],
                calls: []
            }
        };

        const flow = searchFlowByEndpoint(graph, '/api/orders');
        assert.deepStrictEqual(flow, []);
    });

    test('Avoids cycles while traversing DFS', () => {
        const graph: WorkspaceGraph = {
            'a.ts': {
                type: 'controller',
                triggers: ['/api/a'],
                calls: ['b.ts']
            },
            'b.ts': {
                type: 'service',
                triggers: [],
                calls: ['a.ts']
            }
        };

        const flow = searchFlowByEndpoint(graph, '/api/a');
        assert.deepStrictEqual(flow, ['a.ts', 'b.ts']);
    });
});
