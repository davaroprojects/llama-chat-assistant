import * as assert from 'assert';
import { buscarFlujoPorEndpoint } from '../chat/endpointFlowResolver';
import { WorkspaceGraph } from '../rag/workspaceDependencyGraphBuilder';

suite('EndpointFlowResolver - buscarFlujoPorEndpoint', () => {
    test('Returns DFS flow from matching trigger', () => {
        const graph: WorkspaceGraph = {
            'src/controllers/usersController.ts': {
                tipo: 'controller',
                triggers: ['/api/users'],
                llamadas: ['src/services/usersService.ts']
            },
            'src/services/usersService.ts': {
                tipo: 'service',
                triggers: [],
                llamadas: ['src/repositories/usersRepository.ts']
            },
            'src/repositories/usersRepository.ts': {
                tipo: 'repository',
                triggers: [],
                llamadas: []
            }
        };

        const flow = buscarFlujoPorEndpoint(graph, '/api/users');
        assert.deepStrictEqual(flow, [
            'src/controllers/usersController.ts',
            'src/services/usersService.ts',
            'src/repositories/usersRepository.ts'
        ]);
    });

    test('Returns empty when endpoint is not found', () => {
        const graph: WorkspaceGraph = {
            'src/controllers/usersController.ts': {
                tipo: 'controller',
                triggers: ['/api/users'],
                llamadas: ['src/services/usersService.ts']
            },
            'src/services/usersService.ts': {
                tipo: 'service',
                triggers: [],
                llamadas: []
            }
        };

        const flow = buscarFlujoPorEndpoint(graph, '/api/orders');
        assert.deepStrictEqual(flow, []);
    });

    test('Avoids cycles while traversing DFS', () => {
        const graph: WorkspaceGraph = {
            'a.ts': {
                tipo: 'controller',
                triggers: ['/api/a'],
                llamadas: ['b.ts']
            },
            'b.ts': {
                tipo: 'service',
                triggers: [],
                llamadas: ['a.ts']
            }
        };

        const flow = buscarFlujoPorEndpoint(graph, '/api/a');
        assert.deepStrictEqual(flow, ['a.ts', 'b.ts']);
    });
});
