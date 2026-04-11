import { PrismaClient } from '@prisma/client';
import type { Metric, AlertRule } from '../shared/types';
import type { HealthStatus, ComponentHealth } from './types';
import { ALERT_COOLDOWN_MS } from '../shared/constants';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

const metricsBuffer: Metric[] = [];
const alerts: Array<{
  id: string;
  name: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggered_at: string;
  metric_name: string;
  metric_value: number;
}> = [];

function getOptionalComponentHealth(
  component: 'redis' | 'queue',
  configured: boolean,
): ComponentHealth {
  if (!configured) {
    return {
      status: 'up',
      message: `${component} is not configured`,
    };
  }

  return {
    status: 'up',
    message: `${component} is configured; active connectivity probe is not enabled`,
  };
}

export async function recordMetric(
  name: string,
  value: number,
  labels?: Record<string, string>,
): Promise<void> {
  const metric: Metric = {
    name,
    value,
    labels: labels ?? {},
    timestamp: new Date().toISOString(),
  };

  metricsBuffer.push(metric);

  if (metricsBuffer.length > 1000) {
    metricsBuffer.splice(0, metricsBuffer.length - 1000);
  }
}

export async function getMetrics(
  names?: string[],
  start?: string,
  end?: string,
): Promise<Metric[]> {
  let filtered = [...metricsBuffer];

  if (names && names.length > 0) {
    const nameSet = new Set(names);
    filtered = filtered.filter((m) => nameSet.has(m.name));
  }

  if (start) {
    const startTime = new Date(start).getTime();
    filtered = filtered.filter(
      (m) => new Date(m.timestamp).getTime() >= startTime,
    );
  }

  if (end) {
    const endTime = new Date(end).getTime();
    filtered = filtered.filter(
      (m) => new Date(m.timestamp).getTime() <= endTime,
    );
  }

  return filtered;
}

export async function checkHealth(): Promise<HealthStatus> {
  const redisConfigured = Boolean(process.env.REDIS_URL);
  const queueConfigured = Boolean(
    process.env.QUEUE_URL
    ?? process.env.QUEUE_REDIS_URL
    ?? process.env.BULLMQ_REDIS_URL,
  );
  const checks: HealthStatus['checks'] = {
    database: { status: 'up' },
    redis: getOptionalComponentHealth('redis', redisConfigured),
    queue: getOptionalComponentHealth('queue', queueConfigured),
  };

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'up',
      latency_ms: Date.now() - dbStart,
    };
  } catch {
    checks.database = {
      status: 'down',
      message: 'Database connection failed',
    };
  }

  const allUp = Object.values(checks).every(
    (c) => c.status === 'up',
  );
  const anyDown = Object.values(checks).some(
    (c) => c.status === 'down',
  );

  return {
    status: anyDown ? 'unhealthy' : allUp ? 'healthy' : 'degraded',
    checks,
    uptime_seconds: process.uptime(),
    version: '1.0.0',
  };
}

export async function getAlerts(
  severity?: 'info' | 'warning' | 'critical',
  limit = 50,
): Promise<typeof alerts> {
  let filtered = [...alerts];

  if (severity) {
    filtered = filtered.filter((a) => a.severity === severity);
  }

  return filtered.slice(0, limit);
}
