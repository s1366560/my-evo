import { PrismaClient } from '@prisma/client';
import * as audit from './audit';

const mockSyncLogCreate = jest.fn();
const mockSyncLogFindMany = jest.fn();
const mockSyncStateFindUnique = jest.fn();
const mockSyncStateUpsert = jest.fn();

const mockPrisma = {
  syncLog: {
    create: mockSyncLogCreate,
    findMany: mockSyncLogFindMany,
  },
  syncState: {
    findUnique: mockSyncStateFindUnique,
    upsert: mockSyncStateUpsert,
  },
} as unknown as PrismaClient;

beforeAll(() => {
  audit.setPrisma(mockPrisma);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Audit', () => {
  // ===== logSyncOperation =====

  describe('logSyncOperation', () => {
    it('should create a sync log entry and update state with SYNCED (isError=false)', async () => {
      mockSyncLogCreate.mockResolvedValue({
        id: 'log-1',
        node_id: 'node-1',
        step: 'CHECK',
        status: 'SYNCED',
        items_synced: 5,
        error: null,
        synced_at: new Date('2026-01-01T00:00:00Z'),
      });
      mockSyncStateUpsert.mockResolvedValue({});

      const result = await audit.logSyncOperation('node-1', {
        step: 'CHECK',
        status: 'SYNCED',
        itemsSynced: 5,
      });

      expect(mockSyncLogCreate).toHaveBeenCalledWith({
        data: {
          node_id: 'node-1',
          step: 'CHECK',
          status: 'SYNCED',
          items_synced: 5,
          error: undefined,
        },
      });
      expect(mockSyncStateUpsert).toHaveBeenCalled();
      const upsertCall = mockSyncStateUpsert.mock.calls[0][0];
      // When status is SYNCED (not error), error_count increment should be undefined
      expect(upsertCall.update.error_count).toBeUndefined();
      expect(result.status).toBe('SYNCED');
      expect(result.items_synced).toBe(5);
    });

    it('should create a sync log entry and update state with SYNC_ERROR (isError=true)', async () => {
      mockSyncLogCreate.mockResolvedValue({
        id: 'log-2',
        node_id: 'node-1',
        step: 'CHECK',
        status: 'SYNC_ERROR',
        items_synced: 2,
        error: 'DB write failed',
        synced_at: new Date('2026-01-01T00:00:00Z'),
      });
      mockSyncStateUpsert.mockResolvedValue({});

      const result = await audit.logSyncOperation('node-1', {
        step: 'CHECK',
        status: 'SYNC_ERROR',
        itemsSynced: 2,
        error: 'DB write failed',
      });

      expect(mockSyncLogCreate).toHaveBeenCalledWith({
        data: {
          node_id: 'node-1',
          step: 'CHECK',
          status: 'SYNC_ERROR',
          items_synced: 2,
          error: 'DB write failed',
        },
      });
      const upsertCall = mockSyncStateUpsert.mock.calls[0][0];
      // When status is SYNC_ERROR, error_count should be incremented
      expect(upsertCall.update.error_count).toEqual({ increment: 1 });
      expect(result.status).toBe('SYNC_ERROR');
      expect(result.error).toBe('DB write failed');
    });

    it('should handle SYNCING status (isError=false)', async () => {
      mockSyncLogCreate.mockResolvedValue({
        id: 'log-3',
        node_id: 'node-1',
        step: 'FETCH',
        status: 'SYNCING',
        items_synced: 0,
        error: null,
        synced_at: new Date('2026-01-01T00:00:00Z'),
      });
      mockSyncStateUpsert.mockResolvedValue({});

      const result = await audit.logSyncOperation('node-1', {
        step: 'FETCH',
        status: 'SYNCING',
        itemsSynced: 0,
      });

      expect(result.status).toBe('SYNCING');
      const upsertCall = mockSyncStateUpsert.mock.calls[0][0];
      expect(upsertCall.update.error_count).toBeUndefined();
    });
  });

  // ===== getSyncHistory =====

  describe('getSyncHistory', () => {
    it('should return mapped sync log entries', async () => {
      const now = new Date('2026-01-01T00:00:00Z');
      mockSyncLogFindMany.mockResolvedValue([
        { id: 'log-1', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 5, error: null, synced_at: now },
        { id: 'log-2', node_id: 'node-1', step: 'FETCH', status: 'SYNCING', items_synced: 0, error: null, synced_at: now },
      ]);

      const result = await audit.getSyncHistory('node-1', 50);

      expect(mockSyncLogFindMany).toHaveBeenCalledWith({
        where: { node_id: 'node-1' },
        orderBy: { synced_at: 'desc' },
        take: 50,
      });
      expect(result).toHaveLength(2);
      expect(result[0]!.status).toBe('SYNCED');
      expect(result[0]!.items_synced).toBe(5);
    });

    it('should return empty array when no logs exist', async () => {
      mockSyncLogFindMany.mockResolvedValue([]);
      const result = await audit.getSyncHistory('node-1');
      expect(result).toHaveLength(0);
    });
  });

  // ===== analyzeSyncPatterns =====

  describe('analyzeSyncPatterns', () => {
    it('should return default pattern when logs.length === 0', async () => {
      mockSyncLogFindMany.mockResolvedValue([]);

      const result = await audit.analyzeSyncPatterns('node-1');

      expect(result.average_interval_ms).toBe(300_000);
      expect(result.activity_level).toBe('low');
      expect(result.suggested_interval_ms).toBe(600_000);
    });

    it('should calculate average interval and activity level when logs.length > 0', async () => {
      const baseTime = new Date('2026-01-01T00:00:00Z').getTime();
      // Create logs with consistent 300s intervals (high activity)
      const logs = [
        { id: 'l1', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 5, error: null, synced_at: new Date(baseTime + 900_000) },
        { id: 'l2', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 3, error: null, synced_at: new Date(baseTime + 600_000) },
        { id: 'l3', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 7, error: null, synced_at: new Date(baseTime + 300_000) },
        { id: 'l4', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 2, error: null, synced_at: new Date(baseTime) },
      ];
      mockSyncLogFindMany.mockResolvedValue(logs);

      const result = await audit.analyzeSyncPatterns('node-1');

      // 3 intervals of 300000ms each -> avg = 300000
      expect(result.average_interval_ms).toBe(300_000);
      // avgInterval < 360000 -> high activity
      expect(result.activity_level).toBe('high');
      // suggested = avgInterval * 0.8
      expect(result.suggested_interval_ms).toBe(240_000);
    });

    it('should return medium activity for intervals between 360s and 900s', async () => {
      const baseTime = new Date('2026-01-01T00:00:00Z').getTime();
      // Logs with 600s intervals (medium activity)
      const logs = [
        { id: 'l1', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 5, error: null, synced_at: new Date(baseTime + 1_800_000) },
        { id: 'l2', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 3, error: null, synced_at: new Date(baseTime + 1_200_000) },
        { id: 'l3', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 7, error: null, synced_at: new Date(baseTime + 600_000) },
        { id: 'l4', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 2, error: null, synced_at: new Date(baseTime) },
      ];
      mockSyncLogFindMany.mockResolvedValue(logs);

      const result = await audit.analyzeSyncPatterns('node-1');

      // 3 intervals of 600000ms each -> avg = 600000
      expect(result.average_interval_ms).toBe(600_000);
      // 360000 <= avgInterval < 900000 -> medium
      expect(result.activity_level).toBe('medium');
    });

    it('should return low activity for intervals >= 900s', async () => {
      const baseTime = new Date('2026-01-01T00:00:00Z').getTime();
      // Logs with 1200s intervals (low activity)
      const logs = [
        { id: 'l1', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 5, error: null, synced_at: new Date(baseTime + 3_600_000) },
        { id: 'l2', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 3, error: null, synced_at: new Date(baseTime + 2_400_000) },
        { id: 'l3', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 7, error: null, synced_at: new Date(baseTime + 1_200_000) },
        { id: 'l4', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 2, error: null, synced_at: new Date(baseTime) },
      ];
      mockSyncLogFindMany.mockResolvedValue(logs);

      const result = await audit.analyzeSyncPatterns('node-1');

      expect(result.average_interval_ms).toBe(1_200_000);
      expect(result.activity_level).toBe('low');
    });

    it('should calculate peak_sync_hour from log timestamps', async () => {
      // Use local dates with explicit hours to avoid timezone shifts
      const d = (h: number, m: number) => {
        const dt = new Date();
        dt.setHours(h, m, 0, 0);
        return dt;
      };
      const logs = [
        { id: 'l1', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 1, error: null, synced_at: d(3, 0) },
        { id: 'l2', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 1, error: null, synced_at: d(3, 30) },
        { id: 'l3', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 1, error: null, synced_at: d(10, 0) },
        { id: 'l4', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 1, error: null, synced_at: d(10, 0) },
      ];
      mockSyncLogFindMany.mockResolvedValue(logs);

      const result = await audit.analyzeSyncPatterns('node-1');

      expect(result.peak_sync_hour).toBe(3);
      expect(result.typical_sync_time).toBe('03:00');
    });
  });

  // ===== getSyncMetrics =====

  describe('getSyncMetrics', () => {
    it('should return default metrics when logs.length === 0', async () => {
      mockSyncLogFindMany.mockResolvedValue([]);

      const result = await audit.getSyncMetrics('node-1');

      expect(result.total_syncs).toBe(0);
      expect(result.successful_syncs).toBe(0);
      expect(result.failed_syncs).toBe(0);
      expect(result.sync_success_rate).toBe(0);
    });

    it('should calculate success/failure counts when logs exist', async () => {
      const now = new Date('2026-01-01T00:00:00Z');
      const logs = [
        { id: 'l1', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 5, error: null, synced_at: now },
        { id: 'l2', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 3, error: null, synced_at: now },
        { id: 'l3', node_id: 'node-1', step: 'CHECK', status: 'SYNC_ERROR', items_synced: 0, error: 'err', synced_at: now },
        { id: 'l4', node_id: 'node-1', step: 'CHECK', status: 'SYNCED', items_synced: 7, error: null, synced_at: now },
        { id: 'l5', node_id: 'node-1', step: 'CHECK', status: 'SYNC_ERROR', items_synced: 0, error: 'err2', synced_at: now },
      ];
      mockSyncLogFindMany.mockResolvedValue(logs);

      const result = await audit.getSyncMetrics('node-1');

      expect(result.total_syncs).toBe(5);
      expect(result.successful_syncs).toBe(3);
      expect(result.failed_syncs).toBe(2);
      expect(result.average_items_per_sync).toBe(3); // (5+3+0+7+0)/5 = 3
      // success_rate = Math.round((3/5)*100) = 60
      expect(result.sync_success_rate).toBe(60);
      expect(result.last_successful_sync).toBe(now.toISOString());
    });

    it('should return empty string for last_successful_sync when no successful syncs', async () => {
      const now = new Date('2026-01-01T00:00:00Z');
      const logs = [
        { id: 'l1', node_id: 'node-1', step: 'CHECK', status: 'SYNC_ERROR', items_synced: 0, error: 'err', synced_at: now },
        { id: 'l2', node_id: 'node-1', step: 'CHECK', status: 'SYNC_ERROR', items_synced: 0, error: 'err2', synced_at: now },
      ];
      mockSyncLogFindMany.mockResolvedValue(logs);

      const result = await audit.getSyncMetrics('node-1');

      expect(result.successful_syncs).toBe(0);
      expect(result.last_successful_sync).toBe('');
      expect(result.sync_success_rate).toBe(0);
    });
  });
});
