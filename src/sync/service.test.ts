import { PrismaClient } from '@prisma/client';
import * as service from './service';
import * as conflictResolution from './conflict-resolution';
import * as resume from './resume';
import type { ChangeVersion, ConflictRecord } from './types';

const {
  initialize,
  claimSyncTrigger,
  triggerPeriodicSync,
  getNodeSyncStatus,
  syncNodeAssets,
  scheduleNodeSync,
  cancelNodeSync,
  listScheduledSyncs,
  performIncrementalSync,
  checkSyncIntegrity,
  checkpointSync,
  loadSyncCheckpoint,
  resumeSync,
  clearSyncCheckpoint,
} = service;

const mockPrisma = {
  syncState: { findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn(), upsert: jest.fn() },
  asset: { findMany: jest.fn(), findUnique: jest.fn() },
  evolutionEvent: { groupBy: jest.fn() },
  syncLog: { create: jest.fn(), findMany: jest.fn() },
} as any;

jest.mock('./scheduler', () => ({
  initializeScheduler: jest.fn(),
  scheduleSync: jest.fn().mockResolvedValue({ job_id: 'job-1', node_id: 'node-1', interval_ms: 900000, next_run_at: new Date().toISOString(), is_active: true }),
  cancelScheduledSync: jest.fn().mockResolvedValue(true),
  getScheduledJobs: jest.fn().mockResolvedValue([]),
}));

jest.mock('./audit', () => ({
  logSyncOperation: jest.fn().mockResolvedValue({ id: 'log-1' }),
  getSyncHistory: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  analyzeSyncPatterns: jest.fn().mockResolvedValue({ average_interval_ms: 900000, typical_sync_time: '03:00', peak_sync_hour: 3, activity_level: 'medium', suggested_interval_ms: 900000 }),
  getSyncMetrics: jest.fn().mockResolvedValue({ node_id: 'node-1', total_syncs: 5, successful_syncs: 4, failed_syncs: 1, average_items_per_sync: 10, average_duration_ms: 500, last_sync_duration_ms: 450, last_successful_sync: new Date().toISOString(), sync_success_rate: 0.8 }),
}));

jest.mock('./incremental', () => ({
  calculateSyncDelta: jest.fn().mockResolvedValue({ node_id: 'node-1', changes: [], last_sync_time: new Date(0).toISOString(), current_time: new Date().toISOString(), total_changes: 0 }),
  applyIncrementalSync: jest.fn().mockResolvedValue({ applied: 0, skipped: 0, errors: [] }),
  verifySyncIntegrity: jest.fn().mockResolvedValue({ is_integral: true, missing_count: 0, issues: [] }),
}));

describe('Sync Service', () => {
  beforeAll(() => { service.setPrisma(mockPrisma as unknown as PrismaClient); });
  beforeEach(() => { jest.clearAllMocks(); });

  describe('initialize', () => {
    it('should initialize the scheduler', async () => {
      const { initializeScheduler } = require('./scheduler');
      await initialize();
      expect(initializeScheduler).toHaveBeenCalled();
    });
  });

  describe('claimSyncTrigger', () => {
    it('creates a sync lease for nodes without prior state', async () => {
      mockPrisma.syncState.findUnique.mockResolvedValue(null);
      mockPrisma.syncState.create.mockResolvedValue({});

      const claimed = await claimSyncTrigger('node-1');

      expect(claimed).toBe(true);
      expect(mockPrisma.syncState.create).toHaveBeenCalled();
    });

    it('rejects overlapping sync claims while a lease is active', async () => {
      mockPrisma.syncState.findUnique.mockResolvedValue({
        node_id: 'node-1',
        status: 'SYNCING',
        next_sync_at: new Date(Date.now() + 60_000),
      });
      mockPrisma.syncState.updateMany.mockResolvedValue({ count: 0 });

      const claimed = await claimSyncTrigger('node-1');

      expect(claimed).toBe(false);
    });

    it('treats a concurrent unique-key collision as an already-claimed lease', async () => {
      mockPrisma.syncState.findUnique.mockResolvedValue(null);
      mockPrisma.syncState.create.mockRejectedValue({ code: 'P2002' });
      mockPrisma.syncState.updateMany.mockResolvedValue({ count: 0 });

      const claimed = await claimSyncTrigger('node-1');

      expect(claimed).toBe(false);
    });

    it('rethrows unexpected sync lease creation errors', async () => {
      mockPrisma.syncState.findUnique.mockResolvedValue(null);
      mockPrisma.syncState.create.mockRejectedValue(new Error('db unavailable'));

      await expect(claimSyncTrigger('node-1')).rejects.toThrow('db unavailable');
    });
  });

  describe('triggerPeriodicSync', () => {
    it('should return SYNCED when no changes exist', async () => {
      const { calculateSyncDelta } = require('./incremental');
      const { logSyncOperation } = require('./audit');
      calculateSyncDelta.mockResolvedValueOnce({ node_id: 'node-1', changes: [], total_changes: 0 });
      const result = await triggerPeriodicSync('node-1');
      expect(result.status).toBe('SYNCED');
      expect(result.sync_id).toMatch(/^sync_/);
    });

    it('should return SYNC_ERROR when apply errors occur', async () => {
      const { calculateSyncDelta } = require('./incremental');
      const { applyIncrementalSync } = require('./incremental');
      calculateSyncDelta.mockResolvedValueOnce({ node_id: 'node-1', changes: [{ asset_id: 'a-1', change_type: 'update', version: 2, asset_type: 'gene', changed_at: new Date().toISOString(), content_hash: 'abc' }], total_changes: 1 });
      applyIncrementalSync.mockResolvedValueOnce({ applied: 0, skipped: 0, errors: ['Failed to apply a-1: DB error'] });
      const result = await triggerPeriodicSync('node-1');
      expect(result.status).toBe('SYNC_ERROR');
      expect(result.message).toContain('1 errors');
    });
  });

  describe('getNodeSyncStatus', () => {
    it('should return SYNCING for unknown node', async () => {
      mockPrisma.syncState.findUnique.mockResolvedValue(null);
      const result = await getNodeSyncStatus('unknown-node');
      expect(result.status).toBe('SYNCING');
      expect(result.sync_count).toBe(0);
    });

    it('should return stored sync state', async () => {
      mockPrisma.syncState.findUnique.mockResolvedValue({ node_id: 'node-1', status: 'SYNCED', last_sync_at: new Date('2026-01-01'), next_sync_at: new Date('2026-01-02'), sync_count: 5, error_count: 0 });
      const result = await getNodeSyncStatus('node-1');
      expect(result.status).toBe('SYNCED');
      expect(result.sync_count).toBe(5);
    });
  });

  describe('syncNodeAssets', () => {
    it('should return merged count and detect conflicts', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([{ asset_id: 'a-1', version: 2, updated_at: new Date() }]);
      const remoteAssets = [
        { asset_id: 'a-1', version: { version: 2, updated_at: new Date().toISOString(), node_id: 'node-2', content_hash: 'hash2' } },
        { asset_id: 'a-2', version: { version: 1, updated_at: new Date().toISOString(), node_id: 'node-2', content_hash: 'hash3' } },
      ];
      const result = await syncNodeAssets('node-1', remoteAssets);
      expect(result.merged).toBe(2);
      expect(typeof result.conflicts).toBe('number');
    });
  });

  describe('scheduleNodeSync', () => {
    it('should schedule a sync job', async () => {
      const { scheduleSync } = require('./scheduler');
      const result = await scheduleNodeSync('node-1', 600_000);
      expect(scheduleSync).toHaveBeenCalledWith('node-1', 600_000);
      expect(result.job_id).toBe('job-1');
    });
  });

  describe('cancelNodeSync', () => {
    it('should cancel a scheduled sync', async () => {
      const { cancelScheduledSync } = require('./scheduler');
      await cancelNodeSync('job-1');
      expect(cancelScheduledSync).toHaveBeenCalledWith('job-1');
    });
  });

  describe('listScheduledSyncs', () => {
    it('should return scheduled jobs', async () => {
      const { getScheduledJobs } = require('./scheduler');
      await listScheduledSyncs();
      expect(getScheduledJobs).toHaveBeenCalled();
    });
  });

  describe('performIncrementalSync', () => {
    it('should return applied and changes count', async () => {
      const { calculateSyncDelta } = require('./incremental');
      const { applyIncrementalSync } = require('./incremental');
      const { logSyncOperation } = require('./audit');
      calculateSyncDelta.mockResolvedValueOnce({ node_id: 'node-1', changes: [], total_changes: 0 });
      applyIncrementalSync.mockResolvedValueOnce({ applied: 0, skipped: 0, errors: [] });
      const result = await performIncrementalSync('node-1');
      expect(typeof result.changes).toBe('number');
      expect(typeof result.applied).toBe('number');
    });
  });

  describe('checkSyncIntegrity', () => {
    it('should return integrity check result', async () => {
      const { verifySyncIntegrity } = require('./incremental');
      verifySyncIntegrity.mockResolvedValueOnce({ is_integral: true, missing_count: 0, issues: [] });
      const result = await checkSyncIntegrity('node-1');
      expect(result.is_integral).toBe(true);
    });
  });

  describe('checkpointSync / loadSyncCheckpoint / clearSyncCheckpoint', () => {
    it('should save and load a checkpoint', async () => {
      const cp = await checkpointSync('sync-1', 5, 10, 'FETCH', 'asset-5');
      expect(cp.sync_id).toBe('sync-1');
      expect(cp.position).toBe(5);
      const loaded = await loadSyncCheckpoint('sync-1');
      expect(loaded?.position).toBe(5);
    });

    it('should return null for nonexistent checkpoint', async () => {
      const loaded = await loadSyncCheckpoint('nonexistent');
      expect(loaded).toBeNull();
    });

    it('should clear a checkpoint', async () => {
      await checkpointSync('sync-2', 1, 5, 'FETCH');
      await clearSyncCheckpoint('sync-2');
      const loaded = await loadSyncCheckpoint('sync-2');
      expect(loaded).toBeNull();
    });
  });

  // ===== Uncovered lines coverage =====

  describe('fetchSyncHistory', () => {
    it('should return sync history for a node', async () => {
      const { getSyncHistory } = require('./audit');
      getSyncHistory.mockResolvedValueOnce([
        { id: 'log-1', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 5, synced_at: '2026-01-01T00:00:00Z' },
      ]);

      const result = await service.fetchSyncHistory('node-1', 10);

      expect(getSyncHistory).toHaveBeenCalledWith('node-1', 10);
      expect(result).toHaveLength(1);
    });

    it('should use default limit when not provided', async () => {
      const { getSyncHistory } = require('./audit');
      getSyncHistory.mockResolvedValueOnce([]);

      await service.fetchSyncHistory('node-1');

      expect(getSyncHistory).toHaveBeenCalledWith('node-1', 50);
    });
  });

  describe('fetchSyncPatterns', () => {
    it('should return sync patterns for a node', async () => {
      const { analyzeSyncPatterns } = require('./audit');
      analyzeSyncPatterns.mockResolvedValueOnce({
        average_interval_ms: 600000,
        typical_sync_time: '12:00',
        peak_sync_hour: 12,
        activity_level: 'medium',
        suggested_interval_ms: 480000,
      });

      const result = await service.fetchSyncPatterns('node-1');

      expect(analyzeSyncPatterns).toHaveBeenCalledWith('node-1');
      expect(result.activity_level).toBe('medium');
    });
  });

  describe('fetchSyncMetrics', () => {
    it('should return sync metrics for a node', async () => {
      const { getSyncMetrics } = require('./audit');
      getSyncMetrics.mockResolvedValueOnce({
        node_id: 'node-1',
        total_syncs: 10,
        successful_syncs: 8,
        failed_syncs: 2,
        average_items_per_sync: 5,
        average_duration_ms: 300,
        last_sync_duration_ms: 250,
        last_successful_sync: '2026-01-01T00:00:00Z',
        sync_success_rate: 80,
      });

      const result = await service.fetchSyncMetrics('node-1');

      expect(getSyncMetrics).toHaveBeenCalledWith('node-1');
      expect(result.total_syncs).toBe(10);
      expect(result.sync_success_rate).toBe(80);
    });
  });

  describe('performIncrementalSync', () => {
    it('should return SYNC_ERROR status when applyIncrementalSync returns errors', async () => {
      const { calculateSyncDelta } = require('./incremental');
      const { applyIncrementalSync } = require('./incremental');
      const { logSyncOperation } = require('./audit');
      calculateSyncDelta.mockResolvedValueOnce({ node_id: 'node-1', changes: [], total_changes: 0 });
      applyIncrementalSync.mockResolvedValueOnce({ applied: 0, skipped: 0, errors: ['Apply failed: constraint violation'] });
      logSyncOperation.mockResolvedValue({ id: 'log-err' });

      const result = await service.performIncrementalSync('node-1');

      expect(result.changes).toBe(0);
      expect(logSyncOperation).toHaveBeenCalledWith(
        'node-1',
        expect.objectContaining({ status: 'SYNC_ERROR', error: 'Apply failed: constraint violation' })
      );
    });
  });

  describe('resumeSync', () => {
    it('should return resume result for an interrupted sync', async () => {
      const result = await service.resumeSync('resumable-sync');
      expect(typeof result.can_resume).toBe('boolean');
    });
  });
});

describe('Conflict Resolution', () => {
  describe('detectConflicts', () => {
    it('should detect conflicts when hashes differ but versions match', () => {
      const local: Record<string, ChangeVersion> = { 'a-1': { version: 2, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a' } };
      const remote: Record<string, ChangeVersion> = { 'a-1': { version: 2, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b' } };
      const result = conflictResolution.detectConflicts(local, remote);
      expect(result.has_conflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
    });

    it('should not flag conflicts when versions differ', () => {
      const local: Record<string, ChangeVersion> = { 'a-1': { version: 2, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a' } };
      const remote: Record<string, ChangeVersion> = { 'a-1': { version: 3, updated_at: '2026-01-02T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b' } };
      const result = conflictResolution.detectConflicts(local, remote);
      expect(result.has_conflicts).toBe(false);
    });
  });

  describe('resolveByLastWriteWins', () => {
    it('should prefer newer local version', () => {
      const local: ChangeVersion = { version: 1, updated_at: '2026-01-02T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a' };
      const remote: ChangeVersion = { version: 1, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b' };
      expect(conflictResolution.resolveByLastWriteWins(local, remote)).toBe(local);
    });
  });

  describe('resolveByNodePriority', () => {
    it('should prefer higher priority node', () => {
      const local: ChangeVersion = { version: 1, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a' };
      const remote: ChangeVersion = { version: 1, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b' };
      expect(conflictResolution.resolveByNodePriority(local, remote, 70, 30)).toBe(local);
      expect(conflictResolution.resolveByNodePriority(local, remote, 30, 70)).toBe(remote);
    });
  });

  describe('applyConflictResolution', () => {
    it('should resolve conflicts using last_write_wins', () => {
      const conflicts: ConflictRecord[] = [{
        asset_id: 'a-1',
        local_version: { version: 2, updated_at: '2026-01-02T00:00:00Z', node_id: 'node-1', content_hash: 'hash-a' },
        remote_version: { version: 2, updated_at: '2026-01-01T00:00:00Z', node_id: 'node-2', content_hash: 'hash-b' },
        detected_at: new Date().toISOString(),
        strategy: 'last_write_wins',
      }];
      const result = conflictResolution.applyConflictResolution(conflicts, 'last_write_wins');
      expect(result['a-1']!.content_hash).toBe('hash-a');
    });
  });
});

describe('Resume / Checkpoint', () => {
  beforeEach(() => { resume.clearCheckpoint('test-sync'); });

  describe('saveCheckpoint / loadCheckpoint', () => {
    it('should save and retrieve a checkpoint', () => {
      const saved = resume.saveCheckpoint('test-sync', 3, 10, 'FETCH', 'asset-3');
      expect(saved.sync_id).toBe('test-sync');
      expect(saved.position).toBe(3);
      const loaded = resume.loadCheckpoint('test-sync');
      expect(loaded?.position).toBe(3);
    });
  });

  describe('resumeInterruptedSync', () => {
    it('should return checkpoint data for resumption', async () => {
      resume.saveCheckpoint('resumable-sync', 5, 20, 'PUBLISH', 'asset-5');
      const result = await resume.resumeInterruptedSync('resumable-sync');
      expect(result.can_resume).toBe(true);
      expect(result.checkpoint!.position).toBe(5);
    });

    it('should return cannot resume when checkpoint not found', async () => {
      const result = await resume.resumeInterruptedSync('nonexistent');
      expect(result.can_resume).toBe(false);
    });
  });

  describe('clearCheckpoint', () => {
    it('should remove a checkpoint', () => {
      resume.saveCheckpoint('to-clear', 1, 5, 'FETCH');
      resume.clearCheckpoint('to-clear');
      expect(resume.loadCheckpoint('to-clear')).toBeNull();
    });
  });
});
