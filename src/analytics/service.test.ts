import { PrismaClient } from '@prisma/client';
import * as service from './service';

const {
  getDriftReport,
  getBranchingMetrics,
  getTimeline,
  getSignalForecast,
  getGdiForecast,
  getRiskAlerts,
} = service;

const mockPrisma = {
  asset: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  evolutionEvent: {
    findMany: jest.fn(),
  },
  gDIScoreRecord: {
    findMany: jest.fn(),
  },
  quarantineRecord: {
    findMany: jest.fn(),
  },
  similarityRecord: {
    findMany: jest.fn(),
  },
} as any;

describe('Analytics Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDriftReport', () => {
    it('should return normal status when drift is below threshold', async () => {
      const baselineAssets = [
        { signals: ['signal-a', 'signal-b'] },
        { signals: ['signal-a'] },
      ];
      const currentAssets = [
        { signals: ['signal-a', 'signal-b'] },
        { signals: ['signal-a'] },
      ];

      mockPrisma.asset.findMany
        .mockResolvedValueOnce(baselineAssets)
        .mockResolvedValueOnce(currentAssets);

      const result = await getDriftReport('node-1');

      expect(result.node_id).toBe('node-1');
      expect(result.status).toBe('normal');
      expect(result.drift_score).toBeLessThan(0.15);
      expect(result.threshold).toBe(0.15);
      expect(result.drift_types).toEqual([]);
      expect(result.recommendations).toEqual(['No action needed']);
      expect(result.top_drift_signals).toHaveLength(2);
    });

    it('should return drifting status when drift exceeds threshold', async () => {
      const baselineAssets = [
        { signals: ['signal-a', 'signal-a', 'signal-b'] },
      ];
      const currentAssets = [
        { signals: ['signal-a', 'signal-b', 'signal-b'] },
      ];

      mockPrisma.asset.findMany
        .mockResolvedValueOnce(baselineAssets)
        .mockResolvedValueOnce(currentAssets);

      const result = await getDriftReport('node-1');

      expect(result.node_id).toBe('node-1');
      expect(result.status).toBe('drifting');
      expect(result.drift_score).toBeGreaterThan(0);
      expect(result.drift_types).toContain('signal');
      expect(result.recommendations).toHaveLength(2);
    });

    it('should return critical status when drift is very high', async () => {
      const baselineAssets = Array(10).fill({ signals: ['signal-a'] });
      const currentAssets = Array(10).fill({ signals: ['signal-z'] });

      mockPrisma.asset.findMany
        .mockResolvedValueOnce(baselineAssets)
        .mockResolvedValueOnce(currentAssets);

      const result = await getDriftReport('node-1');

      expect(result.status).toBe('critical');
      expect(result.drift_types).toContain('signal');
      expect(result.drift_types).toContain('capability');
      expect(result.drift_types).toContain('style');
      expect(result.recommendations).toHaveLength(3);
    });

    it('should handle empty assets gracefully', async () => {
      mockPrisma.asset.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getDriftReport('node-1');

      expect(result.node_id).toBe('node-1');
      expect(result.drift_score).toBe(0);
      expect(result.status).toBe('normal');
      expect(result.top_drift_signals).toEqual([]);
    });

    it('should compute top drift signals sorted by delta', async () => {
      const baselineAssets = [{ signals: ['a', 'b'] }];
      const currentAssets = [{ signals: ['c', 'b'] }];

      mockPrisma.asset.findMany
        .mockResolvedValueOnce(baselineAssets)
        .mockResolvedValueOnce(currentAssets);

      const result = await getDriftReport('node-1');

      expect(result.top_drift_signals.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getBranchingMetrics', () => {
    it('should compute branching metrics correctly', async () => {
      const branchedAssets = [
        { parent_id: 'parent-1', generation: 1 },
        { parent_id: 'parent-1', generation: 2 },
        { parent_id: 'parent-2', generation: 1 },
      ];
      const signalAssets = [
        { signals: ['signal-a', 'signal-b'] },
        { signals: ['signal-a', 'signal-c'] },
        { signals: ['signal-a'] },
      ];

      mockPrisma.asset.findMany
        .mockResolvedValueOnce(branchedAssets)
        .mockResolvedValueOnce(signalAssets);

      const result = await getBranchingMetrics();

      expect(result.total_branches).toBe(3);
      expect(result.avg_branching_factor).toBeGreaterThan(0);
      expect(result.deepest_path).toBeLessThanOrEqual(10);
      expect(result.convergence_clusters).toBeDefined();
      expect(result.divergence_hotspots).toBeDefined();
    });

    it('should handle no branched assets', async () => {
      mockPrisma.asset.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getBranchingMetrics();

      expect(result.total_branches).toBe(0);
      expect(result.avg_branching_factor).toBe(0);
      expect(result.deepest_path).toBe(0);
    });

    it('should classify divergence hotspots correctly', async () => {
      const branchedAssets = [{ parent_id: 'p1', generation: 1 }];
      const signalAssets = [
        { signals: Array(55).fill('popular-signal') },
      ];

      mockPrisma.asset.findMany
        .mockResolvedValueOnce(branchedAssets)
        .mockResolvedValueOnce(signalAssets);

      const result = await getBranchingMetrics();

      const saturated = result.divergence_hotspots.find(
        (h) => h.signal === 'popular-signal',
      );
      expect(saturated).toBeDefined();
      expect(saturated!.status).toBe('saturated');
    });
  });

  describe('getTimeline', () => {
    it('should return timeline events for a node', async () => {
      const mockEvents = [
        {
          id: 'ev-1',
          actor_id: 'node-1',
          event_type: 'asset_published',
          asset_id: 'asset-1',
          from_version: 0,
          to_version: 1,
          changes: null,
          timestamp: new Date('2025-01-01'),
        },
      ];

      mockPrisma.evolutionEvent.findMany.mockResolvedValue(mockEvents);

      const result = await getTimeline('node-1');

      expect(result).toHaveLength(1);
      expect(result[0]!.event_id).toBe('ev-1');
      expect(result[0]!.node_id).toBe('node-1');
      expect(result[0]!.event_type).toBe('asset_published');
      expect(result[0]!.description).toContain('asset_published');
      expect(result[0]!.metadata.asset_id).toBe('asset-1');
    });

    it('should filter by event type when provided', async () => {
      mockPrisma.evolutionEvent.findMany.mockResolvedValue([]);

      await getTimeline('node-1', 'asset_published', 10, 0);

      expect(mockPrisma.evolutionEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            actor_id: 'node-1',
            event_type: 'asset_published',
          }),
        }),
      );
    });

    it('should apply limit and offset', async () => {
      mockPrisma.evolutionEvent.findMany.mockResolvedValue([]);

      await getTimeline('node-1', undefined, 5, 10);

      expect(mockPrisma.evolutionEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          skip: 10,
        }),
      );
    });

    it('should handle empty timeline', async () => {
      mockPrisma.evolutionEvent.findMany.mockResolvedValue([]);

      const result = await getTimeline('node-1');

      expect(result).toEqual([]);
    });
  });

  describe('getSignalForecast', () => {
    it('should return rising trend when recent activity is high', async () => {
      const now = Date.now();
      const weekMs = 7 * 24 * 60 * 60 * 1000;

      const weeklyAssets = Array.from({ length: 20 }, (_, i) => ({
        created_at: new Date(now - i * weekMs),
      }));

      mockPrisma.asset.findMany
        .mockResolvedValueOnce(weeklyAssets)
        .mockResolvedValueOnce([
          { signals: ['signal-a', 'other'] },
        ]);
      mockPrisma.asset.count.mockResolvedValue(20);

      const result = await getSignalForecast('signal-a');

      expect(result.signal).toBe('signal-a');
      expect(result.current_rank).toBeGreaterThanOrEqual(1);
      expect(result.confidence).toBe(0.7);
      expect(['rising', 'stable', 'declining']).toContain(result.trend);
    });

    it('should return declining trend when recent activity is low', async () => {
      const now = Date.now();
      const weekMs = 7 * 24 * 60 * 60 * 1000;

      const weeklyAssets = Array.from({ length: 20 }, (_, i) => ({
        created_at: new Date(now - (8 - i) * weekMs),
      }));

      mockPrisma.asset.findMany
        .mockResolvedValueOnce(weeklyAssets)
        .mockResolvedValueOnce([
          { signals: ['signal-b', 'signal-a'] },
        ]);
      mockPrisma.asset.count.mockResolvedValue(20);

      const result = await getSignalForecast('signal-a');

      expect(result.signal).toBe('signal-a');
      expect(['rising', 'stable', 'declining']).toContain(result.trend);
    });

    it('should handle no matching assets', async () => {
      mockPrisma.asset.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.asset.count.mockResolvedValue(0);

      const result = await getSignalForecast('nonexistent');

      expect(result.signal).toBe('nonexistent');
      expect(result.trend).toBe('stable');
    });

    it('should compute predicted ranks correctly', async () => {
      mockPrisma.asset.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.asset.count.mockResolvedValue(0);

      const result = await getSignalForecast('signal-x');

      expect(result.predicted_rank_7d).toBeGreaterThanOrEqual(1);
      expect(result.predicted_rank_14d).toBeGreaterThanOrEqual(1);
      expect(result.predicted_rank_30d).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getGdiForecast', () => {
    it('should return zeroed forecast for non-existent asset', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      const result = await getGdiForecast('nonexistent');

      expect(result.asset_id).toBe('nonexistent');
      expect(result.current_gdi).toBe(0);
      expect(result.predicted_7d).toBe(0);
      expect(result.predicted_14d).toBe(0);
      expect(result.predicted_30d).toBe(0);
      expect(result.risk_of_archive).toBe(true);
    });

    it('should return forecast with stable trend', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        gdi_score: 60,
      });
      mockPrisma.gDIScoreRecord.findMany.mockResolvedValue([
        { overall: 60 },
        { overall: 60 },
      ]);

      const result = await getGdiForecast('asset-1');

      expect(result.asset_id).toBe('asset-1');
      expect(result.current_gdi).toBe(60);
      expect(result.predicted_7d).toBe(60);
      expect(result.risk_of_archive).toBe(false);
    });

    it('should return forecast with upward trend', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        gdi_score: 65,
      });
      mockPrisma.gDIScoreRecord.findMany.mockResolvedValue([
        { overall: 65 },
        { overall: 60 },
        { overall: 55 },
      ]);

      const result = await getGdiForecast('asset-1');

      expect(result.current_gdi).toBe(65);
      expect(result.predicted_7d).toBeGreaterThanOrEqual(65);
      expect(result.predicted_14d).toBeGreaterThanOrEqual(result.predicted_7d);
      expect(result.predicted_30d).toBeGreaterThanOrEqual(result.predicted_14d);
    });

    it('should return forecast with downward trend', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        gdi_score: 30,
      });
      mockPrisma.gDIScoreRecord.findMany.mockResolvedValue([
        { overall: 30 },
        { overall: 40 },
        { overall: 50 },
      ]);

      const result = await getGdiForecast('asset-1');

      expect(result.current_gdi).toBe(30);
      expect(result.predicted_7d).toBeLessThanOrEqual(30);
    });

    it('should handle single GDI record', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        gdi_score: 50,
      });
      mockPrisma.gDIScoreRecord.findMany.mockResolvedValue([
        { overall: 50 },
      ]);

      const result = await getGdiForecast('asset-1');

      expect(result.current_gdi).toBe(50);
      expect(result.predicted_7d).toBe(50);
    });

    it('should flag risk_of_archive when predicted 30d is below 20', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        gdi_score: 25,
      });
      mockPrisma.gDIScoreRecord.findMany.mockResolvedValue([
        { overall: 25 },
        { overall: 35 },
        { overall: 45 },
      ]);

      const result = await getGdiForecast('asset-1');

      expect(result.risk_of_archive).toBe(true);
    });

    it('should clamp predicted values between 0 and 100', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        gdi_score: 95,
      });
      mockPrisma.gDIScoreRecord.findMany.mockResolvedValue([
        { overall: 95 },
        { overall: 80 },
        { overall: 65 },
      ]);

      const result = await getGdiForecast('asset-1');

      expect(result.predicted_30d).toBeLessThanOrEqual(100);
      expect(result.predicted_7d).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getRiskAlerts', () => {
    it('should return quarantine alerts', async () => {
      mockPrisma.quarantineRecord.findMany.mockResolvedValue([
        {
          level: 'L2',
          reason: 'similarity_violation',
          started_at: new Date('2025-01-01'),
        },
      ]);
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.similarityRecord.findMany.mockResolvedValue([]);

      const result = await getRiskAlerts('node-1');

      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe('quarantine');
      expect(result[0]!.severity).toBe('medium');
      expect(result[0]!.message).toContain('L2');
    });

    it('should classify L3 quarantine as high severity', async () => {
      mockPrisma.quarantineRecord.findMany.mockResolvedValue([
        {
          level: 'L3',
          reason: 'content_violation',
          started_at: new Date('2025-01-01'),
        },
      ]);
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.similarityRecord.findMany.mockResolvedValue([]);

      const result = await getRiskAlerts('node-1');

      expect(result[0]!.severity).toBe('high');
    });

    it('should classify L1 quarantine as low severity', async () => {
      mockPrisma.quarantineRecord.findMany.mockResolvedValue([
        {
          level: 'L1',
          reason: 'report_threshold',
          started_at: new Date('2025-01-01'),
        },
      ]);
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.similarityRecord.findMany.mockResolvedValue([]);

      const result = await getRiskAlerts('node-1');

      expect(result[0]!.severity).toBe('low');
    });

    it('should return low GDI alerts', async () => {
      mockPrisma.quarantineRecord.findMany.mockResolvedValue([]);
      mockPrisma.asset.findMany.mockResolvedValue([
        {
          name: 'bad-asset',
          gdi_score: 15.3,
          updated_at: new Date('2025-06-01'),
        },
      ]);
      mockPrisma.similarityRecord.findMany.mockResolvedValue([]);

      const result = await getRiskAlerts('node-1');

      const lowGdiAlert = result.find((a) => a.type === 'low_gdi');
      expect(lowGdiAlert).toBeDefined();
      expect(lowGdiAlert!.severity).toBe('medium');
      expect(lowGdiAlert!.message).toContain('bad-asset');
    });

    it('should return similarity alerts for matching assets', async () => {
      mockPrisma.quarantineRecord.findMany.mockResolvedValue([]);
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.similarityRecord.findMany.mockResolvedValue([
        {
          asset_id: 'asset-1',
          score: 0.9,
          detected_at: new Date('2025-06-01'),
        },
      ]);
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        author_id: 'node-1',
      });

      const result = await getRiskAlerts('node-1');

      const simAlert = result.find((a) => a.type === 'similarity');
      expect(simAlert).toBeDefined();
      expect(simAlert!.severity).toBe('medium');
    });

    it('should classify similarity score >= 0.95 as high severity', async () => {
      mockPrisma.quarantineRecord.findMany.mockResolvedValue([]);
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.similarityRecord.findMany.mockResolvedValue([
        {
          asset_id: 'asset-1',
          score: 0.96,
          detected_at: new Date('2025-06-01'),
        },
      ]);
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        author_id: 'node-1',
      });

      const result = await getRiskAlerts('node-1');

      const simAlert = result.find((a) => a.type === 'similarity');
      expect(simAlert!.severity).toBe('high');
    });

    it('should not include similarity alerts for other nodes assets', async () => {
      mockPrisma.quarantineRecord.findMany.mockResolvedValue([]);
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.similarityRecord.findMany.mockResolvedValue([
        {
          asset_id: 'asset-1',
          score: 0.9,
          detected_at: new Date('2025-06-01'),
        },
      ]);
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        author_id: 'other-node',
      });

      const result = await getRiskAlerts('node-1');

      const simAlert = result.find((a) => a.type === 'similarity');
      expect(simAlert).toBeUndefined();
    });

    it('should sort alerts by detected_at descending', async () => {
      mockPrisma.quarantineRecord.findMany.mockResolvedValue([
        {
          level: 'L1',
          reason: 'test',
          started_at: new Date('2025-01-01'),
        },
      ]);
      mockPrisma.asset.findMany.mockResolvedValue([
        {
          name: 'asset',
          gdi_score: 10,
          updated_at: new Date('2025-06-01'),
        },
      ]);
      mockPrisma.similarityRecord.findMany.mockResolvedValue([]);

      const result = await getRiskAlerts('node-1');

      for (let i = 1; i < result.length; i++) {
        const prev = new Date(result[i - 1]!.detected_at).getTime();
        const curr = new Date(result[i]!.detected_at).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    it('should return empty alerts when no risks found', async () => {
      mockPrisma.quarantineRecord.findMany.mockResolvedValue([]);
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.similarityRecord.findMany.mockResolvedValue([]);

      const result = await getRiskAlerts('node-1');

      expect(result).toEqual([]);
    });
  });
});
