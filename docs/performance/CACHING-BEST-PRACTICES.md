# Caching Best Practices

**Project:** EvoMap Hub  
**Date:** 2026-04-29

---

## 1. Two-Level Cache Architecture

### Level 1 (L1) - In-Memory Cache

- **Technology:** MemoryCache class (`src/shared/cache.ts`)
- **Scope:** Per-instance, fastest access
- **Use Case:** Hot data, frequently accessed

```typescript
import { globalCache } from '../shared/cache';

globalCache.set('key', data, 3600); // 1 hour TTL
const data = globalCache.get('key');
```

### Level 2 (L2) - Redis Cache

- **Technology:** Redis (`src/shared/redis-cache.ts`)
- **Scope:** Distributed, shared across instances
- **Use Case:** Cross-instance data, session storage

```typescript
import { cacheGet, cacheSet, cacheAside } from '../shared/redis-cache';

// Cache-aside pattern
const data = await cacheAside('key', 'ASSET', async () => {
  return await prisma.asset.findMany();
});
```

---

## 2. Cache TTL Reference

| Key Type | TTL | When to Use |
|----------|-----|-------------|
| SESSION | 5 min | User authentication |
| RATE_LIMIT | 1 min | Rate limiting counters |
| ASSET | 1 hour | Asset metadata |
| USER_PROFILE | 1 hour | User profile data |
| GDI_SCORES | 15 min | GDI scoring data |
| MARKETPLACE | 10 min | Marketplace listings |
| BOUNTY_LIST | 5 min | Bounty listings |
| CONFIG | 24 hours | Configuration data |
| STATS | 30 min | Aggregated statistics |
| SEARCH_RESULTS | 10 min | Search query results |

---

## 3. Cache Key Naming Convention

```typescript
// Format: {entity}:{identifier}:{scope}

export const cacheKeys = {
  // Asset keys
  asset: (id: string) => `asset:${id}`,
  assetList: (type?: string) => `assets:list:${type ?? 'all'}`,
  
  // User keys
  user: (id: string) => `user:${id}`,
  userProfile: (id: string) => `user:profile:${id}`,
  
  // Score keys
  gdiScore: (assetId: string) => `gdi:score:${assetId}`,
  gdiStats: () => 'gdi:stats',
  
  // Listing keys
  bounty: (id: string) => `bounty:${id}`,
  bountyList: (status?: string) => `bounties:list:${status ?? 'all'}`,
  
  // Search keys
  searchResults: (query: string) => {
    const hash = Buffer.from(query).toString('base64').slice(0, 32);
    return `search:${hash}`;
  },
  
  // Session keys
  session: (sessionId: string) => `session:${sessionId}`,
  
  // Rate limit keys
  rateLimit: (key: string) => `ratelimit:${key}`,
};
```

---

## 4. Cache Invalidation Patterns

### 4.1 Explicit Invalidation

```typescript
import { cacheDelete, cacheDeletePattern } from '../shared/redis-cache';

// Delete single key
await cacheDelete(cacheKeys.asset(assetId));

// Delete pattern (e.g., all asset lists)
await cacheDeletePattern('assets:list:*');
```

### 4.2 TTL-Based Expiration

```typescript
// Set with appropriate TTL
await cacheSet(cacheKeys.asset(assetId), assetData, 'ASSET');
// Automatically expires based on TTL
```

### 4.3 Event-Driven Invalidation

```typescript
// Invalidate on data change
async function updateAsset(id: string, data: Partial<Asset>) {
  const updated = await prisma.asset.update({ where: { id }, data });
  
  // Invalidate related caches
  await cacheDelete(cacheKeys.asset(id));
  await cacheDeletePattern('assets:list:*');
  
  return updated;
}
```

---

## 5. Best Practices

### DO

- Use cache-aside pattern for read-heavy operations
- Set appropriate TTLs based on data volatility
- Use consistent cache key naming
- Implement cache invalidation on writes
- Monitor cache hit rates

### DON'T

- Cache user secrets or tokens
- Cache unbounded data (use pagination)
- Set TTLs too long for frequently changing data
- Cache entire large objects unnecessarily
- Forget to invalidate on updates

---

## 6. Performance Metrics

Track these metrics for cache optimization:

```typescript
// Get cache statistics
const stats = globalCache.getStats();
// { size: 150, hits: 5000, misses: 500, hitRate: '90.9%' }

// Redis health check
const redisHealth = await checkRedisHealth();
// { status: 'healthy', latency: 2 }
```

---

## 7. Redis Fallback Behavior

The system gracefully degrades when Redis is unavailable:

```typescript
// If Redis is down:
// 1. L1 (memory cache) continues to work
// 2. L2 operations fail silently
// 3. No errors thrown to users
// 4. System continues operating normally

const client = await getRedisClient();
if (client) {
  // Redis operations
} else {
  // Fallback to L1 only
}
```

---

*Document version: 1.0*
