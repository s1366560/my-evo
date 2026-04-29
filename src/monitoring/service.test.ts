import * as service from './service';

const {
  recordMetric,
  recordMetrics,
  getMetrics,
  checkHealth,
  getAlerts,
  getDashboardMetrics,
  getAlertStats,
  createMonitoringState,
  acknowledgeAlert,
  resolveAlert,
  triggerAlert,
  getAlertRules,
  updateAlertRule,
  trackUserAction,
  getUserActions,
  getAnalyticsSummary,
  getResponseTimeStats,
  DEFAULT_ALERT_RULES,
} = service;

const mockPrisma = {
  $queryRaw: jest.fn(),
  node: {
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  quarantineRecord: {
    count: jest.fn(),
  },
  swarmTask: {
    count: jest.fn(),
  },
  asset: {
    aggregate: jest.fn(),
  },
} as any;

describe('Monitoring Service', () => {
  let monitoringState: service.MonitoringState;

  beforeEach(() => {
    jest.clearAllMocks();
    monitoringState = createMonitoringState();
  });

  async function record(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): Promise<void> {
    await recordMetric(monitoringState, name, value, labels);
  }

  async function listMetrics(
    names?: string[],
    start?: string,
    end?: string,
  ) {
    return getMetrics(monitoringState, names, start, end);
  }

  async function listAlerts(
    severity?: 'info' | 'warning' | 'critical',
    limit = 50,
  ) {
    return getAlerts(monitoringState, severity, limit);
  }

  describe('recordMetric', () => {
    it('should record a metric with name, value, and labels', async () => {
      await record('cpu_usage', 72.5, { host: 'server-1' });

      const metrics = await listMetrics(['cpu_usage']);
      expect(metrics).toHaveLength(1);
      expect(metrics[0]!.name).toBe('cpu_usage');
      expect(metrics[0]!.value).toBe(72.5);
      expect(metrics[0]!.labels).toEqual({ host: 'server-1' });
      expect(metrics[0]!.timestamp).toBeDefined();
    });

    it('should record a metric without labels', async () => {
      await record('requests', 100);

      const metrics = await listMetrics(['requests']);
      expect(metrics).toHaveLength(1);
      expect(metrics[0]!.labels).toEqual({});
    });

    it('should accumulate multiple metrics', async () => {
      const beforeCount = (await listMetrics()).length;
      await record('metric-1', 10);
      await record('metric-2', 20);
      await record('metric-1', 30);

      const allMetrics = await listMetrics();
      expect(allMetrics.length - beforeCount).toBe(3);
    });

    it('should trim the buffer to the most recent 1000 metrics', async () => {
      for (let index = 0; index < 1002; index += 1) {
        await record(`metric-${index}`, index);
      }

      const allMetrics = await listMetrics();
      expect(allMetrics).toHaveLength(1000);
      expect(allMetrics[0]!.name).toBe('metric-2');
      expect(allMetrics.at(-1)!.name).toBe('metric-1001');
    });
  });

  describe('getMetrics', () => {
    it('should return all metrics when no filters', async () => {
      await record('m1', 1);
      await record('m2', 2);

      const result = await listMetrics();

      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by metric names', async () => {
      await record('target', 1);
      await record('other', 2);

      const result = await listMetrics(['target']);

      expect(result.every((m) => m.name === 'target')).toBe(true);
    });

    it('should filter by start time', async () => {
      await record('time-test', 1);

      const futureTime = new Date(Date.now() + 60000).toISOString();
      const result = await listMetrics(undefined, futureTime);

      expect(result).toHaveLength(0);
    });

    it('should filter by end time', async () => {
      await record('time-test', 1);

      const pastTime = new Date(Date.now() - 60000).toISOString();
      const result = await listMetrics(undefined, undefined, pastTime);

      expect(result).toHaveLength(0);
    });

    it('should return metrics within time range', async () => {
      await record('range-test', 1);

      const start = new Date(Date.now() - 60000).toISOString();
      const end = new Date(Date.now() + 60000).toISOString();
      const result = await listMetrics(undefined, start, end);

      expect(result.length).toBeGreaterThanOrEqual(1);
      const rangeMetrics = result.filter((m) => m.name === 'range-test');
      expect(rangeMetrics).toHaveLength(1);
    });

    it('should return empty array when no matching names', async () => {
      await record('exists', 1);

      const result = await listMetrics(['nonexistent']);

      expect(result).toEqual([]);
    });
  });

  describe('checkHealth', () => {
    const originalRedisUrl = process.env.REDIS_URL;
    const originalQueueUrl = process.env.QUEUE_URL;

    afterEach(() => {
      process.env.REDIS_URL = originalRedisUrl;
      process.env.QUEUE_URL = originalQueueUrl;
    });

    it('should return healthy status when database is up', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ result: 1 }]);

      const result = await checkHealth(mockPrisma);

      expect(result.status).toBe('healthy');
      expect(result.checks.database.status).toBe('up');
      expect(result.checks.database.latency_ms).toBeGreaterThanOrEqual(0);
      expect(result.checks.redis.status).toBe('up');
      expect(result.checks.queue.status).toBe('up');
      expect(result.uptime_seconds).toBeGreaterThan(0);
      expect(result.version).toBe('1.0.0');
    });

    it('should report configured optional components when env vars are present', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.QUEUE_URL = 'redis://localhost:6380';
      mockPrisma.$queryRaw.mockResolvedValue([{ result: 1 }]);

      const result = await checkHealth(mockPrisma);

      expect(result.checks.redis).toEqual({
        status: 'up',
        message: 'redis is configured; active connectivity probe is not enabled',
      });
      expect(result.checks.queue).toEqual({
        status: 'up',
        message: 'queue is configured; active connectivity probe is not enabled',
      });
    });

    it('should return unhealthy status when database is down', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const result = await checkHealth(mockPrisma);

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database.status).toBe('down');
      expect(result.checks.database.message).toBe('Database connection failed');
    });

    it('should include latency for database check', async () => {
      mockPrisma.$queryRaw.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10)),
      );

      const result = await checkHealth(mockPrisma);

      expect(result.checks.database.latency_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getAlerts', () => {
    it('should return alerts up to the limit', async () => {
      const result = await listAlerts(undefined, 50);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by severity', async () => {
      const result = await listAlerts('critical');

      expect(Array.isArray(result)).toBe(true);
      expect(result.every((a) => a.severity === 'critical')).toBe(true);
    });

    it('should respect the limit parameter', async () => {
      const result = await listAlerts(undefined, 10);

      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('should return empty array when no alerts', async () => {
      const result = await listAlerts();

      expect(result).toEqual([]);
    });
  });

  describe('getDashboardMetrics', () => {
    it('should aggregate dashboard metrics from prisma and alert state', async () => {
      mockPrisma.node.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(7);
      mockPrisma.quarantineRecord.count.mockResolvedValue(2);
      mockPrisma.swarmTask.count.mockResolvedValue(3);
      mockPrisma.asset.aggregate.mockResolvedValue({
        _count: { _all: 25 },
        _avg: { gdi_score: 54.321 },
      });
      mockPrisma.node.aggregate.mockResolvedValue({
        _sum: { credit_balance: 1200 },
      });
      monitoringState.alerts.push({
        id: 'alert-1',
        name: 'node offline',
        severity: 'warning',
        message: 'node offline',
        triggered_at: new Date().toISOString(),
        metric_name: 'heartbeat',
        metric_value: 1,
        acknowledged: false,
        resolved: false,
      });

      const result = await getDashboardMetrics(monitoringState, mockPrisma);

      expect(mockPrisma.node.count).toHaveBeenNthCalledWith(1);
      expect(mockPrisma.node.count).toHaveBeenNthCalledWith(2, {
        where: {
          last_seen: { gte: expect.any(Date) },
        },
      });
      expect(result).toMatchObject({
        total_nodes: 10,
        online_nodes: 7,
        offline_nodes: 3,
        quarantined_nodes: 2,
        active_swarms: 3,
        total_assets: 25,
        average_gdi: 54.32,
        total_credits: 1200,
        alerts_triggered_24h: 1,
      });
      expect(result.uptime_seconds).toBeGreaterThan(0);
    });
  });

  describe('getAlertStats', () => {
    it('should summarize alert severities', async () => {
      monitoringState.alerts.push(
        {
          id: 'alert-1',
          name: 'critical alert',
          severity: 'critical',
          message: 'critical',
          triggered_at: new Date().toISOString(),
          metric_name: 'errors',
          metric_value: 2,
          acknowledged: false,
          resolved: false,
        },
        {
          id: 'alert-2',
          name: 'info alert',
          severity: 'info',
          message: 'info',
          triggered_at: new Date().toISOString(),
          metric_name: 'credits',
          metric_value: 10,
          acknowledged: false,
          resolved: false,
        },
      );

      const result = await getAlertStats(monitoringState);

      expect(result).toEqual({
        total: 2,
        info: 1,
        warning: 0,
        critical: 1,
        acknowledged: 0,
        resolved: 0,
        active: 2,
      });
    });
  });

  describe('recordMetrics batch', () => {
    it('should record multiple metrics at once', async () => {
      await recordMetrics(monitoringState, [
        { name: 'batch.m1', value: 1 },
        { name: 'batch.m2', value: 2 },
        { name: 'batch.m3', value: 3, labels: { env: 'test' } },
      ]);

      const result = await getMetrics(monitoringState, ['batch.m1', 'batch.m2', 'batch.m3']);
      expect(result).toHaveLength(3);
    });
  });

  describe('triggerAlert', () => {
    it('should create a manual alert with correct fields', async () => {
      const alert = await triggerAlert(
        monitoringState,
        'Disk Full',
        'critical',
        'Disk usage above 95%',
        'disk.usage',
        96,
      );

      expect(alert.name).toBe('Disk Full');
      expect(alert.severity).toBe('critical');
      expect(alert.message).toBe('Disk usage above 95%');
      expect(alert.metric_name).toBe('disk.usage');
      expect(alert.metric_value).toBe(96);
      expect(alert.acknowledged).toBe(false);
      expect(alert.resolved).toBe(false);
      expect(alert.id).toMatch(/^manual-/);
    });
  });

  describe('acknowledgeAlert', () => {
    it('should mark alert as acknowledged', async () => {
      const alert = await triggerAlert(monitoringState, 'Test', 'warning', 'Test', 'test', 1);
      const ok = await acknowledgeAlert(monitoringState, alert.id);
      expect(ok).toBe(true);
      const found = monitoringState.alerts.find((a) => a.id === alert.id);
      expect(found?.acknowledged).toBe(true);
    });

    it('should return false for unknown alert', async () => {
      const ok = await acknowledgeAlert(monitoringState, 'nonexistent');
      expect(ok).toBe(false);
    });
  });

  describe('resolveAlert', () => {
    it('should mark alert as resolved and acknowledged', async () => {
      const alert = await triggerAlert(monitoringState, 'Test', 'info', 'Test', 'test', 1);
      const ok = await resolveAlert(monitoringState, alert.id);
      expect(ok).toBe(true);
      const found = monitoringState.alerts.find((a) => a.id === alert.id);
      expect(found?.resolved).toBe(true);
      expect(found?.acknowledged).toBe(true);
    });
  });

  describe('alert rules', () => {
    it('should have default alert rules initialized', () => {
      expect(DEFAULT_ALERT_RULES.length).toBeGreaterThan(0);
      const rule = DEFAULT_ALERT_RULES.find((r) => r.id === 'high-error-rate');
      expect(rule).toBeDefined();
      expect(rule!.severity).toBe('critical');
      expect(rule!.operator).toBe('gt');
      expect(rule!.threshold).toBe(5);
    });

    it('should get all alert rules', async () => {
      const rules = await getAlertRules(monitoringState);
      expect(rules.length).toBe(DEFAULT_ALERT_RULES.length);
    });

    it('should update an alert rule', async () => {
      const ok = await updateAlertRule(monitoringState, 'high-error-rate', {
        threshold: 10,
        enabled: false,
      });
      expect(ok).toBe(true);
      const rule = monitoringState.alertRules.find((r) => r.id === 'high-error-rate');
      expect(rule?.threshold).toBe(10);
      expect(rule?.enabled).toBe(false);
    });

    it('should return false for unknown rule', async () => {
      const ok = await updateAlertRule(monitoringState, 'unknown-rule', { threshold: 5 });
      expect(ok).toBe(false);
    });

    it('should auto-trigger alert when metric exceeds threshold', async () => {
      // Create a rule with a very low threshold so it fires immediately
      monitoringState.alertRules = [{
        id: 'test-rule',
        name: 'Test Rule',
        description: 'Test',
        metric_name: 'test.metric',
        operator: 'gt',
        threshold: 50,
        severity: 'warning',
        cooldown_ms: 0, // No cooldown for testing
        enabled: true,
      }];

      await recordMetric(monitoringState, 'test.metric', 100);

      const alert = monitoringState.alerts.find((a) => a.name === 'Test Rule');
      expect(alert).toBeDefined();
      expect(alert!.severity).toBe('warning');
      expect(alert!.metric_value).toBe(100);
    });

    it('should respect cooldown period', async () => {
      monitoringState.alertRules = [{
        id: 'cooldown-test',
        name: 'Cooldown Test',
        description: 'Test',
        metric_name: 'cooldown.metric',
        operator: 'gt',
        threshold: 0,
        severity: 'info',
        cooldown_ms: 60000, // 60s cooldown
        enabled: true,
      }];

      // First trigger
      await recordMetric(monitoringState, 'cooldown.metric', 1);
      expect(monitoringState.alerts.filter((a) => a.name === 'Cooldown Test')).toHaveLength(1);

      // Should not trigger again within cooldown
      await recordMetric(monitoringState, 'cooldown.metric', 2);
      expect(monitoringState.alerts.filter((a) => a.name === 'Cooldown Test')).toHaveLength(1);
    });
  });

  describe('user analytics', () => {
    it('should track user actions', async () => {
      await trackUserAction(monitoringState, {
        event_type: 'api_call',
        user_id: 'user-1',
        session_id: 'session-1',
        metadata: { route: '/api/v2/assets', method: 'GET' },
        duration_ms: 120,
        status_code: 200,
      });

      const actions = await getUserActions(monitoringState, { user_id: 'user-1' });
      expect(actions).toHaveLength(1);
      expect(actions[0]!.event_type).toBe('api_call');
      expect(actions[0]!.user_id).toBe('user-1');
      expect(actions[0]!.duration_ms).toBe(120);
    });

    it('should filter actions by event_type', async () => {
      await trackUserAction(monitoringState, { event_type: 'api_call', user_id: 'u1' });
      await trackUserAction(monitoringState, { event_type: 'search', user_id: 'u1' });
      await trackUserAction(monitoringState, { event_type: 'error', user_id: 'u1' });

      const errors = await getUserActions(monitoringState, { event_type: 'error' });
      expect(errors.every((a) => a.event_type === 'error')).toBe(true);
    });

    it('should get analytics summary', async () => {
      await trackUserAction(monitoringState, { event_type: 'api_call', user_id: 'u1' });
      await trackUserAction(monitoringState, { event_type: 'api_call', user_id: 'u2' });
      await trackUserAction(monitoringState, { event_type: 'error', user_id: 'u1', error_message: 'oops' });
      await trackUserAction(monitoringState, {
        event_type: 'api_call',
        user_id: 'u1',
        metadata: { route: '/api/v2/assets' },
        duration_ms: 500,
      });

      const summary = await getAnalyticsSummary(monitoringState, 24);
      expect(summary.total_events).toBe(4);
      expect(summary.unique_users).toBe(2);
      expect(summary.events_by_type['api_call']).toBe(3);
      expect(summary.events_by_type['error']).toBe(1);
      expect(summary.error_count).toBe(1);
      expect(summary.top_routes.length).toBeGreaterThan(0);
    });

    it('should bound user actions buffer to 5000', async () => {
      for (let i = 0; i < 5002; i += 1) {
        await trackUserAction(monitoringState, { event_type: 'api_call' });
      }
      const actions = await getUserActions(monitoringState);
      expect(actions.length).toBeLessThanOrEqual(5000);
    });
  });

  describe('response time stats', () => {
    it('should compute avg/p50/p90/p99 from buffer', async () => {
      for (const v of [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]) {
        await recordMetric(monitoringState, 'http.response_time_ms', v);
      }

      const stats = getResponseTimeStats(monitoringState);
      expect(stats.count).toBe(10);
      expect(stats.avg).toBe(550);
      expect(stats.p50).toBeGreaterThan(0);
      expect(stats.p90).toBeGreaterThan(stats.p50);
      expect(stats.p99).toBeGreaterThanOrEqual(stats.p90);
    });

    it('should return zeros for empty buffer', async () => {
      const stats = getResponseTimeStats(monitoringState);
      expect(stats.avg).toBe(0);
      expect(stats.p50).toBe(0);
      expect(stats.count).toBe(0);
    });
  });

  describe('createMonitoringState', () => {
    it('should initialize with default alert rules', () => {
      const state = createMonitoringState();
      expect(state.alertRules.length).toBe(DEFAULT_ALERT_RULES.length);
      expect(state.metricsBuffer).toEqual([]);
      expect(state.alerts).toEqual([]);
      expect(state.userActions).toEqual([]);
      expect(state.startTime).toBeGreaterThan(0);
    });
  });
});
