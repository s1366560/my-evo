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
});
