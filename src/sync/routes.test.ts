import fastify, { type FastifyInstance } from 'fastify';
import { syncRoutes } from './routes';

let mockAuthNodeId = 'node-1';
const mockClaimSyncTrigger = jest.fn();
const mockTriggerPeriodicSync = jest.fn();
const mockGetNodeSyncStatus = jest.fn();
const mockFetchSyncHistory = jest.fn();
const mockCheckSyncIntegrity = jest.fn();

jest.mock('./service', () => ({
  claimSyncTrigger: (...args: unknown[]) => mockClaimSyncTrigger(...args),
  triggerPeriodicSync: (...args: unknown[]) => mockTriggerPeriodicSync(...args),
  getNodeSyncStatus: (...args: unknown[]) => mockGetNodeSyncStatus(...args),
  fetchSyncHistory: (...args: unknown[]) => mockFetchSyncHistory(...args),
  checkSyncIntegrity: (...args: unknown[]) => mockCheckSyncIntegrity(...args),
}));

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (request: { auth?: { node_id: string } }) => {
    request.auth = { node_id: mockAuthNodeId };
  },
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Sync routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockAuthNodeId = 'node-1';
    mockClaimSyncTrigger.mockResolvedValue(true);
    app = buildApp();
    await app.register(syncRoutes, { prefix: '/a2a/sync' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('triggers sync for the authenticated node', async () => {
    mockTriggerPeriodicSync.mockResolvedValue({
      sync_id: 'sync-1',
      status: 'SYNCED',
      message: 'done',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/a2a/sync/trigger',
    });

    expect(response.statusCode).toBe(202);
    expect(mockClaimSyncTrigger).toHaveBeenCalledWith('node-1');
    expect(mockTriggerPeriodicSync).toHaveBeenCalledWith('node-1');
  });

  it('rejects overlapping sync triggers for the same node', async () => {
    mockClaimSyncTrigger.mockResolvedValue(false);

    const response = await app.inject({
      method: 'POST',
      url: '/a2a/sync/trigger',
    });

    expect(response.statusCode).toBe(409);
    expect(mockTriggerPeriodicSync).not.toHaveBeenCalled();
  });

  it('sanitizes trigger error messages before returning them', async () => {
    mockTriggerPeriodicSync.mockResolvedValue({
      sync_id: 'sync-err',
      status: 'SYNC_ERROR',
      message: 'Sync failed: database timeout',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/a2a/sync/trigger',
    });

    expect(response.statusCode).toBe(202);
    expect(JSON.parse(response.payload).data.message).toBe('Sync failed');
  });

  it('returns sync status for the authenticated node', async () => {
    mockGetNodeSyncStatus.mockResolvedValue({
      node_id: 'node-1',
      status: 'SYNCED',
      last_sync_at: '2026-01-01T00:00:00.000Z',
      next_sync_at: '2026-01-01T01:00:00.000Z',
      sync_count: 3,
      error_count: 0,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/a2a/sync/status',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetNodeSyncStatus).toHaveBeenCalledWith('node-1');
  });

  it('passes limit through to sync history lookups', async () => {
    mockFetchSyncHistory.mockResolvedValue([{ id: 'log-1' }]);

    const response = await app.inject({
      method: 'GET',
      url: '/a2a/sync/history?limit=10',
    });

    expect(response.statusCode).toBe(200);
    expect(mockFetchSyncHistory).toHaveBeenCalledWith('node-1', 10);
  });

  it('caps sync history limit to the safe maximum', async () => {
    mockFetchSyncHistory.mockResolvedValue([]);

    const response = await app.inject({
      method: 'GET',
      url: '/a2a/sync/history?limit=999',
    });

    expect(response.statusCode).toBe(200);
    expect(mockFetchSyncHistory).toHaveBeenCalledWith('node-1', 100);
  });

  it('rejects invalid history limits', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/a2a/sync/history?limit=0',
    });

    expect(response.statusCode).toBe(400);
    expect(mockFetchSyncHistory).not.toHaveBeenCalled();
  });

  it('checks sync integrity for the authenticated node', async () => {
    mockCheckSyncIntegrity.mockResolvedValue({
      is_integral: true,
      missing_count: 0,
      issues: [],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/a2a/sync/check',
    });

    expect(response.statusCode).toBe(200);
    expect(mockCheckSyncIntegrity).toHaveBeenCalledWith('node-1');
  });

  it('rejects non-node identities on sync routes', async () => {
    mockAuthNodeId = 'user-1';

    const response = await app.inject({
      method: 'GET',
      url: '/a2a/sync/status',
    });

    expect(response.statusCode).toBe(403);
    expect(mockGetNodeSyncStatus).not.toHaveBeenCalled();
  });
});
