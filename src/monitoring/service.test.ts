import { PrismaClient } from '@prisma/client';
import * as service from './service';

const {
  recordMetric,
  getMetrics,
  checkHealth,
  getAlerts,
} = service;

const mockPrisma = {
  $queryRaw: jest.fn(),
} as any;

describe('Monitoring Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordMetric', () => {
    it('should record a metric with name, value, and labels', async () => {
      await recordMetric('cpu_usage', 72.5, { host: 'server-1' });

      const metrics = await getMetrics(['cpu_usage']);
      expect(metrics).toHaveLength(1);
      expect(metrics[0]!.name).toBe('cpu_usage');
      expect(metrics[0]!.value).toBe(72.5);
      expect(metrics[0]!.labels).toEqual({ host: 'server-1' });
      expect(metrics[0]!.timestamp).toBeDefined();
    });

    it('should record a metric without labels', async () => {
      await recordMetric('requests', 100);

      const metrics = await getMetrics(['requests']);
      expect(metrics).toHaveLength(1);
      expect(metrics[0]!.labels).toEqual({});
    });

    it('should accumulate multiple metrics', async () => {
      const beforeCount = (await getMetrics()).length;
      await recordMetric('metric-1', 10);
      await recordMetric('metric-2', 20);
      await recordMetric('metric-1', 30);

      const allMetrics = await getMetrics();
      expect(allMetrics.length - beforeCount).toBe(3);
    });
  });

  describe('getMetrics', () => {
    it('should return all metrics when no filters', async () => {
      await recordMetric('m1', 1);
      await recordMetric('m2', 2);

      const result = await getMetrics();

      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by metric names', async () => {
      await recordMetric('target', 1);
      await recordMetric('other', 2);

      const result = await getMetrics(['target']);

      expect(result.every((m) => m.name === 'target')).toBe(true);
    });

    it('should filter by start time', async () => {
      await recordMetric('time-test', 1);

      const futureTime = new Date(Date.now() + 60000).toISOString();
      const result = await getMetrics(undefined, futureTime);

      expect(result).toHaveLength(0);
    });

    it('should filter by end time', async () => {
      await recordMetric('time-test', 1);

      const pastTime = new Date(Date.now() - 60000).toISOString();
      const result = await getMetrics(undefined, undefined, pastTime);

      expect(result).toHaveLength(0);
    });

    it('should return metrics within time range', async () => {
      await recordMetric('range-test', 1);

      const start = new Date(Date.now() - 60000).toISOString();
      const end = new Date(Date.now() + 60000).toISOString();
      const result = await getMetrics(undefined, start, end);

      expect(result.length).toBeGreaterThanOrEqual(1);
      const rangeMetrics = result.filter((m) => m.name === 'range-test');
      expect(rangeMetrics).toHaveLength(1);
    });

    it('should return empty array when no matching names', async () => {
      await recordMetric('exists', 1);

      const result = await getMetrics(['nonexistent']);

      expect(result).toEqual([]);
    });
  });

  describe('checkHealth', () => {
    it('should return healthy status when database is up', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ result: 1 }]);

      const result = await checkHealth();

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

      const result = await checkHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database.status).toBe('down');
      expect(result.checks.database.message).toBe('Database connection failed');
    });

    it('should include latency for database check', async () => {
      mockPrisma.$queryRaw.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10)),
      );

      const result = await checkHealth();

      expect(result.checks.database.latency_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getAlerts', () => {
    it('should return alerts up to the limit', async () => {
      const result = await getAlerts(undefined, 50);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by severity', async () => {
      const result = await getAlerts('critical');

      expect(Array.isArray(result)).toBe(true);
      expect(result.every((a) => a.severity === 'critical')).toBe(true);
    });

    it('should respect the limit parameter', async () => {
      const result = await getAlerts(undefined, 10);

      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('should return empty array when no alerts', async () => {
      const result = await getAlerts();

      expect(result).toEqual([]);
    });
  });
});
