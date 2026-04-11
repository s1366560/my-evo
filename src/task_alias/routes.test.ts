import fastify, { type FastifyInstance } from 'fastify';
import { taskAliasRoutes } from './routes';

const mockProposeTaskDecomposition = jest.fn();
const mockGetSwarm = jest.fn();

jest.mock('../task/service', () => ({
  ...jest.requireActual('../task/service'),
  proposeTaskDecomposition: (...args: unknown[]) => mockProposeTaskDecomposition(...args),
}));

jest.mock('../swarm/service', () => ({
  ...jest.requireActual('../swarm/service'),
  getSwarm: (...args: unknown[]) => mockGetSwarm(...args),
}));

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (request: { auth?: { node_id: string } }) => {
    request.auth = { node_id: 'node-1' };
  },
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Task alias routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
    await app.register(taskAliasRoutes, { prefix: '/task' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects spoofed sender ids during decomposition proposals', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/task/propose-decomposition',
      payload: {
        task_id: 'p-1:t-1',
        sender_id: 'node-2',
        subtasks: ['Research'],
      },
    });

    expect(response.statusCode).toBe(403);
    expect(mockProposeTaskDecomposition).not.toHaveBeenCalled();
  });

  it('hides swarm state from unrelated authenticated users', async () => {
    mockGetSwarm.mockResolvedValue({
      swarm_id: 'swarm-1',
      creator_id: 'node-2',
      subtasks: [],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/task/swarm/swarm-1',
    });

    expect(response.statusCode).toBe(404);
  });
});
