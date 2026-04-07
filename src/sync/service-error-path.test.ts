/**
 * Separate test file for service.ts catch block coverage.
 * Uses jest.resetModules() which would interfere with other tests in service.test.ts.
 */
jest.mock('./incremental', () => ({
  calculateSyncDelta: jest.fn(),
  applyIncrementalSync: jest.fn().mockResolvedValue({ applied: 0, skipped: 0, errors: [] }),
  verifySyncIntegrity: jest.fn().mockResolvedValue({ is_integral: true, missing_count: 0, issues: [] }),
}));

jest.mock('./audit', () => ({
  logSyncOperation: jest.fn().mockResolvedValue({ id: 'log-err' }),
  getSyncHistory: jest.fn().mockResolvedValue([]),
  analyzeSyncPatterns: jest.fn().mockResolvedValue({ average_interval_ms: 300000, typical_sync_time: '00:00', peak_sync_hour: 0, activity_level: 'low', suggested_interval_ms: 600000 }),
  getSyncMetrics: jest.fn().mockResolvedValue({ node_id: 'node-1', total_syncs: 5, successful_syncs: 4, failed_syncs: 1, average_items_per_sync: 10, average_duration_ms: 500, last_sync_duration_ms: 450, last_successful_sync: new Date().toISOString(), sync_success_rate: 0.8 }),
}));

describe('Sync Service - error path coverage', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('./incremental', () => ({
      calculateSyncDelta: jest.fn(),
      applyIncrementalSync: jest.fn().mockResolvedValue({ applied: 0, skipped: 0, errors: [] }),
      verifySyncIntegrity: jest.fn().mockResolvedValue({ is_integral: true, missing_count: 0, issues: [] }),
    }));
    jest.doMock('./audit', () => ({
      logSyncOperation: jest.fn().mockResolvedValue({ id: 'log-err' }),
      getSyncHistory: jest.fn().mockResolvedValue([]),
      analyzeSyncPatterns: jest.fn().mockResolvedValue({ average_interval_ms: 300000, typical_sync_time: '00:00', peak_sync_hour: 0, activity_level: 'low', suggested_interval_ms: 600000 }),
      getSyncMetrics: jest.fn().mockResolvedValue({ node_id: 'node-1', total_syncs: 5, successful_syncs: 4, failed_syncs: 1, average_items_per_sync: 10, average_duration_ms: 500, last_sync_duration_ms: 450, last_successful_sync: new Date().toISOString(), sync_success_rate: 0.8 }),
    }));
  });

  it('should return SYNC_ERROR when calculateSyncDelta throws an Error instance', async () => {
    jest.doMock('./incremental', () => ({
      calculateSyncDelta: jest.fn().mockRejectedValue(new Error('DB unavailable')),
      applyIncrementalSync: jest.fn().mockResolvedValue({ applied: 0, skipped: 0, errors: [] }),
      verifySyncIntegrity: jest.fn().mockResolvedValue({ is_integral: true, missing_count: 0, issues: [] }),
    }));

    const { triggerPeriodicSync } = await import('./service');
    const result = await triggerPeriodicSync('node-1');

    expect(result.status).toBe('SYNC_ERROR');
    expect(result.message).toContain('DB unavailable');
  });

  it('should use String(err) when thrown value is not an Error instance', async () => {
    jest.doMock('./incremental', () => ({
      calculateSyncDelta: jest.fn().mockRejectedValue('string error' as unknown as Error),
      applyIncrementalSync: jest.fn().mockResolvedValue({ applied: 0, skipped: 0, errors: [] }),
      verifySyncIntegrity: jest.fn().mockResolvedValue({ is_integral: true, missing_count: 0, issues: [] }),
    }));

    const { triggerPeriodicSync } = await import('./service');
    const result = await triggerPeriodicSync('node-1');

    expect(result.status).toBe('SYNC_ERROR');
    expect(result.message).toContain('string error');
  });
});
