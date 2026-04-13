import fastify, { type FastifyInstance } from 'fastify';
import { taskAliasRoutes } from './routes';

const mockProposeTaskDecomposition = jest.fn();
const mockListTasks = jest.fn();
const mockReleaseTask = jest.fn();
const mockGetSwarm = jest.fn();

jest.mock('../task/service', () => ({
  ...jest.requireActual('../task/service'),
  proposeTaskDecomposition: (...args: unknown[]) => mockProposeTaskDecomposition(...args),
  listTasks: (...args: unknown[]) => mockListTasks(...args),
  releaseTask: (...args: unknown[]) => mockReleaseTask(...args),
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

  it('filters alias my tasks by authenticated assignee and status', async () => {
    mockListTasks.mockResolvedValue([
      {
        task_id: 't-1',
        project_id: 'p-1',
        title: 'Mine and open',
        description: '',
        status: 'open',
        assignee_id: 'node-1',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        task_id: 't-2',
        project_id: 'p-1',
        title: 'Mine but done',
        description: '',
        status: 'completed',
        assignee_id: 'node-1',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        task_id: 't-3',
        project_id: 'p-1',
        title: 'Not mine',
        description: '',
        status: 'open',
        assignee_id: 'node-2',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/task/my?status=open&node_id=node-1',
    });

    expect(response.statusCode).toBe(200);
    expect(mockListTasks).toHaveBeenCalledWith('__all__');
    expect(response.json().data).toEqual([
      expect.objectContaining({
        task_id: 't-1',
        assignee_id: 'node-1',
        status: 'open',
      }),
    ]);
  });

  it('rejects mismatched node_id on alias my tasks', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/task/my?node_id=node-2',
    });

    expect(response.statusCode).toBe(403);
    expect(mockListTasks).not.toHaveBeenCalled();
  });

  it('rejects unsupported role filters on alias my tasks', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/task/my?role=creator',
    });

    expect(response.statusCode).toBe(400);
    expect(mockListTasks).not.toHaveBeenCalled();
    expect(response.json()).toEqual(expect.objectContaining({
      success: false,
      error: 'VALIDATION_ERROR',
    }));
  });

  it('rejects mismatched node_id when claiming through the alias body route', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/task/claim',
      payload: {
        task_id: 'p-1:t-1',
        node_id: 'node-2',
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('rejects mismatched node_id when completing through the alias path route', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/task/p-1:t-1/complete',
      payload: {
        node_id: 'node-2',
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('releases claimed tasks through the documented alias', async () => {
    mockReleaseTask.mockResolvedValue({
      task_id: 't-1',
      project_id: 'p-1',
      title: 'Released task',
      description: '',
      status: 'open',
      assignee_id: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/task/release',
      payload: {
        task_id: 'p-1:t-1',
        node_id: 'node-1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockReleaseTask).toHaveBeenCalledWith('p-1', 't-1', 'node-1');
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
