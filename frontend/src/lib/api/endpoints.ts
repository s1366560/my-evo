// Type-safe API endpoint definitions, grouped by module.
// Sync with backend routes.ts files when endpoints are added or changed.

export const Endpoints = {
  // ── A2A module ──────────────────────────────────────────────────────────────
  a2a: {
    hello: '/a2a/hello',
    stats: '/api/a2a/stats',
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
    /** POST /api/v2/marketplace/purchases - purchase a listing */
    purchase: '/api/v2/marketplace/purchases',
    /** GET /api/v2/marketplace/purchases - list my purchases */
    myPurchases: '/api/v2/marketplace/purchases',
    /** GET /api/v2/marketplace/transactions - transaction history */
    transactions: '/api/v2/marketplace/transactions',
  },

  // ── Bounty (API v2) ─────────────────────────────────────────────────────────
  bounty: {
    /** GET /api/v2/bounty/ - list all bounties */
    all: '/api/v2/bounty/',
    /** GET /api/v2/bounty/:id - get bounty details */
    byId: (id: string) => `/api/v2/bounty/${id}`,
    /** POST /api/v2/bounty/:id/submit - submit solution */
    submit: (id: string) => `/api/v2/bounty/${id}/submit`,
  },

  // ── Watchlist ────────────────────────────────────────────────────────────────
  watchlist: {
    /** GET /api/v2/watchlist - get user watchlist */
    all: '/api/v2/watchlist',
    /** POST /api/v2/watchlist - add to watchlist */
    add: '/api/v2/watchlist',
    /** DELETE /api/v2/watchlist/:assetId - remove from watchlist */
    remove: (assetId: string) => `/api/v2/watchlist/${assetId}`,
  },

  // ── Notifications ────────────────────────────────────────────────────────────
  notifications: {
    /** GET /api/v2/notifications - get user notifications */
    all: '/api/v2/notifications',
    /** POST /api/v2/notifications/:id/read - mark as read */
    markRead: (id: string) => `/api/v2/notifications/${id}/read`,
    /** POST /api/v2/notifications/read-all - mark all as read */
    markAllRead: '/api/v2/notifications/read-all',
  },

  // ── GEP (Genome Evolution Protocol) ───────────────────────────────────────
  gep: {
    /** POST /gene — register a new gene */
    registerGene: '/gene',
    /** GET /gene/:id */
    geneById: (id: string) => `/gene/${id}`,
    /** GET /genes?node_id=&category= */
    genes: (filters?: { node_id?: string; category?: string }) => {
      const params = new URLSearchParams();
      if (filters?.node_id) params.set('node_id', filters.node_id);
      if (filters?.category) params.set('category', filters.category);
      const qs = params.toString();
      return `/genes${qs ? `?${qs}` : ''}`;
    },
    /** POST /capsule — register a new capsule */
    registerCapsule: '/capsule',
    /** GET /capsule/:id */
    capsuleById: (id: string) => `/capsule/${id}`,
    /** GET /capsules?node_id= */
    capsules: (nodeId?: string) => {
      const params = new URLSearchParams();
      if (nodeId) params.set('node_id', nodeId);
      const qs = params.toString();
      return `/capsules${qs ? `?${qs}` : ''}`;
    },
    /** POST /node — register a new node */
    registerNode: '/node',
    /** GET /node/:id */
    nodeById: (id: string) => `/node/${id}`,
    /** GET /nodes?capabilities=&min_reputation=&status=&limit= */
    nodes: (filters?: {
      capabilities?: string;
      min_reputation?: number;
      status?: string;
      limit?: number;
    }) => {
      const params = new URLSearchParams();
      if (filters?.capabilities) params.set('capabilities', filters.capabilities);
      if (filters?.min_reputation != null) params.set('min_reputation', String(filters.min_reputation));
      if (filters?.status) params.set('status', filters.status);
      if (filters?.limit != null) params.set('limit', String(filters.limit));
      const qs = params.toString();
      return `/nodes${qs ? `?${qs}` : ''}`;
    },
    /** POST /validate — validate a gene or capsule */
    validate: '/validate',
    /** GET /adapters — list available GEP adapters */
    adapters: '/adapters',
  },

  // ── GEPX (.gepx bundle export/import) ───────────────────────────────────
  gepx: {
    /** POST /gepx/export — export bundle of assets */
    export: '/gepx/export',
    /** POST /gepx/export/single — export single asset */
    exportSingle: '/gepx/export/single',
    /** POST /gepx/validate — validate .gepx binary */
    validate: '/gepx/validate',
    /** GET /gepx/bundle/:bundleId — download bundle as gepx */
    bundle: (bundleId: string) => `/gepx/bundle/${bundleId}`,
    /** GET /gepx/bundles?bundle_type=&limit=&offset= */
    bundles: (filters?: { bundle_type?: string; limit?: number; offset?: number }) => {
      const params = new URLSearchParams();
      if (filters?.bundle_type) params.set('bundle_type', filters.bundle_type);
      if (filters?.limit != null) params.set('limit', String(filters.limit));
      if (filters?.offset != null) params.set('offset', String(filters.offset));
      const qs = params.toString();
      return `/gepx/bundles${qs ? `?${qs}` : ''}`;
    },
    /** GET /gepx/bundles/:bundleId — get bundle detail */
    bundleById: (bundleId: string) => `/gepx/bundles/${bundleId}`,
    /** POST /gepx/bundles — create a bundle */
    createBundle: '/gepx/bundles',
    /** GET /gepx/bundles/:bundleId/download — download as gepx file */
    downloadBundle: (bundleId: string) => `/gepx/bundles/${bundleId}/download`,
    /** GET /gepx/bundles/:bundleId/assets — list assets in bundle */
    bundleAssets: (bundleId: string) => `/gepx/bundles/${bundleId}/assets`,
    /** GET /gepx/exports — list user's exports */
    exports: '/gepx/exports',
    /** POST /gepx/import — import .gepx bundle */
    import: '/gepx/import',
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
    login: '/api/v1/auth/login',
    register: '/api/v1/auth/register',
    logout: '/api/v1/auth/logout',
    me: '/api/v1/auth/me',
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
