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
      subscription_id: 'sub-1',
      node_id: 'node-1',
      plan: 'premium',
      billing_cycle: 'monthly',
      status: 'active',
      current_period_start: '2026-03-01T00:00:00Z',
      current_period_end: '2026-03-31T23:59:59Z',
      auto_renew: true,
      total_paid: 2000,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/subscription',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetSubscriptionStatus).toHaveBeenCalledWith('node-1');
    expect(JSON.parse(response.payload)).toMatchObject({
      success: true,
      subscription: {
        subscription_id: 'sub-1',
        plan: 'premium',
        status: 'active',
        billing_cycle: 'monthly',
        next_charge: 2000,
        features: {
          carbon_tax_multiplier: 1,
        },
      },
    });
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
      subscription_id: 'sub-1',
      node_id: 'node-1',
      plan: 'ultra',
      billing_cycle: 'monthly',
      status: 'active',
      current_period_start: '2026-03-01T00:00:00Z',
      current_period_end: '2026-03-31T23:59:59Z',
      auto_renew: true,
      total_paid: 10000,
    });
    mockCancelSubscription.mockResolvedValue(undefined);
    mockGetSubscriptionStatus
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        subscription_id: 'sub-1',
        node_id: 'node-1',
        plan: 'ultra',
        billing_cycle: 'monthly',
        status: 'active',
        current_period_start: '2026-03-01T00:00:00Z',
        current_period_end: '2026-03-31T23:59:59Z',
        auto_renew: false,
        total_paid: 10000,
      });

    const changeResponse = await app.inject({
      method: 'POST',
      url: '/subscription/change',
      payload: { plan: 'enterprise', billing_cycle: 'monthly' },
    });
    const cancelResponse = await app.inject({
      method: 'POST',
      url: '/subscription/cancel',
    });

    expect(changeResponse.statusCode).toBe(200);
    expect(cancelResponse.statusCode).toBe(200);
    expect(JSON.parse(changeResponse.payload)).toMatchObject({
      status: 'ok',
      amount_charged: 10000,
      effective_immediately: true,
    });
    expect(JSON.parse(cancelResponse.payload)).toMatchObject({
      status: 'ok',
      downgrade_to: 'free',
      grace_period_until: '2026-03-31T23:59:59Z',
    });
    expect(mockCreateOrUpdateSubscription).toHaveBeenCalledWith(
      'node-1',
      'ultra',
      'monthly',
      true,
    );
    expect(mockCancelSubscription).toHaveBeenCalledWith('node-1');
    expect(mockGetSubscriptionStatus).toHaveBeenCalledWith('node-1');
  });

  it('surfaces scheduled downgrades on the canonical change route', async () => {
    mockCreateOrUpdateSubscription.mockResolvedValue({
      subscription_id: 'sub-1',
      node_id: 'node-1',
      plan: 'ultra',
      billing_cycle: 'monthly',
      scheduled_plan: 'premium',
      scheduled_billing_cycle: 'monthly',
      scheduled_change_at: '2026-03-31T23:59:59Z',
      status: 'active',
      current_period_start: '2026-03-01T00:00:00Z',
      current_period_end: '2026-03-31T23:59:59Z',
      auto_renew: true,
      total_paid: 10000,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/subscription/change',
      payload: { plan: 'premium', billing_cycle: 'monthly' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toMatchObject({
      status: 'ok',
      amount_charged: 10000,
      effective_immediately: false,
      scheduled_plan: 'premium',
      scheduled_change_at: '2026-03-31T23:59:59Z',
    });
  });

  it('returns a paused-aware cancel response when auto-renew is disabled on a paused subscription', async () => {
    mockCancelSubscription.mockResolvedValue(undefined);
    mockGetSubscriptionStatus.mockResolvedValue({
      subscription_id: 'sub-1',
      node_id: 'node-1',
      plan: 'premium',
      billing_cycle: 'monthly',
      status: 'paused',
      current_period_start: '2026-03-01T00:00:00Z',
      current_period_end: '2026-03-31T23:59:59Z',
      auto_renew: false,
      total_paid: 2000,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/subscription/cancel',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toMatchObject({
      status: 'ok',
      message: 'Auto-renew disabled while the subscription remains paused.',
      grace_period_until: null,
      downgrade_to: null,
    });
  });

  it('lists invoices from the canonical root route', async () => {
    mockListInvoices.mockResolvedValue({
      items: [{ invoice_id: 'inv-1', amount: 2000 }],
      total: 1,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/subscription/invoices?limit=10&offset=5',
    });

    expect(response.statusCode).toBe(200);
    expect(mockListInvoices).toHaveBeenCalledWith('node-1', 10, 5);
    expect(JSON.parse(response.payload)).toMatchObject({
      success: true,
      invoices: [{ invoice_id: 'inv-1', amount: 2000 }],
      total: 1,
    });
  });

  it('rejects invalid invoice pagination params', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/subscription/invoices?limit=-1&offset=abc',
    });

    expect(response.statusCode).toBe(400);
    expect(mockListInvoices).not.toHaveBeenCalled();
  });

  it('does not double-charge unchanged subscription changes', async () => {
    mockGetSubscriptionStatus.mockResolvedValue({
      subscription_id: 'sub-1',
      node_id: 'node-1',
      plan: 'premium',
      billing_cycle: 'monthly',
      status: 'active',
      current_period_start: '2026-03-01T00:00:00Z',
      current_period_end: '2026-03-31T23:59:59Z',
      auto_renew: true,
      total_paid: 2000,
    });
    mockCreateOrUpdateSubscription.mockResolvedValue({
      subscription_id: 'sub-1',
      node_id: 'node-1',
      plan: 'premium',
      billing_cycle: 'monthly',
      status: 'active',
      current_period_start: '2026-03-01T00:00:00Z',
      current_period_end: '2026-03-31T23:59:59Z',
      auto_renew: true,
      total_paid: 2000,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/subscription/change',
      payload: { plan: 'premium', billing_cycle: 'monthly' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toMatchObject({
      amount_charged: 0,
    });
  });
});
