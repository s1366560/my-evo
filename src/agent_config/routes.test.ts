import fastify, { type FastifyInstance } from 'fastify';
import { agentConfigRoutes } from './routes';
import { _resetTestState, auditAction, updateAgentConstraints, updateAgentPermissions, upsertAgentConfig } from './service';

jest.mock('../shared/auth', () => ({
  authenticate: async (request: { headers: Record<string, string | undefined> }) => {
    const header = request.headers.authorization;
    if (header === 'Bearer trusted-node-1') {
      return {
        node_id: 'node-1',
        trust_level: 'trusted',
        auth_type: 'node_secret',
      };
    }
    if (header === 'Bearer node-2') {
      return {
        node_id: 'node-2',
        trust_level: 'verified',
        auth_type: 'node_secret',
      };
    }

    const { UnauthorizedError } = jest.requireActual('../shared/errors');
    throw new UnauthorizedError();
  },
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Agent config routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    _resetTestState();
    app = buildApp();
    await app.register(agentConfigRoutes, { prefix: '/api/v2' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('scopes config reads to the authenticated agent', async () => {
    upsertAgentConfig('node-1');

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/agent-config/node-1',
      headers: { authorization: 'Bearer trusted-node-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload).data.agent_id).toBe('node-1');
  });

  it('rejects access to another agent config', async () => {
    upsertAgentConfig('node-1');

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/agent-config/node-1',
      headers: { authorization: 'Bearer node-2' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('creates configs for the authenticated agent only', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/agent-config',
      headers: { authorization: 'Bearer trusted-node-1' },
      payload: { agent_id: 'node-2' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('limits global audit reads to the authenticated agent logs', async () => {
    auditAction('node-1', 'permission_check', { action: 'read' });
    auditAction('node-2', 'permission_check', { action: 'write' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/agent-config/audit',
      headers: { authorization: 'Bearer trusted-node-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].agent_id).toBe('node-1');
  });

  it('requires trusted auth to mutate global registries', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/agent-config/permissions',
      headers: { authorization: 'Bearer node-2' },
      payload: {
        name: 'Read assets',
        scope: 'assets_read',
        description: 'Allows reading assets',
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('does not trust client-supplied trust_level during checks', async () => {
    upsertAgentConfig('node-2');
    updateAgentPermissions('node-2', ['publish']);
    updateAgentConstraints('node-2', { min_trust_level: 'trusted' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/agent-config/node-2/check',
      headers: { authorization: 'Bearer node-2' },
      payload: {
        action: 'publish',
        context: { trust_level: 'trusted' },
      },
    });

    expect(response.statusCode).toBe(429);
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({
      allowed: false,
      reason: 'constraint_violation',
    }));
  });

  it('passes request context through conditional permission checks', async () => {
    upsertAgentConfig('node-2');
    updateAgentPermissions(
      'node-2',
      ['read'],
      [],
      [{ scope: 'publish', condition: 'request.approved == true' }],
    );

    const allowed = await app.inject({
      method: 'POST',
      url: '/api/v2/agent-config/node-2/check',
      headers: { authorization: 'Bearer node-2' },
      payload: {
        action: 'publish',
        context: { request: { approved: true } },
      },
    });

    const denied = await app.inject({
      method: 'POST',
      url: '/api/v2/agent-config/node-2/check',
      headers: { authorization: 'Bearer node-2' },
      payload: {
        action: 'publish',
        context: { request: { approved: false } },
      },
    });

    expect(allowed.statusCode).toBe(200);
    expect(JSON.parse(allowed.payload)).toEqual(expect.objectContaining({
      allowed: true,
      action: 'publish',
    }));
    expect(denied.statusCode).toBe(403);
  });
});
