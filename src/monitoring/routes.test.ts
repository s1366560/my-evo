import fastify, { type FastifyInstance } from 'fastify';
import { monitoringRoutes } from './routes';
import * as monitoringService from './service';

const mockCheckHealth = jest.fn();

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  checkHealth: (...args: unknown[]) => mockCheckHealth(...args),
}));

function buildApp(prisma: unknown): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', prisma as any);
  return app;
}

describe('Monitoring routes', () => {
  let app: FastifyInstance;
  let prisma: { marker: string };

  beforeEach(async () => {
    prisma = { marker: 'monitoring-prisma' };
    app = buildApp(prisma);
    await app.register(monitoringRoutes, { prefix: '/monitoring' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('passes app prisma to health checks', async () => {
    mockCheckHealth.mockResolvedValue({
      status: 'healthy',
      checks: {
        database: { status: 'up', latency_ms: 1 },
        redis: { status: 'up', message: 'redis is not configured' },
        queue: { status: 'up', message: 'queue is not configured' },
      },
      uptime_seconds: 1,
      version: '1.0.0',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/monitoring/health',
    });

    expect(response.statusCode).toBe(200);
    expect(mockCheckHealth).toHaveBeenCalledWith(prisma);
  });

  it('keeps metrics isolated per app instance', async () => {
    const sharedPrisma = { marker: 'shared-monitoring-prisma' };
    const appA = buildApp(sharedPrisma);
    const appB = buildApp(sharedPrisma);
    const stateA = monitoringService.createMonitoringState();
    const stateB = monitoringService.createMonitoringState();

    try {
      await appA.register(monitoringRoutes, { prefix: '/monitoring', monitoringState: stateA });
      await appB.register(monitoringRoutes, { prefix: '/monitoring', monitoringState: stateB });
      await Promise.all([appA.ready(), appB.ready()]);

      await monitoringService.recordMetric(stateA, 'cpu_usage', 42);
      await monitoringService.recordMetric(stateB, 'queue_depth', 7);

      const [metricsA, metricsB] = await Promise.all([
        appA.inject({
          method: 'GET',
          url: '/monitoring/metrics',
        }),
        appB.inject({
          method: 'GET',
          url: '/monitoring/metrics',
        }),
      ]);

      expect(metricsA.statusCode).toBe(200);
      expect(metricsB.statusCode).toBe(200);
      expect(JSON.parse(metricsA.payload).data).toEqual([
        expect.objectContaining({ name: 'cpu_usage', value: 42 }),
      ]);
      expect(JSON.parse(metricsB.payload).data).toEqual([
        expect.objectContaining({ name: 'queue_depth', value: 7 }),
      ]);
    } finally {
      await Promise.all([appA.close(), appB.close()]);
    }
  });
});
