import fastify, { type FastifyInstance } from 'fastify';
import { claimRoutes } from './routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'session',
  trust_level: 'trusted',
  userId: 'user-1',
};

const mockGetClaimInfo = jest.fn();
const mockClaimNode = jest.fn();

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
  getClaimInfo: (...args: unknown[]) => mockGetClaimInfo(...args),
  claimNode: (...args: unknown[]) => mockClaimNode(...args),
}));

function buildApp(prisma: unknown): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', prisma as any);
  return app;
}

describe('Claim routes', () => {
  let app: FastifyInstance;
  let prisma: { marker: string };

  beforeEach(async () => {
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    };
    prisma = { marker: 'claim-prisma' };
    app = buildApp(prisma);
    await app.register(claimRoutes, { prefix: '/claim' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('passes app prisma to claim info lookup', async () => {
    mockGetClaimInfo.mockResolvedValue({
      node_id: 'node-1',
      model: 'gpt',
      reputation: 50,
      credit_balance: 500,
      registered_at: '2026-01-01T00:00:00Z',
      already_claimed: false,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/claim/abc123',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetClaimInfo).toHaveBeenCalledWith('ABC123', prisma);
  });

  it('passes app prisma to node claiming', async () => {
    mockClaimNode.mockResolvedValue({
      node_id: 'node-1',
      model: 'gpt',
      reputation: 50,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/claim/abc123',
    });

    expect(response.statusCode).toBe(200);
    expect(mockClaimNode).toHaveBeenCalledWith('ABC123', 'user-1', prisma);
  });
});
