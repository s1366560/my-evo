import fastify, { type FastifyInstance } from 'fastify';
import { sandboxRoutes } from './routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'node_secret',
  trust_level: 'trusted',
  userId: undefined as string | undefined,
};

const mockListSandboxes = jest.fn();
const mockCreateSandbox = jest.fn();
const mockGetSandboxStats = jest.fn();
const mockGetSandbox = jest.fn();
const mockRunExperiment = jest.fn();
const mockAttachExistingAssetToSandbox = jest.fn();
const mockModifySandboxAsset = jest.fn();
const mockCompleteSandbox = jest.fn();
const mockCompareSandbox = jest.fn();

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (
    request: {
      auth?: {
        node_id: string;
        auth_type?: string;
        trust_level?: string;
        userId?: string;
      };
    },
  ) => {
    request.auth = mockAuth;
  },
  requireTrustLevel: () => async (
    request: {
      auth?: {
        node_id: string;
        auth_type?: string;
        trust_level?: string;
        userId?: string;
      };
    },
  ) => {
    request.auth = mockAuth;
  },
}));

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  listSandboxes: (...args: unknown[]) => mockListSandboxes(...args),
  createSandbox: (...args: unknown[]) => mockCreateSandbox(...args),
  getSandboxStats: (...args: unknown[]) => mockGetSandboxStats(...args),
  getSandbox: (...args: unknown[]) => mockGetSandbox(...args),
  runExperiment: (...args: unknown[]) => mockRunExperiment(...args),
  attachExistingAssetToSandbox: (...args: unknown[]) => mockAttachExistingAssetToSandbox(...args),
  modifySandboxAsset: (...args: unknown[]) => mockModifySandboxAsset(...args),
  completeSandbox: (...args: unknown[]) => mockCompleteSandbox(...args),
  compareSandbox: (...args: unknown[]) => mockCompareSandbox(...args),
}));

function buildApp(): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', {
    node: {
      findFirst: jest.fn().mockResolvedValue({ node_id: 'node-1' }),
      findMany: jest.fn().mockResolvedValue([{ node_id: 'node-1' }]),
    },
  } as any);
  return app;
}

describe('Sandbox routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'node_secret',
      trust_level: 'trusted',
      userId: undefined,
    };
    app = buildApp();
    await app.register(sandboxRoutes, { prefix: '/sandbox' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('supports create, list, and stats compatibility routes', async () => {
    mockCreateSandbox.mockResolvedValue({
      sandbox_id: 'sbx-1',
      state: 'active',
      isolation_level: 'soft',
    });
    mockListSandboxes.mockResolvedValue({
      items: [
        {
          sandbox_id: 'sbx-1',
          name: 'Experiment A',
          state: 'active',
          isolation_level: 'soft',
        },
      ],
      total: 1,
    });
    mockGetSandboxStats.mockResolvedValue({
      total_sandboxes: 1,
      active: 1,
      completed: 0,
      total_experiments: 2,
      promotion_rate: 0.5,
    });

    const [createResponse, listResponse, statsResponse] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/sandbox/create',
        payload: {
          name: 'Experiment A',
          isolation_mode: 'soft-tagged',
          base_gene_id: 'gene-1',
        },
      }),
      app.inject({
        method: 'GET',
        url: '/sandbox/list?status=active',
      }),
      app.inject({
        method: 'GET',
        url: '/sandbox/stats',
      }),
    ]);

    expect(createResponse.statusCode).toBe(200);
    expect(listResponse.statusCode).toBe(200);
    expect(statsResponse.statusCode).toBe(200);
    expect(mockCreateSandbox).toHaveBeenCalledWith(
      'node-1',
      'Experiment A',
      'Sandbox experiment for gene-1',
      'soft',
      undefined,
      undefined,
      expect.objectContaining({
        base_gene_id: 'gene-1',
      }),
    );
    expect(mockListSandboxes).toHaveBeenCalledWith('active', undefined, 20, 0, 'node-1');
    expect(mockGetSandboxStats).toHaveBeenCalledTimes(1);
  });

  it('resolves owned nodes for session-authenticated sandbox listings', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    };
    (app.prisma as any).node.findFirst.mockResolvedValue({ node_id: 'node-2' });
    mockListSandboxes.mockResolvedValue({ items: [], total: 0 });

    const response = await app.inject({
      method: 'GET',
      url: '/sandbox/list',
    });

    expect(response.statusCode).toBe(200);
    expect(mockListSandboxes).toHaveBeenCalledWith(undefined, undefined, 20, 0, 'node-2');
  });

  it('keeps sandbox stats publicly readable per the architecture contract', async () => {
    mockAuth = {
      node_id: 'node-9',
      auth_type: 'node_secret',
      trust_level: 'basic',
      userId: undefined,
    };
    mockGetSandboxStats.mockResolvedValue({
      total_sandboxes: 2,
      active: 1,
      completed: 1,
      total_experiments: 4,
      promotion_rate: 0.5,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/sandbox/stats',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      data: {
        total_sandboxes: 2,
        active: 1,
        completed: 1,
        total_experiments: 4,
        promotion_rate: 0.5,
      },
    });
  });

  it('supports experiment, asset, modify, complete, and compare compatibility routes', async () => {
    mockRunExperiment.mockResolvedValue({ experiment_id: 'exp-1', status: 'running', estimated_time_minutes: 5 });
    mockAttachExistingAssetToSandbox.mockResolvedValue({ status: 'ok', sandbox_asset_count: 3 });
    mockModifySandboxAsset.mockResolvedValue({ status: 'ok', modified: 'gene-1' });
    mockCompleteSandbox.mockResolvedValue({ status: 'completed', promoted_to_mainnet: ['gene-1'], sandbox_archived: true });
    mockCompareSandbox.mockResolvedValue({ sandbox_id: 'sbx-1', total_assets: 3 });

    const [experimentResponse, assetResponse, modifyResponse, completeResponse, compareResponse] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/sandbox/sbx-1/experiment',
        payload: {
          experiment_type: 'mutation',
          target_gene: 'gene-1',
        },
      }),
      app.inject({
        method: 'POST',
        url: '/sandbox/sbx-1/asset',
        payload: {
          asset_id: 'gene-1',
        },
      }),
      app.inject({
        method: 'POST',
        url: '/sandbox/sbx-1/modify',
        payload: {
          asset_id: 'gene-1',
          modifications: { code: 'new content' },
        },
      }),
      app.inject({
        method: 'POST',
        url: '/sandbox/sbx-1/complete',
        payload: {
          promote_assets: ['gene-1'],
          summary: 'Looks good',
        },
      }),
      app.inject({
        method: 'GET',
        url: '/sandbox/sbx-1/compare',
      }),
    ]);

    expect(experimentResponse.statusCode).toBe(200);
    expect(assetResponse.statusCode).toBe(200);
    expect(modifyResponse.statusCode).toBe(200);
    expect(completeResponse.statusCode).toBe(200);
    expect(compareResponse.statusCode).toBe(200);
    expect(mockRunExperiment).toHaveBeenCalledWith('sbx-1', 'node-1', {
      experiment_type: 'mutation',
      target_gene: 'gene-1',
      mutation_strategy: undefined,
      parameters: undefined,
    });
    expect(mockAttachExistingAssetToSandbox).toHaveBeenCalledWith('sbx-1', 'node-1', 'gene-1');
    expect(mockModifySandboxAsset).toHaveBeenCalledWith('sbx-1', 'node-1', 'gene-1', { code: 'new content' });
    expect(mockCompleteSandbox).toHaveBeenCalledWith('sbx-1', 'node-1', {
      promote_assets: ['gene-1'],
      summary: 'Looks good',
    });
    expect(mockCompareSandbox).toHaveBeenCalledWith('sbx-1', 'node-1');
  });

  it('protects sandbox detail reads and scopes them to the authenticated node', async () => {
    mockGetSandbox.mockResolvedValue({
      sandbox_id: 'sbx-1',
      name: 'Experiment A',
      description: 'Sandbox details',
      state: 'active',
      isolation_level: 'soft',
      members: [],
      assets: [{ asset_id: 'gene-1' }, { asset_id: 'gene-2' }],
      metadata: {
        experiments: [{ id: 'exp-1', status: 'completed', result: 'improved +12% accuracy' }],
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/sandbox/sbx-1',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetSandbox).toHaveBeenCalledWith('sbx-1', 'node-1');
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      data: expect.objectContaining({
        sandbox_id: 'sbx-1',
        name: 'Experiment A',
        description: 'Sandbox details',
        status: 'active',
        isolation_mode: 'soft-tagged',
        assets: ['gene-1', 'gene-2'],
        experiments: [{ id: 'exp-1', status: 'completed', result: 'improved +12% accuracy' }],
      }),
    });
  });
});
