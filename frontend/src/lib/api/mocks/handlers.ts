import { http, HttpResponse } from 'msw';

// ── Mock data ─────────────────────────────────────────────────────────────────

const mockStats = {
  success: true,
  data: {
    total_nodes: 2847,
    alive_nodes: 1923,
    total_genes: 14832,
    total_capsules: 3204,
    total_recipes: 891,
    active_swarms: 147,
  },
};

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
];

const mockCredits = {
  success: true,
  data: {
    node_id: 'demo-node',
    balance: 12480,
    updated_at: '2026-04-08T08:00:00Z',
  },
};

const mockReputation = {
  success: true,
  data: {
    node_id: 'demo-node',
    score: 86,
    tier: 'Master',
    trust: 'verified',
  },
};

const mockCreditsHistory = {
  success: true,
  data: {
    items: [
      {
        id: 'txn-1',
        type: 'earn',
        amount: 320,
        balance_after: 12480,
        created_at: '2026-04-08T07:20:00Z',
        description: 'Downloaded by 12 nodes',
      },
      {
        id: 'txn-2',
        type: 'spend',
        amount: 40,
        balance_after: 12160,
        created_at: '2026-04-07T16:15:00Z',
        description: 'Published Recipe fast-rag-pipeline',
      },
    ],
    meta: {
      total: 2,
      page: 1,
      limit: 20,
    },
  },
};

const mockReputationHistory = {
  success: true,
  data: {
    items: [
      {
        id: 'rep-1',
        event_type: 'quality-score',
        delta: 6,
        score_after: 86,
        created_at: '2026-04-08T06:10:00Z',
        description: 'Recipe fast-rag-pipeline reached GDI 85',
      },
      {
        id: 'rep-2',
        event_type: 'review',
        delta: 3,
        score_after: 80,
        created_at: '2026-04-06T09:30:00Z',
        description: 'Peer review marked capsule as trustworthy',
      },
    ],
    meta: {
      total: 2,
      page: 1,
      limit: 20,
    },
  },
};

function getScore(asset: MockAsset) {
  return typeof asset.gdi_score === 'number'
    ? asset.gdi_score
    : asset.gdi_score.overall;
}

function getRankedAssets() {
  return [...mockAssets].sort((a, b) => getScore(b) - getScore(a));
}

const mockTrending = {
  success: true,
  data: getRankedAssets().slice(0, 4),
};

const mockSkillCategories = {
  success: true,
  data: [
    { category: 'reasoning', count: 234 },
    { category: 'retrieval', count: 189 },
    { category: 'planning', count: 156 },
    { category: 'code-generation', count: 143 },
    { category: 'evaluation', count: 98 },
  ],
};

const mockSkillFeatured = {
  success: true,
  data: [
    {
      skill_id: 'sk-001',
      name: 'Chain-of-Thought',
      description: 'Structured step-by-step reasoning',
      category: 'reasoning',
      gdi_score: 87,
      downloads: 5420,
      author: 'node-alpha',
    },
    {
      skill_id: 'sk-002',
      name: 'Hybrid Search',
      description: 'Dense + sparse retrieval combination',
      category: 'retrieval',
      gdi_score: 83,
      downloads: 3210,
      author: 'node-beta',
    },
  ],
};

const mockHelloResponse = {
  success: true,
  data: {
    node_id: 'node-demo-' + Math.random().toString(36).slice(2, 10),
    node_secret: 'ns_demo_' + Math.random().toString(36).slice(2),
    registered_at: new Date().toISOString(),
  },
};

const mockPublishResponse = {
  success: true,
  data: {
    asset_id: 'asset-demo-' + Math.random().toString(36).slice(2, 10),
    status: 'published',
    created_at: new Date().toISOString(),
  },
};

// ── Handlers ───────────────────────────────────────────────────────────────────

export const handlers = [
  // A2A stats
  http.get('http://localhost:3001/a2a/stats', () => {
    return HttpResponse.json(mockStats);
  }),

  // A2A assets (with optional query params)
  http.get('http://localhost:3001/a2a/assets', ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 20);

    let assets = [...mockAssets];
    if (type) {
      assets = assets.filter((a) => a.type === type);
    }
    const start = (page - 1) * limit;
    return HttpResponse.json({
      success: true,
      data: assets.slice(start, start + limit),
      meta: {
        total: assets.length,
        page,
        limit,
      },
    });
  }),

  // A2A assets/ranked
  http.get('http://localhost:3001/a2a/assets/ranked', () => {
    const ranked = getRankedAssets();
    return HttpResponse.json({
      success: true,
      data: ranked,
      meta: {
        total: ranked.length,
        page: 1,
        limit: 20,
      },
    });
  }),

  // A2A trending
  http.get('http://localhost:3001/a2a/trending', () => {
    return HttpResponse.json(mockTrending);
  }),

  // A2A assets/:assetId
  http.get('http://localhost:3001/a2a/assets/:assetId', ({ params }) => {
    const asset = mockAssets.find((a) => a.asset_id === params.assetId);
    if (!asset) {
      return HttpResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 },
      );
    }
    return HttpResponse.json({ success: true, data: asset });
  }),

  // A2A assets/:assetId/lineage
  http.get('http://localhost:3001/a2a/assets/:assetId/lineage', ({ params }) => {
    const baseId = params.assetId as string;
    // Return a small mock lineage tree
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

  // /assets/search (assets module, not a2a)
  http.get('http://localhost:3001/assets/search', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 20);

    const filtered = q
      ? mockAssets.filter(
          (a) =>
            a.name.toLowerCase().includes(q.toLowerCase()) ||
            (a.description ?? '').toLowerCase().includes(q.toLowerCase()),
        )
      : [...mockAssets];

    const start = (page - 1) * limit;
    return HttpResponse.json({
      success: true,
      data: filtered.slice(start, start + limit),
      meta: {
        total: filtered.length,
        page,
        limit,
      },
    });
  }),

  // A2A credits
  http.get('http://localhost:3001/a2a/credits/:nodeId', ({ params }) => {
    return HttpResponse.json({
      ...mockCredits,
      data: {
        ...mockCredits.data,
        node_id: String(params.nodeId ?? mockCredits.data.node_id),
      },
    });
  }),

  // A2A reputation
  http.get('http://localhost:3001/a2a/reputation/:nodeId', ({ params }) => {
    return HttpResponse.json({
      ...mockReputation,
      data: {
        ...mockReputation.data,
        node_id: String(params.nodeId ?? mockReputation.data.node_id),
      },
    });
  }),

  // Credits history
  http.get('http://localhost:3001/credits/:nodeId/history', () => {
    return HttpResponse.json(mockCreditsHistory);
  }),

  // Reputation history
  http.get('http://localhost:3001/reputation/:nodeId/history', () => {
    return HttpResponse.json(mockReputationHistory);
  }),

  // A2A skill
  http.get('http://localhost:3001/a2a/skill', () => {
    return HttpResponse.json({
      success: true,
      data: mockSkillFeatured.data,
    });
  }),

  // A2A skill/search
  http.get('http://localhost:3001/a2a/skill/search', ({ request }) => {
    const q = new URL(request.url).searchParams.get('q') ?? '';
    const results = mockSkillFeatured.data.filter(
      (s) =>
        s.name.toLowerCase().includes(q.toLowerCase()) ||
        s.description.toLowerCase().includes(q.toLowerCase()),
    );
    return HttpResponse.json({ success: true, data: results });
  }),

  // A2A skill/categories
  http.get('http://localhost:3001/a2a/skill/categories', () => {
    return HttpResponse.json(mockSkillCategories);
  }),

  // A2A skill/featured
  http.get('http://localhost:3001/a2a/skill/featured', () => {
    return HttpResponse.json(mockSkillFeatured);
  }),

  // POST /a2a/hello (node registration)
  http.post('http://localhost:3001/a2a/hello', () => {
    return HttpResponse.json(mockHelloResponse);
  }),

  // POST /a2a/publish (requires auth in real API, mock only)
  http.post('http://localhost:3001/a2a/publish', () => {
    return HttpResponse.json(mockPublishResponse);
  }),
];
