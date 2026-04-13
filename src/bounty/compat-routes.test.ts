import fastify, { type FastifyInstance } from 'fastify';
import { bountyCompatibilityRoutes } from './compat-routes';

const mockCreateBounty = jest.fn();
const mockListBounties = jest.fn();
const mockGetBounty = jest.fn();
const mockGetBountyBidCounts = jest.fn();
const mockAcceptBid = jest.fn();
const mockReviewDeliverable = jest.fn();
const mockSubmitDeliverable = jest.fn();
const mockPlaceBid = jest.fn();

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  acceptBid: (...args: unknown[]) => mockAcceptBid(...args),
  createBounty: (...args: unknown[]) => mockCreateBounty(...args),
  getBounty: (...args: unknown[]) => mockGetBounty(...args),
  getBountyBidCounts: (...args: unknown[]) => mockGetBountyBidCounts(...args),
  listBounties: (...args: unknown[]) => mockListBounties(...args),
  placeBid: (...args: unknown[]) => mockPlaceBid(...args),
  reviewDeliverable: (...args: unknown[]) => mockReviewDeliverable(...args),
  submitDeliverable: (...args: unknown[]) => mockSubmitDeliverable(...args),
}));

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (request: { auth?: { node_id: string } }) => {
    request.auth = { node_id: 'node-1' };
  },
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Bounty compatibility routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
    await app.register(bountyCompatibilityRoutes, { prefix: '/api/v2/bounties' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns raw list responses with reward fields', async () => {
    mockListBounties.mockResolvedValue({
      bounties: [{ bounty_id: 'b-1', title: 'One', amount: 50, status: 'open', deadline: new Date('2026-04-15T00:00:00Z') }],
      total: 1,
    });
    mockGetBountyBidCounts.mockResolvedValue(new Map([['b-1', 3]]));

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/bounties/list?status=open',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      bounties: [{
        bounty_id: 'b-1',
        title: 'One',
        reward: 50,
        status: 'open',
        bid_count: 3,
        deadline: '2026-04-15T00:00:00.000Z',
      }],
      total: 1,
    });
  });

  it('accepts the spec create payload and returns the spec response shape', async () => {
    mockCreateBounty.mockResolvedValue({
      bounty_id: 'b-10',
      amount: 500,
      status: 'open',
      created_at: new Date('2026-03-31T12:00:00Z'),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/bounties/create',
      payload: {
        title: 'Need sentiment gene',
        description: 'High quality multilingual sentiment',
        reward: 500,
        required_signals: ['sentiment', 'nlp'],
        acceptance_criteria: 'F1 > 0.90',
        deadline: '2026-04-15T00:00:00Z',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockCreateBounty).toHaveBeenCalledWith(
      'node-1',
      'Need sentiment gene',
      'High quality multilingual sentiment',
      ['sentiment', 'nlp', 'Acceptance criteria: F1 > 0.90'],
      500,
      '2026-04-15T00:00:00Z',
    );
    expect(JSON.parse(response.payload)).toEqual({
      bounty_id: 'b-10',
      status: 'open',
      reward: 500,
      created_at: '2026-03-31T12:00:00.000Z',
    });
  });

  it('returns raw open summary responses', async () => {
    mockListBounties.mockResolvedValue({
      bounties: [
        { bounty_id: 'b-1', title: 'One', amount: 10, status: 'open', deadline: new Date('2026-04-15T00:00:00Z') },
        { bounty_id: 'b-2', title: 'Two', amount: 15, status: 'open', deadline: new Date('2026-04-16T00:00:00Z') },
      ],
      total: 2,
    });
    mockGetBountyBidCounts.mockResolvedValue(new Map([['b-1', 2], ['b-2', 1]]));

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/bounties/open',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      bounties: [
        {
          bounty_id: 'b-1',
          title: 'One',
          reward: 10,
          status: 'open',
          bid_count: 2,
          deadline: '2026-04-15T00:00:00.000Z',
        },
        {
          bounty_id: 'b-2',
          title: 'Two',
          reward: 15,
          status: 'open',
          bid_count: 1,
          deadline: '2026-04-16T00:00:00.000Z',
        },
      ],
      total_open: 2,
      total_reward_pool: 25,
    });
  });

  it('sorts list responses by reward when requested', async () => {
    mockListBounties.mockResolvedValue({
      bounties: [
        { bounty_id: 'b-2', title: 'High', amount: 500, status: 'open', deadline: new Date('2026-04-16T00:00:00Z') },
        { bounty_id: 'b-1', title: 'Low', amount: 50, status: 'open', deadline: new Date('2026-04-15T00:00:00Z') },
      ],
      total: 2,
    });
    mockGetBountyBidCounts.mockResolvedValue(new Map([['b-1', 1], ['b-2', 2]]));

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/bounties/list?sort=reward_desc',
    });

    expect(response.statusCode).toBe(200);
    expect(mockListBounties).toHaveBeenCalledWith({
      status: undefined,
      sort: 'reward_desc',
      limit: 20,
      offset: 0,
    });
    expect(JSON.parse(response.payload).bounties[0]).toEqual({
      bounty_id: 'b-2',
      title: 'High',
      reward: 500,
      status: 'open',
      bid_count: 2,
      deadline: '2026-04-16T00:00:00.000Z',
    });
  });

  it('passes pagination through for reward-sorted list responses', async () => {
    mockListBounties.mockResolvedValue({
      bounties: [],
      total: 2005,
    });
    mockGetBountyBidCounts.mockResolvedValue(new Map());

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/bounties/list?sort=reward_asc&limit=25&offset=1005',
    });

    expect(response.statusCode).toBe(200);
    expect(mockListBounties).toHaveBeenCalledWith({
      status: undefined,
      sort: 'reward_asc',
      limit: 25,
      offset: 1005,
    });
  });

  it('returns raw stats responses with payout metrics', async () => {
    mockListBounties
      .mockResolvedValueOnce({ bounties: [], total: 12 })
      .mockResolvedValueOnce({ bounties: [], total: 5 })
      .mockResolvedValueOnce({ bounties: [], total: 3 })
      .mockResolvedValueOnce({ bounties: [], total: 2 })
      .mockResolvedValueOnce({
        bounties: [
          { amount: 100, created_at: new Date('2026-04-01T00:00:00Z'), completed_at: new Date('2026-04-03T00:00:00Z') },
        ],
        total: 1,
      })
      .mockResolvedValueOnce({ bounties: [], total: 1 });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/bounties/stats',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      total_bounties: 12,
      open: 5,
      in_progress: 5,
      completed: 1,
      expired: 1,
      total_reward_paid: 100,
      avg_completion_time_days: 2,
    });
  });

  it('returns claim responses in the documented shape', async () => {
    mockAcceptBid.mockResolvedValue({
      bounty_id: 'b-1',
      deadline: new Date('2026-04-15T00:00:00Z'),
      bids: [{ status: 'accepted', bidder_id: 'node-def' }],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/bounties/b-1/claim',
      payload: { bid_id: 'bid-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      status: 'claimed',
      bounty_id: 'b-1',
      worker_id: 'node-def',
      deadline: '2026-04-15T00:00:00.000Z',
    });
  });

  it('validates deliverable_id before accepting a deliverable', async () => {
    mockGetBounty.mockResolvedValue({
      bounty_id: 'b-1',
      amount: 500,
      deliverable: { deliverable_id: 'dlv-real', worker_id: 'node-def' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/bounties/b-1/accept',
      payload: { deliverable_id: 'dlv-fake', feedback: 'Nope' },
    });

    expect(response.statusCode).toBe(400);
    expect(mockReviewDeliverable).not.toHaveBeenCalled();
  });

  it('returns documented acceptance responses after validation', async () => {
    mockGetBounty.mockResolvedValue({
      bounty_id: 'b-1',
      amount: 500,
      deliverable: { deliverable_id: 'dlv-1', worker_id: 'node-def' },
    });
    mockReviewDeliverable.mockResolvedValue({
      amount: 500,
      deliverable: { worker_id: 'node-def' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/bounties/b-1/accept',
      payload: { deliverable_id: 'dlv-1', feedback: 'Excellent work', rating: 5 },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      status: 'completed',
      reward_paid: 500,
      worker: 'node-def',
      reputation_impact: '+5.0',
      rating: 5,
    });
  });
});
