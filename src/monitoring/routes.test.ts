import fastify, { type FastifyInstance } from 'fastify';
import { monitoringRoutes } from './routes';
import * as monitoringService from './service';

const mockCheckHealth = jest.fn();
const mockGetDashboardMetrics = jest.fn();
const mockGetAlertStats = jest.fn();

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  checkHealth: (...args: unknown[]) => mockCheckHealth(...args),
  getDashboardMetrics: (...args: unknown[]) => mockGetDashboardMetrics(...args),
  getAlertStats: (...args: unknown[]) => mockGetAlertStats(...args),
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

  it('exposes dashboard metrics with top-level aliases and compatibility data', async () => {
    mockGetDashboardMetrics.mockResolvedValue({
      total_nodes: 10,
      online_nodes: 7,
      offline_nodes: 3,
      quarantined_nodes: 1,
      active_swarms: 2,
      total_assets: 40,
      average_gdi: 55.5,
      total_credits: 5000,
      alerts_triggered_24h: 4,
      uptime_seconds: 123,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/monitoring/dashboard/metrics',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetDashboardMetrics).toHaveBeenCalledWith(expect.any(Object), prisma);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      total_nodes: 10,
      online_nodes: 7,
      offline_nodes: 3,
      quarantined_nodes: 1,
      active_swarms: 2,
      total_assets: 40,
      average_gdi: 55.5,
      total_credits: 5000,
      alerts_triggered_24h: 4,
      uptime_seconds: 123,
      data: {
        total_nodes: 10,
        online_nodes: 7,
        offline_nodes: 3,
        quarantined_nodes: 1,
        active_swarms: 2,
        total_assets: 40,
        average_gdi: 55.5,
        total_credits: 5000,
        alerts_triggered_24h: 4,
        uptime_seconds: 123,
      },
    });
  });

  it('exposes alert list and alert stats compatibility aliases', async () => {
    mockGetAlertStats.mockResolvedValue({
      total: 2,
      info: 1,
      warning: 0,
      critical: 1,
      acknowledged: 0,
      resolved: 0,
      active: 2,
    });

    const state = monitoringService.createMonitoringState();
    state.alerts.push(
      {
        id: 'alert-1',
        name: 'Quarantine',
        severity: 'critical',
        message: 'node quarantined',
        triggered_at: '2026-04-15T10:00:00.000Z',
        metric_name: 'quarantine',
        metric_value: 1,
      },
      {
        id: 'alert-2',
        name: 'Low credits',
        severity: 'info',
        message: 'credits low',
        triggered_at: '2026-04-15T11:00:00.000Z',
        metric_name: 'credit_balance',
        metric_value: 42,
      },
    );

    const appWithState = buildApp(prisma);

    try {
      await appWithState.register(monitoringRoutes, {
        prefix: '/monitoring',
        monitoringState: state,
      });
      await appWithState.ready();

      const [alertsResponse, statsResponse] = await Promise.all([
        appWithState.inject({
          method: 'GET',
          url: '/monitoring/alerts?severity=critical&limit=10',
        }),
        appWithState.inject({
          method: 'GET',
          url: '/monitoring/alerts/stats',
        }),
      ]);

      expect(alertsResponse.statusCode).toBe(200);
      expect(JSON.parse(alertsResponse.payload)).toEqual({
        success: true,
        alerts: [
          expect.objectContaining({
            id: 'alert-1',
            severity: 'critical',
          }),
        ],
        total: 1,
        data: [
          expect.objectContaining({
            id: 'alert-1',
            severity: 'critical',
          }),
        ],
      });
      expect(statsResponse.statusCode).toBe(200);
      expect(mockGetAlertStats).toHaveBeenCalledWith(state);
      expect(JSON.parse(statsResponse.payload)).toEqual({
        success: true,
        stats: {
          total: 2,
          info: 1,
          warning: 0,
          critical: 1,
          acknowledged: 0,
          resolved: 0,
          active: 2,
        },
        data: {
          total: 2,
          info: 1,
          warning: 0,
          critical: 1,
          acknowledged: 0,
          resolved: 0,
          active: 2,
        },
      });
    } finally {
      await appWithState.close();
    }
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
