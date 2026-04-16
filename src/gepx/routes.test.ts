import fastify, { type FastifyInstance } from 'fastify';
import { gepxRoutes } from './routes';

const mockExportBundleArchive = jest.fn();
const mockValidateGepxPayload = jest.fn();
const mockValidateGepxBinary = jest.fn();
const mockDownloadBundle = jest.fn();

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (request: { auth?: { node_id: string } }) => {
    request.auth = { node_id: 'node-1' };
  },
}));

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  exportBundleArchive: (...args: unknown[]) => mockExportBundleArchive(...args),
  validateGepxPayload: (...args: unknown[]) => mockValidateGepxPayload(...args),
  validateGepxBinary: (...args: unknown[]) => mockValidateGepxBinary(...args),
  downloadBundle: (...args: unknown[]) => mockDownloadBundle(...args),
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Gepx routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
    await app.register(gepxRoutes, { prefix: '/api/v2/gepx' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('exports a bundle through the canonical route', async () => {
    mockExportBundleArchive.mockResolvedValue({
      bundle_id: 'bundle-1',
      filename: 'pack.gepx',
      size_bytes: 42,
      asset_count: 1,
      compressed: true,
      checksum: 'sha256:abc',
      download_url: '/gepx/bundle/bundle-1',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/gepx/export',
      payload: {
        bundle_name: 'pack',
        description: 'desc',
        asset_ids: ['asset-1'],
        compress: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockExportBundleArchive).toHaveBeenCalledWith('node-1', {
      bundle_name: 'pack',
      description: 'desc',
      asset_ids: ['asset-1'],
      tags: undefined,
      compress: true,
      bundle_type: undefined,
    });
  });

  it('validates base64 gepx payloads via binary decoder', async () => {
    mockValidateGepxBinary.mockReturnValue({ valid: true, compressed: true });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/gepx/validate',
      payload: {
        base64: Buffer.from('GEPX').toString('base64'),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockValidateGepxBinary).toHaveBeenCalled();
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      data: { valid: true, compressed: true },
    });
  });

  it('validates raw binary gepx payloads from the canonical transport', async () => {
    mockValidateGepxBinary.mockReturnValue({ valid: true, compressed: false });
    const binary = Buffer.from('GEPXraw-binary');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/gepx/validate',
      payload: binary,
      headers: {
        'content-type': 'application/octet-stream',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockValidateGepxBinary).toHaveBeenCalledWith(binary);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      data: { valid: true, compressed: false },
    });
  });

  it('downloads bundles from the documented alias route', async () => {
    mockDownloadBundle.mockResolvedValue({
      bundle: { bundle_id: 'bundle-1' },
      assets: [{ asset_id: 'asset-1' }],
      exportRecord: { export_id: 'exp-1' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/gepx/bundle/bundle-1',
    });

    expect(response.statusCode).toBe(200);
    expect(mockDownloadBundle).toHaveBeenCalledWith('bundle-1', 'node-1');
    expect(JSON.parse(response.payload)).toMatchObject({
      success: true,
      data: {
        bundle: { bundle_id: 'bundle-1' },
        export: { export_id: 'exp-1' },
      },
    });
  });
});
