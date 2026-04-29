# CDN & Cache Configuration Guide

## Overview

This document describes the CDN and caching strategy implemented for the EvoMap Hub platform to optimize performance across frontend and backend layers.

## Frontend Caching Strategy

### Next.js Configuration

The `next.config.ts` implements aggressive caching headers for optimal CDN performance:

```typescript
// Static assets - immutable, cached for 1 year
source: '/_next/static/:path*'
Cache-Control: public, max-age=31536000, immutable

// Media files - long cache
source: '/_next/media/:path*'
Cache-Control: public, max-age=31536000, immutable

// API routes - no cache (dynamic data)
source: '/api/:path*'
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate

// Static pages - cache with revalidation
source: '/((?!api|_next/static|_next/image|favicon.ico).*)'
Cache-Control: public, max-age=60, stale-while-revalidate=86400
```

### Image Optimization

```typescript
images: {
  formats: ['image/avif', 'image/webp'],  // Modern formats first
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  minimumCacheTTL: 60 * 60 * 24 * 30,  // 30 days
}
```

## Backend Caching Strategy

### L1 Cache: In-Memory (Node.js)

Used for ultra-fast access to frequently read data:

| Cache Key Type | TTL | Use Case |
|---------------|-----|----------|
| `asset:{id}` | 1 hour | Asset details |
| `user:profile:{id}` | 1 hour | User profiles |
| `gdi:score:{assetId}` | 15 min | GDI scores |
| `bounties:list:{status}` | 5 min | Bounty listings |
| `search:{hash}` | 10 min | Search results |

### L2 Cache: Redis

For distributed caching across multiple instances:

- Session storage (24h TTL)
- Rate limiting counters
- Cross-instance data sharing
- Real-time pub/sub for live updates

## CDN Providers

### Recommended CDN Configuration

#### Vercel (Recommended for Next.js)

Vercel automatically provides:
- Global CDN edge network
- Automatic asset optimization
- Edge caching with instant purging

#### Cloudflare

```yaml
# Page Rules
# Static assets
URL Pattern: *evomap.ai/_next/static/*
Cache Level: Cache Everything
Edge Cache TTL: 1 month

# API routes - bypass
URL Pattern: *evomap.ai/api/*
Cache Level: Bypass

# HTML pages
URL Pattern: *evomap.ai/*.html
Cache Level: Standard
Edge Cache TTL: 1 hour
```

#### AWS CloudFront

```json
{
  "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
  "ViewerProtocolPolicy": "redirect-to-https",
  "Compress": true,
  "AllowedHeaders": ["*"],
  "MinTTL": 0,
  "DefaultTTL": 86400,
  "MaxTTL": 31536000
}
```

## Cache Invalidation

### Manual Purge

```bash
# Vercel
vercel rm -y cache

# Cloudflare
curl -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE}/purge_cache" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://evomap.ai/*"]}'
```

### Programmatic Invalidation

```typescript
// When asset is updated
await cacheDelete(`asset:${assetId}`);
await cacheDeletePattern('search:*');

// When user updates profile
await cacheDelete(`user:profile:${userId}`);

// When GDI score changes
await cacheDelete(`gdi:score:${assetId}`);
```

## Performance Metrics

### Target Benchmarks

| Metric | Target | Current |
|--------|--------|---------|
| First Contentful Paint (FCP) | < 1.0s | - |
| Largest Contentful Paint (LCP) | < 2.0s | - |
| Time to First Byte (TTFB) | < 200ms | - |
| Cache Hit Rate | > 80% | - |
| API Response Time (p95) | < 200ms | - |

### Monitoring

```typescript
// Track cache hit rates
const stats = {
  memoryCache: globalCache.getStats(),
  redis: await getCacheStats(),
};
console.log('[Cache]', stats);
```

## Best Practices

1. **Cache-Control Headers**: Always set appropriate cache headers on API responses
2. **ETags**: Use ETags for conditional requests on static assets
3. **Compression**: Enable gzip/brotli for all text responses
4. **Service Workers**: Consider for offline support and advanced caching
5. **CDN Preloading**: Pre-warm cache for popular pages after deployment
