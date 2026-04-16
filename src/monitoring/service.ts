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

export interface DashboardMetrics {
  total_nodes: number;
  online_nodes: number;
  offline_nodes: number;
  quarantined_nodes: number;
  active_swarms: number;
  total_assets: number;
  average_gdi: number;
  total_credits: number;
  alerts_triggered_24h: number;
  uptime_seconds: number;
}

export interface AlertStats {
  total: number;
  info: number;
  warning: number;
  critical: number;
  acknowledged: number;
  resolved: number;
  active: number;
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

export async function getDashboardMetrics(
  state: MonitoringState,
  prismaClient: PrismaClient,
): Promise<DashboardMetrics> {
  const offlineThreshold = new Date(Date.now() - 45 * 60 * 1000);
  const alertsWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    totalNodes,
    onlineNodes,
    quarantinedNodes,
    activeSwarms,
    assetAggregate,
    creditAggregate,
  ] = await Promise.all([
    prismaClient.node.count(),
    prismaClient.node.count({
      where: {
        last_seen: { gte: offlineThreshold },
      },
    }),
    prismaClient.quarantineRecord.count({
      where: {
        is_active: true,
      },
    }),
    prismaClient.swarmTask.count({
      where: {
        status: { in: ['pending', 'in_progress'] },
      },
    }),
    prismaClient.asset.aggregate({
      _count: { _all: true },
      _avg: { gdi_score: true },
    }),
    prismaClient.node.aggregate({
      _sum: { credit_balance: true },
    }),
  ]);

  const alertsTriggered24h = state.alerts.filter(
    (alert) => new Date(alert.triggered_at).getTime() >= alertsWindow.getTime(),
  ).length;

  return {
    total_nodes: totalNodes,
    online_nodes: onlineNodes,
    offline_nodes: Math.max(totalNodes - onlineNodes, 0),
    quarantined_nodes: quarantinedNodes,
    active_swarms: activeSwarms,
    total_assets: assetAggregate._count._all,
    average_gdi: Math.round(((assetAggregate._avg.gdi_score ?? 0) * 100)) / 100,
    total_credits: creditAggregate._sum.credit_balance ?? 0,
    alerts_triggered_24h: alertsTriggered24h,
    uptime_seconds: process.uptime(),
  };
}

export async function getAlertStats(
  state: MonitoringState,
): Promise<AlertStats> {
  const stats: AlertStats = {
    total: state.alerts.length,
    info: 0,
    warning: 0,
    critical: 0,
    acknowledged: 0,
    resolved: 0,
    active: 0,
  };

  for (const alert of state.alerts) {
    stats[alert.severity] += 1;
    stats.active += 1;
  }

  return stats;
}
