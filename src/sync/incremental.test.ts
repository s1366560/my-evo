import { PrismaClient } from '@prisma/client';
import * as incremental from './incremental';

const mockAssetFindMany = jest.fn();
const mockAssetFindUnique = jest.fn();
const mockEvolutionEventGroupBy = jest.fn();
const mockSyncStateFindUnique = jest.fn();
const mockSyncLogFindMany = jest.fn();

const mockPrisma = {
  asset: {
    findMany: mockAssetFindMany,
    findUnique: mockAssetFindUnique,
  },
  evolutionEvent: {
    groupBy: mockEvolutionEventGroupBy,
  },
  syncState: {
    findUnique: mockSyncStateFindUnique,
  },
  syncLog: {
    findMany: mockSyncLogFindMany,
  },
} as unknown as PrismaClient;

beforeAll(() => {
  incremental.setPrisma(mockPrisma);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Incremental Sync', () => {
  // ===== getIncrementalChanges =====

  describe('getIncrementalChanges', () => {
    it('should mark assets as delete when they appear in revoked events', async () => {
      mockAssetFindMany.mockResolvedValue([
        { asset_id: 'a-1', asset_type: 'gene', version: 2, updated_at: new Date('2026-01-01T00:00:00Z'), name: 'Gene A', description: 'desc', content: null },
      ]);
      mockEvolutionEventGroupBy.mockResolvedValue([
        { asset_id: 'a-1' },
      ]);

      const result = await incremental.getIncrementalChanges('node-1', new Date('2025-01-01'));

      expect(result).toHaveLength(1);
      expect(result[0]!.change_type).toBe('delete');
      expect(result[0]!.asset_id).toBe('a-1');
    });

    it('should mark assets as update when not in deleted set', async () => {
      mockAssetFindMany.mockResolvedValue([
        { asset_id: 'a-2', asset_type: 'gene', version: 3, updated_at: new Date('2026-01-01T00:00:00Z'), name: 'Gene B', description: 'desc', content: null },
      ]);
      mockEvolutionEventGroupBy.mockResolvedValue([]);

      const result = await incremental.getIncrementalChanges('node-1', new Date('2025-01-01'));

      expect(result).toHaveLength(1);
      expect(result[0]!.change_type).toBe('update');
      expect(result[0]!.asset_id).toBe('a-2');
    });

    it('should add delete entries for revoked assets not in the updated assets list', async () => {
      mockAssetFindMany.mockResolvedValue([
        { asset_id: 'a-1', asset_type: 'gene', version: 1, updated_at: new Date('2026-01-01T00:00:00Z'), name: 'Gene A', description: 'desc', content: null },
      ]);
      // 'a-deleted' was revoked but has no updated record
      mockEvolutionEventGroupBy.mockResolvedValue([
        { asset_id: 'a-deleted' },
      ]);

      const result = await incremental.getIncrementalChanges('node-1', new Date('2025-01-01'));

      // a-1 is in both update and revoked -> delete (from updated)
      // a-deleted is only in revoked -> added as delete entry
      const assetIds = result.map(c => c.asset_id);
      expect(assetIds).toContain('a-1');
      expect(assetIds).toContain('a-deleted');

      const deletedChange = result.find(c => c.asset_id === 'a-deleted');
      expect(deletedChange?.change_type).toBe('delete');
      expect(deletedChange?.asset_type).toBe('unknown');
    });

    it('should return empty array when no changes', async () => {
      mockAssetFindMany.mockResolvedValue([]);
      mockEvolutionEventGroupBy.mockResolvedValue([]);

      const result = await incremental.getIncrementalChanges('node-1', new Date('2026-01-01'));

      expect(result).toHaveLength(0);
    });

    it('should compute content_hash using hashContent', async () => {
      mockAssetFindMany.mockResolvedValue([
        { asset_id: 'a-1', asset_type: 'gene', version: 1, updated_at: new Date('2026-01-01T00:00:00Z'), name: 'TestGene', description: 'TestDesc', content: null },
      ]);
      mockEvolutionEventGroupBy.mockResolvedValue([]);

      const result = await incremental.getIncrementalChanges('node-1', new Date('2025-01-01'));

      expect(result[0]!.content_hash).toBeTruthy();
      expect(typeof result[0]!.content_hash).toBe('string');
    });
  });

  // ===== calculateSyncDelta =====

  describe('calculateSyncDelta', () => {
    it('should return zero changes when no sync state exists', async () => {
      mockSyncStateFindUnique.mockResolvedValue(null);
      mockAssetFindMany.mockResolvedValue([]);
      mockEvolutionEventGroupBy.mockResolvedValue([]);

      const result = await incremental.calculateSyncDelta('new-node');

      expect(result.total_changes).toBe(0);
      expect(result.changes).toHaveLength(0);
      expect(result.node_id).toBe('new-node');
    });

    it('should use last_sync_at from existing sync state', async () => {
      const lastSync = new Date('2026-01-01T00:00:00Z');
      mockSyncStateFindUnique.mockResolvedValue({ node_id: 'node-1', last_sync_at: lastSync });
      mockAssetFindMany.mockResolvedValue([]);
      mockEvolutionEventGroupBy.mockResolvedValue([]);

      const result = await incremental.calculateSyncDelta('node-1');

      expect(result.last_sync_time).toBe(lastSync.toISOString());
      expect(mockAssetFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { updated_at: { gte: lastSync } },
        })
      );
    });
  });

  // ===== applyIncrementalSync =====

  describe('applyIncrementalSync', () => {
    it('should skip changes with change_type === delete', async () => {
      mockAssetFindUnique.mockResolvedValue(null);

      const changes = [
        { asset_id: 'a-deleted', asset_type: 'gene', change_type: 'delete' as const, version: 0, changed_at: '2026-01-01T00:00:00Z', content_hash: '' },
      ];

      const result = await incremental.applyIncrementalSync('node-1', changes);

      expect(result.skipped).toBe(1);
      expect(result.applied).toBe(0);
      expect(result.errors).toHaveLength(0);
      // findUnique should NOT be called for delete type
      expect(mockAssetFindUnique).not.toHaveBeenCalled();
    });

    it('should skip when existing version >= incoming version', async () => {
      mockAssetFindUnique.mockResolvedValue({ asset_id: 'a-1', version: 5 });

      const changes = [
        { asset_id: 'a-1', asset_type: 'gene', change_type: 'update' as const, version: 3, changed_at: '2026-01-01T00:00:00Z', content_hash: 'abc' },
      ];

      const result = await incremental.applyIncrementalSync('node-1', changes);

      expect(result.skipped).toBe(1);
      expect(result.applied).toBe(0);
    });

    it('should apply when existing version is lower', async () => {
      mockAssetFindUnique.mockResolvedValue({ asset_id: 'a-1', version: 1 });

      const changes = [
        { asset_id: 'a-1', asset_type: 'gene', change_type: 'update' as const, version: 3, changed_at: '2026-01-01T00:00:00Z', content_hash: 'abc' },
      ];

      const result = await incremental.applyIncrementalSync('node-1', changes);

      expect(result.applied).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it('should apply when no existing record (insert case)', async () => {
      mockAssetFindUnique.mockResolvedValue(null);

      const changes = [
        { asset_id: 'a-new', asset_type: 'gene', change_type: 'update' as const, version: 1, changed_at: '2026-01-01T00:00:00Z', content_hash: 'abc' },
      ];

      const result = await incremental.applyIncrementalSync('node-1', changes);

      expect(result.applied).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it('should record errors in try/catch', async () => {
      mockAssetFindUnique.mockRejectedValue(new Error('DB connection failed'));

      const changes = [
        { asset_id: 'a-fail', asset_type: 'gene', change_type: 'update' as const, version: 1, changed_at: '2026-01-01T00:00:00Z', content_hash: 'abc' },
      ];

      const result = await incremental.applyIncrementalSync('node-1', changes);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('a-fail');
      expect(result.errors[0]).toContain('DB connection failed');
    });

    it('should handle mixed changes (delete, skip, apply, error)', async () => {
      mockAssetFindUnique
        .mockResolvedValueOnce({ asset_id: 'a-old', version: 1 }) // a-old: skip (version not higher)
        .mockResolvedValueOnce({ asset_id: 'a-apply', version: 1 }) // a-apply: apply (version 2 > 1)
        .mockRejectedValueOnce(new Error('fail')); // a-error: error caught in catch

      const changes = [
        { asset_id: 'a-deleted', asset_type: 'gene', change_type: 'delete' as const, version: 0, changed_at: '2026-01-01T00:00:00Z', content_hash: '' },
        { asset_id: 'a-old', asset_type: 'gene', change_type: 'update' as const, version: 1, changed_at: '2026-01-01T00:00:00Z', content_hash: '' },
        { asset_id: 'a-apply', asset_type: 'gene', change_type: 'update' as const, version: 2, changed_at: '2026-01-01T00:00:00Z', content_hash: '' },
        { asset_id: 'a-error', asset_type: 'gene', change_type: 'update' as const, version: 1, changed_at: '2026-01-01T00:00:00Z', content_hash: '' },
      ];

      const result = await incremental.applyIncrementalSync('node-1', changes);

      // delete -> skipped=1, update skip -> skipped=2, update apply -> applied=1, error -> errors=1
      expect(result.skipped).toBe(2); // a-deleted(delete) + a-old(version not higher)
      expect(result.applied).toBe(1); // a-apply (version 2 > existing 1)
      expect(result.errors).toHaveLength(1); // a-error: DB error caught
      expect(result.errors[0]!).toContain('a-error');
    });

    it('should return empty errors for empty changes array', async () => {
      const result = await incremental.applyIncrementalSync('node-1', []);
      expect(result.applied).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ===== verifySyncIntegrity =====

  describe('verifySyncIntegrity', () => {
    it('should return no issues when everything is clean', async () => {
      mockSyncStateFindUnique.mockResolvedValue({ node_id: 'node-1', last_sync_at: new Date(), status: 'SYNCED' });
      mockSyncLogFindMany.mockResolvedValue([
        { id: 'l1', status: 'SYNCED', items_synced: 5, synced_at: new Date() },
        { id: 'l2', status: 'SYNCED', items_synced: 3, synced_at: new Date() },
      ]);
      mockAssetFindMany.mockResolvedValue([
        { asset_id: 'a-1', version: 1 },
        { asset_id: 'a-2', version: 5 },
      ]);

      const result = await incremental.verifySyncIntegrity('node-1');

      expect(result.is_integral).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.missing_count).toBe(0);
    });

    it('should add issue when no sync state found', async () => {
      mockSyncStateFindUnique.mockResolvedValue(null);
      mockSyncLogFindMany.mockResolvedValue([
        { id: 'l1', status: 'SYNCED', items_synced: 5, synced_at: new Date() },
      ]);
      mockAssetFindMany.mockResolvedValue([]);

      const result = await incremental.verifySyncIntegrity('node-1');

      expect(result.issues).toContain('No sync state found for node');
    });

    it('should add issue when no sync logs found', async () => {
      mockSyncStateFindUnique.mockResolvedValue({ node_id: 'node-1', last_sync_at: new Date(), status: 'SYNCED' });
      mockSyncLogFindMany.mockResolvedValue([]);
      mockAssetFindMany.mockResolvedValue([]);

      const result = await incremental.verifySyncIntegrity('node-1');

      expect(result.issues).toContain('No sync logs found');
    });

    it('should add issue when recent sync errors exist', async () => {
      mockSyncStateFindUnique.mockResolvedValue({ node_id: 'node-1', last_sync_at: new Date(), status: 'SYNCED' });
      mockSyncLogFindMany.mockResolvedValue([
        { id: 'l1', status: 'SYNC_ERROR', items_synced: 0, synced_at: new Date() },
        { id: 'l2', status: 'SYNC_ERROR', items_synced: 0, synced_at: new Date() },
      ]);
      mockAssetFindMany.mockResolvedValue([]);

      const result = await incremental.verifySyncIntegrity('node-1');

      expect(result.issues).toContain('2 recent sync errors detected');
    });

    it('should add issue when assets have invalid version (<=0)', async () => {
      mockSyncStateFindUnique.mockResolvedValue({ node_id: 'node-1', last_sync_at: new Date(), status: 'SYNCED' });
      mockSyncLogFindMany.mockResolvedValue([
        { id: 'l1', status: 'SYNCED', items_synced: 5, synced_at: new Date() },
      ]);
      mockAssetFindMany.mockResolvedValue([
        { asset_id: 'a-1', version: 0 },
        { asset_id: 'a-2', version: -1 },
        { asset_id: 'a-3', version: 1 },
      ]);

      const result = await incremental.verifySyncIntegrity('node-1');

      expect(result.issues).toContain('2 assets with invalid version');
      expect(result.missing_count).toBe(2);
    });

    it('should accumulate multiple issues', async () => {
      mockSyncStateFindUnique.mockResolvedValue(null); // missing state
      mockSyncLogFindMany.mockResolvedValue([]); // no logs
      mockAssetFindMany.mockResolvedValue([
        { asset_id: 'a-1', version: 0 },
      ]);

      const result = await incremental.verifySyncIntegrity('node-1');

      expect(result.is_integral).toBe(false);
      expect(result.issues.length).toBeGreaterThanOrEqual(3);
    });
  });
});
