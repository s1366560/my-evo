import fastify, { type FastifyInstance } from 'fastify';
import { analyticsRoutes } from './routes';

const mockGetDriftReport = jest.fn();
const mockGetBranchingMetrics = jest.fn();
const mockGetTimeline = jest.fn();
const mockGetSignalForecast = jest.fn();
const mockGetGdiForecast = jest.fn();
const mockGetRiskAlerts = jest.fn();

jest.mock('./service', () => ({
  getDriftReport: (...args: unknown[]) => mockGetDriftReport(...args),
  getBranchingMetrics: (...args: unknown[]) => mockGetBranchingMetrics(...args),
  getTimeline: (...args: unknown[]) => mockGetTimeline(...args),
  getSignalForecast: (...args: unknown[]) => mockGetSignalForecast(...args),
  getGdiForecast: (...args: unknown[]) => mockGetGdiForecast(...args),
  getRiskAlerts: (...args: unknown[]) => mockGetRiskAlerts(...args),
}));

function buildApp(prisma: unknown): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', prisma as any);
  return app;
}

describe('Analytics routes', () => {
  let app: FastifyInstance;
  let prisma: { marker: string };

  beforeEach(async () => {
    prisma = { marker: 'analytics-prisma' };
    app = buildApp(prisma);
    await app.register(analyticsRoutes, { prefix: '/analytics' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('passes app prisma to analytics handlers', async () => {
    mockGetDriftReport.mockResolvedValue({ node_id: 'node-1' });
    mockGetBranchingMetrics.mockResolvedValue({ total_branches: 0 });
    mockGetTimeline.mockResolvedValue([]);
    mockGetSignalForecast.mockResolvedValue({ signal: 'signal-a' });
    mockGetGdiForecast.mockResolvedValue({ asset_id: 'asset-1' });
    mockGetRiskAlerts.mockResolvedValue([]);

    const responses = await Promise.all([
      app.inject({ method: 'GET', url: '/analytics/drift/node-1' }),
      app.inject({ method: 'GET', url: '/analytics/branching' }),
      app.inject({
        method: 'GET',
        url: '/analytics/timeline/node-1?event_type=asset_published&limit=5&offset=2',
      }),
      app.inject({ method: 'GET', url: '/analytics/forecast/signal/signal-a' }),
      app.inject({ method: 'GET', url: '/analytics/forecast/gdi/asset-1' }),
      app.inject({ method: 'GET', url: '/analytics/alerts/node-1' }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([
      200,
      200,
      200,
      200,
      200,
      200,
    ]);
    expect(mockGetDriftReport).toHaveBeenCalledWith('node-1', prisma);
    expect(mockGetBranchingMetrics).toHaveBeenCalledWith(prisma);
    expect(mockGetTimeline).toHaveBeenCalledWith(
      'node-1',
      'asset_published',
      5,
      2,
      prisma,
    );
    expect(mockGetSignalForecast).toHaveBeenCalledWith('signal-a', prisma);
    expect(mockGetGdiForecast).toHaveBeenCalledWith('asset-1', prisma);
    expect(mockGetRiskAlerts).toHaveBeenCalledWith('node-1', prisma);
  });
});
