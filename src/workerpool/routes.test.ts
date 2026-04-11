import fastify, { type FastifyInstance } from 'fastify';
import { workerPoolRoutes } from './routes';

const mockRateSpecialist = jest.fn();

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  rateSpecialist: (...args: unknown[]) => mockRateSpecialist(...args),
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
});
