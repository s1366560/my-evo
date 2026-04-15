import fastify, { type FastifyInstance } from 'fastify';
import { antiHallucinationCompatibilityRoutes } from './compat-routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'node_secret',
  trust_level: 'trusted',
  userId: undefined as string | undefined,
};

const mockPerformCheck = jest.fn();
const mockGetCheckStats = jest.fn();

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
  requireNodeSecretAuth: () => async (
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
  performCheck: (...args: unknown[]) => mockPerformCheck(...args),
  getCheckStats: (...args: unknown[]) => mockGetCheckStats(...args),
}));

function buildApp(): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', {
    node: {
      findFirst: jest.fn().mockResolvedValue({ node_id: 'node-1' }),
      findMany: jest.fn().mockResolvedValue([{ node_id: 'node-1' }]),
    },
  } as any);
  return app;
}

describe('Anti-hallucination compatibility routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'node_secret',
      trust_level: 'trusted',
      userId: undefined,
    };
    app = buildApp();
    await app.register(antiHallucinationCompatibilityRoutes, { prefix: '/verify' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('supports the claim compatibility endpoint', async () => {
    mockPerformCheck.mockResolvedValue({
      check_id: 'chk-claim',
      confidence: 0.82,
      validation_type: 'claim',
      result: {
        passed: true,
        summary: 'Claim validated',
        validations: [{ type: 'claim', passed: true, message: 'Claim validated' }],
        alerts: [],
        suggestions: [],
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/verify/claim',
      payload: {
        claim: 'Use requests.get(url, stream=True) to download files safely.',
        asset_id: 'asset-1',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.payload)).toMatchObject({
      success: true,
      passed: true,
      confidence: 0.82,
    });
    expect(mockPerformCheck).toHaveBeenCalledWith(
      'node-1',
      'Use requests.get(url, stream=True) to download files safely.',
      'claim',
      'asset-1',
      undefined,
      undefined,
    );
  });

  it('supports batch verification compatibility endpoint', async () => {
    mockPerformCheck
      .mockResolvedValueOnce({
        check_id: 'chk-1',
        confidence: 0.91,
        validation_type: 'claim',
        result: {
          passed: true,
          summary: 'First claim validated',
          validations: [{ type: 'claim', passed: true, message: 'First claim validated' }],
          alerts: [],
          suggestions: [],
        },
      })
      .mockResolvedValueOnce({
        check_id: 'chk-2',
        confidence: 0.22,
        validation_type: 'claim',
        result: {
          passed: false,
          summary: 'Second claim failed',
          validations: [{ type: 'claim', passed: false, message: 'Second claim failed' }],
          alerts: [
            {
              type: 'invalid_api',
              level: 'L3',
              message: 'requests.download() does not exist',
              suggestion: 'Use requests.get() instead',
              line: 1,
              confidence: 0.95,
            },
          ],
          suggestions: ['Use requests.get() instead'],
        },
      });

    const response = await app.inject({
      method: 'POST',
      url: '/verify/batch',
      payload: {
        claims: [
          { claim: 'requests.get(url, stream=True)' },
          { code_content: 'requests.download(url)' },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.payload)).toMatchObject({
      success: true,
      total: 2,
      passed: 1,
      failed: 1,
    });
    expect(mockPerformCheck).toHaveBeenCalledTimes(2);
  });

  it('keeps verification stats public', async () => {
    mockGetCheckStats.mockResolvedValue({
      total_checks: 2,
      avg_confidence: 0.5,
      checks_with_alerts: 1,
      alert_rate: 0.5,
      recent_24h: 1,
      by_validation_type: { claim: 2 },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/verify/stats',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetCheckStats).toHaveBeenCalledTimes(1);
  });

  it('rejects session-authenticated compatibility verification writes', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    };

    const [claimResponse, batchResponse] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/verify/claim',
        payload: {
          claim: 'Safe claim',
        },
      }),
      app.inject({
        method: 'POST',
        url: '/verify/batch',
        payload: {
          claims: [{ claim: 'Safe claim' }],
        },
      }),
    ]);

    expect(claimResponse.statusCode).toBe(403);
    expect(batchResponse.statusCode).toBe(403);
    expect(mockPerformCheck).not.toHaveBeenCalled();
  });
});
