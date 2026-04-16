import fastify, { type FastifyInstance } from 'fastify';
import { swarmRoutes } from './routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'session',
  trust_level: 'trusted',
};

const mockCreateSwarm = jest.fn();
const mockDecomposeTask = jest.fn();
const mockAssignSubtask = jest.fn();
const mockSubmitSubtaskResult = jest.fn();
const mockAggregateResults = jest.fn();
const mockGetSwarm = jest.fn();
const mockListSwarms = jest.fn();

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (
    request: {
      auth?: {
        node_id: string;
        auth_type?: string;
        trust_level?: string;
      };
    },
  ) => {
    request.auth = mockAuth;
  },
}));

jest.mock('./service', () => ({
  createSwarm: (...args: unknown[]) => mockCreateSwarm(...args),
  decomposeTask: (...args: unknown[]) => mockDecomposeTask(...args),
  assignSubtask: (...args: unknown[]) => mockAssignSubtask(...args),
  submitSubtaskResult: (...args: unknown[]) => mockSubmitSubtaskResult(...args),
  aggregateResults: (...args: unknown[]) => mockAggregateResults(...args),
  getSwarm: (...args: unknown[]) => mockGetSwarm(...args),
  listSwarms: (...args: unknown[]) => mockListSwarms(...args),
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Swarm routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'session',
      trust_level: 'trusted',
    };
    app = buildApp();
    await app.register(swarmRoutes, { prefix: '/a2a/swarm' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('exposes top-level aliases for create/decompose/assign/submit/aggregate/detail/list', async () => {
    mockCreateSwarm.mockResolvedValue({
      swarm_id: 'swarm-1',
      status: 'pending',
      created_at: '2026-04-16T00:00:00.000Z',
    });
    mockDecomposeTask.mockResolvedValue({
      swarm_id: 'swarm-1',
      status: 'in_progress',
      subtasks: [{ subtask_id: 'st-1', title: 'Sub 1' }],
    });
    mockAssignSubtask.mockResolvedValue({
      subtask_id: 'st-1',
      status: 'assigned',
      assigned_to: 'worker-1',
    });
    mockSubmitSubtaskResult.mockResolvedValue({
      subtask_id: 'st-1',
      status: 'completed',
      result: 'done',
    });
    mockAggregateResults.mockResolvedValue({
      swarm_id: 'swarm-1',
      status: 'completed',
      result: { aggregated_output: 'all done' },
    });
    mockGetSwarm.mockResolvedValue({
      swarm_id: 'swarm-1',
      status: 'completed',
      subtasks: [{ subtask_id: 'st-1' }],
    });
    mockListSwarms.mockResolvedValue({
      swarms: [{ swarm_id: 'swarm-1', status: 'pending' }],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const [createRes, decomposeRes, assignRes, submitRes, aggregateRes, detailRes, listRes] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/a2a/swarm',
        payload: { title: 'Swarm Task', description: 'Do complex thing', cost: 50 },
      }),
      app.inject({
        method: 'POST',
        url: '/a2a/swarm/swarm-1/decompose',
        payload: { subtasks: [{ title: 'Sub 1', description: 'Desc 1' }] },
      }),
      app.inject({
        method: 'POST',
        url: '/a2a/swarm/swarm-1/assign',
        payload: { subtaskId: 'st-1', workerId: 'worker-1' },
      }),
      app.inject({
        method: 'POST',
        url: '/a2a/swarm/swarm-1/subtask/st-1/submit',
        payload: { result: 'done' },
      }),
      app.inject({
        method: 'POST',
        url: '/a2a/swarm/swarm-1/aggregate',
      }),
      app.inject({
        method: 'GET',
        url: '/a2a/swarm/swarm-1',
      }),
      app.inject({
        method: 'GET',
        url: '/a2a/swarm?status=pending',
      }),
    ]);

    expect(createRes.statusCode).toBe(201);
    expect(JSON.parse(createRes.payload)).toEqual({
      success: true,
      swarm_id: 'swarm-1',
      state: 'pending',
      created_at: '2026-04-16T00:00:00.000Z',
      data: {
        swarm_id: 'swarm-1',
        status: 'pending',
        created_at: '2026-04-16T00:00:00.000Z',
      },
    });
    expect(decomposeRes.statusCode).toBe(200);
    expect(JSON.parse(decomposeRes.payload)).toEqual({
      success: true,
      swarm: {
        swarm_id: 'swarm-1',
        status: 'in_progress',
        subtasks: [{ subtask_id: 'st-1', title: 'Sub 1' }],
      },
      subtasks: [{ subtask_id: 'st-1', title: 'Sub 1' }],
      data: {
        swarm_id: 'swarm-1',
        status: 'in_progress',
        subtasks: [{ subtask_id: 'st-1', title: 'Sub 1' }],
      },
    });
    expect(JSON.parse(assignRes.payload)).toEqual({
      success: true,
      subtask: {
        subtask_id: 'st-1',
        status: 'assigned',
        assigned_to: 'worker-1',
      },
      data: {
        subtask_id: 'st-1',
        status: 'assigned',
        assigned_to: 'worker-1',
      },
    });
    expect(JSON.parse(submitRes.payload)).toEqual({
      success: true,
      subtask: {
        subtask_id: 'st-1',
        status: 'completed',
        result: 'done',
      },
      data: {
        subtask_id: 'st-1',
        status: 'completed',
        result: 'done',
      },
    });
    expect(JSON.parse(aggregateRes.payload)).toEqual({
      success: true,
      swarm: {
        swarm_id: 'swarm-1',
        status: 'completed',
        result: { aggregated_output: 'all done' },
      },
      result: { aggregated_output: 'all done' },
      data: {
        swarm_id: 'swarm-1',
        status: 'completed',
        result: { aggregated_output: 'all done' },
      },
    });
    expect(JSON.parse(detailRes.payload)).toEqual({
      success: true,
      swarm: {
        swarm_id: 'swarm-1',
        status: 'completed',
        subtasks: [{ subtask_id: 'st-1' }],
      },
      data: {
        swarm_id: 'swarm-1',
        status: 'completed',
        subtasks: [{ subtask_id: 'st-1' }],
      },
    });
    expect(JSON.parse(listRes.payload)).toEqual({
      success: true,
      swarms: [{ swarm_id: 'swarm-1', status: 'pending' }],
      total: 1,
      data: [{ swarm_id: 'swarm-1', status: 'pending' }],
      meta: { total: 1, limit: 20, offset: 0 },
    });
  });

  it('rejects malformed swarm requests before reaching the service layer', async () => {
    const [createRes, decomposeRes, assignRes, submitRes] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/a2a/swarm',
        payload: { title: '', description: '' },
      }),
      app.inject({
        method: 'POST',
        url: '/a2a/swarm/swarm-1/decompose',
        payload: {},
      }),
      app.inject({
        method: 'POST',
        url: '/a2a/swarm/swarm-1/assign',
        payload: { subtaskId: 'st-1' },
      }),
      app.inject({
        method: 'POST',
        url: '/a2a/swarm/swarm-1/subtask/st-1/submit',
        payload: {},
      }),
    ]);

    expect(createRes.statusCode).toBe(400);
    expect(decomposeRes.statusCode).toBe(400);
    expect(assignRes.statusCode).toBe(400);
    expect(submitRes.statusCode).toBe(400);
    expect(mockCreateSwarm).not.toHaveBeenCalled();
    expect(mockDecomposeTask).not.toHaveBeenCalled();
    expect(mockAssignSubtask).not.toHaveBeenCalled();
    expect(mockSubmitSubtaskResult).not.toHaveBeenCalled();
  });
});
