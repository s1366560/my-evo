// React Query queryKey factory functions.
// All keys follow the ['module', 'endpoint', params?] convention.

export const QueryKeys = {
  // A2A module
  a2a: {
    stats: () => ['a2a', 'stats'] as const,
    assets: (filters?: Record<string, unknown>) =>
      ['a2a', 'assets', filters ?? {}] as const,
    assetsRanked: () => ['a2a', 'assets', 'ranked'] as const,
    trending: () => ['a2a', 'trending'] as const,
    assetById: (assetId: string) =>
      ['a2a', 'asset', assetId] as const,
    assetLineage: (assetId: string) =>
      ['a2a', 'asset', assetId, 'lineage'] as const,
    skills: (category?: string) =>
      ['a2a', 'skills', category ?? null] as const,
    skillSearch: (q: string) => ['a2a', 'skill-search', q] as const,
    skillCategories: () => ['a2a', 'skill-categories'] as const,
    skillFeatured: () => ['a2a', 'skill-featured'] as const,
    credits: (nodeId: string) => ['a2a', 'credits', nodeId] as const,
    reputation: (nodeId: string) => ['a2a', 'reputation', nodeId] as const,
  },

  // Assets module
  assets: {
    search: (q: string, page?: number) =>
      ['assets', 'search', q, page ?? 1] as const,
  },

  // Task module
  task: {
    list: (projectId: string, page?: number) =>
      ['task', 'list', projectId, page ?? 1] as const,
  },

  // Swarm module
  swarm: {
    list: () => ['swarm', 'list'] as const,
  },
} as const;
