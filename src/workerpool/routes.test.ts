import fastify, { type FastifyInstance } from 'fastify';
import { workerPoolRoutes } from './routes';

const mockListWorkers = jest.fn();
const mockGetWorker = jest.fn();
const mockListWorkersPublic = jest.fn();
const mockGetWorkerPublic = jest.fn();
const mockSetWorkerAvailability = jest.fn();
const mockRateSpecialist = jest.fn();
const mockListSpecialistPools = jest.fn();
const mockMatchWorkers = jest.fn();
const mockGetWorkerPoolStats = jest.fn();

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  listWorkers: (...args: unknown[]) => mockListWorkers(...args),
  getWorker: (...args: unknown[]) => mockGetWorker(...args),
  listWorkersPublic: (...args: unknown[]) => mockListWorkersPublic(...args),
  getWorkerPublic: (...args: unknown[]) => mockGetWorkerPublic(...args),
  setWorkerAvailability: (...args: unknown[]) => mockSetWorkerAvailability(...args),
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

  it('supports the documented /workers listing alias', async () => {
    mockListWorkersPublic.mockResolvedValue({
      workers: [{ worker_id: 'worker-1' }],
      total: 1,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/workerpool/workers?status=active',
    });

    expect(response.statusCode).toBe(200);
    expect(mockListWorkersPublic).toHaveBeenCalledWith({
      skill: undefined,
      status: 'active',
      limit: 20,
      offset: 0,
    });
  });

  it('supports the documented /workers/:id detail alias', async () => {
    mockGetWorkerPublic.mockResolvedValue({ worker_id: 'worker-7' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/workerpool/workers/worker-7',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetWorkerPublic).toHaveBeenCalledWith('worker-7');
  });

  it('updates the authenticated worker availability via the documented alias', async () => {
    mockSetWorkerAvailability.mockResolvedValue({
      node_id: 'node-1',
      is_available: false,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/workerpool/workers/node-1/availability',
      payload: { availability: 'busy', resume_at: '2026-04-02T00:00:00Z' },
    });

    expect(response.statusCode).toBe(200);
    expect(mockSetWorkerAvailability).toHaveBeenCalledWith('node-1', false);
    expect(JSON.parse(response.payload)).toEqual({
      status: 'ok',
      availability: 'busy',
    });
  });

  it('rejects availability updates for another worker', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/workerpool/workers/node-2/availability',
      payload: { available: true },
    });

    expect(response.statusCode).toBe(403);
    expect(mockSetWorkerAvailability).not.toHaveBeenCalled();
  });

  it('rejects availability updates without any availability field', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/workerpool/workers/node-1/availability',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(mockSetWorkerAvailability).not.toHaveBeenCalled();
  });

  it('rejects unknown availability values', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/workerpool/workers/node-1/availability',
      payload: { availability: 'offline' },
    });

    expect(response.statusCode).toBe(400);
    expect(mockSetWorkerAvailability).not.toHaveBeenCalled();
  });

  it('rejects non-string availability values', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/workerpool/workers/node-1/availability',
      payload: { availability: 1 },
    });

    expect(response.statusCode).toBe(400);
    expect(mockSetWorkerAvailability).not.toHaveBeenCalled();
  });

  it('rejects malformed worker list pagination values', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/workerpool?limit=1abc&offset=1.5',
    });

    expect(response.statusCode).toBe(400);
    expect(mockListWorkers).not.toHaveBeenCalled();
  });
});
