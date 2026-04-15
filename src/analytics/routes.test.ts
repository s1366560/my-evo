import fastify, { type FastifyInstance } from 'fastify';
import { analyticsRoutes } from './routes';

let mockAuth: {
  node_id: string;
  auth_type?: string;
  trust_level?: string;
} = {
  node_id: 'node-1',
  auth_type: 'node_secret',
  trust_level: 'trusted',
};

const mockGetDriftReport = jest.fn();
const mockGetBranchingMetrics = jest.fn();
const mockGetTimeline = jest.fn();
const mockGetSignalForecast = jest.fn();
const mockListSignalForecasts = jest.fn();
const mockGetGdiForecast = jest.fn();
const mockGetRiskAlerts = jest.fn();

jest.mock('../shared/auth', () => ({
  requireNodeSecretAuth: () => async (
    request: {
      auth?: {
        node_id: string;
        auth_type?: string;
        trust_level?: string;
      };
    },
  ) => {
    request.auth = mockAuth;
  },
}));

jest.mock('./service', () => ({
  getDriftReport: (...args: unknown[]) => mockGetDriftReport(...args),
  getBranchingMetrics: (...args: unknown[]) => mockGetBranchingMetrics(...args),
  getTimeline: (...args: unknown[]) => mockGetTimeline(...args),
  getSignalForecast: (...args: unknown[]) => mockGetSignalForecast(...args),
  listSignalForecasts: (...args: unknown[]) => mockListSignalForecasts(...args),
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
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'node_secret',
      trust_level: 'trusted',
    };
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
    mockListSignalForecasts.mockResolvedValue([
      {
        signal: 'signal-a',
        current_rank: 1,
        predicted_rank_7d: 1,
        predicted_rank_14d: 1,
        predicted_rank_30d: 1,
        confidence: 0.82,
        trend: 'rising',
      },
    ]);
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
      app.inject({ method: 'GET', url: '/analytics/forecast/signals?limit=1' }),
      app.inject({ method: 'GET', url: '/analytics/forecast/gdi/asset-1' }),
      app.inject({ method: 'GET', url: '/analytics/alerts/node-1' }),
      app.inject({ method: 'GET', url: '/analytics/alerts' }),
      app.inject({ method: 'GET', url: '/analytics/config' }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([
      200,
      200,
      200,
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
    expect(mockListSignalForecasts).toHaveBeenCalledWith(1, prisma);
    expect(mockGetGdiForecast).toHaveBeenCalledWith('asset-1', prisma);
    expect(mockGetRiskAlerts).toHaveBeenCalledWith('node-1', prisma);
    expect(JSON.parse(responses[4]!.payload)).toMatchObject({
      forecasts: [
        {
          signal: 'signal-a',
          current_rank: 1,
          predicted_rank_7d: 1,
          predicted_rank_30d: 1,
          confidence: 0.82,
          trend: 'rising',
        },
      ],
    });
    expect(JSON.parse(responses[7]!.payload)).toMatchObject({
      alerts: [],
    });
    expect(JSON.parse(responses[8]!.payload)).toMatchObject({
      drift_threshold: expect.any(Number),
      drift_window_days: expect.any(Number),
      forecast_horizon_days: expect.any(Number),
      branching_depth_limit: expect.any(Number),
    });
  });

  it('rejects session-authenticated access to node-scoped analytics endpoints', async () => {
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'session',
      trust_level: 'trusted',
    };

    const responses = await Promise.all([
      app.inject({ method: 'GET', url: '/analytics/drift/node-1' }),
      app.inject({ method: 'GET', url: '/analytics/timeline/node-1' }),
      app.inject({ method: 'GET', url: '/analytics/alerts' }),
      app.inject({ method: 'GET', url: '/analytics/alerts/node-1' }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([
      403,
      403,
      403,
      403,
    ]);
    expect(mockGetDriftReport).not.toHaveBeenCalled();
    expect(mockGetTimeline).not.toHaveBeenCalled();
    expect(mockGetRiskAlerts).not.toHaveBeenCalled();
  });

  it('rejects analytics node routes when the path nodeId does not match the authenticated node', async () => {
    const responses = await Promise.all([
      app.inject({ method: 'GET', url: '/analytics/drift/node-2' }),
      app.inject({ method: 'GET', url: '/analytics/timeline/node-2' }),
      app.inject({ method: 'GET', url: '/analytics/alerts/node-2' }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([
      400,
      400,
      400,
    ]);
    expect(mockGetDriftReport).not.toHaveBeenCalled();
    expect(mockGetTimeline).not.toHaveBeenCalled();
    expect(mockGetRiskAlerts).not.toHaveBeenCalled();
  });

  it('rejects malformed timeline pagination before hitting the service', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/analytics/timeline/node-1?limit=oops&offset=-1',
    });

    expect(response.statusCode).toBe(400);
    expect(mockGetTimeline).not.toHaveBeenCalled();
  });

  it('rejects malformed signal forecast pagination before hitting the service', async () => {
    const [malformedResponse, blankResponse, excessiveResponse, repeatedResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/analytics/forecast/signals?limit=oops',
      }),
      app.inject({
        method: 'GET',
        url: '/analytics/forecast/signals?limit=',
      }),
      app.inject({
        method: 'GET',
        url: '/analytics/forecast/signals?limit=21',
      }),
      app.inject({
        method: 'GET',
        url: '/analytics/forecast/signals?limit=1&limit=2',
      }),
    ]);

    expect(malformedResponse.statusCode).toBe(400);
    expect(blankResponse.statusCode).toBe(400);
    expect(excessiveResponse.statusCode).toBe(400);
    expect(repeatedResponse.statusCode).toBe(400);
    expect(mockListSignalForecasts).not.toHaveBeenCalled();
  });
});
