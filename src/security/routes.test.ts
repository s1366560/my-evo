import fastify, { type FastifyInstance } from 'fastify';
import { securityRoutes } from './routes';

let mockAuth = {
  node_id: 'node-1',
  trust_level: 'trusted',
};

jest.mock('../shared/auth', () => ({
  requireTrustLevel: () => async (
    request: {
      auth?: {
        node_id: string;
        trust_level: string;
      };
    },
  ) => {
    if (mockAuth.trust_level !== 'trusted') {
      const error = new Error('Forbidden') as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }

    request.auth = mockAuth;
  },
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('securityRoutes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockAuth = {
      node_id: 'node-1',
      trust_level: 'trusted',
    };
    app = buildApp();
    await app.register(securityRoutes, { prefix: '/api/v2' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('blocks untrusted callers from mutating the security control plane', async () => {
    mockAuth = {
      node_id: 'node-2',
      trust_level: 'verified',
    };

    const [assignResponse, clearResponse, resolveResponse] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/v2/security/rbac/assign',
        payload: { node_id: 'node-3', role: 'operator' },
      }),
      app.inject({
        method: 'DELETE',
        url: '/api/v2/security/rate-limit/node-3',
      }),
      app.inject({
        method: 'PATCH',
        url: '/api/v2/security/events/event-1/resolve',
      }),
    ]);

    expect(assignResponse.statusCode).toBe(403);
    expect(clearResponse.statusCode).toBe(403);
    expect(resolveResponse.statusCode).toBe(403);
  });

  it('allows trusted callers to assign RBAC roles', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/security/rbac/assign',
      payload: { node_id: 'node-3', role: 'operator' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      data: {
        node_id: 'node-3',
        role: 'operator',
      },
    });
  });
});
