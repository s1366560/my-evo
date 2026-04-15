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
const mockPerformCheck = jest.fn();
const mockGetCheck = jest.fn();
const mockGetConfidence = jest.fn();
const mockListForbiddenPatterns = jest.fn();
const mockGetCheckStats = jest.fn();
const mockAddAnchor = jest.fn();
const mockUpsertGraphNode = jest.fn();
const mockCreateGraphEdge = jest.fn();

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
  performCheck: (...args: unknown[]) => mockPerformCheck(...args),
  validateCode: (...args: unknown[]) => mockValidateCode(...args),
  detectHallucination: (...args: unknown[]) => mockDetectHallucination(...args),
  getCheck: (...args: unknown[]) => mockGetCheck(...args),
  getConfidence: (...args: unknown[]) => mockGetConfidence(...args),
  listForbiddenPatterns: (...args: unknown[]) => mockListForbiddenPatterns(...args),
  getCheckStats: (...args: unknown[]) => mockGetCheckStats(...args),
  addAnchor: (...args: unknown[]) => mockAddAnchor(...args),
  upsertGraphNode: (...args: unknown[]) => mockUpsertGraphNode(...args),
  createGraphEdge: (...args: unknown[]) => mockCreateGraphEdge(...args),
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
        language: 'typescript',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockValidateCode).toHaveBeenCalledWith('node-1', 'const x = 1;', 'asset-1', 'typescript');
  });

  it('supports the check endpoint with architecture-compatible payload fields', async () => {
    mockPerformCheck.mockResolvedValue({
      check_id: 'chk-check',
      confidence: 0.91,
      validation_type: 'check',
      result: {
        passed: false,
        has_hallucination: true,
        checks_passed: false,
        summary: 'Detected 1 potential issue(s) in code',
        validations: [
          { type: 'syntax', passed: true, message: 'Syntax valid' },
          { type: 'security', passed: true, message: 'No security risks detected' },
        ],
        details: ['Potential hardcoded secret or credential detected'],
        alerts: [
          {
            type: 'hardcoded_secret',
            level: 'L3',
            message: 'Potential hardcoded secret or credential detected',
            suggestion: 'Move credentials to environment variables or a secrets manager.',
            line: 1,
            confidence: 0.95,
          },
        ],
        suggestions: ['Move credentials to environment variables or a secrets manager.'],
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/anti/check',
      payload: {
        code: 'const x = 1;',
        language: 'typescript',
        trust_anchors: [{ type: 'document', source: 'ts-docs', confidence: 0.9 }],
        asset_id: 'asset-1',
      },
    });
    const payload = JSON.parse(response.payload);

    expect(response.statusCode).toBe(201);
    expect(payload).toMatchObject({
      passed: false,
      confidence: 0.91,
      validations: expect.arrayContaining([
        {
          type: 'syntax',
          passed: true,
          message: 'Syntax valid',
        },
        {
          type: 'security',
          passed: true,
          message: 'No security risks detected',
        },
      ]),
    });
    expect(payload.alerts).toEqual([
      expect.objectContaining({
        type: 'hardcoded_secret',
        level: 'L3',
        message: 'Potential hardcoded secret or credential detected',
        suggestion: 'Move credentials to environment variables or a secrets manager.',
        line: 1,
        confidence: 0.95,
      }),
    ]);
    expect(payload.suggestions).toContain('Move credentials to environment variables or a secrets manager.');
    expect(mockPerformCheck).toHaveBeenCalledWith(
      'node-1',
      'const x = 1;',
      'check',
      'asset-1',
      'typescript',
      [{ type: 'document', source: 'ts-docs', confidence: 0.9 }],
    );
  });

  it('rejects session-authenticated validation', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/anti/validate',
      payload: {
        code_content: 'const x = 1;',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(mockValidateCode).not.toHaveBeenCalled();
  });

  it('rejects session-authenticated anti-hallucination mutations', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    };

    const [anchorResponse, nodeResponse, edgeResponse] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/anti/anchors',
        payload: {
          type: 'document',
          source: 'spec',
          confidence: 0.9,
          expires_at: '2099-01-01T00:00:00.000Z',
        },
      }),
      app.inject({
        method: 'POST',
        url: '/anti/graph/nodes',
        payload: {
          node_id: 'node-1',
          type: 'concept',
          label: 'Spec anchor',
        },
      }),
      app.inject({
        method: 'POST',
        url: '/anti/graph/edges',
        payload: {
          source_id: 'node-1',
          target_id: 'node-2',
          relation: 'depends_on',
        },
      }),
    ]);

    expect(anchorResponse.statusCode).toBe(403);
    expect(nodeResponse.statusCode).toBe(403);
    expect(edgeResponse.statusCode).toBe(403);
    expect(mockAddAnchor).not.toHaveBeenCalled();
    expect(mockUpsertGraphNode).not.toHaveBeenCalled();
    expect(mockCreateGraphEdge).not.toHaveBeenCalled();
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
