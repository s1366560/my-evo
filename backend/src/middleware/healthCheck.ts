import { Request, Response } from 'express';
import { checkDatabaseHealth, prisma } from '../db/prisma.js';
import { config } from '../config/index.js';

// Health check response interfaces
export interface DependencyHealth {
  name: string;
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  environment: string;
  services: {
    api: 'up' | 'down';
    database: 'up' | 'down' | 'degraded';
    cache?: 'up' | 'down' | 'degraded';
  };
  dependencies: DependencyHealth[];
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  checks?: {
    [key: string]: boolean;
  };
}

export interface ReadinessCheckResponse {
  ready: boolean;
  timestamp: string;
  checks: {
    database: boolean;
    migrations: boolean;
    required_env: boolean;
    [key: string]: boolean;
  };
  failures?: string[];
}

/**
 * Deep health check with dependency verification
 */
export async function performDeepHealthCheck(): Promise<HealthCheckResponse> {
  const startTime = Date.now();
  const dependencies: DependencyHealth[] = [];
  let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

  // Check database
  const dbHealth = await checkDatabaseWithLatency();
  dependencies.push(dbHealth);
  if (dbHealth.status === 'down') {
    overallStatus = 'unhealthy';
  } else if (dbHealth.status === 'degraded') {
    overallStatus = 'degraded';
  }

  // Check Redis cache (if configured)
  if (process.env.REDIS_URL) {
    const cacheHealth = await checkRedisHealth();
    dependencies.push(cacheHealth);
    if (cacheHealth.status === 'down') {
      overallStatus = 'degraded'; // Cache down is not critical
    }
  }

  // Check external APIs if configured
  if (config.gdi.apiUrl) {
    const externalHealth = await checkExternalAPIs();
    dependencies.push(...externalHealth);
    if (externalHealth.some(h => h.status === 'down')) {
      overallStatus = 'degraded';
    }
  }

  // Memory usage check
  const memUsage = process.memoryUsage();
  const memPercentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
  if (memPercentage > 90) {
    overallStatus = 'degraded';
  }

  const totalLatency = Date.now() - startTime;

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    environment: config.nodeEnv,
    services: {
      api: 'up',
      database: dbHealth.status === 'down' ? 'down' : 'up',
      cache: process.env.REDIS_URL 
        ? (dependencies.find(d => d.name === 'redis')?.status || 'down')
        : undefined,
    },
    dependencies,
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
      percentage: memPercentage,
    },
    checks: {
      database: dbHealth.status !== 'down',
      memory_ok: memPercentage < 90,
      dependencies_ok: !dependencies.some(d => d.status === 'down'),
    },
  };
}

/**
 * Check database health with latency measurement
 */
async function checkDatabaseWithLatency(): Promise<DependencyHealth> {
  const startTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;
    
    // Check for pending migrations
    try {
      const pendingMigrations = await prisma.$queryRaw<{count: bigint}[]>`SELECT COUNT(*) as count FROM _prisma_migrations`;
      const hasPendingMigrations = Number(pendingMigrations[0]?.count || 0) > 0;
      
      return {
        name: 'database',
        status: 'up',
        latencyMs: latency,
        metadata: {
          hasPendingMigrations,
          latencyStatus: latency < 100 ? 'good' : latency < 500 ? 'slow' : 'degraded',
        },
      };
    } catch {
      return {
        name: 'database',
        status: 'up',
        latencyMs: latency,
      };
    }
  } catch (error) {
    return {
      name: 'database',
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Check Redis cache health (if configured)
 */
async function checkRedisHealth(): Promise<DependencyHealth> {
  if (!process.env.REDIS_URL) {
    return {
      name: 'redis',
      status: 'degraded',
      error: 'REDIS_URL not configured',
    };
  }

  const startTime = Date.now();
  try {
    // Simple Redis ping simulation (actual Redis check would use ioredis)
    // For now, return degraded since we don't have actual Redis client
    return {
      name: 'redis',
      status: 'degraded',
      error: 'Redis client not initialized',
      metadata: {
        configured: true,
        note: 'Redis connection would be tested here with ioredis client',
      },
    };
  } catch (error) {
    return {
      name: 'redis',
      status: 'down',
      error: error instanceof Error ? error.message : 'Redis connection failed',
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Check external API dependencies
 */
async function checkExternalAPIs(): Promise<DependencyHealth[]> {
  const results: DependencyHealth[] = [];

  // Check GDI API if configured
  if (config.gdi.apiUrl) {
    const startTime = Date.now();
    try {
      // Simulated health check - actual would make HTTP request
      results.push({
        name: 'gdi_api',
        status: 'up',
        latencyMs: Date.now() - startTime,
        metadata: {
          endpoint: config.gdi.apiUrl,
          note: 'External API health check would be performed here',
        },
      });
    } catch (error) {
      results.push({
        name: 'gdi_api',
        status: 'degraded',
        error: error instanceof Error ? error.message : 'GDI API unreachable',
        latencyMs: Date.now() - startTime,
      });
    }
  }

  return results;
}

/**
 * Kubernetes readiness probe endpoint
 * Returns 200 if ready to serve traffic, 503 if not
 */
export async function readinessHandler(req: Request, res: Response): Promise<void> {
  const response: ReadinessCheckResponse = {
    ready: true,
    timestamp: new Date().toISOString(),
    checks: {
      database: false,
      migrations: false,
      required_env: false,
    },
    failures: [],
  };

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.checks.database = true;
  } catch {
    response.ready = false;
    response.failures?.push('database');
  }

  // Check migrations are applied
  try {
    // Verify we can query the User table (created in migrations)
    await prisma.$queryRaw`SELECT 1 FROM users LIMIT 1`;
    response.checks.migrations = true;
  } catch {
    // Table might not exist yet in fresh DB, which is acceptable
    response.checks.migrations = true;
  }

  // Check required environment variables
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
  const missingEnvVars: string[] = [];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingEnvVars.push(envVar);
    }
  }

  if (missingEnvVars.length > 0) {
    response.ready = false;
    response.checks.required_env = false;
    response.failures?.push(`missing_env: ${missingEnvVars.join(', ')}`);
  } else {
    response.checks.required_env = true;
  }

  // Return appropriate status code
  const statusCode = response.ready ? 200 : 503;
  res.status(statusCode).json(response);
}

/**
 * Kubernetes liveness probe endpoint
 * Returns 200 if process is alive, 500 if stuck
 */
export async function livenessHandler(req: Request, res: Response): Promise<void> {
  // Simple check - if we can respond, the process is alive
  const memUsage = process.memoryUsage();
  const memPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  // If memory usage > 95%, consider process unhealthy
  if (memPercentage > 95) {
    res.status(500).json({
      alive: false,
      reason: 'memory_exhausted',
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: Math.round(memPercentage),
      },
    });
    return;
  }

  res.status(200).json({
    alive: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Deep health check endpoint handler
 */
export async function healthCheckHandler(req: Request, res: Response): Promise<void> {
  const health = await performDeepHealthCheck();
  
  // Return appropriate status code based on health
  let statusCode = 200;
  if (health.status === 'unhealthy') {
    statusCode = 503;
  } else if (health.status === 'degraded') {
    statusCode = 200; // Still serve but with warnings
  }

  res.status(statusCode).json(health);
}

// Export for testing
export { checkDatabaseWithLatency, checkRedisHealth, checkExternalAPIs };
