import fastify, { type FastifyInstance } from 'fastify';
import { quarantineRoutes } from './routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'session',
  trust_level: 'trusted',
};

const mockListHistory = jest.fn();
const mockSubmitAppeal = jest.fn();
const mockListAppeals = jest.fn();
const mockReviewAppeal = jest.fn();

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
  requireTrustLevel: () => async (
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
  ...jest.requireActual('./service'),
  listHistory: (...args: unknown[]) => mockListHistory(...args),
  submitAppeal: (...args: unknown[]) => mockSubmitAppeal(...args),
  listAppeals: (...args: unknown[]) => mockListAppeals(...args),
  reviewAppeal: (...args: unknown[]) => mockReviewAppeal(...args),
}));

function buildApp(): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', {} as any);
  return app;
}

describe('Quarantine routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'session',
      trust_level: 'trusted',
    };
    app = buildApp();
    await app.register(quarantineRoutes, { prefix: '/api/v2/quarantine' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('submits quarantine appeals for the authenticated node', async () => {
    mockSubmitAppeal.mockResolvedValue({ appeal_id: 'qap_1', status: 'submitted' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/quarantine/node-1/appeal',
      payload: {
        grounds: 'Need a human review for this quarantine',
        evidence: [{ source: 'audit-log' }],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockSubmitAppeal).toHaveBeenCalledWith(
      'node-1',
      'node-1',
      'Need a human review for this quarantine',
      [{ source: 'audit-log' }],
    );
  });

  it('lists quarantine history', async () => {
    mockListHistory.mockResolvedValue([{ node_id: 'node-1', level: 'L1' }]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/quarantine/history/node-1?limit=5',
    });

    expect(response.statusCode).toBe(200);
    expect(mockListHistory).toHaveBeenCalledWith('node-1', 5);
  });

  it('lists appeals for the requester', async () => {
    mockListAppeals.mockResolvedValue([{ appeal_id: 'qap_1' }]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/quarantine/node-1/appeals',
    });

    expect(response.statusCode).toBe(200);
    expect(mockListAppeals).toHaveBeenCalledWith('node-1');
  });

  it('allows trusted reviewers to review appeals', async () => {
    mockAuth = {
      node_id: 'moderator-1',
      auth_type: 'session',
      trust_level: 'trusted',
    };
    mockReviewAppeal.mockResolvedValue({ appeal_id: 'qap_1', status: 'approved' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/quarantine/appeals/qap_1/review',
      payload: {
        status: 'approved',
        resolution: 'Manual moderation error',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockReviewAppeal).toHaveBeenCalledWith(
      'qap_1',
      'moderator-1',
      'approved',
      'Manual moderation error',
    );
  });
});
