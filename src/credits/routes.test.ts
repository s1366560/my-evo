import fastify, { type FastifyInstance } from 'fastify';
import { creditRoutes } from './routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'session',
  trust_level: 'trusted',
};

const mockGetBalance = jest.fn();
const mockGetHistory = jest.fn();
const mockTransfer = jest.fn();

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
  getBalance: (...args: unknown[]) => mockGetBalance(...args),
  getHistory: (...args: unknown[]) => mockGetHistory(...args),
  transfer: (...args: unknown[]) => mockTransfer(...args),
}));

function buildApp(prisma: unknown): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', prisma as any);
  return app;
}

describe('Credits routes', () => {
  let app: FastifyInstance;
  let prisma: { marker: string };

  beforeEach(async () => {
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'session',
      trust_level: 'trusted',
    };
    prisma = { marker: 'credits-prisma' };
    app = buildApp(prisma);
    await app.register(creditRoutes, { prefix: '/' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('passes app prisma to balance and history reads', async () => {
    mockGetBalance.mockResolvedValue({ node_id: 'node-1', available: 100, locked: 0, total: 100, lifetime_earned: 10, lifetime_spent: 5 });
    mockGetHistory.mockResolvedValue({ items: [], total: 0 });

    const [balanceRes, historyRes] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/credits/node-1',
      }),
      app.inject({
        method: 'GET',
        url: '/credits/node-1/history?type=publish&limit=5&offset=2',
      }),
    ]);

    expect(balanceRes.statusCode).toBe(200);
    expect(historyRes.statusCode).toBe(200);
    expect(mockGetBalance).toHaveBeenCalledWith('node-1', prisma);
    expect(mockGetHistory).toHaveBeenCalledWith('node-1', 'publish', 5, 2, prisma);
    expect(JSON.parse(balanceRes.payload)).toEqual({
      success: true,
      node_id: 'node-1',
      available: 100,
      locked: 0,
      total: 100,
      lifetime_earned: 10,
      lifetime_spent: 5,
      data: {
        node_id: 'node-1',
        available: 100,
        locked: 0,
        total: 100,
        lifetime_earned: 10,
        lifetime_spent: 5,
      },
    });
    expect(JSON.parse(historyRes.payload)).toEqual({
      success: true,
      history: [],
      total: 0,
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 5,
      },
    });
  });

  it('passes app prisma to transfers', async () => {
    mockTransfer.mockResolvedValue({
      from_transaction: { transaction_id: 'tx-1' },
      to_transaction: { transaction_id: 'tx-2' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/credits/transfer',
      payload: {
        to_id: 'node-2',
        amount: 25,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockTransfer).toHaveBeenCalledWith('node-1', 'node-2', 25, prisma);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      from_transaction: { transaction_id: 'tx-1' },
      to_transaction: { transaction_id: 'tx-2' },
      data: {
        from_transaction: { transaction_id: 'tx-1' },
        to_transaction: { transaction_id: 'tx-2' },
      },
    });
  });

  it('exposes top-level credit pricing and economics fields', async () => {
    const [priceResponse, economicsResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/credit/price',
      }),
      app.inject({
        method: 'GET',
        url: '/credit/economics',
      }),
    ]);

    expect(priceResponse.statusCode).toBe(200);
    expect(economicsResponse.statusCode).toBe(200);
    expect(JSON.parse(priceResponse.payload)).toMatchObject({
      success: true,
      price_per_credit: 0.01,
      currency: 'USD',
      min_purchase: 100,
      max_purchase: 100000,
    });
    expect(JSON.parse(economicsResponse.payload)).toMatchObject({
      success: true,
      total_supply: 10000000,
      circulating: 5000000,
      price_per_credit_usd: 0.01,
      publish_gene_cost: 5,
      publish_capsule_cost: 10,
      publish_recipe_cost: 20,
      fetch_cost: 1,
    });
  });
});
