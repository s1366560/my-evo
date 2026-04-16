import fastify, { type FastifyInstance } from 'fastify';
import { memoryGraphRoutes } from './routes';
import { memoryGraphSpecRoutes } from './spec-routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'node_secret',
  trust_level: 'trusted',
};

const mockCreateGraphNode = jest.fn();
const mockCreateGraphEdge = jest.fn();
const mockGetLineage = jest.fn();
const mockConstructChain = jest.fn();
const mockGetChain = jest.fn();
const mockRecall = jest.fn();
const mockGetConfidenceRecord = jest.fn();
const mockGetConfidenceStats = jest.fn();
const mockTriggerDecay = jest.fn();
const mockTriggerDecayAll = jest.fn();
const mockCheckBan = jest.fn();
const mockGetGraphStats = jest.fn();
const mockExportGraph = jest.fn();
const mockImportGraph = jest.fn();

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

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  createGraphNode: (...args: unknown[]) => mockCreateGraphNode(...args),
  createGraphEdge: (...args: unknown[]) => mockCreateGraphEdge(...args),
  getLineage: (...args: unknown[]) => mockGetLineage(...args),
  constructChain: (...args: unknown[]) => mockConstructChain(...args),
  getChain: (...args: unknown[]) => mockGetChain(...args),
  recall: (...args: unknown[]) => mockRecall(...args),
  getConfidenceRecord: (...args: unknown[]) => mockGetConfidenceRecord(...args),
  getConfidenceStats: (...args: unknown[]) => mockGetConfidenceStats(...args),
  triggerDecay: (...args: unknown[]) => mockTriggerDecay(...args),
  triggerDecayAll: (...args: unknown[]) => mockTriggerDecayAll(...args),
  checkBan: (...args: unknown[]) => mockCheckBan(...args),
  getGraphStats: (...args: unknown[]) => mockGetGraphStats(...args),
  exportGraph: (...args: unknown[]) => mockExportGraph(...args),
  importGraph: (...args: unknown[]) => mockImportGraph(...args),
}));

function buildApp(prisma: unknown): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', prisma as any);
  return app;
}

describe('Memory graph routes', () => {
  let app: FastifyInstance;
  let prisma: {
    memoryGraphNode: {
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'node_secret',
      trust_level: 'trusted',
    };
    prisma = {
      memoryGraphNode: {
        update: jest.fn(),
      },
    };
    app = buildApp(prisma);
    await app.register(memoryGraphRoutes, { prefix: '/legacy' });
    await app.register(memoryGraphSpecRoutes, { prefix: '/api/v2/memory/graph' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('preserves the legacy node creation route', async () => {
    mockCreateGraphNode.mockResolvedValue({ node_id: 'node-1' });

    const response = await app.inject({
      method: 'POST',
      url: '/legacy/nodes',
      payload: {
        node_id: 'node-1',
        type: 'gene',
        label: 'Legacy Node',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockCreateGraphNode).toHaveBeenCalledWith(
      'node-1',
      'gene',
      'Legacy Node',
      1,
      50,
      undefined,
    );
  });

  it('supports the spec node creation route and applies initial signal counts', async () => {
    mockCreateGraphNode.mockResolvedValue({ node_id: 'gene-1' });
    prisma.memoryGraphNode.update.mockResolvedValue({
      node_id: 'gene-1',
      positive: 12,
      negative: 1,
      usage_count: 45,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/memory/graph/node',
      payload: {
        id: 'gene-1',
        type: 'gene',
        label: 'Spec Node',
        confidence: 0.85,
        gdi: 72,
        signals: {
          positive: 12,
          negative: 1,
          usage_count: 45,
        },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockCreateGraphNode).toHaveBeenCalledWith(
      'gene-1',
      'gene',
      'Spec Node',
      0.85,
      72,
      undefined,
    );
    expect(prisma.memoryGraphNode.update).toHaveBeenCalledWith({
      where: { node_id: 'gene-1' },
      data: {
        positive: 12,
        negative: 1,
        usage_count: 45,
      },
    });
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      node: {
        node_id: 'gene-1',
        positive: 12,
        negative: 1,
        usage_count: 45,
      },
      data: {
        node_id: 'gene-1',
        positive: 12,
        negative: 1,
        usage_count: 45,
      },
    });
  });

  it('maps the spec lineage query route to the lineage service', async () => {
    mockGetLineage.mockResolvedValue({
      root: 'asset-1',
      lineage: [],
      total_depth: 0,
      chain_id: 'chain-1',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/memory/graph/lineage?asset_id=asset-1&depth=2',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetLineage).toHaveBeenCalledWith('asset-1', 2);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      root: 'asset-1',
      lineage: [],
      total_depth: 0,
      chain_id: 'chain-1',
      data: {
        root: 'asset-1',
        lineage: [],
        total_depth: 0,
        chain_id: 'chain-1',
      },
    });
  });

  it('routes spec decay requests to single-node or bulk decay services', async () => {
    mockTriggerDecay.mockResolvedValue({ node: { node_id: 'asset-1' } });
    mockTriggerDecayAll.mockResolvedValue({ processed: 1, skipped: 0 });

    const [singleResponse, bulkResponse] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/v2/memory/graph/decay',
        payload: {
          node_id: 'asset-1',
          lambda: 0.1,
        },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v2/memory/graph/decay',
        payload: {
          inactive_days: 30,
          batch_size: 50,
        },
      }),
    ]);

    expect(singleResponse.statusCode).toBe(200);
    expect(bulkResponse.statusCode).toBe(200);
    expect(mockTriggerDecay).toHaveBeenCalledWith('asset-1', { lambda: 0.1 });
    expect(mockTriggerDecayAll).toHaveBeenCalledWith(undefined, 30, 50);
    expect(JSON.parse(singleResponse.payload)).toEqual({
      success: true,
      node: { node_id: 'asset-1' },
      data: { node: { node_id: 'asset-1' } },
    });
    expect(JSON.parse(bulkResponse.payload)).toEqual({
      success: true,
      processed: 1,
      skipped: 0,
      data: { processed: 1, skipped: 0 },
    });
  });

  it('keeps compute-decay aliases wired for legacy and spec routes', async () => {
    mockTriggerDecay.mockResolvedValue({ node: { node_id: 'asset-1' } });
    mockTriggerDecayAll.mockResolvedValue({ processed: 2, skipped: 0 });

    const [legacyResponse, specResponse] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/legacy/compute-decay',
        payload: {
          node_id: 'asset-1',
          lambda: 0.2,
        },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v2/memory/graph/compute-decay',
        payload: {
          inactive_days: 45,
          batch_size: 25,
        },
      }),
    ]);

    expect(legacyResponse.statusCode).toBe(200);
    expect(specResponse.statusCode).toBe(200);
    expect(mockTriggerDecay).toHaveBeenCalledWith('asset-1', { lambda: 0.2 });
    expect(mockTriggerDecayAll).toHaveBeenCalledWith(undefined, 45, 25);
  });

  it('exposes spec chain and export endpoints', async () => {
    mockConstructChain.mockResolvedValue({ chain_id: 'chain-1' });
    mockExportGraph.mockResolvedValue({ nodes: [], edges: [], chains: [], exported_at: '2026-01-01T00:00:00Z' });

    const [chainResponse, exportResponse] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/v2/memory/graph/chain/construct',
        payload: { start_node_id: 'node-1' },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v2/memory/graph/export',
      }),
    ]);

    expect(chainResponse.statusCode).toBe(201);
    expect(exportResponse.statusCode).toBe(200);
    expect(mockConstructChain).toHaveBeenCalledWith('node-1', 10);
    expect(mockExportGraph).toHaveBeenCalledTimes(1);
    expect(JSON.parse(chainResponse.payload)).toEqual({
      success: true,
      chain: { chain_id: 'chain-1' },
      data: { chain_id: 'chain-1' },
    });
    expect(JSON.parse(exportResponse.payload)).toEqual({
      success: true,
      nodes: [],
      edges: [],
      chains: [],
      exported_at: '2026-01-01T00:00:00Z',
      data: {
        nodes: [],
        edges: [],
        chains: [],
        exported_at: '2026-01-01T00:00:00Z',
      },
    });
  });

  it('exposes top-level aliases for stats, recall, confidence, ban-check, and import', async () => {
    mockGetGraphStats.mockResolvedValue({
      total_nodes: 10,
      total_edges: 12,
      node_types: { gene: 6 },
      edge_types: { derived_from: 4 },
      avg_confidence: 0.62,
      avg_gdi: 54.3,
      chains_count: 2,
    });
    mockRecall.mockResolvedValue({
      results: [{ asset_id: 'gene-1', score: 0.87 }],
      total: 1,
      query_time_ms: 12,
    });
    mockGetConfidenceRecord.mockResolvedValue({
      asset_id: 'gene-1',
      current: 0.82,
      initial: 1,
      grade: 'A',
      last_decay_at: '2026-04-16T00:00:00Z',
      positive_signals: 5,
      negative_signals: 0,
      history: [],
    });
    mockGetConfidenceStats.mockResolvedValue({
      total_nodes: 10,
      avg_confidence: 0.62,
      grade_distribution: { A: 5 },
      stale_nodes: 1,
    });
    mockCheckBan.mockResolvedValue({
      node_id: 'gene-1',
      should_ban: false,
      reasons: [],
      thresholds: { confidence_min: 0.15, gdi_min: 25, report_ratio_max: 0.05 },
    });
    mockImportGraph.mockResolvedValue({
      imported_nodes: 1,
      imported_edges: 2,
      imported_chains: 0,
    });

    const [statsRes, recallRes, confidenceRes, confidenceStatsRes, banRes, importRes] = await Promise.all([
      app.inject({ method: 'GET', url: '/api/v2/memory/graph/stats' }),
      app.inject({
        method: 'POST',
        url: '/api/v2/memory/graph/recall',
        payload: { query: 'async http', limit: 5 },
      }),
      app.inject({ method: 'GET', url: '/api/v2/memory/graph/confidence/gene-1' }),
      app.inject({ method: 'GET', url: '/api/v2/memory/graph/confidence/stats' }),
      app.inject({
        method: 'POST',
        url: '/api/v2/memory/graph/ban-check',
        payload: { node_id: 'gene-1' },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v2/memory/graph/import',
        payload: { nodes: [{ node_id: 'gene-1' }], edges: [{ source_id: 'a', target_id: 'b' }] },
      }),
    ]);

    expect(statsRes.statusCode).toBe(200);
    expect(recallRes.statusCode).toBe(200);
    expect(confidenceRes.statusCode).toBe(200);
    expect(confidenceStatsRes.statusCode).toBe(200);
    expect(banRes.statusCode).toBe(200);
    expect(importRes.statusCode).toBe(200);
    expect(JSON.parse(statsRes.payload)).toEqual({
      success: true,
      total_nodes: 10,
      total_edges: 12,
      node_types: { gene: 6 },
      edge_types: { derived_from: 4 },
      avg_confidence: 0.62,
      avg_gdi: 54.3,
      chains_count: 2,
      data: {
        total_nodes: 10,
        total_edges: 12,
        node_types: { gene: 6 },
        edge_types: { derived_from: 4 },
        avg_confidence: 0.62,
        avg_gdi: 54.3,
        chains_count: 2,
      },
    });
    expect(JSON.parse(recallRes.payload)).toEqual({
      success: true,
      results: [{ asset_id: 'gene-1', score: 0.87 }],
      total: 1,
      query_time_ms: 12,
      data: {
        results: [{ asset_id: 'gene-1', score: 0.87 }],
        total: 1,
        query_time_ms: 12,
      },
    });
    expect(JSON.parse(confidenceRes.payload)).toEqual({
      success: true,
      asset_id: 'gene-1',
      current: 0.82,
      initial: 1,
      grade: 'A',
      last_decay_at: '2026-04-16T00:00:00Z',
      positive_signals: 5,
      negative_signals: 0,
      history: [],
      data: {
        asset_id: 'gene-1',
        current: 0.82,
        initial: 1,
        grade: 'A',
        last_decay_at: '2026-04-16T00:00:00Z',
        positive_signals: 5,
        negative_signals: 0,
        history: [],
      },
    });
    expect(JSON.parse(confidenceStatsRes.payload)).toEqual({
      success: true,
      total_nodes: 10,
      avg_confidence: 0.62,
      grade_distribution: { A: 5 },
      stale_nodes: 1,
      data: {
        total_nodes: 10,
        avg_confidence: 0.62,
        grade_distribution: { A: 5 },
        stale_nodes: 1,
      },
    });
    expect(JSON.parse(banRes.payload)).toEqual({
      success: true,
      node_id: 'gene-1',
      should_ban: false,
      reasons: [],
      thresholds: { confidence_min: 0.15, gdi_min: 25, report_ratio_max: 0.05 },
      data: {
        node_id: 'gene-1',
        should_ban: false,
        reasons: [],
        thresholds: { confidence_min: 0.15, gdi_min: 25, report_ratio_max: 0.05 },
      },
    });
    expect(JSON.parse(importRes.payload)).toEqual({
      success: true,
      imported_nodes: 1,
      imported_edges: 2,
      imported_chains: 0,
      data: {
        imported_nodes: 1,
        imported_edges: 2,
        imported_chains: 0,
      },
    });
  });

  it('rejects export for non-node authentication', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
    };

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/memory/graph/export',
    });

    expect(response.statusCode).toBe(401);
    expect(mockExportGraph).not.toHaveBeenCalled();
  });

  it('rejects oversized import payloads before calling the service', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/memory/graph/import',
      payload: {
        nodes: Array.from({ length: 501 }, (_, index) => ({ node_id: `node-${index}` })),
      },
    });

    expect(response.statusCode).toBe(400);
    expect(mockImportGraph).not.toHaveBeenCalled();
  });
});
