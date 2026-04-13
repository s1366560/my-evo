import fastify, { type FastifyInstance } from 'fastify';
import { sessionRoutes } from './routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'session',
  trust_level: 'trusted',
};

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

function buildApp(prisma: unknown): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', prisma as any);
  return app;
}

describe('Session routes', () => {
  beforeEach(() => {
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'session',
      trust_level: 'trusted',
    };
  });

  it('keeps prisma isolated per app instance for session reads', async () => {
    const prismaA = {
      collaborationSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-a',
          creator_id: 'node-1',
          status: 'active',
          members: [{ node_id: 'node-1', role: 'organizer', is_active: true }],
          context: {},
          updated_at: new Date('2026-01-01T00:00:00Z'),
        }),
      },
    };
    const prismaB = {
      collaborationSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-b',
          creator_id: 'node-1',
          status: 'active',
          members: [{ node_id: 'node-1', role: 'organizer', is_active: true }],
          context: {},
          updated_at: new Date('2026-01-02T00:00:00Z'),
        }),
      },
    };
    const appA = buildApp(prismaA);
    const appB = buildApp(prismaB);

    try {
      await appA.register(sessionRoutes, { prefix: '/api/v2/session' });
      await appB.register(sessionRoutes, { prefix: '/api/v2/session' });
      await Promise.all([appA.ready(), appB.ready()]);

      const [responseA, responseB] = await Promise.all([
        appA.inject({ method: 'GET', url: '/api/v2/session/session-a' }),
        appB.inject({ method: 'GET', url: '/api/v2/session/session-b' }),
      ]);

      expect(responseA.statusCode).toBe(200);
      expect(responseB.statusCode).toBe(200);
      expect(JSON.parse(responseA.payload).data.id).toBe('session-a');
      expect(JSON.parse(responseB.payload).data.id).toBe('session-b');
      expect(prismaA.collaborationSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-a' },
      });
      expect(prismaB.collaborationSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-b' },
      });
    } finally {
      await Promise.all([appA.close(), appB.close()]);
    }
  });
});
