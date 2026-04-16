import fastify, { type FastifyInstance } from 'fastify';
import { workerPoolRoutes } from './routes';

const mockListWorkers = jest.fn();
const mockGetWorker = jest.fn();
const mockListWorkersPublic = jest.fn();
const mockGetWorkerPublic = jest.fn();
const mockRegisterWorker = jest.fn();
const mockUpdateHeartbeat = jest.fn();
const mockDeregisterWorker = jest.fn();
const mockListSpecialists = jest.fn();
const mockGetSpecialist = jest.fn();
const mockSetWorkerAvailability = jest.fn();
const mockRateSpecialist = jest.fn();
const mockListSpecialistPools = jest.fn();
const mockMatchWorkers = jest.fn();
const mockGetWorkerPoolStats = jest.fn();

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  registerWorker: (...args: unknown[]) => mockRegisterWorker(...args),
  updateHeartbeat: (...args: unknown[]) => mockUpdateHeartbeat(...args),
  deregisterWorker: (...args: unknown[]) => mockDeregisterWorker(...args),
  listWorkers: (...args: unknown[]) => mockListWorkers(...args),
  getWorker: (...args: unknown[]) => mockGetWorker(...args),
  listWorkersPublic: (...args: unknown[]) => mockListWorkersPublic(...args),
  getWorkerPublic: (...args: unknown[]) => mockGetWorkerPublic(...args),
  listSpecialists: (...args: unknown[]) => mockListSpecialists(...args),
  getSpecialist: (...args: unknown[]) => mockGetSpecialist(...args),
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
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      rated: true,
      worker_id: 'worker-1',
      task_id: 'task-1',
      data: { rated: true },
    });
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
      pools: [{ name: 'coding', worker_count: 2, avg_reputation: 75 }],
      total: 1,
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
      matches: [{ worker_id: 'worker-1', match_score: 0.95, price: null }],
      total: 1,
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
      total_workers: 10,
      active_workers: 8,
      total_tasks_completed: 100,
      avg_match_score: 0.87,
      specialist_pools: 3,
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
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      workers: [{ worker_id: 'worker-1' }],
      total: 1,
      data: {
        workers: [{ worker_id: 'worker-1' }],
        total: 1,
      },
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
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      worker: { worker_id: 'worker-7' },
      data: { worker_id: 'worker-7' },
    });
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
      success: true,
      status: 'ok',
      availability: 'busy',
      worker_id: 'node-1',
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

  it('exposes top-level aliases for authenticated worker registration/list/detail routes', async () => {
    mockRegisterWorker.mockResolvedValue({
      node_id: 'node-1',
      is_available: true,
      last_heartbeat: '2026-04-16T00:00:00.000Z',
    });
    mockUpdateHeartbeat.mockResolvedValue({
      node_id: 'node-1',
      is_available: true,
      last_heartbeat: '2026-04-16T00:01:00.000Z',
    });
    mockDeregisterWorker.mockResolvedValue({
      success: true,
      node_id: 'node-1',
    });
    mockListWorkers.mockResolvedValue({
      workers: [{ node_id: 'node-1', specialties: ['coding'] }],
      total: 1,
      limit: 20,
      offset: 0,
    });
    mockGetWorker.mockResolvedValue({ node_id: 'node-1', specialties: ['coding'] });
    mockListSpecialists.mockResolvedValue({
      items: [{ node_id: 'node-1', specialties: ['coding'] }],
      total: 1,
    });
    mockGetSpecialist.mockResolvedValue({ node_id: 'node-1', specialties: ['coding'] });

    const [registerRes, heartbeatRes, deregisterRes, listRes, detailRes, specialistsRes, specialistRes] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/v2/workerpool/register',
        payload: { specialties: ['coding'] },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v2/workerpool/heartbeat',
      }),
      app.inject({
        method: 'POST',
        url: '/api/v2/workerpool/deregister',
      }),
      app.inject({
        method: 'GET',
        url: '/api/v2/workerpool',
      }),
      app.inject({
        method: 'GET',
        url: '/api/v2/workerpool/node-1',
      }),
      app.inject({
        method: 'GET',
        url: '/api/v2/workerpool/specialists',
      }),
      app.inject({
        method: 'GET',
        url: '/api/v2/workerpool/specialists/node-1',
      }),
    ]);

    expect(registerRes.statusCode).toBe(201);
    expect(JSON.parse(registerRes.payload)).toEqual({
      success: true,
      worker_id: 'node-1',
      type: 'passive',
      tier: 'bronze',
      is_available: true,
      registered_at: '2026-04-16T00:00:00.000Z',
      data: {
        node_id: 'node-1',
        is_available: true,
        last_heartbeat: '2026-04-16T00:00:00.000Z',
      },
    });
    expect(JSON.parse(heartbeatRes.payload)).toEqual({
      success: true,
      worker: {
        node_id: 'node-1',
        is_available: true,
        last_heartbeat: '2026-04-16T00:01:00.000Z',
      },
      data: {
        node_id: 'node-1',
        is_available: true,
        last_heartbeat: '2026-04-16T00:01:00.000Z',
      },
    });
    expect(JSON.parse(deregisterRes.payload)).toEqual({
      success: true,
      node_id: 'node-1',
      data: {
        success: true,
        node_id: 'node-1',
      },
    });
    expect(JSON.parse(listRes.payload)).toEqual({
      success: true,
      workers: [{ node_id: 'node-1', specialties: ['coding'] }],
      total: 1,
      data: [{ node_id: 'node-1', specialties: ['coding'] }],
      meta: {
        total: 1,
        limit: 20,
        offset: 0,
      },
    });
    expect(JSON.parse(detailRes.payload)).toEqual({
      success: true,
      worker: { node_id: 'node-1', specialties: ['coding'] },
      data: { node_id: 'node-1', specialties: ['coding'] },
    });
    expect(JSON.parse(specialistsRes.payload)).toEqual({
      success: true,
      specialists: [{ node_id: 'node-1', specialties: ['coding'] }],
      total: 1,
      data: [{ node_id: 'node-1', specialties: ['coding'] }],
      meta: { total: 1 },
    });
    expect(JSON.parse(specialistRes.payload)).toEqual({
      success: true,
      specialist: { node_id: 'node-1', specialties: ['coding'] },
      data: { node_id: 'node-1', specialties: ['coding'] },
    });
  });
});
