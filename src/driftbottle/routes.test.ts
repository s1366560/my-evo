import fastify, { type FastifyInstance } from 'fastify';
import { driftBottleRoutes } from './routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'session',
  trust_level: 'trusted',
};

const mockThrowBottle = jest.fn();
const mockDiscoverBottle = jest.fn();
const mockReplyToBottle = jest.fn();
const mockDiscardBottle = jest.fn();

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
  throwBottle: (...args: unknown[]) => mockThrowBottle(...args),
  discoverBottle: (...args: unknown[]) => mockDiscoverBottle(...args),
  replyToBottle: (...args: unknown[]) => mockReplyToBottle(...args),
  discardBottle: (...args: unknown[]) => mockDiscardBottle(...args),
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Drift bottle routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'session',
      trust_level: 'trusted',
    };
    app = buildApp();
    await app.register(driftBottleRoutes, { prefix: '/a2a/driftbottle' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('exposes top-level throw/list/stats aliases', async () => {
    mockThrowBottle.mockResolvedValue({
      bottle_id: 'bottle-1',
      sender_id: 'node-1',
      status: 'drifting',
      signals: ['python'],
      hops: 0,
      max_hops: 10,
      path: ['node-1'],
      thrown_at: '2026-04-16T00:00:00.000Z',
      expires_at: '2026-04-19T00:00:00.000Z',
    });

    const [throwRes, listRes, statsRes] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/a2a/driftbottle/throw',
        payload: {
          title: 'Need help',
          content: 'How to fix this?',
          signal_type: 'problem',
          tags: ['python'],
          reward_credits: 100,
        },
      }),
      app.inject({
        method: 'GET',
        url: '/a2a/driftbottle/list',
      }),
      app.inject({
        method: 'GET',
        url: '/a2a/driftbottle/stats',
      }),
    ]);

    expect(JSON.parse(throwRes.payload)).toEqual({
      success: true,
      bottle_id: 'bottle-1',
      status: 'drifting',
      reward_credits: 100,
      expires_at: '2026-04-19T00:00:00.000Z',
      credits_deducted: 100,
      data: {
        bottle_id: 'bottle-1',
        sender_id: 'node-1',
        status: 'drifting',
        signals: ['python'],
        hops: 0,
        max_hops: 10,
        path: ['node-1'],
        thrown_at: '2026-04-16T00:00:00.000Z',
        expires_at: '2026-04-19T00:00:00.000Z',
      },
    });
    expect(JSON.parse(listRes.payload)).toEqual({
      success: true,
      bottles: [],
      total: 0,
      data: [],
    });
    expect(JSON.parse(statsRes.payload)).toEqual({
      success: true,
      floating: 0,
      picked: 0,
      resolved: 0,
      expired: 0,
      data: {
        floating: 0,
        picked: 0,
        resolved: 0,
        expired: 0,
      },
    });
  });

  it('exposes top-level pick/inbox/detail/rescue/reject aliases', async () => {
    mockDiscoverBottle.mockResolvedValue({
      bottle_id: 'bottle-1',
      sender_id: 'node-2',
      status: 'found',
      signals: ['python'],
      hops: 1,
      max_hops: 10,
      path: ['node-2', 'node-1'],
      finder_id: 'node-1',
      thrown_at: '2026-04-16T00:00:00.000Z',
      found_at: '2026-04-16T01:00:00.000Z',
      expires_at: '2026-04-19T00:00:00.000Z',
    });
    mockReplyToBottle.mockResolvedValue({
      bottle_id: 'bottle-1',
      sender_id: 'node-2',
      status: 'replied',
      signals: ['python'],
      hops: 1,
      max_hops: 10,
      path: ['node-2', 'node-1'],
      finder_id: 'node-1',
      reply: 'Use TaskGroup',
      thrown_at: '2026-04-16T00:00:00.000Z',
      found_at: '2026-04-16T01:00:00.000Z',
      expires_at: '2026-04-19T00:00:00.000Z',
    });
    mockDiscardBottle.mockResolvedValue({
      bottle_id: 'bottle-1',
      sender_id: 'node-2',
      status: 'discarded',
      signals: ['python'],
      hops: 1,
      max_hops: 10,
      path: ['node-2', 'node-1'],
      finder_id: 'node-1',
      thrown_at: '2026-04-16T00:00:00.000Z',
      found_at: '2026-04-16T01:00:00.000Z',
      expires_at: '2026-04-19T00:00:00.000Z',
    });

    const [pickRes, inboxRes, detailRes, rescueRes, rejectRes] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/a2a/driftbottle/bottle-1/pick?signals=python,asyncio',
      }),
      app.inject({
        method: 'GET',
        url: '/a2a/driftbottle/inbox',
      }),
      app.inject({
        method: 'GET',
        url: '/a2a/driftbottle/bottle-1',
      }),
      app.inject({
        method: 'POST',
        url: '/a2a/driftbottle/bottle-1/rescue',
        payload: { content: 'Use TaskGroup' },
      }),
      app.inject({
        method: 'POST',
        url: '/a2a/driftbottle/bottle-1/reject',
      }),
    ]);

    expect(JSON.parse(pickRes.payload)).toEqual({
      success: true,
      bottle: {
        bottle_id: 'bottle-1',
        sender_id: 'node-2',
        status: 'found',
        signals: ['python'],
        hops: 1,
        max_hops: 10,
        path: ['node-2', 'node-1'],
        finder_id: 'node-1',
        thrown_at: '2026-04-16T00:00:00.000Z',
        found_at: '2026-04-16T01:00:00.000Z',
        expires_at: '2026-04-19T00:00:00.000Z',
      },
      data: {
        bottle_id: 'bottle-1',
        sender_id: 'node-2',
        status: 'found',
        signals: ['python'],
        hops: 1,
        max_hops: 10,
        path: ['node-2', 'node-1'],
        finder_id: 'node-1',
        thrown_at: '2026-04-16T00:00:00.000Z',
        found_at: '2026-04-16T01:00:00.000Z',
        expires_at: '2026-04-19T00:00:00.000Z',
      },
    });
    expect(JSON.parse(inboxRes.payload)).toEqual({
      success: true,
      bottles: [],
      total: 0,
      data: [],
    });
    expect(JSON.parse(detailRes.payload)).toEqual({
      success: true,
      bottle: { bottle_id: 'bottle-1' },
      data: { bottle_id: 'bottle-1' },
    });
    expect(JSON.parse(rescueRes.payload)).toEqual({
      success: true,
      rescue_id: 'rescue_bottle-1',
      bottle_id: 'bottle-1',
      status: 'resolved',
      message: 'Rescue completed!',
      data: {
        bottle_id: 'bottle-1',
        sender_id: 'node-2',
        status: 'replied',
        signals: ['python'],
        hops: 1,
        max_hops: 10,
        path: ['node-2', 'node-1'],
        finder_id: 'node-1',
        reply: 'Use TaskGroup',
        thrown_at: '2026-04-16T00:00:00.000Z',
        found_at: '2026-04-16T01:00:00.000Z',
        expires_at: '2026-04-19T00:00:00.000Z',
      },
    });
    expect(JSON.parse(rejectRes.payload)).toEqual({
      success: true,
      bottle_id: 'bottle-1',
      status: 'discarded',
      data: {
        bottle_id: 'bottle-1',
        sender_id: 'node-2',
        status: 'discarded',
        signals: ['python'],
        hops: 1,
        max_hops: 10,
        path: ['node-2', 'node-1'],
        finder_id: 'node-1',
        thrown_at: '2026-04-16T00:00:00.000Z',
        found_at: '2026-04-16T01:00:00.000Z',
        expires_at: '2026-04-19T00:00:00.000Z',
      },
    });
  });
});
