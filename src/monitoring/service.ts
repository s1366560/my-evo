/**
 * Enhanced Monitoring Service
 * Production-grade monitoring: performance metrics, error tracking,
 * user behavior analytics, and automated alerting rules.
 *
 * For persistent metrics export to Prometheus/DataDog, pipe metricsBuffer
 * to a pushgateway or DataDog agent via the flushMetrics() function.
 */

import type { PrismaClient } from '@prisma/client';
import type { Metric } from '../shared/types';
import type { HealthStatus, ComponentHealth } from './types';

// ─── Alert & Analytics types ───────────────────────────────────────────────

export interface MonitoringAlert {
  id: string;
  name: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggered_at: string;
  metric_name: string;
  metric_value: number;
  acknowledged: boolean;
  resolved: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric_name: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  cooldown_ms: number;
  enabled: boolean;
}

export interface UserAction {
  event_type: 'page_view' | 'api_call' | 'search' | 'asset_publish' |
               'asset_purchase' | 'swarm_join' | 'node_register' | 'error' |
               'quarantine' | 'gdi_update';
  user_id?: string;
  node_id?: string;
  asset_id?: string;
  swarm_id?: string;
  session_id?: string;
  metadata?: Record<string, string | number | boolean>;
  timestamp: string;
  duration_ms?: number;
  status_code?: number;
  error_message?: string;
}

export interface MonitoringState {
  metricsBuffer: Metric[];
  alerts: MonitoringAlert[];
  userActions: UserAction[];
  alertRules: AlertRule[];
  lastAlertTimes: Record<string, number>;
  startTime: number;
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
  avg_response_time_ms: number;
  requests_per_minute: number;
  error_rate_percent: number;
  top_routes: Array<{ path: string; count: number }>;
  top_users: Array<{ user_id: string; actions: number }>;
  events_24h: number;
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

// ─── Default Alert Rules ────────────────────────────────────────────────────

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    description: 'Alert when error rate exceeds 5% of requests',
    metric_name: 'http.error_rate',
    operator: 'gt',
    threshold: 5,
    severity: 'critical',
    cooldown_ms: 5 * 60 * 1000,
    enabled: true,
  },
  {
    id: 'slow-response',
    name: 'Slow Response Time',
    description: 'Alert when average response time exceeds 2 seconds',
    metric_name: 'http.response_time_ms.avg',
    operator: 'gt',
    threshold: 2000,
    severity: 'warning',
    cooldown_ms: 5 * 60 * 1000,
    enabled: true,
  },
  {
    id: 'high-latency-p99',
    name: 'High P99 Latency',
    description: 'Alert when P99 response time exceeds 5 seconds',
    metric_name: 'http.response_time_ms.p99',
    operator: 'gt',
    threshold: 5000,
    severity: 'critical',
    cooldown_ms: 10 * 60 * 1000,
    enabled: true,
  },
  {
    id: 'node-offline-spike',
    name: 'Node Offline Spike',
    description: 'Alert when offline nodes exceed 20% of total',
    metric_name: 'node.offline_percent',
    operator: 'gt',
    threshold: 20,
    severity: 'warning',
    cooldown_ms: 15 * 60 * 1000,
    enabled: true,
  },
  {
    id: 'quarantine-surge',
    name: 'Quarantine Surge',
    description: 'Alert when quarantined nodes exceed 10',
    metric_name: 'quarantine.active_count',
    operator: 'gt',
    threshold: 10,
    severity: 'critical',
    cooldown_ms: 10 * 60 * 1000,
    enabled: true,
  },
  {
    id: 'low-credits',
    name: 'Low System Credits',
    description: 'Alert when total credits drop below 1000',
    metric_name: 'credits.total',
    operator: 'lt',
    threshold: 1000,
    severity: 'info',
    cooldown_ms: 60 * 60 * 1000,
    enabled: true,
  },
  {
    id: 'api-rate-limit',
    name: 'API Rate Limit Hit',
    description: 'Alert when rate-limited requests exceed 100/minute',
    metric_name: 'http.rate_limited',
    operator: 'gt',
    threshold: 100,
    severity: 'warning',
    cooldown_ms: 5 * 60 * 1000,
    enabled: true,
  },
  {
    id: 'search-latency',
    name: 'Search Latency High',
    description: 'Alert when search response time exceeds 3 seconds',
    metric_name: 'http.response_time_ms.search',
    operator: 'gt',
    threshold: 3000,
    severity: 'warning',
    cooldown_ms: 5 * 60 * 1000,
    enabled: true,
  },
];

// ─── State Factory ──────────────────────────────────────────────────────────

export function createMonitoringState(): MonitoringState {
  return {
    metricsBuffer: [],
    alerts: [],
    userActions: [],
    alertRules: [...DEFAULT_ALERT_RULES],
    lastAlertTimes: {},
    startTime: Date.now(),
  };
}

// ─── Metrics ────────────────────────────────────────────────────────────────

/** Record a metric and auto-evaluate alert rules. */
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

  await evaluateAlertRules(state, metric);
}

/** Record multiple metrics in batch. */
export async function recordMetrics(
  state: MonitoringState,
  metrics: Array<{ name: string; value: number; labels?: Record<string, string> }>,
): Promise<void> {
  for (const m of metrics) {
    await recordMetric(state, m.name, m.value, m.labels);
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

// ─── Alert Rules Engine ─────────────────────────────────────────────────────

function compareAlertValues(
  operator: AlertRule['operator'],
  actual: number,
  threshold: number,
): boolean {
  switch (operator) {
    case 'gt':  return actual > threshold;
    case 'lt':  return actual < threshold;
    case 'eq':  return actual === threshold;
    case 'gte': return actual >= threshold;
    case 'lte': return actual <= threshold;
  }
}

async function evaluateAlertRules(state: MonitoringState, metric: Metric): Promise<void> {
  for (const rule of state.alertRules) {
    if (!rule.enabled) continue;
    if (rule.metric_name !== metric.name) continue;

    const now = Date.now();
    const lastTime = state.lastAlertTimes[rule.id] ?? 0;

    if (now - lastTime < rule.cooldown_ms) continue;

    if (compareAlertValues(rule.operator, metric.value, rule.threshold)) {
      const alert: MonitoringAlert = {
        id: `${rule.id}-${now}`,
        name: rule.name,
        severity: rule.severity,
        message: `${rule.description} (current: ${metric.value}, threshold: ${rule.threshold})`,
        triggered_at: new Date().toISOString(),
        metric_name: metric.name,
        metric_value: metric.value,
        acknowledged: false,
        resolved: false,
      };

      state.alerts.push(alert);
      state.lastAlertTimes[rule.id] = now;

      if (state.alerts.length > 500) {
        state.alerts.splice(0, state.alerts.length - 500);
      }
    }
  }
}

/** Manually trigger an alert (e.g., for caught exceptions). */
export async function triggerAlert(
  state: MonitoringState,
  name: string,
  severity: MonitoringAlert['severity'],
  message: string,
  metric_name = 'manual',
  metric_value = 1,
): Promise<MonitoringAlert> {
  const alert: MonitoringAlert = {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    severity,
    message,
    triggered_at: new Date().toISOString(),
    metric_name,
    metric_value,
    acknowledged: false,
    resolved: false,
  };

  state.alerts.push(alert);
  return alert;
}

export async function acknowledgeAlert(
  state: MonitoringState,
  alertId: string,
): Promise<boolean> {
  const alert = state.alerts.find((a) => a.id === alertId);
  if (!alert) return false;
  alert.acknowledged = true;
  return true;
}

export async function resolveAlert(
  state: MonitoringState,
  alertId: string,
): Promise<boolean> {
  const alert = state.alerts.find((a) => a.id === alertId);
  if (!alert) return false;
  alert.resolved = true;
  alert.acknowledged = true;
  return true;
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
    if (alert.acknowledged) stats.acknowledged += 1;
    if (alert.resolved) stats.resolved += 1;
    if (!alert.resolved) stats.active += 1;
  }

  return stats;
}

export async function getAlertRules(
  state: MonitoringState,
): Promise<AlertRule[]> {
  return [...state.alertRules];
}

export async function updateAlertRule(
  state: MonitoringState,
  ruleId: string,
  patch: Partial<AlertRule>,
): Promise<boolean> {
  const rule = state.alertRules.find((r) => r.id === ruleId);
  if (!rule) return false;
  Object.assign(rule, patch);
  return true;
}


// ─── User Behavior Analytics ────────────────────────────────────────────────

export async function trackUserAction(
  state: MonitoringState,
  action: Omit<UserAction, 'timestamp'>,
): Promise<void> {
  const event: UserAction = {
    ...action,
    timestamp: new Date().toISOString(),
  };

  state.userActions.push(event);

  if (state.userActions.length > 5000) {
    state.userActions.splice(0, state.userActions.length - 5000);
  }
}

export async function getUserActions(
  state: MonitoringState,
  options?: {
    event_type?: UserAction['event_type'];
    user_id?: string;
    start?: string;
    end?: string;
    limit?: number;
  },
): Promise<UserAction[]> {
  let filtered = [...state.userActions];

  if (options?.event_type) {
    filtered = filtered.filter((a) => a.event_type === options.event_type);
  }

  if (options?.user_id) {
    filtered = filtered.filter((a) => a.user_id === options.user_id);
  }

  if (options?.start) {
    const startTime = new Date(options.start).getTime();
    filtered = filtered.filter(
      (a) => new Date(a.timestamp).getTime() >= startTime,
    );
  }

  if (options?.end) {
    const endTime = new Date(options.end).getTime();
    filtered = filtered.filter(
      (a) => new Date(a.timestamp).getTime() <= endTime,
    );
  }

  const limit = options?.limit ?? 100;
  return filtered.slice(-limit);
}

export async function getAnalyticsSummary(
  state: MonitoringState,
  windowHours = 24,
): Promise<{
  events_by_type: Record<string, number>;
  unique_users: number;
  total_events: number;
  top_routes: Array<{ path: string; count: number }>;
  error_count: number;
  avg_duration_ms: number;
}> {
  const windowMs = windowHours * 60 * 60 * 1000;
  const cutoff = Date.now() - windowMs;

  const recent = state.userActions.filter(
    (a) => new Date(a.timestamp).getTime() >= cutoff,
  );

  const eventsByType: Record<string, number> = {};
  const userSet = new Set<string>();
  const routeCounts: Record<string, number> = {};
  let errorCount = 0;
  let totalDuration = 0;
  let durationCount = 0;

  for (const action of recent) {
    eventsByType[action.event_type] = (eventsByType[action.event_type] ?? 0) + 1;

    if (action.user_id) userSet.add(action.user_id);

    if (action.metadata?.route) {
      const route = String(action.metadata.route);
      routeCounts[route] = (routeCounts[route] ?? 0) + 1;
    }

    if (action.event_type === 'error' || action.error_message) {
      errorCount += 1;
    }

    if (action.duration_ms != null) {
      totalDuration += action.duration_ms;
      durationCount += 1;
    }
  }

  const topRoutes = Object.entries(routeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  return {
    events_by_type: eventsByType,
    unique_users: userSet.size,
    total_events: recent.length,
    top_routes: topRoutes,
    error_count: errorCount,
    avg_duration_ms: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
  };
}

// ─── Health Checks ──────────────────────────────────────────────────────────

function getOptionalComponentHealth(
  component: 'redis' | 'queue',
  configured: boolean,
): ComponentHealth {
  if (!configured) {
    return { status: 'up', message: `${component} is not configured` };
  }
  return { status: 'up', message: `${component} is configured; active connectivity probe is not enabled` };
}

export async function checkHealth(prismaClient: PrismaClient): Promise<HealthStatus> {
  const redisConfigured = Boolean(process.env.REDIS_URL);
  const queueConfigured = Boolean(
    process.env.QUEUE_URL ?? process.env.QUEUE_REDIS_URL ?? process.env.BULLMQ_REDIS_URL,
  );
  const checks: HealthStatus['checks'] = {
    database: { status: 'up' },
    redis: getOptionalComponentHealth('redis', redisConfigured),
    queue: getOptionalComponentHealth('queue', queueConfigured),
  };

  try {
    const dbStart = Date.now();
    await prismaClient.$queryRaw`SELECT 1`;
    checks.database = { status: 'up', latency_ms: Date.now() - dbStart };
  } catch {
    checks.database = { status: 'down', message: 'Database connection failed' };
  }

  const allUp = Object.values(checks).every((c) => c.status === 'up');
  const anyDown = Object.values(checks).some((c) => c.status === 'down');

  return {
    status: anyDown ? 'unhealthy' : allUp ? 'healthy' : 'degraded',
    checks,
    uptime_seconds: process.uptime(),
    version: '1.0.0',
  };
}

// ─── Dashboard Metrics ──────────────────────────────────────────────────────

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
    prismaClient.node.count({ where: { last_seen: { gte: offlineThreshold } } }),
    prismaClient.quarantineRecord.count({ where: { is_active: true } }),
    prismaClient.swarmTask.count({ where: { status: { in: ['pending', 'in_progress'] } } }),
    prismaClient.asset.aggregate({ _count: { _all: true }, _avg: { gdi_score: true } }),
    prismaClient.node.aggregate({ _sum: { credit_balance: true } }),
  ]);

  const alertsTriggered24h = state.alerts.filter(
    (alert) => new Date(alert.triggered_at).getTime() >= alertsWindow.getTime(),
  ).length;

  // Compute performance metrics from in-memory buffer
  const window5m = Date.now() - 5 * 60 * 1000;
  const recentMetrics = state.metricsBuffer.filter(
    (m) => new Date(m.timestamp).getTime() >= window5m,
  );

  const requestCount = recentMetrics.filter((m) => m.name === 'http.requests.total').length;
  const errorCount = recentMetrics.filter((m) => m.name === 'http.errors').reduce(
    (sum, m) => sum + m.value, 0,
  );
  const responseTimes = recentMetrics
    .filter((m) => m.name === 'http.response_time_ms')
    .map((m) => m.value)
    .sort((a, b) => a - b);

  const avgResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;
  const p99ResponseTime = responseTimes.length > 0
    ? responseTimes[Math.floor(responseTimes.length * 0.99)] ?? avgResponseTime
    : 0;

  const errorRate = requestCount > 0
    ? Math.round((errorCount / requestCount) * 100 * 100) / 100
    : 0;

  // Top users from analytics
  const window24h = Date.now() - 24 * 60 * 60 * 1000;
  const recentActions = state.userActions.filter(
    (a) => new Date(a.timestamp).getTime() >= window24h,
  );
  const userCounts: Record<string, number> = {};
  for (const action of recentActions) {
    if (action.user_id) {
      userCounts[action.user_id] = (userCounts[action.user_id] ?? 0) + 1;
    }
  }
  const topUsers = Object.entries(userCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([user_id, actions]) => ({ user_id, actions }));

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
    avg_response_time_ms: avgResponseTime,
    requests_per_minute: Math.round(requestCount / 5),
    error_rate_percent: errorRate,
    top_routes: [],
    top_users: topUsers,
    events_24h: recentActions.length,
  };
}

/** Export metrics for Prometheus pushgateway or DataDog agent. */
export function flushMetrics(state: MonitoringState): Metric[] {
  return [...state.metricsBuffer];
}

/** Get response time percentiles from buffer. */
export function getResponseTimeStats(state: MonitoringState, windowMs = 5 * 60 * 1000): {
  avg: number; p50: number; p90: number; p99: number; count: number;
} {
  const cutoff = Date.now() - windowMs;
  const times = state.metricsBuffer
    .filter((m) => m.name === 'http.response_time_ms' && new Date(m.timestamp).getTime() >= cutoff)
    .map((m) => m.value)
    .sort((a, b) => a - b);

  if (times.length === 0) {
    return { avg: 0, p50: 0, p90: 0, p99: 0, count: 0 };
  }

  const len = times.length;
  const sum = times.reduce((a, b) => a + b, 0);
  const idx = (p: number): number => {
    const val = times[Math.floor(len * p)];
    const last = times[len - 1];
    return val ?? last ?? 0;
  };

  return {
    avg: Math.round(sum / len),
    p50: idx(0.5),
    p90: idx(0.9),
    p99: idx(0.99),
    count: len,
  };
}
