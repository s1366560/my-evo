import fastify, { type FastifyInstance } from 'fastify';
import { assetRoutes } from './routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'session',
  trust_level: 'trusted',
};

const mockPublishAsset = jest.fn();
const mockFetchAsset = jest.fn();
const mockRevokeAsset = jest.fn();
const mockSearchAssets = jest.fn();
const mockCalculateGDI = jest.fn();

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (
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
  publishAsset: (...args: unknown[]) => mockPublishAsset(...args),
  fetchAsset: (...args: unknown[]) => mockFetchAsset(...args),
  revokeAsset: (...args: unknown[]) => mockRevokeAsset(...args),
  searchAssets: (...args: unknown[]) => mockSearchAssets(...args),
  calculateGDI: (...args: unknown[]) => mockCalculateGDI(...args),
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Assets routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'session',
      trust_level: 'trusted',
    };
    app = buildApp();
    await app.register(assetRoutes, { prefix: '/assets' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('exposes top-level publish/fetch/revoke aliases', async () => {
    mockPublishAsset.mockResolvedValue({
      status: 'ok',
      asset_id: 'asset-1',
      asset_type: 'gene',
      gdi_score: 50,
      carbon_cost: 5,
      similarity_check: [],
    });
    mockFetchAsset.mockResolvedValue({
      asset_id: 'asset-1',
      asset_type: 'gene',
      name: 'Asset One',
      status: 'published',
      gdi_score: 50,
    });
    mockRevokeAsset.mockResolvedValue({
      asset_id: 'asset-1',
      status: 'revoked',
    });

    const [publishResponse, fetchResponse, revokeResponse] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/assets/publish',
        payload: {
          sender_id: 'node-1',
          asset_type: 'gene',
          name: 'Asset One',
          description: 'Test asset',
          content: 'hello',
        },
      }),
      app.inject({
        method: 'GET',
        url: '/assets/fetch/asset-1',
      }),
      app.inject({
        method: 'POST',
        url: '/assets/revoke',
        payload: { asset_id: 'asset-1' },
      }),
    ]);

    expect(publishResponse.statusCode).toBe(201);
    expect(fetchResponse.statusCode).toBe(200);
    expect(revokeResponse.statusCode).toBe(200);
    expect(JSON.parse(publishResponse.payload)).toEqual({
      success: true,
      status: 'ok',
      asset_id: 'asset-1',
      asset_type: 'gene',
      gdi_score: 50,
      carbon_cost: 5,
      similarity_check: [],
      data: {
        status: 'ok',
        asset_id: 'asset-1',
        asset_type: 'gene',
        gdi_score: 50,
        carbon_cost: 5,
        similarity_check: [],
      },
    });
    expect(JSON.parse(fetchResponse.payload)).toEqual({
      success: true,
      asset_id: 'asset-1',
      asset_type: 'gene',
      name: 'Asset One',
      status: 'published',
      gdi_score: 50,
      data: {
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Asset One',
        status: 'published',
        gdi_score: 50,
      },
    });
    expect(JSON.parse(revokeResponse.payload)).toEqual({
      success: true,
      asset_id: 'asset-1',
      status: 'revoked',
      data: {
        asset_id: 'asset-1',
        status: 'revoked',
      },
    });
  });

  it('exposes top-level search and gdi aliases', async () => {
    mockSearchAssets.mockResolvedValue([
      {
        asset_id: 'asset-1',
        name: 'Asset One',
      },
    ]);
    mockCalculateGDI.mockResolvedValue({
      asset_id: 'asset-1',
      overall: 52,
      intrinsic: 0.61,
      usage: 0.52,
      social: 0.47,
      freshness: 0.9,
    });

    const [searchResponse, gdiResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/assets/search?q=asset',
      }),
      app.inject({
        method: 'GET',
        url: '/assets/gdi/asset-1',
      }),
    ]);

    expect(searchResponse.statusCode).toBe(200);
    expect(gdiResponse.statusCode).toBe(200);
    expect(JSON.parse(searchResponse.payload)).toEqual({
      success: true,
      assets: [{ asset_id: 'asset-1', name: 'Asset One' }],
      total: 1,
      data: [{ asset_id: 'asset-1', name: 'Asset One' }],
    });
    expect(JSON.parse(gdiResponse.payload)).toEqual({
      success: true,
        asset_id: 'asset-1',
        overall: 52,
        intrinsic: 0.61,
        usage: 0.52,
        social: 0.47,
        freshness: 0.9,
        data: {
        asset_id: 'asset-1',
          overall: 52,
          intrinsic: 0.61,
          usage: 0.52,
          social: 0.47,
        freshness: 0.9,
      },
    });
  });
});
