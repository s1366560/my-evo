import * as service from './service';

const {
  recordMetric,
  getMetrics,
  checkHealth,
  getAlerts,
  createMonitoringState,
} = service;

const mockPrisma = {
  $queryRaw: jest.fn(),
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
});
