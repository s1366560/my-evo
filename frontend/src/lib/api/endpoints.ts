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
    /** GET /a2a/reputation/:nodeId */
    reputation: (nodeId: string) => `/a2a/reputation/${nodeId}`,
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
    list: (projectId: string, page?: number) => {
      const params = new URLSearchParams({ project_id: projectId });
      if (page) params.set('page', String(page));
      return `/api/v2/task/list?${params.toString()}`;
    },
  },
} as const;
