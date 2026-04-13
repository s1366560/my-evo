import fastify, { type FastifyInstance } from 'fastify';
import { workerPoolRoutes } from './routes';

const mockRateSpecialist = jest.fn();
const mockListSpecialistPools = jest.fn();
const mockMatchWorkers = jest.fn();
const mockGetWorkerPoolStats = jest.fn();

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  rateSpecialist: (...args: unknown[]) => mockRateSpecialist(...args),
  listSpecialistPools: (...args: unknown[]) => mockListSpecialistPools(...args),
  matchWorkers: (...args: unknown[]) => mockMatchWorkers(...args),
  getWorkerPoolStats: (...args: unknown[]) => mockGetWorkerPoolStats(...args),
}));

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (request: { auth?: { node_id: string } }) => {
    request.auth = { node_id: 'node-1' };
  },
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Worker pool routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
    await app.register(workerPoolRoutes, { prefix: '/api/v2/workerpool' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires task_id when rating a specialist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/workerpool/specialists/worker-1/rate',
      payload: {
        rating: 4,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(mockRateSpecialist).not.toHaveBeenCalled();
  });

  it('passes task_id to the specialist rating service', async () => {
    mockRateSpecialist.mockResolvedValue(undefined);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/workerpool/specialists/worker-1/rate',
      payload: {
        task_id: 'task-1',
        rating: 4,
        review: 'Great work',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockRateSpecialist).toHaveBeenCalledWith(
      'worker-1',
      'task-1',
      'node-1',
      4,
      'Great work',
    );
  });

  it('returns specialist pools', async () => {
    mockListSpecialistPools.mockResolvedValue([
      { name: 'coding', worker_count: 2, avg_reputation: 75 },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/workerpool/specialist/pools',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      data: {
        pools: [{ name: 'coding', worker_count: 2, avg_reputation: 75 }],
      },
    });
  });

  it('matches workers for a task', async () => {
    mockMatchWorkers.mockResolvedValue([
      { worker_id: 'worker-1', match_score: 0.95, price: null },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/workerpool/match',
      payload: {
        task_signals: ['coding'],
        min_reputation: 70,
        limit: 5,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockMatchWorkers).toHaveBeenCalledWith(['coding'], 70, 5);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      data: {
        matches: [{ worker_id: 'worker-1', match_score: 0.95, price: null }],
      },
    });
  });

  it('requires task_signals for worker matching', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/workerpool/match',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(mockMatchWorkers).not.toHaveBeenCalled();
  });

  it('returns workerpool stats', async () => {
    mockGetWorkerPoolStats.mockResolvedValue({
      total_workers: 10,
      active_workers: 8,
      total_tasks_completed: 100,
      avg_match_score: 0.87,
      specialist_pools: 3,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/workerpool/stats',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      data: {
        total_workers: 10,
        active_workers: 8,
        total_tasks_completed: 100,
        avg_match_score: 0.87,
        specialist_pools: 3,
      },
    });
  });
});
