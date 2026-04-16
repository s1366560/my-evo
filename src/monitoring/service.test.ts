import * as service from './service';

const {
  recordMetric,
  getMetrics,
  checkHealth,
  getAlerts,
  getDashboardMetrics,
  getAlertStats,
  createMonitoringState,
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
        },
        {
          id: 'alert-2',
          name: 'info alert',
          severity: 'info',
          message: 'info',
          triggered_at: new Date().toISOString(),
          metric_name: 'credits',
          metric_value: 10,
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
});
