import fastify, { type FastifyInstance } from 'fastify';
import { antiHallucinationRoutes } from './routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'node_secret',
  trust_level: 'trusted',
  userId: undefined as string | undefined,
};

const mockValidateCode = jest.fn();
const mockDetectHallucination = jest.fn();
const mockGetCheck = jest.fn();
const mockGetConfidence = jest.fn();
const mockListForbiddenPatterns = jest.fn();
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
  requireTrustLevel: () => async (
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
  validateCode: (...args: unknown[]) => mockValidateCode(...args),
  detectHallucination: (...args: unknown[]) => mockDetectHallucination(...args),
  getCheck: (...args: unknown[]) => mockGetCheck(...args),
  getConfidence: (...args: unknown[]) => mockGetConfidence(...args),
  listForbiddenPatterns: (...args: unknown[]) => mockListForbiddenPatterns(...args),
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

describe('Anti-hallucination routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'node_secret',
      trust_level: 'trusted',
      userId: undefined,
    };
    app = buildApp();
    await app.register(antiHallucinationRoutes, { prefix: '/anti' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('supports the validate endpoint', async () => {
    mockValidateCode.mockResolvedValue({ check_id: 'chk-validate' });

    const response = await app.inject({
      method: 'POST',
      url: '/anti/validate',
      payload: {
        code_content: 'const x = 1;',
        asset_id: 'asset-1',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockValidateCode).toHaveBeenCalledWith('node-1', 'const x = 1;', 'asset-1');
  });

  it('resolves owned nodes for session-authenticated validation', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    };
    (app.prisma as any).node.findFirst.mockResolvedValue({ node_id: 'node-2' });
    mockValidateCode.mockResolvedValue({ check_id: 'chk-validate' });

    const response = await app.inject({
      method: 'POST',
      url: '/anti/validate',
      payload: {
        code_content: 'const x = 1;',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockValidateCode).toHaveBeenCalledWith('node-2', 'const x = 1;', undefined);
  });

  it('supports the detect endpoint', async () => {
    mockDetectHallucination.mockResolvedValue({ check_id: 'chk-detect' });

    const response = await app.inject({
      method: 'POST',
      url: '/anti/detect',
      payload: {
        code_content: 'const secret = "abc123456";',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockDetectHallucination).toHaveBeenCalledWith('node-1', 'const secret = "abc123456";', undefined);
  });

  it('returns confidence details for the caller', async () => {
    mockGetConfidence.mockResolvedValue({ check_id: 'chk-1', confidence: 0.92 });

    const response = await app.inject({
      method: 'GET',
      url: '/anti/confidence?asset_id=asset-1',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetConfidence).toHaveBeenCalledWith('node-1', {
      checkId: undefined,
      assetId: 'asset-1',
    });
  });

  it('returns forbidden patterns and stats', async () => {
    mockListForbiddenPatterns.mockReturnValue([{ id: 'hardcoded-secrets' }]);
    mockGetCheckStats.mockResolvedValue({ total_checks: 4 });

    const [patternsResponse, statsResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/anti/patterns',
      }),
      app.inject({
        method: 'GET',
        url: '/anti/stats',
      }),
    ]);

    expect(patternsResponse.statusCode).toBe(200);
    expect(statsResponse.statusCode).toBe(200);
    expect(mockListForbiddenPatterns).toHaveBeenCalledTimes(1);
    expect(mockGetCheckStats).toHaveBeenCalledTimes(1);
  });

  it('requires auth when reading a specific check and scopes it to the caller', async () => {
    mockGetCheck.mockResolvedValue({ check_id: 'chk-1', node_id: 'node-1' });

    const response = await app.inject({
      method: 'GET',
      url: '/anti/checks/chk-1',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetCheck).toHaveBeenCalledWith('chk-1', 'node-1');
  });
});
