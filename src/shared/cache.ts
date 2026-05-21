/**
 * EvoMap Hub - Lightweight In-Memory Cache Service (L1)
 * Fast, per-instance caching for frequently accessed data
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// ===== Cache TTL Configuration =====
export const CACHE_TTL = {
  SESSION: 300,           // 5 minutes
  RATE_LIMIT: 60,         // 1 minute
  ASSET: 3600,            // 1 hour
  USER_PROFILE: 3600,     // 1 hour
  GDI_SCORES: 900,       // 15 minutes
  MARKETPLACE: 600,        // 10 minutes
  BOUNTY_LIST: 300,       // 5 minutes
  CONFIG: 86400,           // 24 hours
  STATS: 1800,            // 30 minutes
  SEARCH_RESULTS: 600,    // 10 minutes
  NODE_INFO: 3600,        // 1 hour
  REPUTATION: 1800,        // 30 minutes
  NONE: 0,
} as const;

export type CacheTTLKey = keyof typeof CACHE_TTL;

/**
 * In-memory LRU cache with TTL support
 */
export class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  deletePattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total * 100).toFixed(2) + '%' : '0%',
    };
  }
}

// Global cache instance
export const globalCache = new MemoryCache(2000);

// Cache key builders
export const cacheKeys = {
  asset: (id: string) => `asset:${id}`,
  assetList: (type?: string) => type ? `assets:list:${type}` : 'assets:list:all',
  user: (id: string) => `user:${id}`,
  userProfile: (id: string) => `user:profile:${id}`,
  gdiScore: (assetId: string) => `gdi:score:${assetId}`,
  gdiStats: () => 'gdi:stats',
  bounty: (id: string) => `bounty:${id}`,
  bountyList: (status?: string) => status ? `bounties:list:${status}` : 'bounties:list:all',
  marketplaceListing: (id: string) => `marketplace:listing:${id}`,
  marketplaceList: () => 'marketplace:list',
  nodeInfo: (nodeId: string) => `node:info:${nodeId}`,
  reputation: (nodeId: string) => `node:reputation:${nodeId}`,
  searchResults: (query: string) => `search:${Buffer.from(query).toString('base64').slice(0, 32)}`,
  session: (sessionId: string) => `session:${sessionId}`,
  rateLimit: (key: string) => `ratelimit:${key}`,
  stats: (type: string) => `stats:${type}`,
};
