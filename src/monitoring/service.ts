import type { PrismaClient } from '@prisma/client';
import type { Metric, AlertRule } from '../shared/types';
import type { HealthStatus, ComponentHealth } from './types';
import { ALERT_COOLDOWN_MS } from '../shared/constants';

type MonitoringAlert = {
  id: string;
  name: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggered_at: string;
  metric_name: string;
  metric_value: number;
};

export interface MonitoringState {
  metricsBuffer: Metric[];
  alerts: MonitoringAlert[];
}

export function createMonitoringState(): MonitoringState {
  return {
    metricsBuffer: [],
    alerts: [],
  };
}

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
  state: MonitoringState,
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

  state.metricsBuffer.push(metric);

  if (state.metricsBuffer.length > 1000) {
    state.metricsBuffer.splice(0, state.metricsBuffer.length - 1000);
  }
}

export async function getMetrics(
  state: MonitoringState,
  names?: string[],
  start?: string,
  end?: string,
): Promise<Metric[]> {
  let filtered = [...state.metricsBuffer];

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

export async function checkHealth(prismaClient: PrismaClient): Promise<HealthStatus> {
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
    await prismaClient.$queryRaw`SELECT 1`;
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
  state: MonitoringState,
  severity?: 'info' | 'warning' | 'critical',
  limit = 50,
): Promise<MonitoringAlert[]> {
  let filtered = [...state.alerts];

  if (severity) {
    filtered = filtered.filter((a) => a.severity === severity);
  }

  return filtered.slice(0, limit);
}
