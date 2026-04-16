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
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      bounties: [{ bounty_id: 'b-1', creator_id: 'node-2' }],
      total: 1,
      data: [{ bounty_id: 'b-1', creator_id: 'node-2' }],
      meta: { total: 1, limit: 5, offset: 2 },
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
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      bounties: [{ bounty_id: 'b-2', creator_id: 'node-3' }],
      total: 1,
      data: [{ bounty_id: 'b-2', creator_id: 'node-3' }],
      meta: { total: 1, limit: 10, offset: 0 },
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
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      bounty: { bounty_id: 'b-1' },
      data: { bounty_id: 'b-1' },
    });
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
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      bounties: [{ bounty_id: 'b-1' }],
      total: 1,
      data: [{ bounty_id: 'b-1' }],
      meta: { total: 1 },
    });
  });

  it('rejects bodyless bounty creation instead of crashing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/bounty',
    });

    expect(response.statusCode).toBe(400);
    expect(mockCreateBounty).not.toHaveBeenCalled();
  });

  it('exposes top-level aliases for create/open/stats/bid/claim/submit/review/accept/cancel', async () => {
    mockCreateBounty.mockResolvedValue({
      bounty_id: 'b-9',
      status: 'open',
      amount: 200,
      created_at: '2026-04-16T00:00:00.000Z',
      deadline: '2026-04-20T00:00:00.000Z',
    });
    mockListBounties
      .mockResolvedValueOnce({ bounties: [{ bounty_id: 'b-open', amount: 50 }], total: 1, limit: 50, offset: 0 })
      .mockResolvedValueOnce({ bounties: [{ bounty_id: 't' }], total: 5, limit: 1, offset: 0 })
      .mockResolvedValueOnce({ bounties: [{ bounty_id: 'o' }], total: 2, limit: 1, offset: 0 })
      .mockResolvedValueOnce({ bounties: [{ bounty_id: 'c' }], total: 1, limit: 1, offset: 0 })
      .mockResolvedValueOnce({ bounties: [{ bounty_id: 's' }], total: 1, limit: 1, offset: 0 })
      .mockResolvedValueOnce({ bounties: [{ bounty_id: 'a' }], total: 1, limit: 1, offset: 0 })
      .mockResolvedValueOnce({ bounties: [{ bounty_id: 'e' }], total: 0, limit: 1, offset: 0 });
    const dynamicService = require('./service');
    dynamicService.placeBid = jest.fn().mockResolvedValue({ bid_id: 'bid-1' });
    mockAcceptBid.mockResolvedValue({ bounty_id: 'b-9', status: 'claimed' });
    mockSubmitDeliverable.mockResolvedValue({ bounty_id: 'b-9', deliverable: { worker_id: 'node-1' } });
    mockReviewDeliverable.mockResolvedValue({ bounty_id: 'b-9', amount: 200, deliverable: { worker_id: 'node-2' } });
    dynamicService.cancelBounty = jest.fn().mockResolvedValue({ bounty_id: 'b-9', status: 'cancelled' });

    const [createRes, openRes, statsRes, bidRes, claimRes, submitRes, reviewRes, acceptRes, cancelRes] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/v2/bounty/create',
        payload: { title: 'Task', description: 'Desc', reward: 200, deadline: '2026-04-20T00:00:00.000Z' },
      }),
      app.inject({ method: 'GET', url: '/api/v2/bounty/open' }),
      app.inject({ method: 'GET', url: '/api/v2/bounty/stats' }),
      app.inject({
        method: 'POST',
        url: '/api/v2/bounty/b-9/bid',
        payload: { proposedAmount: 180, estimatedTime: '2d', approach: 'Do it' },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v2/bounty/b-9/claim',
        payload: { bidId: 'bid-1' },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v2/bounty/b-9/submit',
        payload: { content: 'done' },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v2/bounty/b-9/review',
        payload: { accepted: true },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v2/bounty/b-9/accept',
        payload: { rating: 5 },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v2/bounty/b-9/cancel',
      }),
    ]);

    expect(createRes.statusCode).toBe(201);
    expect(JSON.parse(createRes.payload)).toEqual({
      success: true,
      bounty_id: 'b-9',
      state: 'open',
      reward: 200,
      platform_fee: 10,
      created_at: '2026-04-16T00:00:00.000Z',
      deadline: '2026-04-20T00:00:00.000Z',
      data: {
        bounty_id: 'b-9',
        status: 'open',
        amount: 200,
        created_at: '2026-04-16T00:00:00.000Z',
        deadline: '2026-04-20T00:00:00.000Z',
        reward: 200,
      },
    });
    expect(JSON.parse(openRes.payload)).toEqual({
      success: true,
      bounties: [{ bounty_id: 'b-open', amount: 50 }],
      total_open: 1,
      total_reward_pool: 50,
      data: {
        bounties: [{ bounty_id: 'b-open', amount: 50 }],
        total_open: 1,
        total_reward_pool: 50,
      },
    });
    expect(JSON.parse(statsRes.payload)).toEqual({
      success: true,
      total_bounties: 5,
      open: 2,
      in_progress: 2,
      completed: 1,
      expired: 0,
      data: {
        total_bounties: 5,
        open: 2,
        in_progress: 2,
        completed: 1,
        expired: 0,
      },
    });
    expect(JSON.parse(bidRes.payload)).toEqual({
      success: true,
      bid: { bid_id: 'bid-1' },
      data: { bid_id: 'bid-1' },
    });
    expect(JSON.parse(claimRes.payload)).toEqual({
      success: true,
      bounty: { bounty_id: 'b-9', status: 'claimed' },
      data: { bounty_id: 'b-9', status: 'claimed' },
    });
    expect(JSON.parse(submitRes.payload)).toEqual({
      success: true,
      bounty: { bounty_id: 'b-9', deliverable: { worker_id: 'node-1' } },
      deliverable: { worker_id: 'node-1' },
      data: { bounty_id: 'b-9', deliverable: { worker_id: 'node-1' } },
    });
    expect(JSON.parse(reviewRes.payload)).toEqual({
      success: true,
      bounty: { bounty_id: 'b-9', amount: 200, deliverable: { worker_id: 'node-2' } },
      data: { bounty_id: 'b-9', amount: 200, deliverable: { worker_id: 'node-2' } },
    });
    expect(JSON.parse(acceptRes.payload)).toEqual({
      success: true,
      status: 'completed',
      reward_paid: 200,
      worker: 'node-2',
      rating: 5,
      deliverable_id: null,
      reputation_impact: '+5.0',
      data: {
        status: 'completed',
        reward_paid: 200,
        worker: 'node-2',
        rating: 5,
        deliverable_id: null,
        reputation_impact: '+5.0',
      },
    });
    expect(JSON.parse(cancelRes.payload)).toEqual({
      success: true,
      bounty: { bounty_id: 'b-9', status: 'cancelled' },
      data: { bounty_id: 'b-9', status: 'cancelled' },
    });
  });
});
