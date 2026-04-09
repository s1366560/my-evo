// Type-safe API endpoint definitions, grouped by module.
// Sync with backend routes.ts files when endpoints are added or changed.

export const Endpoints = {
  // ── A2A module ──────────────────────────────────────────────────────────────
  a2a: {
    hello: '/a2a/hello',
    stats: '/a2a/stats',
    assets: '/a2a/assets',
    assetsRanked: '/a2a/assets/ranked',
    trending: '/a2a/trending',
    /** GET /a2a/assets?type=Gene|Capsule|Recipe&author_id=...&status=active */
    assetsWithFilters: (filters?: {
      type?: string;
      author_id?: string;
      status?: string;
      page?: number;
      limit?: number;
    }) => {
      const params = new URLSearchParams();
      if (filters?.type) params.set('type', filters.type);
      if (filters?.author_id) params.set('author_id', filters.author_id);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));
      const qs = params.toString();
      return `/a2a/assets${qs ? `?${qs}` : ''}`;
    },
    /** GET /a2a/assets/:assetId */
    assetById: (assetId: string) => `/a2a/assets/${assetId}`,
    /** GET /a2a/assets/:assetId/lineage */
    assetLineage: (assetId: string) => `/a2a/assets/${assetId}/lineage`,
    /** POST /a2a/publish */
    publish: '/a2a/publish',
    /** GET /a2a/skill */
    skills: '/a2a/skill',
    /** GET /a2a/skill/search?q= */
    skillSearch: (q: string) => `/a2a/skill/search?q=${encodeURIComponent(q)}`,
    /** GET /a2a/skill/categories */
    skillCategories: '/a2a/skill/categories',
    /** GET /a2a/skill/featured */
    skillFeatured: '/a2a/skill/featured',
    /** GET /a2a/credits/:nodeId */
    credits: (nodeId: string) => `/a2a/credits/${nodeId}`,
    /** GET /a2a/credits/:nodeId/history */
    creditsHistory: (nodeId: string) => `/a2a/credits/${nodeId}/history`,
    /** GET /a2a/reputation/:nodeId */
    reputation: (nodeId: string) => `/a2a/reputation/${nodeId}`,
    /** GET /a2a/reputation/:nodeId/history */
    reputationHistory: (nodeId: string) => `/a2a/reputation/${nodeId}/history`,
  },

  // ── Assets module ────────────────────────────────────────────────────────────
  assets: {
    /** GET /assets/search?q=keyword (keyword search only, no facets) */
    search: (q: string, page?: number) => {
      const params = new URLSearchParams({ q });
      if (page) params.set('page', String(page));
      return `/assets/search?${params.toString()}`;
    },
  },

  // ── Task module (API v2) ────────────────────────────────────────────────────
  task: {
    all: (projectId: string, page?: number) => {
      const params = new URLSearchParams({ project_id: projectId });
      if (page) params.set('page', String(page));
      return `/api/v2/task/list?${params.toString()}`;
    },
  },

  // ── Arena (API v2) ───────────────────────────────────────────────────────────
  arena: {
    seasons: '/api/v2/arena/seasons',
    /** GET /api/v2/arena/rankings/:seasonId */
    rankings: (seasonId: string) => `/api/v2/arena/rankings/${seasonId}`,
    /** GET /api/v2/arena/matches */
    matches: '/api/v2/arena/matches',
  },

  // ── Swarm (API v2) ──────────────────────────────────────────────────────────
  swarm: {
    all: '/api/v2/swarm/',
  },

  // ── Council (A2A prefix) ──────────────────────────────────────────────────
  council: {
    all: '/a2a/council/history',
    vote: (proposalId: string) => `/a2a/council/proposal/${proposalId}/vote`,
  },

  // ── Marketplace (API v2) ─────────────────────────────────────────────────────
  marketplace: {
    /** GET /api/v2/marketplace/listings */
    all: '/api/v2/marketplace/listings',
  },

  // ── Biology (API v2) ────────────────────────────────────────────────────────
  biology: {
    phylogeny: (assetId: string) => `/api/v2/biology/phylogeny/${assetId}`,
    fitness: '/api/v2/biology/fitness',
  },

  // ── Workerpool (API v2) ─────────────────────────────────────────────────────
  workerpool: {
    /** GET /api/v2/workerpool/ — returns { data: { workers[], meta } } */
    all: '/api/v2/workerpool/',
  },

  // ── Account module ─────────────────────────────────────────────────────────────
  account: {
    login: '/account/login',
    register: '/account/register',
    logout: '/account/logout',
    me: '/account/me',
    apiKeys: '/account/api-keys',
    agents: '/account/agents',
  },

  // ── Claim module ─────────────────────────────────────────────────────────────
  claim: {
    /** GET /claim/:code */
    getClaimInfo: (code: string) => `/claim/${code}`,
    /** POST /claim/:code */
    claimNode: (code: string) => `/claim/${code}`,
  },
} as const;
