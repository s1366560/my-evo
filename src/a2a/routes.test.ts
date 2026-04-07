/**
 * Route tests for src/a2a/routes.ts
 * Tests the protocol format -> PublishPayload adaptation in POST /a2a/publish
 */

import type { FastifyInstance } from 'fastify';
import fastify from 'fastify';
import { a2aRoutes } from './routes';
import { ValidationError } from '../shared/errors';

// ─── Mock auth middleware ───────────────────────────────────────────────────────

const mockNodeId = 'node-test-001';

// Store the original request auth setter to call from within the route
let capturedRequest: { auth?: { node_id: string } } | null = null;

const mockRequireAuth = () => async (request: { auth?: { node_id: string } }) => {
  request.auth = { node_id: mockNodeId };
  capturedRequest = request;
};

// ─── Mock publishAsset ────────────────────────────────────────────────────────

const mockPublishAsset = jest.fn();

jest.mock('../assets/service', () => ({
  ...jest.requireActual('../assets/service'),
  publishAsset: (...args: unknown[]) => mockPublishAsset(...args),
}));

jest.mock('../shared/auth', () => ({
  requireAuth: () => mockRequireAuth(),
}));

// ─── App factory ───────────────────────────────────────────────────────────────

function buildApp(): FastifyInstance {
  const app = fastify({ logger: false });
  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /a2a/publish', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
    // Register with the same prefix as app.ts production config
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
    capturedRequest = null;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when protocol field is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol_version: '1.0.0',
        message_type: 'publish',
        sender_id: mockNodeId,
        timestamp: '2025-01-15T08:31:40Z',
        payload: { assets: [{ type: 'Gene', asset_id: 'sha256:test' }] },
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('protocol');
  });

  it('should return 400 when message_type is not "publish"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'validate',
        sender_id: mockNodeId,
        timestamp: '2025-01-15T08:31:40Z',
        payload: { assets: [{ type: 'Gene', asset_id: 'sha256:test' }] },
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('message_type');
  });

  it('should return 400 when payload.assets is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        sender_id: mockNodeId,
        timestamp: '2025-01-15T08:31:40Z',
        payload: {},
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('payload.assets');
  });

  it('should return 400 when payload.assets is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: { payload: { assets: [] } },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should return 400 when Gene asset is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        sender_id: mockNodeId,
        timestamp: '2025-01-15T08:31:40Z',
        payload: { assets: [{ type: 'Capsule', asset_id: 'sha256:capsule123' }] },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('Gene');
  });

  it('should return 400 when Gene.asset_id does not start with sha256:', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        sender_id: mockNodeId,
        timestamp: '2025-01-15T08:31:40Z',
        payload: { assets: [{ type: 'Gene', asset_id: 'just-a-hash' }] },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('sha256');
  });

  it('should call publishAsset with correct PublishPayload mapping from Gene.summary', async () => {
    const mockResult = {
      status: 'ok' as const,
      asset_id: 'asset-created-001',
      asset_type: 'gene' as const,
      gdi_score: 60,
      carbon_cost: 5,
      similarity_check: [],
    };
    mockPublishAsset.mockResolvedValue(mockResult);

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        message_id: 'msg_123',
        sender_id: mockNodeId,
        timestamp: '2025-01-15T08:31:40Z',
        payload: {
          assets: [
            {
              type: 'Gene',
              schema_version: '1.5.0',
              category: 'repair',
              signals_match: ['TimeoutError', 'NetworkError'],
              summary: 'Retry with exponential backoff on timeout errors',
              asset_id: 'sha256:abc123def456',
            },
            {
              type: 'Capsule',
              asset_id: 'sha256:capsule456',
              gene: 'sha256:abc123def456',
            },
          ],
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.asset_id).toBe('asset-created-001');

    // Verify protocol format -> PublishPayload mapping
    expect(mockPublishAsset).toHaveBeenCalledTimes(1);
    const [nodeId, publishPayload] = mockPublishAsset.mock.calls[0]!;
    expect(nodeId).toBe(mockNodeId);
    expect(publishPayload.name).toBe('Retry with exponential backoff on timeout errors');
    expect(publishPayload.description).toBe('Retry with exponential backoff on timeout errors');
    expect(publishPayload.signals).toEqual(['repair', 'TimeoutError', 'NetworkError']);
    expect(publishPayload.gene_ids).toEqual(['sha256:abc123def456', 'sha256:capsule456']);
  });

  it('should use asset_id as fallback name when summary is missing', async () => {
    mockPublishAsset.mockResolvedValue({
      status: 'ok',
      asset_id: 'asset-001',
      asset_type: 'gene',
      gdi_score: 60,
      carbon_cost: 5,
      similarity_check: [],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        sender_id: mockNodeId,
        timestamp: '2025-01-15T08:31:40Z',
        payload: { assets: [{ type: 'Gene', asset_id: 'sha256:onlyid', category: 'test' }] },
      },
    });

    expect(res.statusCode).toBe(201);
    const [, publishPayload] = mockPublishAsset.mock.calls[0]!;
    expect(publishPayload.name).toBe('sha256:onlyid');
    expect(publishPayload.description).toBe('');
    expect(publishPayload.signals).toEqual(['test']);
  });

  it('should include validated_assets count in response', async () => {
    mockPublishAsset.mockResolvedValue({
      status: 'ok',
      asset_id: 'asset-001',
      asset_type: 'gene',
      gdi_score: 60,
      carbon_cost: 5,
      similarity_check: [],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        sender_id: mockNodeId,
        timestamp: '2025-01-15T08:31:40Z',
        payload: {
          assets: [
            { type: 'Gene', asset_id: 'sha256:gene1', summary: 'Gene 1' },
            { type: 'Capsule', asset_id: 'sha256:cap1' },
            { type: 'EvolutionEvent', asset_id: 'sha256:evt1' },
          ],
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.data.validated_assets).toBe(3);
  });

  it('should pass through publishAsset errors', async () => {
    mockPublishAsset.mockRejectedValue(new ValidationError('Insufficient credits'));

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        sender_id: mockNodeId,
        timestamp: '2025-01-15T08:31:40Z',
        payload: { assets: [{ type: 'Gene', asset_id: 'sha256:gene1', summary: 'Test Gene' }] },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toBe('Insufficient credits');
  });
});
