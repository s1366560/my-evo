import fastify, { type FastifyInstance } from 'fastify';
import { bountyRoutes } from './routes';

const mockListBountiesByCreator = jest.fn();
const mockCreateBounty = jest.fn();
const mockListBounties = jest.fn();
const mockGetBounty = jest.fn();
const mockAcceptBid = jest.fn();
const mockReviewDeliverable = jest.fn();
const mockSubmitDeliverable = jest.fn();

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  acceptBid: (...args: unknown[]) => mockAcceptBid(...args),
  createBounty: (...args: unknown[]) => mockCreateBounty(...args),
  getBounty: (...args: unknown[]) => mockGetBounty(...args),
  listBounties: (...args: unknown[]) => mockListBounties(...args),
  listBountiesByCreator: (...args: unknown[]) => mockListBountiesByCreator(...args),
  reviewDeliverable: (...args: unknown[]) => mockReviewDeliverable(...args),
  submitDeliverable: (...args: unknown[]) => mockSubmitDeliverable(...args),
}));

jest.mock('../shared/auth', () => ({
  authenticate: jest.fn(),
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

  it('forwards creator_id filters on public bounty listings', async () => {
    mockListBounties.mockResolvedValue({
      bounties: [{ bounty_id: 'b-1', creator_id: 'node-2' }],
      total: 1,
      limit: 5,
      offset: 2,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/bounty?status=open&creator_id=node-2&limit=5&offset=2',
    });

    expect(response.statusCode).toBe(200);
    expect(mockListBounties).toHaveBeenCalledWith({
      status: 'open',
      creator_id: 'node-2',
      limit: 5,
      offset: 2,
    });
  });

  it('supports the documented /list bounty alias', async () => {
    mockListBounties.mockResolvedValue({
      bounties: [{ bounty_id: 'b-2', creator_id: 'node-3' }],
      total: 1,
      limit: 10,
      offset: 0,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/bounty/list?status=claimed',
    });

    expect(response.statusCode).toBe(200);
    expect(mockListBounties).toHaveBeenCalledWith({
      status: 'claimed',
      creator_id: undefined,
      limit: 20,
      offset: 0,
    });
  });

  it('allows public bounty detail requests with redacted viewer context', async () => {
    mockGetBounty.mockResolvedValue({ bounty_id: 'b-1' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/bounty/b-1',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetBounty).toHaveBeenCalledWith('b-1', '');
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
