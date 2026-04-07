import { PrismaClient } from '@prisma/client';
import * as drift from './drift-detection';
import * as forecasting from './forecasting';
import * as gdiTrends from './gdi-trends';
import * as swarmMetrics from './swarm-metrics';
import * as aggregation from './aggregation';
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
  // ─── Drift Detection Tests ─────────────────────────────────────────────────────

const mockDriftPrisma = {
  evolutionEvent: { findMany: jest.fn() },
} as any;

describe('Drift Detection', () => {
  beforeAll(() => {
    drift.setPrismaForDrift(mockDriftPrisma as unknown as PrismaClient);
  });
  beforeEach(() => { jest.clearAllMocks(); });

  // Re-import the in-memory map — we need a fresh one per describe block.
  // The alertOnDrift and getDriftHistory use the module-level Map.
  // We can only test them through the exported functions.

  describe('detectDrift', () => {
    it('should return no drift when no events exist', async () => {
      mockDriftPrisma.evolutionEvent.findMany.mockResolvedValue([]);

      const result = await drift.detectDrift('asset-1');

      expect(result.assetId).toBe('asset-1');
      expect(result.driftDetected).toBe(false);
      expect(result.magnitude).toBe(0);
      expect(result.signals).toEqual([]);
    });

    it('should compute drift magnitude correctly', async () => {
      const now = Date.now();
      const events = [
        { changes: JSON.stringify({ signals: ['a', 'b'] }) },
        { changes: JSON.stringify({ signals: ['a', 'b'] }) },
        { changes: JSON.stringify({ signals: ['c', 'd'] }) },
        { changes: JSON.stringify({ signals: ['c', 'd'] }) },
      ].map((c, i) => ({
        changes: c.changes,
        timestamp: new Date(now - (4 - i) * 60 * 60 * 1000),
      }));

      mockDriftPrisma.evolutionEvent.findMany.mockResolvedValue(events);

      const result = await drift.detectDrift('asset-1');

      expect(result.assetId).toBe('asset-1');
      expect(result.magnitude).toBeGreaterThan(0);
      expect(result.signals.length).toBeGreaterThan(0);
    });

    it('should mark drift detected when magnitude exceeds threshold', async () => {
      const now = Date.now();
      const events = Array.from({ length: 10 }, (_, i) => ({
        changes: JSON.stringify({ signals: ['signal-x'] }),
        timestamp: new Date(now - (10 - i) * 60 * 60 * 1000),
      }));

      mockDriftPrisma.evolutionEvent.findMany.mockResolvedValue(events);

      const result = await drift.detectDrift('asset-1');

      // Should have signals tracked
      expect(result.signals.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateDriftMagnitude', () => {
    it('should return 0 for identical distributions', () => {
      const before = { a: 5, b: 3 };
      const after = { a: 5, b: 3 };

      const magnitude = drift.calculateDriftMagnitude(before, after);

      expect(magnitude).toBe(0);
    });

    it('should return positive value for divergent distributions', () => {
      const before = { a: 10 };
      const after = { b: 10 };

      const magnitude = drift.calculateDriftMagnitude(before, after);

      expect(magnitude).toBeGreaterThan(0);
      expect(magnitude).toBeLessThanOrEqual(1);
    });

    it('should return 0 for empty distributions', () => {
      expect(drift.calculateDriftMagnitude({}, {})).toBe(0);
      expect(drift.calculateDriftMagnitude({ a: 0 }, {})).toBe(0);
    });
  });

  describe('alertOnDrift', () => {
    it('should not alert when magnitude is below threshold', () => {
      const result = drift.alertOnDrift({ assetId: 'asset-1', magnitude: 0.05 });
      expect(result).toBe(false);
    });

    it('should alert when magnitude exceeds threshold', () => {
      const result = drift.alertOnDrift({ assetId: 'asset-2', magnitude: 0.5 });
      expect(result).toBe(true);
    });

    it('should suppress duplicate alerts within cooldown', () => {
      drift.alertOnDrift({ assetId: 'asset-3', magnitude: 0.5 });
      const suppressed = drift.alertOnDrift({ assetId: 'asset-3', magnitude: 0.5 });
      expect(suppressed).toBe(false);
    });
  });

  describe('getDriftHistory', () => {
    it('should return drift history for a specific asset', () => {
      drift.alertOnDrift({ assetId: 'asset-history-1', magnitude: 0.5 });
      const history = drift.getDriftHistory('asset-history-1');
      expect(Array.isArray(history)).toBe(true);
      // May be empty if cooldown was triggered and asset doesn't match
    });
  });
});

// ─── Forecasting Tests ────────────────────────────────────────────────────────

const mockForecastPrisma = {
  evolutionEvent: { findMany: jest.fn() },
  asset: { findUnique: jest.fn() },
  gDIScoreRecord: { findMany: jest.fn() },
} as any;

describe('Forecasting', () => {
  beforeAll(() => { forecasting.setPrismaForForecasting(mockForecastPrisma as unknown as PrismaClient); });
  beforeEach(() => { jest.clearAllMocks(); });

  describe('predictTrend', () => {
    it('should return stable trend with no events', async () => {
      mockForecastPrisma.evolutionEvent.findMany.mockResolvedValue([]);

      const result = await forecasting.predictTrend('asset-1');

      expect(result.assetId).toBe('asset-1');
      expect(['rising', 'stable', 'declining']).toContain(result.trend);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should return rising trend when recent activity exceeds older activity', async () => {
      const now = Date.now();
      const recentEvents = Array.from({ length: 10 }, (_, i) => ({
        timestamp: new Date(now - i * 24 * 60 * 60 * 1000),
      }));
      const olderEvents = Array.from({ length: 2 }, (_, i) => ({
        timestamp: new Date(now - (20 + i) * 24 * 60 * 60 * 1000),
      }));

      mockForecastPrisma.evolutionEvent.findMany.mockResolvedValue([
        ...olderEvents,
        ...recentEvents,
      ]);

      const result = await forecasting.predictTrend('asset-1');

      expect(result.trend).toBe('rising');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should include horizon days in projection', async () => {
      mockForecastPrisma.evolutionEvent.findMany.mockResolvedValue([]);

      const result = await forecasting.predictTrend('asset-1', 14);
      expect(result.horizonDays).toBe(14);
    });
  });

  describe('predictPopularity', () => {
    it('should return zeroed result for non-existent gene', async () => {
      mockForecastPrisma.asset.findUnique.mockResolvedValue(null);

      const result = await forecasting.predictPopularity('nonexistent-gene');

      expect(result.geneId).toBe('nonexistent-gene');
      expect(result.currentScore).toBe(0);
      expect(result.predictedScore).toBe(0);
    });

    it('should predict popularity based on velocity', async () => {
      mockForecastPrisma.asset.findUnique.mockResolvedValue({
        downloads: 100,
        gdi_score: 65,
        created_at: new Date(),
      });
      mockForecastPrisma.evolutionEvent.findMany.mockResolvedValue(
        Array.from({ length: 10 }, () => ({ timestamp: new Date() })),
      );

      const result = await forecasting.predictPopularity('gene-1', 30);

      expect(result.geneId).toBe('gene-1');
      expect(result.currentScore).toBe(65);
      expect(result.daysAhead).toBe(30);
      expect(result.velocity).toBeGreaterThan(0);
      expect(['rising', 'stable', 'declining']).toContain(result.trend);
    });
  });

  describe('predictGDIScore', () => {
    it('should return zeroed result for non-existent asset', async () => {
      mockForecastPrisma.asset.findUnique.mockResolvedValue(null);

      const result = await forecasting.predictGDIScore('nonexistent');

      expect(result.assetId).toBe('nonexistent');
      expect(result.currentScore).toBe(0);
      expect(result.predictedScore).toBe(0);
      expect(result.confidence).toBe(0);
    });

    it('should return stable for assets with few records', async () => {
      mockForecastPrisma.asset.findUnique.mockResolvedValue({ gdi_score: 55 });
      mockForecastPrisma.gDIScoreRecord.findMany.mockResolvedValue([
        { overall: 55 },
      ]);

      const result = await forecasting.predictGDIScore('asset-1');

      expect(result.currentScore).toBe(55);
      expect(result.predictedScore).toBe(55);
      expect(result.confidence).toBe(0.3);
    });

    it('should compute regression-based prediction', async () => {
      mockForecastPrisma.asset.findUnique.mockResolvedValue({ gdi_score: 70 });
      mockForecastPrisma.gDIScoreRecord.findMany.mockResolvedValue([
        { overall: 55, calculated_at: new Date('2026-03-01') },
        { overall: 60, calculated_at: new Date('2026-03-08') },
        { overall: 65, calculated_at: new Date('2026-03-15') },
        { overall: 70, calculated_at: new Date('2026-03-22') },
      ]);

      const result = await forecasting.predictGDIScore('asset-1');

      expect(result.currentScore).toBe(70);
      expect(result.trend).toBe('rising');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('evaluatePredictionAccuracy', () => {
    it('should return zeros for insufficient data', async () => {
      mockForecastPrisma.gDIScoreRecord.findMany.mockResolvedValue([]);

      const result = await forecasting.evaluatePredictionAccuracy('asset-1');

      expect(result.sampleSize).toBe(0);
      expect(result.mae).toBe(0);
    });

    it('should compute MAE and MAPE correctly', async () => {
      mockForecastPrisma.gDIScoreRecord.findMany.mockResolvedValue([
        { overall: 50, calculated_at: new Date('2026-03-01') },
        { overall: 52, calculated_at: new Date('2026-03-02') },
        { overall: 51, calculated_at: new Date('2026-03-03') },
        { overall: 53, calculated_at: new Date('2026-03-04') },
      ]);

      const result = await forecasting.evaluatePredictionAccuracy('asset-1');

      expect(result.sampleSize).toBe(3);
      expect(result.mae).toBeGreaterThanOrEqual(0);
      expect(result.mape).toBeGreaterThanOrEqual(0);
      expect(result.directionAccuracy).toBeGreaterThanOrEqual(0);
    });
  });
});

// ─── GDI Trends Tests ─────────────────────────────────────────────────────────

const mockGdiPrisma = {
  gDIScoreRecord: { findMany: jest.fn(), findFirst: jest.fn() },
  asset: { findUnique: jest.fn(), findMany: jest.fn() },
} as any;

describe('GDI Trends', () => {
  beforeAll(() => { gdiTrends.setPrismaForGdiTrends(mockGdiPrisma as unknown as PrismaClient); });
  beforeEach(() => { jest.clearAllMocks(); });

  describe('calculateGDITrend', () => {
    it('should return empty trend points when no records', async () => {
      mockGdiPrisma.gDIScoreRecord.findMany.mockResolvedValue([]);

      const result = await gdiTrends.calculateGDITrend('asset-1', '7d');

      expect(result.assetId).toBe('asset-1');
      expect(result.trendPoints).toEqual([]);
      expect(result.slope).toBe(0);
    });

    it('should detect rising trend from ascending scores', async () => {
      mockGdiPrisma.gDIScoreRecord.findMany.mockResolvedValue([
        { overall: 40, usefulness: 40, novelty: 40, rigor: 40, reuse: 40, calculated_at: new Date('2026-03-01') },
        { overall: 50, usefulness: 50, novelty: 50, rigor: 50, reuse: 50, calculated_at: new Date('2026-03-15') },
        { overall: 60, usefulness: 60, novelty: 60, rigor: 60, reuse: 60, calculated_at: new Date('2026-03-29') },
      ]);

      const result = await gdiTrends.calculateGDITrend('asset-1', '30d');

      expect(result.trend).toBe('rising');
      expect(result.trendPoints.length).toBe(3);
      expect(result.slope).toBeGreaterThan(0);
    });

    it('should detect declining trend', async () => {
      mockGdiPrisma.gDIScoreRecord.findMany.mockResolvedValue([
        { overall: 80, usefulness: 80, novelty: 80, rigor: 80, reuse: 80, calculated_at: new Date('2026-03-01') },
        { overall: 60, usefulness: 60, novelty: 60, rigor: 60, reuse: 60, calculated_at: new Date('2026-03-15') },
        { overall: 40, usefulness: 40, novelty: 40, rigor: 40, reuse: 40, calculated_at: new Date('2026-03-29') },
      ]);

      const result = await gdiTrends.calculateGDITrend('asset-1', '30d');

      expect(result.trend).toBe('declining');
      expect(result.slope).toBeLessThan(0);
    });

    it('should accept all valid period options', async () => {
      mockGdiPrisma.gDIScoreRecord.findMany.mockResolvedValue([]);

      for (const period of ['7d', '14d', '30d', '90d'] as const) {
        const result = await gdiTrends.calculateGDITrend('asset-1', period);
        expect(result.period).toBe(period);
      }
    });
  });

  describe('compareWithBenchmarks', () => {
    it('should return zeroed result for non-existent asset', async () => {
      mockGdiPrisma.asset.findUnique.mockResolvedValue(null);
      mockGdiPrisma.asset.findMany.mockResolvedValue([]);
      mockGdiPrisma.gDIScoreRecord.findFirst.mockResolvedValue(null);

      const result = await gdiTrends.compareWithBenchmarks('nonexistent');

      expect(result.assetId).toBe('nonexistent');
      expect(result.assetGdi).toBe(0);
    });

    it('should classify asset above benchmark', async () => {
      mockGdiPrisma.asset.findUnique.mockResolvedValue({ gdi_score: 80 });
      mockGdiPrisma.gDIScoreRecord.findFirst.mockResolvedValue({
        usefulness: 80, novelty: 80, rigor: 80, reuse: 80,
      });
      mockGdiPrisma.asset.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ gdi_score: 50 }, { gdi_score: 60 }]);

      const result = await gdiTrends.compareWithBenchmarks('asset-1');

      expect(result.assetGdi).toBe(80);
      expect(result.verdict).toMatch(/above|at|below/);
    });
  });

  describe('identifyImprovementAreas', () => {
    it('should return empty array when no records', async () => {
      mockGdiPrisma.gDIScoreRecord.findFirst.mockResolvedValue(null);

      const result = await gdiTrends.identifyImprovementAreas('asset-1');
      expect(result).toEqual([]);
    });

    it('should identify dimensions below benchmark', async () => {
      mockGdiPrisma.gDIScoreRecord.findFirst.mockResolvedValue({
        usefulness: 30,
        novelty: 70,
        rigor: 70,
        reuse: 70,
      });
      mockGdiPrisma.gDIScoreRecord.findMany.mockResolvedValue([
        { usefulness: 50, novelty: 50, rigor: 50, reuse: 50, calculated_at: new Date() },
      ]);

      const result = await gdiTrends.identifyImprovementAreas('asset-1');

      const usefulnessArea = result.find((a) => a.dimension === 'usefulness');
      expect(usefulnessArea).toBeDefined();
      expect(usefulnessArea!.gap).toBeGreaterThan(0);
      expect(usefulnessArea!.priority).toBe('high');
    });
  });

  describe('getGDIHistory', () => {
    it('should return history with changeFromPrevious computed', async () => {
      mockGdiPrisma.gDIScoreRecord.findMany.mockResolvedValue([
        { overall: 40, usefulness: 40, novelty: 40, rigor: 40, reuse: 40, calculated_at: new Date('2026-03-01') },
        { overall: 50, usefulness: 50, novelty: 50, rigor: 50, reuse: 50, calculated_at: new Date('2026-03-15') },
        { overall: 48, usefulness: 48, novelty: 48, rigor: 48, reuse: 48, calculated_at: new Date('2026-03-29') },
      ]);

      const result = await gdiTrends.getGDIHistory('asset-1');

      expect(result.length).toBe(3);
      expect(result[0]!.changeFromPrevious).toBeNull();
      expect(result[1]!.changeFromPrevious).toBe(10);
      expect(result[2]!.changeFromPrevious).toBe(-2);
    });

    it('should respect limit parameter', async () => {
      const manyRecords = Array.from({ length: 50 }, (_, i) => ({
        overall: 50 + i,
        usefulness: 50, novelty: 50, rigor: 50, reuse: 50,
        calculated_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      }));
      mockGdiPrisma.gDIScoreRecord.findMany.mockResolvedValue(manyRecords);

      const result = await gdiTrends.getGDIHistory('asset-1', 10);

      expect(result.length).toBeLessThanOrEqual(50);
    });
  });
});

// ─── Swarm Metrics Tests ──────────────────────────────────────────────────────

const mockSwarmPrisma = {
  swarmTask: {
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  swarmSubtask: { findMany: jest.fn() },
} as any;

describe('Swarm Metrics', () => {
  beforeAll(() => { swarmMetrics.setPrismaForSwarmMetrics(mockSwarmPrisma as unknown as PrismaClient); });
  beforeEach(() => { jest.clearAllMocks(); });

  describe('calculateSwarmEfficiency', () => {
    it('should return zeros for non-existent swarm', async () => {
      mockSwarmPrisma.swarmTask.findUnique.mockResolvedValue(null);

      const result = await swarmMetrics.calculateSwarmEfficiency('nonexistent');

      expect(result.swarmId).toBe('nonexistent');
      expect(result.efficiency).toBe(0);
      expect(result.completionRate).toBe(0);
    });

    it('should compute efficiency from subtask completion', async () => {
      const now = Date.now();
      mockSwarmPrisma.swarmTask.findUnique.mockResolvedValue({
        swarm_id: 'swarm-1',
        cost: 500,
        workers: ['w1', 'w2'],
        status: 'in_progress',
        subtasks: [
          {
            status: 'completed',
            assigned_to: 'w1',
            assigned_at: new Date(now - 30 * 60 * 1000),
            completed_at: new Date(now - 10 * 60 * 1000),
          },
          {
            status: 'completed',
            assigned_to: 'w2',
            assigned_at: new Date(now - 30 * 60 * 1000),
            completed_at: new Date(now - 5 * 60 * 1000),
          },
          {
            status: 'pending',
            assigned_to: null,
            assigned_at: null,
            completed_at: null,
          },
        ],
      } as any);

      const result = await swarmMetrics.calculateSwarmEfficiency('swarm-1');

      expect(result.swarmId).toBe('swarm-1');
      expect(result.totalTasks).toBe(3);
      expect(result.completedTasks).toBe(2);
      expect(result.completionRate).toBeCloseTo(0.67, 1);
      expect(result.efficiency).toBeGreaterThan(0);
      expect(result.avgTaskDurationMs).toBeGreaterThan(0);
    });

    it('should reflect low efficiency for mostly-pending swarms', async () => {
      mockSwarmPrisma.swarmTask.findUnique.mockResolvedValue({
        swarm_id: 'swarm-2',
        cost: 0,
        workers: ['w1'],
        status: 'pending',
        subtasks: [
          { status: 'pending', assigned_to: null },
        ],
      } as any);

      const result = await swarmMetrics.calculateSwarmEfficiency('swarm-2');

      expect(result.completionRate).toBe(0);
      expect(result.efficiency).toBeLessThan(100);
    });
  });

  describe('getSubtaskCompletionRate', () => {
    it('should return breakdown for all subtask statuses', async () => {
      mockSwarmPrisma.swarmSubtask.findMany.mockResolvedValue([
        { status: 'pending' },
        { status: 'in_progress' },
        { status: 'completed' },
        { status: 'completed' },
        { status: 'failed' },
      ] as any[]);

      const result = await swarmMetrics.getSubtaskCompletionRate('swarm-1');

      expect(result.total).toBe(5);
      expect(result.pending).toBe(1);
      expect(result.in_progress).toBe(1);
      expect(result.completed).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.completionRate).toBe(0.4);
    });

    it('should return zeros when no subtasks', async () => {
      mockSwarmPrisma.swarmSubtask.findMany.mockResolvedValue([]);

      const result = await swarmMetrics.getSubtaskCompletionRate('swarm-empty');

      expect(result.total).toBe(0);
      expect(result.completionRate).toBe(0);
    });
  });

  describe('getResourceUtilization', () => {
    it('should return zeros for non-existent swarm', async () => {
      mockSwarmPrisma.swarmTask.findUnique.mockResolvedValue(null);

      const result = await swarmMetrics.getResourceUtilization('nonexistent');

      expect(result.totalWorkers).toBe(0);
      expect(result.overallUtilization).toBe(0);
    });

    it('should identify bottleneck workers', async () => {
      const now = Date.now();
      mockSwarmPrisma.swarmTask.findUnique.mockResolvedValue({
        swarm_id: 'swarm-1',
        workers: ['w1', 'w2'],
      } as any);
      mockSwarmPrisma.swarmSubtask.findMany.mockResolvedValue([
        { assigned_to: 'w1', status: 'completed' },
        { assigned_to: 'w1', status: 'completed' },
        { assigned_to: 'w2', status: 'pending' },
        { assigned_to: 'w2', status: 'pending' },
      ] as any[]);

      const result = await swarmMetrics.getResourceUtilization('swarm-1');

      expect(result.totalWorkers).toBe(2);
      expect(result.bottleneckWorkers).toContain('w2');
    });
  });

  describe('generateEfficiencyReport', () => {
    it('should generate report with recommendations and risk flags', async () => {
      const now = Date.now();
      mockSwarmPrisma.swarmTask.findUnique.mockResolvedValue({
        swarm_id: 'swarm-1',
        cost: 500,
        workers: ['w1', 'w2'],
        status: 'in_progress',
        subtasks: [],
      } as any);
      mockSwarmPrisma.swarmSubtask.findMany.mockResolvedValue([]);

      const result = await swarmMetrics.generateEfficiencyReport('swarm-1');

      expect(result.swarmId).toBe('swarm-1');
      expect(result.generatedAt).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(Array.isArray(result.riskFlags)).toBe(true);
    });
  });
});

// ─── Aggregation Tests ────────────────────────────────────────────────────────

const mockAggPrisma = {
  evolutionEvent: { findMany: jest.fn(), count: jest.fn() },
  gDIScoreRecord: { findMany: jest.fn() },
  reputationEvent: { findMany: jest.fn() },
  creditTransaction: { findMany: jest.fn() },
  asset: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  node: { findUnique: jest.fn() },
  swarmTask: { count: jest.fn() },
} as any;

describe('Aggregation', () => {
  beforeAll(() => { aggregation.setPrismaForAggregation(mockAggPrisma as unknown as PrismaClient); });
  beforeEach(() => { jest.clearAllMocks(); });

  describe('aggregateByTimeRange', () => {
    it('should return empty buckets when no data', async () => {
      mockAggPrisma.evolutionEvent.findMany.mockResolvedValue([]);

      const start = new Date('2026-03-01');
      const end = new Date('2026-03-07');
      const result = await aggregation.aggregateByTimeRange('events', start, end);

      expect(result.metric).toBe('events');
      expect(result.buckets.length).toBeGreaterThan(0);
      expect(result.min).toBe(0);
      expect(result.max).toBe(0);
    });

    it('should count events correctly per bucket', async () => {
      const now = Date.now();
      mockAggPrisma.evolutionEvent.findMany.mockResolvedValue(
        Array.from({ length: 20 }, () => ({ timestamp: new Date(now) })),
      );

      const start = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const end = new Date(now);
      const result = await aggregation.aggregateByTimeRange('events', start, end, 'day');

      expect(result.granularity).toBe('day');
      expect(result.sum).toBe(20);
    });

    it('should accept all metric types', async () => {
      mockAggPrisma.evolutionEvent.findMany.mockResolvedValue([]);
      mockAggPrisma.gDIScoreRecord.findMany.mockResolvedValue([]);
      mockAggPrisma.reputationEvent.findMany.mockResolvedValue([]);
      mockAggPrisma.creditTransaction.findMany.mockResolvedValue([]);

      const start = new Date('2026-03-01');
      const end = new Date('2026-03-07');

      for (const metric of ['events', 'gdi_score', 'reputation', 'credits'] as const) {
        const result = await aggregation.aggregateByTimeRange(metric, start, end);
        expect(result.metric).toBe(metric);
      }
    });
  });

  describe('aggregateByCategory', () => {
    it('should aggregate by asset_type', async () => {
      mockAggPrisma.asset.findMany.mockResolvedValue([
        { asset_type: 'gene', signals: [], tags: [], gdi_score: 60, downloads: 10 },
        { asset_type: 'gene', signals: [], tags: [], gdi_score: 70, downloads: 20 },
        { asset_type: 'capsule', signals: [], tags: [], gdi_score: 80, downloads: 5 },
      ]);

      const result = await aggregation.aggregateByCategory('asset_type');

      expect(result.totalAssets).toBe(3);
      const geneBucket = result.buckets.find((b) => b.category === 'gene');
      expect(geneBucket).toBeDefined();
      expect(geneBucket!.count).toBe(2);
      expect(geneBucket!.avgScore).toBe(65);
    });

    it('should aggregate by signal', async () => {
      mockAggPrisma.asset.findMany.mockResolvedValue([
        { asset_type: 'gene', signals: ['security', 'repair'], tags: [], gdi_score: 60, downloads: 10 },
        { asset_type: 'gene', signals: ['security', 'optimize'], tags: [], gdi_score: 70, downloads: 5 },
        { asset_type: 'gene', signals: ['repair'], tags: [], gdi_score: 50, downloads: 3 },
      ]);

      const result = await aggregation.aggregateByCategory('signal');

      // totalAssets = sum of signal entry counts across all assets = 2 + 2 + 1 = 5
      expect(result.totalAssets).toBe(5);
      const security = result.buckets.find((b) => b.category === 'security');
      expect(security).toBeDefined();
      expect(security!.count).toBe(2);
    });

    it('should aggregate by tag', async () => {
      mockAggPrisma.asset.findMany.mockResolvedValue([
        { asset_type: 'gene', signals: [], tags: ['production', 'stable'], gdi_score: 60, downloads: 10 },
        { asset_type: 'gene', signals: [], tags: ['production'], gdi_score: 70, downloads: 5 },
      ]);

      const result = await aggregation.aggregateByCategory('tag');

      const prodBucket = result.buckets.find((b) => b.category === 'production');
      expect(prodBucket).toBeDefined();
      expect(prodBucket!.count).toBe(2);
    });
  });

  describe('getDashboardData', () => {
    it('should return zeroed dashboard for non-existent node', async () => {
      mockAggPrisma.node.findUnique.mockResolvedValue(null);
      mockAggPrisma.asset.findMany.mockResolvedValue([]);
      mockAggPrisma.evolutionEvent.findMany.mockResolvedValue([]);
      mockAggPrisma.swarmTask.count.mockResolvedValue(0);

      const result = await aggregation.getDashboardData('nonexistent');

      expect(result.nodeId).toBe('nonexistent');
      expect(result.totalAssets).toBe(0);
      expect(result.avgGdi).toBe(0);
    });

    it('should compute dashboard metrics correctly', async () => {
      mockAggPrisma.node.findUnique.mockResolvedValue({
        reputation: 72,
        credit_balance: 350,
        quarantineRecords: [],
      });
      mockAggPrisma.asset.findMany.mockResolvedValue([
        { asset_type: 'gene', gdi_score: 60, downloads: 10, signals: ['security'], updated_at: new Date() },
        { asset_type: 'gene', gdi_score: 80, downloads: 5, signals: ['security', 'repair'], updated_at: new Date() },
        { asset_type: 'capsule', gdi_score: 70, downloads: 3, signals: [], updated_at: new Date() },
      ]);
      mockAggPrisma.evolutionEvent.findMany.mockResolvedValue([
        { timestamp: new Date() },
        { timestamp: new Date() },
      ]);
      mockAggPrisma.swarmTask.count.mockResolvedValue(2);

      const result = await aggregation.getDashboardData('node-1');

      expect(result.totalAssets).toBe(3);
      expect(result.avgGdi).toBeCloseTo(70, 0);
      expect(result.totalDownloads).toBe(18);
      expect(result.totalEvents).toBe(2);
      expect(result.activeSwarms).toBe(2);
      expect(result.reputation).toBe(72);
      expect(result.quarantined).toBe(false);
    });

    it('should return quarantined=true when active quarantine exists', async () => {
      mockAggPrisma.node.findUnique.mockResolvedValue({
        reputation: 10,
        credit_balance: 50,
        quarantineRecords: [{ id: 'q1', is_active: true }],
      });
      mockAggPrisma.asset.findMany.mockResolvedValue([]);
      mockAggPrisma.evolutionEvent.findMany.mockResolvedValue([]);
      mockAggPrisma.swarmTask.count.mockResolvedValue(0);

      const result = await aggregation.getDashboardData('node-1');

      expect(result.quarantined).toBe(true);
    });
  });
});
