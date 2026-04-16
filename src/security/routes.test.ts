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
      assignment: {
        node_id: 'node-3',
        role: 'operator',
      },
      data: {
        node_id: 'node-3',
        role: 'operator',
      },
    });
  });

  it('exposes top-level aliases across security read endpoints', async () => {
    const [rolesResponse, rateCheckResponse, nodeRoleResponse, nodeCheckResponse, eventsResponse, anomalyResponse, anomalyHistoryResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/api/v2/security/roles',
      }),
      app.inject({
        method: 'POST',
        url: '/api/v2/security/rate-limit/check',
        payload: { identifier: 'node-1', max_requests: 5 },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v2/security/rbac/node/node-3',
      }),
      app.inject({
        method: 'POST',
        url: '/api/v2/security/rbac/node/node-3/check',
        payload: { permission: 'publish' },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v2/security/events',
      }),
      app.inject({
        method: 'POST',
        url: '/api/v2/security/anomaly',
        payload: { node_id: 'node-3', signals: [{ signal_type: 'unusual_pattern', score: 0.6, description: 'Spike' }] },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v2/security/anomaly/node-3/history',
      }),
    ]);

    expect(rolesResponse.statusCode).toBe(200);
    expect(rolesResponse.json()).toEqual(expect.objectContaining({
      success: true,
      roles: expect.any(Array),
      total: expect.any(Number),
      data: expect.any(Array),
    }));
    expect(rateCheckResponse.statusCode).toBe(200);
    expect(rateCheckResponse.json()).toEqual(expect.objectContaining({
      success: true,
      allowed: true,
      result: expect.objectContaining({
        allowed: true,
      }),
    }));
    expect(nodeRoleResponse.statusCode).toBe(200);
    expect(nodeRoleResponse.json()).toEqual({
      success: true,
      node_id: 'node-3',
      role: 'operator',
      data: { node_id: 'node-3', role: 'operator' },
    });
    expect(nodeCheckResponse.statusCode).toBe(200);
    expect(nodeCheckResponse.json()).toEqual(expect.objectContaining({
      success: true,
      node_id: 'node-3',
      permission: 'publish',
      result: expect.objectContaining({
        node_id: 'node-3',
        permission: 'publish',
      }),
    }));
    expect(eventsResponse.statusCode).toBe(200);
    expect(eventsResponse.json()).toEqual(expect.objectContaining({
      success: true,
      events: expect.any(Array),
      total: expect.any(Number),
      data: expect.any(Array),
    }));
    expect(anomalyResponse.statusCode).toBe(200);
    expect(anomalyResponse.json()).toEqual(expect.objectContaining({
      success: true,
      report: expect.objectContaining({
        node_id: 'node-3',
      }),
      data: expect.objectContaining({
        node_id: 'node-3',
      }),
    }));
    expect(anomalyHistoryResponse.statusCode).toBe(200);
    expect(anomalyHistoryResponse.json()).toEqual(expect.objectContaining({
      success: true,
      history: expect.any(Array),
      total: expect.any(Number),
      data: expect.any(Array),
    }));
  });
});
