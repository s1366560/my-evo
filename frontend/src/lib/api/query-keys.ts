// React Query key factory — central place to define all query keys for cache consistency

export const QueryKeys = {
  // Assets
  assets: (filters?: { type?: string; search?: string; sort?: string }) => ["assets", filters] as const,
  asset: (id: string) => ["asset", id] as const,
  assetLineage: (id: string) => ["asset-lineage", id] as const,
  trending: () => ["trending"] as const,
  newest: () => ["newest"] as const,

  // Dashboard
  dashboard: () => ["dashboard"] as const,
  dashboardUser: () => ["dashboard", "user"] as const,
  dashboardCredits: () => ["dashboard", "credits"] as const,
  dashboardStats: () => ["dashboard", "stats"] as const,
  dashboardAssets: () => ["dashboard", "assets"] as const,
  dashboardActivity: () => ["dashboard", "activity"] as const,
  dashboardTrending: () => ["dashboard", "trending"] as const,

  // Bounties
  bounties: (filters?: Record<string, string>) => ["bounties", filters] as const,
  openBounties: () => ["bounties", "open"] as const,
  bounty: (id: string) => ["bounty", id] as const,
  bountyStats: () => ["bounty-stats"] as const,
  myBounties: () => ["my-bounties"] as const,

  // Credits
  credits: () => ["credits"] as const,
  creditsHistory: () => ["credits-history"] as const,

  // Auth
  me: () => ["me"] as const,

  // GDI
  gdi: (assetId: string) => ["gdi", assetId] as const,

  // Marketplace
  marketplace: (filters?: Record<string, string>) => ["marketplace", filters] as const,
};
