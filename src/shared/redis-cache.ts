/**
 * EvoMap Hub - Redis Cache Service (L2)
 *
 * Redis-based distributed caching for:
 * - Cross-instance data sharing
 * - Session storage
 * - Rate limiting
 * - Pub/sub for real-time updates
 *
 * Falls back to in-memory cache when Redis is unavailable.
 */

import { globalCache, CACHE_TTL, type CacheTTLKey } from './cache';

interface RedisConfig {
  url: string;
  maxRetries?: number;
  retryDelay?: number;
}

let redis: unknown = null;
let isRedisAvailable = false;

// Lazy-load ioredis only when Redis URL is configured
async function getRedisClient() {
  if (!isRedisAvailable && redis === null) {
    try {
      const Redis = (await import('ioredis')).default;
      const config: RedisConfig = {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
        maxRetries: 3,
        retryDelay: 100,
      };
      redis = new Redis(config.url, {
        lazyConnect: true,
        enableReadyCheck: true,
        maxRetriesPerRequest: config.maxRetries ?? 3,
        retryStrategy: (times: number) => Math.min(times * 100, 3000),
      });
      await (redis as { connect: () => Promise<unknown> } ).connect();
      isRedisAvailable = true;
      console.log('[Cache] Redis connected successfully');
    } catch (error) {
      console.warn('[Cache] Redis unavailable, falling back to in-memory cache:', error);
      redis = null;
      isRedisAvailable = false;
    }
  }
  return redis;
}

/**
 * Get value from Redis (L2) or fallback to in-memory (L1)
 */
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  // Try Redis first
  const client = await getRedisClient();
  if (client) {
    try {
      const value = await (client as { get: (k: string) => Promise<string | null> }).get(key);
      if (value) return JSON.parse(value) as T;
    } catch {
      // Fall through to L1
    }
  }
  // Fallback to L1 memory cache
  return globalCache.get<T>(key);
}

/**
 * Set value in both Redis (L2) and in-memory (L1)
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlKey: CacheTTLKey
): Promise<void> {
  const ttl = CACHE_TTL[ttlKey];
  const serialized = JSON.stringify(value);

  // Always write to L1 for fast local access
  globalCache.set(key, value, ttl);

  // Try Redis L2 for distributed caching
  const client = await getRedisClient();
  if (client) {
    try {
      await (client as { setex: (k: string, t: number, v: string) => Promise<string> }).setex(key, ttl, serialized);
    } catch {
      // Redis write failed, but L1 still has the data
    }
  }
}

/**
 * Delete key from both caches
 */
export async function cacheDelete(key: string): Promise<void> {
  globalCache.delete(key);
  const client = await getRedisClient();
  if (client) {
    try {
      await (client as { del: (k: string) => Promise<number> }).del(key);
    } catch {
      // Ignore
    }
  }
}

/**
 * Delete keys matching a pattern (Redis SCAN or L1 pattern match)
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
  let count = globalCache.deletePattern(new RegExp(pattern.replace(/\*/g, '.*')));

  const client = await getRedisClient();
  if (client) {
    try {
      // Use SCAN for large keyspaces
      let cursor = 0;
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      do {
        const result = await (client as {
          scan: (c: number, opts: { COUNT: number; MATCH: string }) => Promise<[number, string[]]>
        }).scan(cursor, { COUNT: 100, MATCH: pattern });
        cursor = Number(result[0]);
        const keys = result[1];
        for (const key of keys) {
          if (regex.test(key)) {
            await (client as { del: (k: string) => Promise<number> }).del(key);
            count++;
          }
        }
      } while (cursor !== 0);
    } catch {
      // Ignore
    }
  }
  return count;
}

/**
 * Cache-aside pattern: get from cache, or execute fn and cache result
 */
export async function cacheAside<T>(
  key: string,
  ttlKey: CacheTTLKey,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== undefined) return cached;

  const value = await fetchFn();
  await cacheSet(key, value, ttlKey);
  return value;
}

/**
 * Wrap function with two-level caching (L1 + L2)
 */
export function withDistributedCache<TArgs extends unknown[], TReturn>(
  ttlKey: CacheTTLKey,
  keyBuilder: (...args: TArgs) => string
) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const original = descriptor.value as (...args: TArgs) => Promise<TReturn>;
    descriptor.value = async function (...args: TArgs): Promise<TReturn> {
      const key = keyBuilder(...args);
      const cached = await cacheGet<TReturn>(key);
      if (cached !== undefined) return cached;
      const result = await original.apply(this, args);
      await cacheSet(key, result, ttlKey);
      return result;
    };
  };
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<{ status: string; latency?: number; error?: string }> {
  const start = Date.now();
  try {
    const client = await getRedisClient();
    if (!client) return { status: 'unavailable' };
    await (client as { ping: () => Promise<string> }).ping();
    return { status: 'healthy', latency: Date.now() - start };
  } catch (error) {
    return { status: 'unhealthy', error: String(error) };
  }
}

/**
 * Get cache statistics from both L1 and L2
 */
export async function getCacheStats() {
  const l1Stats = globalCache.getStats();
  const redisHealth = await checkRedisHealth();
  return {
    l1: l1Stats,
    l2: redisHealth,
    tier: isRedisAvailable ? 'L1+L2' : 'L1-only',
  };
}
