# EvoMap Hub - CDN Configuration Guide

## Overview

This document describes the CDN (Content Delivery Network) configuration strategy for EvoMap Hub, covering setup for popular CDN providers and best practices for static asset delivery, API response caching, and cache invalidation.

## Supported CDN Providers

| Provider | Protocol | Features | Setup Complexity |
|----------|---------|----------|------------------|
| CloudFlare | Proxy | Free tier, HTTP/3, edge workers | Easy |
| Fastly | Proxy | Real-time purging, VCL | Medium |
| AWS CloudFront | Proxy | S3 integration, Lambda@Edge | Medium |
| Akamai | Proxy | Global network, mPulse | Complex |
| BunnyCDN | Pull | Simple setup, affordable | Easy |
| KeyCDN | Pull | Pay-per-use, zones | Easy |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Request                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CDN Edge Network                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Edge 1    │  │   Edge 2    │  │   Edge N    │            │
│  │  (closest)  │  │  (fallback) │  │  (backup)   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
         │                                           │
         ▼                                           ▼
┌─────────────────┐                     ┌─────────────────────────┐
│   Static Assets │                     │    Dynamic Content      │
│   (Cached)      │                     │    (Origin Fetch)       │
│                 │                     │                         │
│  JS/CSS/Bundles │                     │  /api/* routes         │
│  Images/Media   │                     │  User-specific data    │
│  Fonts/Icons    │                     │  Real-time updates     │
└─────────────────┘                     └─────────────────────────┘
```

## Cache Headers

### Static Assets (Immutably Fingerprinted)

Next.js generates content-hashed filenames for:
- JavaScript bundles: `/_next/static/chunks/<filename>-<hash>.js`
- CSS files: `/_next/static/css/<filename>-<hash>.css`
- Asset chunks: `/_next/static/chunks/pages/<filename>-<hash>.js`

These can be cached forever:

```nginx
# nginx configuration
location /_next/static/ {
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable";
    access_log off;
}
```

### Dynamic Pages

Pages that change based on user authentication or data:

```nginx
# Cache for 60 seconds, allow stale for 1 day
location ~ ^/(map|browse|marketplace)/ {
    expires 60s;
    add_header Cache-Control "public, max-age=60, stale-while-revalidate=86400";
}
```

### API Responses

APIs should not be cached or use very short TTL:

```nginx
location /api/ {
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate";
}
```

## CloudFlare Setup

### Basic Configuration

1. Create CloudFlare account and add your domain
2. Set DNS to "Proxied" (orange cloud) for CDN-enabled routes
3. Configure Page Rules for optimal caching

### Page Rules

| Pattern | Setting | Value |
|---------|---------|-------|
| `*evomap.ai/_next/static/*` | Cache Level | Cache Everything |
| `*evomap.ai/_next/static/*` | Edge Cache TTL | 1 month |
| `*evomap.ai/*` | Cache Level | Standard |
| `*evomap.ai/api/*` | Cache Level | Bypass |

### CloudFlare Workers (Advanced)

```javascript
// workers/_cache_assets.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Cache static assets at edge
  if (url.pathname.startsWith('/_next/static/')) {
    const cache = caches.default
    let response = await cache.match(request)
    
    if (!response) {
      response = await fetch(request)
      // Cache for 30 days
      response = new Response(response.body, response)
      response.headers.set('Cache-Control', 'public, max-age=2592000')
      response.headers.set('CF-Cache-Status', 'MISS')
      event.waitUntil(cache.put(request, response.clone()))
    } else {
      response = new Response(response.body, response)
      response.headers.set('CF-Cache-Status', 'HIT')
    }
    return response
  }
  
  return fetch(request)
}
```

## AWS CloudFront Setup

### Distribution Configuration

```json
{
  "DistributionConfig": {
    "DefaultRootObject": "index.html",
    "Comment": "EvoMap Hub CDN Distribution",
    "Enabled": true,
    "PriceClass": "PriceClass_All",
    "ViewerCertificate": {
      "ACMCertificateArn": "arn:aws:acm:us-east-1:...",
      "SSLSupportMethod": "sni-only"
    },
    "DefaultCacheBehavior": {
      "TargetOriginId": "evomap-origin",
      "ViewerProtocolPolicy": "redirect-to-https",
      "AllowedMethods": ["GET", "HEAD", "OPTIONS"],
      "CachedMethods": ["GET", "HEAD", "OPTIONS"],
      "ForwardedValues": {
        "QueryString": false,
        "Cookies": {
          "Forward": "none"
        },
        "Headers": ["Accept", "Origin", "Accept-Encoding"]
      },
      "MinTTL": 0,
      "DefaultTTL": 86400,
      "MaxTTL": 31536000,
      "Compress": true
    },
    "Origins": [{
      "Id": "evomap-origin",
      "DomainName": "evomap.example.com",
      "CustomOriginConfig": {
        "HTTPPort": 80,
        "HTTPSPort": 443,
        "OriginProtocolPolicy": "https-only"
      }
    }]
  }
}
```

### Cache Behaviors

| Path Pattern | Cache Policy | TTL |
|-------------|--------------|-----|
| `/_next/static/*` | Managed-CachingOptimized | Max: 31536000 |
| `/*.js` | Managed-CachingOptimizedForInteractiveAssets | Max: 31536000 |
| `/*.css` | Managed-CachingOptimizedForInteractiveAssets | Max: 31536000 |
| `/api/*` | Managed-CachingDisabled | Min/Max/Default: 0 |
| `/*` | Managed-CachingOptimized | Default: 86400 |

## Cache Invalidation

### Manual Invalidation

#### CloudFlare
```bash
# Purge specific URL
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://evomap.ai/_next/static/chunks/main.js"]}'

# Purge by cache tag
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  --data '{"tags":["static","evomap-assets"]}'
```

#### CloudFront
```bash
aws cloudfront create-invalidation \
  --distribution-id E12ABC \
  --paths "/_next/static/*" "/index.html"
```

### Automatic Invalidation on Deploy

Add to your deployment script:

```bash
#!/bin/bash
# deploy.sh

# Build new version
npm run build

# Tag new deployment
DEPLOY_ID=$(date +%s)

# For Next.js, only invalidate changed assets
# CloudFlare: Use content hash from build
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_ID \
  --paths "/_next/static/chunks/*" \
  --invalidation-batch-reference="deploy-$DEPLOY_ID"
```

## Image CDN Integration

### Cloudinary

```javascript
// frontend/src/lib/image-config.ts
export const cloudinaryConfig = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD,
  apiKey: process.env.CLOUDINARY_API_KEY,
  
  // Automatic format selection (WebP/AVIF)
  fetchFormat: 'auto',
  
  // Quality optimization
  quality: 'auto',
  
  // Responsive breakpoints
  breakpoints: [640, 750, 828, 1080, 1200, 1920],
  
  // Lazy loading
  lazyLoad: true,
}

// Usage in component
<Image
  src={`https://res.cloudinary.com/${cloudName}/image/fetch/f_auto,q_auto/${originalUrl}`}
  alt="..."
/>
```

### Vercel Image Optimization (Built-in)

Next.js image optimization is already configured:

```typescript
// next.config.ts
images: {
  formats: ['image/avif', 'image/webp'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  minimumCacheTTL: 60 * 60 * 24 * 30,
  remotePatterns: [
    { protocol: 'https', hostname: '**.amazonaws.com' },
    { protocol: 'https', hostname: 'images.unsplash.com' },
  ],
}
```

## Performance Benchmarks

### Expected Performance with CDN

| Metric | Without CDN | With CDN |
|--------|------------|----------|
| TTFB (US) | 200-400ms | 20-50ms |
| TTFB (EU) | 300-500ms | 30-80ms |
| TTFB (Asia) | 400-800ms | 50-150ms |
| JS Bundle (download) | 2-5s | 0.5-1.5s |
| Cache Hit Rate | N/A | 90-95% |
| Origin Load | 100% | 5-10% |

### Monitoring

Set up monitoring for CDN metrics:

```javascript
// analytics/cdn-metrics.js
export function trackCDNMetrics(response) {
  const cfCacheStatus = response.headers.get('cf-cache-status')
  const xCache = response.headers.get('x-cache')
  const age = response.headers.get('age')
  
  analytics.track('cdn_performance', {
    cacheStatus: cfCacheStatus || xCache,
    cacheHit: ['HIT', 'CF-Hit'].includes(cfCacheStatus || xCache),
    age: parseInt(age || '0'),
    url: response.url,
  })
}
```

## Security Considerations

### CORS Configuration

```nginx
# Allow specific origins for API calls
location /api/ {
    # Set allowed origins
    set $cors_origin "";
    if ($http_origin ~* ^https?://(.*\.)?evomap\.ai$) {
        set $cors_origin $http_origin;
    }
    
    add_header Access-Control-Allow-Origin $cors_origin always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
}
```

### Rate Limiting at CDN

```javascript
// CloudFlare Workers - Rate Limiting
const RATE_LIMIT = 100
const WINDOW_MS = 60 * 1000

addEventListener('fetch', event => {
  const key = `rate:${event.request.headers.get('CF-Connecting-IP')}`
  
  // Check rate limit using KV
  event.respondWith(handleRequest(event.request, key))
})

async function handleRequest(request, key) {
  const count = await RATE_KV.get(key, { type: 'number' }) || 0
  
  if (count >= RATE_LIMIT) {
    return new Response('Rate limit exceeded', { status: 429 })
  }
  
  await RATE_KV.put(key, count + 1, { expirationTtl: 60 })
  return fetch(request)
}
```

## Troubleshooting

### Cache Not Updating

1. **Check Cache-Control headers** in response
2. **Purge CDN cache** manually
3. **Check deployment** - hashed files auto-update, non-hashed need purge
4. **Verify origin** is returning correct headers

### Cache Miss Rate High

1. **Too many query strings** - normalize URLs
2. **Cookies being forwarded** - exclude from cache key
3. **Personalized content** - use client-side rendering

### Slow TTFB from Edge

1. **Origin too slow** - optimize origin server
2. **Large responses** - compress or split
3. **Geographic distribution** - add edge locations
