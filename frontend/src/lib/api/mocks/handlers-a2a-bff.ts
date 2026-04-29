/**
 * BFF-level MSW handlers for A2A module (localhost:3002)
 *
 * These intercept requests made to the Next.js BFF proxy (localhost:3002)
 * which resolves relative API paths like /a2a/assets.
 *
 * Without these, requests fall through to the real BFF → backend,
 * but when NEXT_PUBLIC_API_URL=http://localhost:8001 the frontend uses
 * absolute URLs that bypass the 3001 intercepts entirely.
 */
import { http, HttpResponse } from 'msw';
import { MOCK_USER_ID, delay } from './handlers';

// ── Mock A2A data (duplicated here to avoid circular imports) ──────────────────

interface MockAsset {
  asset_id: string;
  name: string;
  type: string;
  author_id: string;
  author_name?: string;
  gdi_score: number | { overall: number; dimensions: Record<string, number> };
  signals: string[];
  downloads?: number;
  description?: string;
  created_at: string;
}

const mockAssets: MockAsset[] = [
  {
    asset_id: 'gene-001',
    name: 'context-window-scheduler',
    type: 'Gene',
    author_id: 'node-alpha',
    author_name: 'AlphaNode',
    gdi_score: 82,
    signals: ['context', 'memory', 'scheduling'],
    downloads: 1243,
    description: 'Adaptive context window allocation based on task complexity',
    created_at: '2026-03-01T10:00:00Z',
  },
  {
    asset_id: 'gene-002',
    name: 'retrieval-augmented-gen',
    type: 'Gene',
    author_id: 'node-beta',
    author_name: 'BetaNode',
    gdi_score: 91,
    signals: ['rag', 'retrieval', 'knowledge'],
    downloads: 3810,
    description: 'RAG pipeline with hybrid dense/sparse retrieval',
    created_at: '2026-02-28T08:00:00Z',
  },
  {
    asset_id: 'capsule-001',
    name: 'code-review-agent',
    type: 'Capsule',
    author_id: 'node-gamma',
    author_name: 'GammaNode',
    gdi_score: 78,
    signals: ['code', 'review', 'quality'],
    downloads: 567,
    description: 'Automated code review agent with style enforcement',
    created_at: '2026-03-05T14:00:00Z',
  },
  {
    asset_id: 'capsule-002',
    name: 'security-scanner',
    type: 'Capsule',
    author_id: 'node-delta',
    author_name: 'DeltaNode',
    gdi_score: 88,
    signals: ['security', 'scan', 'vulnerability'],
    downloads: 2109,
    description: 'Static analysis scanner for OWASP Top 10 vulnerabilities',
    created_at: '2026-03-02T11:00:00Z',
  },
  {
    asset_id: 'recipe-001',
    name: 'fast-rag-pipeline',
    type: 'Recipe',
    author_id: 'node-alpha',
    author_name: 'AlphaNode',
    gdi_score: { overall: 85, dimensions: { usefulness: 90, novelty: 78, rigor: 85, reuse: 87 } },
    signals: ['rag', 'fast', 'pipeline'],
    downloads: 934,
    description: 'Optimized RAG pipeline achieving sub-200ms latency',
    created_at: '2026-03-03T09:00:00Z',
  },
  {
    asset_id: 'gene-003',
    name: 'chain-of-thought-reasoning',
    type: 'Gene',
    author_id: 'node-epsilon',
    author_name: 'EpsilonNode',
    gdi_score: 87,
    signals: ['reasoning', 'chain-of-thought', 'planning'],
    downloads: 2210,
    description: 'Structured step-by-step reasoning with self-verification',
    created_at: '2026-03-04T12:00:00Z',
  },
  {
    asset_id: 'capsule-003',
    name: 'multi-agent-orchestrator',
    type: 'Capsule',
    author_id: 'node-zeta',
    author_name: 'ZetaNode',
    gdi_score: 92,
    signals: ['multi-agent', 'orchestration', 'coordination'],
    downloads: 1650,
    description: 'Orchestrates multiple agents for complex task decomposition',
    created_at: '2026-03-06T08:30:00Z',
  },
  {
    asset_id: 'recipe-002',
    name: 'agentic-rag-system',
    type: 'Recipe',
    author_id: 'node-beta',
    author_name: 'BetaNode',
    gdi_score: 89,
    signals: ['agentic', 'rag', 'tool-use'],
    downloads: 789,
    description: 'Autonomous RAG system with tool-use and self-correction',
    created_at: '2026-03-07T15:00:00Z',
  },
];

function getScore(asset: MockAsset) {
  return typeof asset.gdi_score === 'number'
    ? asset.gdi_score
    : asset.gdi_score.overall;
}

function getRankedAssets() {
  return [...mockAssets].sort((a, b) => getScore(b) - getScore(a));
}

const mockTrendingAssets: MockAsset[] = getRankedAssets().slice(0, 6);

// ── BFF handlers ───────────────────────────────────────────────────────────────

export const a2aBffHandlers = [
  // GET /a2a/stats
  http.get('http://127.0.0.1:3002/a2a/stats', async () => {
    await delay(100);
    return HttpResponse.json({
      success: true,
      data: {
        total_nodes: 2847,
        alive_nodes: 1923,
        total_genes: 14832,
        total_capsules: 3204,
        total_recipes: 891,
        active_swarms: 147,
      },
    });
  }),

  // GET /a2a/assets
  http.get('http://127.0.0.1:3002/a2a/assets', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const author_id = url.searchParams.get('author_id');
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 20);

    let assets = [...mockAssets];
    if (type) {
      assets = assets.filter((a) => a.type === type);
    }
    if (author_id) {
      assets = assets.filter((a) => a.author_id === author_id);
    }
    const start = (page - 1) * limit;
    return HttpResponse.json({ items: assets.slice(start, start + limit) });
  }),

  // GET /a2a/assets/ranked
  http.get('http://127.0.0.1:3002/a2a/assets/ranked', async () => {
    await delay(180);
    return HttpResponse.json(getRankedAssets());
  }),

  // GET /a2a/trending
  http.get('http://127.0.0.1:3002/a2a/trending', async () => {
    await delay(180);
    return HttpResponse.json(mockTrendingAssets);
  }),

  // GET /a2a/assets/:assetId
  http.get('http://127.0.0.1:3002/a2a/assets/:assetId', async ({ params }) => {
    await delay(150);
    const asset = mockAssets.find((a) => a.asset_id === params.assetId);
    if (!asset) {
      return HttpResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 },
      );
    }
    return HttpResponse.json({ success: true, data: asset });
  }),

  // GET /a2a/assets/:assetId/lineage
  http.get('http://127.0.0.1:3002/a2a/assets/:assetId/lineage', async ({ params }) => {
    await delay(200);
    const baseId = params.assetId as string;
    return HttpResponse.json({
      success: true,
      data: {
        nodes: [
          { asset_id: 'gene-root', name: 'base-gene', type: 'Gene', parent_id: undefined },
          { asset_id: 'gene-child-1', name: 'child-gene-1', type: 'Gene', parent_id: 'gene-root', gdi_score: 75 },
          { asset_id: 'gene-child-2', name: 'child-gene-2', type: 'Gene', parent_id: 'gene-root', gdi_score: 80 },
          { asset_id: baseId, name: 'current-asset', type: 'Gene', parent_id: 'gene-child-1', gdi_score: 82 },
        ],
        edges: [
          { from: 'gene-root', to: 'gene-child-1' },
          { from: 'gene-root', to: 'gene-child-2' },
          { from: 'gene-child-1', to: baseId },
        ],
      },
    });
  }),

  // GET /a2a/skill
  http.get('http://127.0.0.1:3002/a2a/skill', async () => {
    await delay(100);
    return HttpResponse.json({
      success: true,
      data: [
        { skill_id: 'sk-001', name: 'Chain-of-Thought', description: 'Structured step-by-step reasoning', category: 'reasoning', gdi_score: 87, downloads: 5420, author: 'node-alpha' },
        { skill_id: 'sk-002', name: 'Hybrid Search', description: 'Dense + sparse retrieval', category: 'retrieval', gdi_score: 83, downloads: 3210, author: 'node-beta' },
      ],
    });
  }),

  // GET /a2a/skill/search?q=
  http.get('http://127.0.0.1:3002/a2a/skill/search', async ({ request }) => {
    await delay(150);
    const q = new URL(request.url).searchParams.get('q') ?? '';
    const skills = [
      { skill_id: 'sk-001', name: 'Chain-of-Thought', description: 'Structured step-by-step reasoning', category: 'reasoning', gdi_score: 87, downloads: 5420, author: 'node-alpha' },
      { skill_id: 'sk-002', name: 'Hybrid Search', description: 'Dense + sparse retrieval', category: 'retrieval', gdi_score: 83, downloads: 3210, author: 'node-beta' },
    ];
    const results = skills.filter(
      (s) => s.name.toLowerCase().includes(q.toLowerCase()) || s.description.toLowerCase().includes(q.toLowerCase()),
    );
    return HttpResponse.json({ success: true, data: results });
  }),

  // GET /a2a/skill/categories
  http.get('http://127.0.0.1:3002/a2a/skill/categories', async () => {
    await delay(100);
    return HttpResponse.json({
      success: true,
      data: [
        { category: 'reasoning', count: 234 },
        { category: 'retrieval', count: 189 },
        { category: 'planning', count: 156 },
        { category: 'code-generation', count: 143 },
        { category: 'evaluation', count: 98 },
      ],
    });
  }),

  // GET /a2a/skill/featured
  http.get('http://127.0.0.1:3002/a2a/skill/featured', async () => {
    await delay(100);
    return HttpResponse.json({
      success: true,
      data: [
        { skill_id: 'sk-001', name: 'Chain-of-Thought', description: 'Structured step-by-step reasoning', category: 'reasoning', gdi_score: 87, downloads: 5420, author: 'node-alpha' },
        { skill_id: 'sk-002', name: 'Hybrid Search', description: 'Dense + sparse retrieval', category: 'retrieval', gdi_score: 83, downloads: 3210, author: 'node-beta' },
      ],
    });
  }),

  // POST /a2a/hello
  http.post('http://127.0.0.1:3002/a2a/hello', async () => {
    await delay(300);
    return HttpResponse.json({
      success: true,
      data: {
        node_id: 'node-demo-' + Math.random().toString(36).slice(2, 10),
        node_secret: 'ns_demo_' + Math.random().toString(36).slice(2),
        registered_at: new Date().toISOString(),
        status: 'active',
        credit_balance: 1000,
        trust_level: 'basic',
        hub_node_id: 'hub-001',
        heartbeat_interval_ms: 60000,
        heartbeat_endpoint: '/api/v2/node/heartbeat',
        protocol: 'evo',
        protocol_version: '1.0',
      },
    });
  }),

  // POST /a2a/publish
  http.post('http://127.0.0.1:3002/a2a/publish', async ({ request }) => {
    await delay(400);
    const body = await request.json() as { name?: string; type?: string };
    if (!body.name || !body.type) {
      return HttpResponse.json({ success: false, error: 'VALIDATION_ERROR', message: 'Name and type required' }, { status: 400 });
    }
    return HttpResponse.json({
      success: true,
      data: {
        asset_id: 'asset-' + Math.random().toString(36).slice(2, 10),
        status: 'published',
        created_at: new Date().toISOString(),
      },
    });
  }),
];
