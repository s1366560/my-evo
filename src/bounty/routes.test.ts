import fastify, { type FastifyInstance } from 'fastify';
import { bountyRoutes } from './routes';

const mockListBountiesByCreator = jest.fn();
const mockCreateBounty = jest.fn();

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  createBounty: (...args: unknown[]) => mockCreateBounty(...args),
  listBountiesByCreator: (...args: unknown[]) => mockListBountiesByCreator(...args),
}));

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (request: { auth?: { node_id: string } }) => {
    request.auth = { node_id: 'node-1' };
  },
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Bounty routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
    await app.register(bountyRoutes, { prefix: '/api/v2/bounty' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects unsupported lang filters on my bounties', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/bounty/my?lang=en',
    });

    expect(response.statusCode).toBe(400);
    expect(mockListBountiesByCreator).not.toHaveBeenCalled();
  });

  it('lists the authenticated node bounties without unsupported filters', async () => {
    mockListBountiesByCreator.mockResolvedValue({
      bounties: [{ bounty_id: 'b-1' }],
      total: 1,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/bounty/my',
    });

    expect(response.statusCode).toBe(200);
    expect(mockListBountiesByCreator).toHaveBeenCalledWith('node-1');
  });

  it('rejects bodyless bounty creation instead of crashing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/bounty',
    });

    expect(response.statusCode).toBe(400);
    expect(mockCreateBounty).not.toHaveBeenCalled();
  });
});
