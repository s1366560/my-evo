import fastify, { type FastifyInstance } from 'fastify';
import { accountRoutes } from './routes';

let mockAuth: {
  node_id: string;
  auth_type?: string;
  trust_level?: string;
  userId?: string;
} = {
  node_id: 'node-1',
  auth_type: 'session',
  trust_level: 'trusted',
  userId: 'user-1',
};

const mockGetOnboardingState = jest.fn();
const mockCompleteOnboardingStep = jest.fn();
const mockResetOnboarding = jest.fn();

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
  getOnboardingState: (...args: unknown[]) => mockGetOnboardingState(...args),
  completeOnboardingStep: (...args: unknown[]) => mockCompleteOnboardingStep(...args),
  resetOnboarding: (...args: unknown[]) => mockResetOnboarding(...args),
}));

function buildApp(prisma: unknown): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', prisma as any);
  return app;
}

describe('Account routes', () => {
  beforeEach(() => {
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    };
    jest.clearAllMocks();
  });

  it('uses auth.userId when creating api keys', async () => {
    const prisma = {
      apiKey: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'key-1',
          prefix: 'ek_ab',
          name: 'Primary',
          scopes: ['read'],
          expires_at: null,
          created_at: new Date('2026-01-01T00:00:00Z'),
        }),
      },
    };
    const app = buildApp(prisma);

    try {
      await app.register(accountRoutes, { prefix: '/account' });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/account/api-keys',
        payload: {
          name: 'Primary',
          scopes: ['read'],
        },
      });

      expect(response.statusCode).toBe(201);
      expect(prisma.apiKey.count).toHaveBeenCalledWith({
        where: { user_id: 'user-1' },
      });
    } finally {
      await app.close();
    }
  });

  it('rejects non-session credentials for api key lifecycle routes', async () => {
    mockAuth = {
      node_id: 'node-secret-node',
      auth_type: 'node_secret',
      trust_level: 'trusted',
    };
    const prisma = {
      apiKey: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };
    const app = buildApp(prisma);

    try {
      await app.register(accountRoutes, { prefix: '/account' });
      await app.ready();

      const [createResponse, listResponse, deleteResponse] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/account/api-keys',
          payload: { name: 'Primary', scopes: ['read'] },
        }),
        app.inject({
          method: 'GET',
          url: '/account/api-keys',
        }),
        app.inject({
          method: 'DELETE',
          url: '/account/api-keys/key-1',
        }),
      ]);

      expect(createResponse.statusCode).toBe(401);
      expect(listResponse.statusCode).toBe(401);
      expect(deleteResponse.statusCode).toBe(401);
      expect(prisma.apiKey.count).not.toHaveBeenCalled();
      expect(prisma.apiKey.findMany).not.toHaveBeenCalled();
      expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('keeps prisma isolated per app instance for api key listings', async () => {
    const prismaA = {
      apiKey: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'key-a', prefix: 'ek_aa', name: 'A', scopes: ['read'], expires_at: null, created_at: new Date('2026-01-01T00:00:00Z') },
        ]),
      },
    };
    const prismaB = {
      apiKey: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'key-b', prefix: 'ek_bb', name: 'B', scopes: ['kg'], expires_at: null, created_at: new Date('2026-01-02T00:00:00Z') },
        ]),
      },
    };
    const appA = buildApp(prismaA);
    const appB = buildApp(prismaB);

    try {
      await appA.register(accountRoutes, { prefix: '/account' });
      await appB.register(accountRoutes, { prefix: '/account' });
      await Promise.all([appA.ready(), appB.ready()]);

      const [responseA, responseB] = await Promise.all([
        appA.inject({ method: 'GET', url: '/account/api-keys' }),
        appB.inject({ method: 'GET', url: '/account/api-keys' }),
      ]);

      expect(responseA.statusCode).toBe(200);
      expect(responseB.statusCode).toBe(200);
      expect(JSON.parse(responseA.payload).data[0].id).toBe('key-a');
      expect(JSON.parse(responseB.payload).data[0].id).toBe('key-b');
      expect(prismaA.apiKey.findMany).toHaveBeenCalledWith({
        where: { user_id: 'user-1' },
        orderBy: { created_at: 'desc' },
      });
      expect(prismaB.apiKey.findMany).toHaveBeenCalledWith({
        where: { user_id: 'user-1' },
        orderBy: { created_at: 'desc' },
      });
    } finally {
      await Promise.all([appA.close(), appB.close()]);
    }
  });

  it('resolves owned nodes for legacy onboarding routes', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    };

    const prisma = {
      node: {
        findFirst: jest.fn().mockResolvedValue({ node_id: 'node-2' }),
      },
    };
    mockGetOnboardingState.mockResolvedValue({
      agent_id: 'node-2',
      completed_steps: [],
      current_step: 1,
    });
    mockCompleteOnboardingStep.mockResolvedValue({
      agent_id: 'node-2',
      completed_steps: [1],
      current_step: 2,
    });
    mockResetOnboarding.mockResolvedValue({
      agent_id: 'node-2',
      completed_steps: [],
      current_step: 1,
    });
    const app = buildApp(prisma);

    try {
      await app.register(accountRoutes, { prefix: '/account' });
      await app.ready();

      const [getResponse, completeResponse, resetResponse] = await Promise.all([
        app.inject({
          method: 'GET',
          url: '/account/onboarding?agent_id=node-2',
        }),
        app.inject({
          method: 'POST',
          url: '/account/onboarding/complete',
          payload: { agent_id: 'node-2', step: 1 },
        }),
        app.inject({
          method: 'POST',
          url: '/account/onboarding/reset',
          payload: { agent_id: 'node-2' },
        }),
      ]);

      expect(getResponse.statusCode).toBe(200);
      expect(completeResponse.statusCode).toBe(200);
      expect(resetResponse.statusCode).toBe(200);
      expect(mockGetOnboardingState).toHaveBeenCalledWith('node-2', prisma);
      expect(mockCompleteOnboardingStep).toHaveBeenCalledWith('node-2', 1, prisma);
      expect(mockResetOnboarding).toHaveBeenCalledWith('node-2', prisma);
    } finally {
      await app.close();
    }
  });
});
