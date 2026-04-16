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
const mockListChecks = jest.fn();
const mockGetConfidence = jest.fn();
const mockListForbiddenPatterns = jest.fn();
const mockGetCheckStats = jest.fn();
const mockAddAnchor = jest.fn();
const mockListAnchors = jest.fn();
const mockListGraphNodes = jest.fn();
const mockListGraphEdges = jest.fn();
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
  listChecks: (...args: unknown[]) => mockListChecks(...args),
  getConfidence: (...args: unknown[]) => mockGetConfidence(...args),
  listForbiddenPatterns: (...args: unknown[]) => mockListForbiddenPatterns(...args),
  getCheckStats: (...args: unknown[]) => mockGetCheckStats(...args),
  addAnchor: (...args: unknown[]) => mockAddAnchor(...args),
  listAnchors: (...args: unknown[]) => mockListAnchors(...args),
  listGraphNodes: (...args: unknown[]) => mockListGraphNodes(...args),
  listGraphEdges: (...args: unknown[]) => mockListGraphEdges(...args),
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
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      validation: { check_id: 'chk-validate' },
      data: { check_id: 'chk-validate' },
    });
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

  it('normalizes trust anchor fields from the architecture schema', async () => {
    mockPerformCheck.mockResolvedValue({
      check_id: 'chk-check-2',
      confidence: 0.8,
      validation_type: 'check',
      result: {
        passed: true,
        has_hallucination: false,
        checks_passed: true,
        summary: 'No obvious hallucinations detected',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/anti/check',
      payload: {
        code: 'print("ok")',
        trust_anchors: [{
          source_id: 'python-docs',
          source_type: 'official_doc',
          trust_score: 0.95,
          last_verified: '2026-04-01T00:00:00.000Z',
        }],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockPerformCheck).toHaveBeenCalledWith(
      'node-1',
      'print("ok")',
      'check',
      undefined,
      undefined,
      [{ type: 'official_doc', source: 'python-docs', confidence: 0.95 }],
    );
  });

  it('rejects unsupported validation_type values before persisting checks', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/anti/check',
      payload: {
        code: 'const x = 1;',
        validation_type: 'lintingg',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(mockPerformCheck).not.toHaveBeenCalled();
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
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      detection: { check_id: 'chk-detect' },
      data: { check_id: 'chk-detect' },
    });
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
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      check_id: 'chk-1',
      confidence: 0.92,
      data: { check_id: 'chk-1', confidence: 0.92 },
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
    expect(JSON.parse(patternsResponse.payload)).toEqual({
      success: true,
      patterns: [{ id: 'hardcoded-secrets' }],
      total: 1,
      data: [{ id: 'hardcoded-secrets' }],
    });
    expect(JSON.parse(statsResponse.payload)).toEqual({
      success: true,
      total_checks: 4,
      data: { total_checks: 4 },
    });
  });

  it('requires auth when reading a specific check and scopes it to the caller', async () => {
    mockGetCheck.mockResolvedValue({ check_id: 'chk-1', node_id: 'node-1' });

    const response = await app.inject({
      method: 'GET',
      url: '/anti/checks/chk-1',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetCheck).toHaveBeenCalledWith('chk-1', 'node-1');
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      check: { check_id: 'chk-1', node_id: 'node-1' },
      data: { check_id: 'chk-1', node_id: 'node-1' },
    });
  });

  it('rejects malformed pagination for check listings', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/anti/checks?limit=oops&offset=-1',
    });

    expect(response.statusCode).toBe(400);
    expect(mockListChecks).not.toHaveBeenCalled();
  });

  it('rejects invalid anchor confidence and invalid graph confidence filters', async () => {
    const [anchorResponse, graphResponse] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/anti/anchors',
        payload: {
          type: 'document',
          source: 'spec',
          confidence: 1.2,
          expires_at: '2099-01-01T00:00:00.000Z',
        },
      }),
      app.inject({
        method: 'GET',
        url: '/anti/graph/nodes?min_confidence=high',
      }),
    ]);

    expect(anchorResponse.statusCode).toBe(400);
    expect(graphResponse.statusCode).toBe(400);
    expect(mockAddAnchor).not.toHaveBeenCalled();
    expect(mockListGraphNodes).not.toHaveBeenCalled();
  });

  it('rejects blank confidence values from compatibility payloads', async () => {
    const [checkResponse, graphResponse] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/anti/check',
        payload: {
          code: 'print("ok")',
          trust_anchors: [{
            source_id: 'python-docs',
            source_type: 'official_doc',
            trust_score: '',
          }],
        },
      }),
      app.inject({
        method: 'GET',
        url: '/anti/graph/nodes?min_confidence=',
      }),
    ]);

    expect(checkResponse.statusCode).toBe(400);
    expect(graphResponse.statusCode).toBe(400);
    expect(mockPerformCheck).not.toHaveBeenCalled();
    expect(mockListGraphNodes).not.toHaveBeenCalled();
  });

  it('rejects repeated scalar query filters on anti-hallucination reads', async () => {
    const [confidenceResponse, anchorsResponse, edgesResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/anti/confidence?asset_id=asset-1&asset_id=asset-2',
      }),
      app.inject({
        method: 'GET',
        url: '/anti/anchors?type=document&type=community',
      }),
      app.inject({
        method: 'GET',
        url: '/anti/graph/edges?source_id=node-a&source_id=node-b',
      }),
    ]);

    expect(confidenceResponse.statusCode).toBe(400);
    expect(anchorsResponse.statusCode).toBe(400);
    expect(edgesResponse.statusCode).toBe(400);
    expect(mockGetConfidence).not.toHaveBeenCalled();
    expect(mockListAnchors).not.toHaveBeenCalled();
    expect(mockListGraphEdges).not.toHaveBeenCalled();
  });
});
