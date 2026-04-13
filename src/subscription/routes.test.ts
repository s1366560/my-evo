import fastify, { type FastifyInstance } from 'fastify';
import { subscriptionRoutes } from './routes';
import { subscriptionPublicRoutes } from './public-routes';

let mockAuth: {
  node_id: string;
  auth_type?: string;
  trust_level?: string;
  userId?: string;
} = {
  node_id: 'node-1',
  auth_type: 'node_secret',
  trust_level: 'trusted',
};

const mockGetPlans = jest.fn();
const mockGetSubscription = jest.fn();
const mockListInvoices = jest.fn();
const mockCreateOrUpdateSubscription = jest.fn();
const mockCancelSubscription = jest.fn();
const mockGetSubscriptionStatus = jest.fn();

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (
    request: {
      auth?: {
        node_id: string;
        auth_type?: string;
        trust_level?: string;
        userId?: string;
      };
    },
  ) => {
    request.auth = mockAuth;
  },
}));

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  getPlans: (...args: unknown[]) => mockGetPlans(...args),
  getSubscription: (...args: unknown[]) => mockGetSubscription(...args),
  listInvoices: (...args: unknown[]) => mockListInvoices(...args),
  createOrUpdateSubscription: (...args: unknown[]) => mockCreateOrUpdateSubscription(...args),
  cancelSubscription: (...args: unknown[]) => mockCancelSubscription(...args),
  getSubscriptionStatus: (...args: unknown[]) => mockGetSubscriptionStatus(...args),
}));

function buildApp(): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', {
    node: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  } as any);
  return app;
}

describe('Subscription routes', () => {
  let app: FastifyInstance;
  let prisma: {
    node: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'node_secret',
      trust_level: 'trusted',
    };
    app = buildApp();
    prisma = app.prisma as unknown as typeof prisma;
    await app.register(subscriptionRoutes, { prefix: '/api/v2/subscription' });
    await app.register(subscriptionPublicRoutes, { prefix: '/subscription' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists canonical plans from the shared plan service', async () => {
    mockGetPlans.mockReturnValue([
      {
        id: 'free',
        name: 'Free',
        description: 'Starter plan',
        price_monthly_credits: 0,
        price_annual_credits: 0,
        features: [],
        limits: {},
      },
      {
        id: 'premium',
        name: 'Premium',
        description: 'Professional plan',
        price_monthly_credits: 2000,
        price_annual_credits: 19200,
        features: [],
        limits: {},
      },
      {
        id: 'ultra',
        name: 'Ultra',
        description: 'Enterprise plan',
        price_monthly_credits: 10000,
        price_annual_credits: 96000,
        features: [],
        limits: {},
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/subscription/plans',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload).data.map((plan: { id: string }) => plan.id)).toEqual([
      'free',
      'premium',
      'ultra',
    ]);
  });

  it('normalizes legacy plan and billing cycle aliases on the v2 subscription route', async () => {
    mockCreateOrUpdateSubscription.mockResolvedValue({
      node_id: 'node-1',
      plan: 'premium',
      billing_cycle: 'annual',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/subscription',
      payload: {
        plan: 'pro',
        billing_cycle: 'yearly',
        auto_renew: false,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockCreateOrUpdateSubscription).toHaveBeenCalledWith(
      'node-1',
      'premium',
      'annual',
      false,
    );
  });

  it('returns the authenticated node subscription on the canonical root route', async () => {
    mockGetSubscriptionStatus.mockResolvedValue({
      node_id: 'node-1',
      plan: 'premium',
      billing_cycle: 'monthly',
      status: 'active',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/subscription',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetSubscriptionStatus).toHaveBeenCalledWith('node-1');
  });

  it('allows session callers to manage subscriptions for owned nodes', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    };
    prisma.node.findFirst.mockResolvedValue({ node_id: 'node-2' });
    mockGetSubscriptionStatus.mockResolvedValue({
      node_id: 'node-2',
      plan: 'premium',
      billing_cycle: 'monthly',
      status: 'active',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/subscription?node_id=node-2',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetSubscriptionStatus).toHaveBeenCalledWith('node-2');
  });

  it('requires an explicit node_id when a session owns multiple nodes', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    };
    prisma.node.findFirst.mockResolvedValue(null);
    prisma.node.findMany.mockResolvedValue([{ node_id: 'node-1' }, { node_id: 'node-2' }]);

    const response = await app.inject({
      method: 'GET',
      url: '/subscription',
    });

    expect(response.statusCode).toBe(400);
    expect(mockGetSubscriptionStatus).not.toHaveBeenCalled();
  });

  it('rejects v2 subscription reads for nodes the caller does not own', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    };
    prisma.node.findFirst.mockResolvedValue(null);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/subscription/node-2',
    });

    expect(response.statusCode).toBe(401);
    expect(mockGetSubscription).not.toHaveBeenCalled();
  });

  it('changes and cancels subscriptions through canonical root routes', async () => {
    mockCreateOrUpdateSubscription.mockResolvedValue({
      node_id: 'node-1',
      plan: 'ultra',
      billing_cycle: 'monthly',
    });
    mockCancelSubscription.mockResolvedValue(undefined);

    const [changeResponse, cancelResponse] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/subscription/change',
        payload: { plan: 'enterprise', billing_cycle: 'monthly' },
      }),
      app.inject({
        method: 'POST',
        url: '/subscription/cancel',
      }),
    ]);

    expect(changeResponse.statusCode).toBe(200);
    expect(cancelResponse.statusCode).toBe(200);
    expect(mockCreateOrUpdateSubscription).toHaveBeenCalledWith(
      'node-1',
      'ultra',
      'monthly',
      true,
    );
    expect(mockCancelSubscription).toHaveBeenCalledWith('node-1');
  });
});
