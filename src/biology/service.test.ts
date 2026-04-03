import { PrismaClient } from '@prisma/client';
import * as service from './service';

const {
  getPhylogenyTree,
  detectSymbiosis,
  getFitnessLandscape,
  detectEmergentPatterns,
  getDiversityIndex,
  getRedQueenEffect,
  detectMacroEvents,
} = service;

const mockPrisma = {
  asset: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  evolutionEvent: {
    findMany: jest.fn(),
  },
  gDIScoreRecord: {
    findMany: jest.fn(),
  },
} as any;

describe('Biology Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPhylogenyTree', () => {
    it('should return phylogeny tree for an existing asset', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Test Gene',
        parent_id: 'parent-1',
        signals: ['optimize'],
        gdi_score: 75,
        created_at: new Date('2025-01-01'),
      });
      mockPrisma.asset.findMany.mockResolvedValue([
        { asset_id: 'child-1' },
        { asset_id: 'child-2' },
      ]);
      mockPrisma.evolutionEvent.findMany.mockResolvedValue([
        { id: 'ev-1' },
        { id: 'ev-2' },
        { id: 'ev-3' },
      ]);

      const result = await getPhylogenyTree('asset-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('asset-1');
      expect(result!.type).toBe('gene');
      expect(result!.name).toBe('Test Gene');
      expect(result!.parent_id).toBe('parent-1');
      expect(result!.children).toEqual(['child-1', 'child-2']);
      expect(result!.mutations).toBe(3);
      expect(result!.category).toBe('optimize');
    });

    it('should return null when asset does not exist', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      const result = await getPhylogenyTree('missing');

      expect(result).toBeNull();
    });

    it('should use default category when signals are empty', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-2',
        asset_type: 'capsule',
        name: 'No Signals',
        parent_id: null,
        signals: [],
        gdi_score: 50,
        created_at: new Date('2025-01-01'),
      });
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.evolutionEvent.findMany.mockResolvedValue([]);

      const result = await getPhylogenyTree('asset-2');

      expect(result!.category).toBe('optimize');
    });

    it('should handle asset with no parent', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'root-asset',
        asset_type: 'gene',
        name: 'Root Gene',
        parent_id: null,
        signals: ['innovate'],
        gdi_score: 80,
        created_at: new Date('2025-01-01'),
      });
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.evolutionEvent.findMany.mockResolvedValue([]);

      const result = await getPhylogenyTree('root-asset');

      expect(result!.parent_id).toBeUndefined();
    });
  });

  describe('detectSymbiosis', () => {
    it('should detect mutualism when downloads are similar', async () => {
      const assets = [
        { asset_id: 'a-1', signals: ['optimize', 'reliability', 'security'], gdi_score: 70, author_id: 'u1', downloads: 50 },
        { asset_id: 'a-2', signals: ['optimize', 'reliability', 'performance'], gdi_score: 75, author_id: 'u2', downloads: 55 },
      ];
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await detectSymbiosis();

      expect(result.length).toBeGreaterThan(0);
      const rel = result[0]!;
      expect(rel.source_id).toBe('a-1');
      expect(rel.target_id).toBe('a-2');
      expect(rel.type).toBe('mutualism');
      expect(rel.strength).toBeGreaterThan(0.3);
    });

    it('should detect parasitism when one asset has low GDI', async () => {
      const assets = [
        { asset_id: 'a-low', signals: ['optimize', 'reliability', 'security'], gdi_score: 20, author_id: 'u1', downloads: 50 },
        { asset_id: 'a-high', signals: ['optimize', 'reliability', 'performance'], gdi_score: 75, author_id: 'u2', downloads: 500 },
      ];
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await detectSymbiosis();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.type).toBe('parasitism');
    });

    it('should detect commensalism for moderate download difference and decent GDI', async () => {
      const assets = [
        { asset_id: 'a-1', signals: ['optimize', 'reliability', 'security'], gdi_score: 70, author_id: 'u1', downloads: 50 },
        { asset_id: 'a-2', signals: ['optimize', 'reliability', 'performance'], gdi_score: 65, author_id: 'u2', downloads: 200 },
      ];
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await detectSymbiosis();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.type).toBe('commensalism');
    });

    it('should return empty when no assets share enough signals', async () => {
      const assets = [
        { asset_id: 'a-1', signals: ['optimize'], gdi_score: 70, author_id: 'u1', downloads: 50 },
        { asset_id: 'a-2', signals: ['reliability'], gdi_score: 75, author_id: 'u2', downloads: 50 },
      ];
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await detectSymbiosis();

      expect(result).toHaveLength(0);
    });

    it('should return empty when no published assets exist', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await detectSymbiosis();

      expect(result).toHaveLength(0);
    });

    it('should limit results to 20 sorted by strength descending', async () => {
      const assets = Array.from({ length: 10 }, (_, i) => ({
        asset_id: `a-${i}`,
        signals: ['optimize', 'reliability', 'security', 'performance'],
        gdi_score: 60 + i,
        author_id: `u-${i}`,
        downloads: 50 + i,
      }));
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await detectSymbiosis();

      expect(result.length).toBeLessThanOrEqual(20);
      for (let i = 1; i < result.length; i++) {
        expect(result[i]!.strength).toBeLessThanOrEqual(result[i - 1]!.strength);
      }
    });
  });

  describe('getFitnessLandscape', () => {
    it('should return grid with correct dimensions', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await getFitnessLandscape();

      expect(result.grid_size).toBe(5);
      expect(result.grid).toHaveLength(5);
      expect(result.grid[0]!).toHaveLength(5);
      expect(result.x_axis_label).toBe('Downloads');
      expect(result.y_axis_label).toBe('GDI Score');
    });

    it('should populate cells with matching assets', async () => {
      const assets = [
        { gdi_score: 50, downloads: 50, signals: ['optimize'] },
        { gdi_score: 90, downloads: 500, signals: ['innovate'] },
      ];
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await getFitnessLandscape();

      const totalInCells = result.grid
        .flat()
        .reduce((sum, cell) => sum + cell.count, 0);
      expect(totalInCells).toBe(2);
    });

    it('should calculate avg_gdi for cells with assets', async () => {
      const assets = [
        { gdi_score: 60, downloads: 50, signals: ['optimize'] },
        { gdi_score: 70, downloads: 50, signals: ['reliability'] },
      ];
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await getFitnessLandscape();

      const nonEmptyCell = result.grid.flat().find((c) => c.count > 0);
      expect(nonEmptyCell).toBeDefined();
      expect(nonEmptyCell!.avg_gdi).toBeGreaterThan(0);
    });

    it('should return zero counts for empty asset list', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await getFitnessLandscape();

      const totalInCells = result.grid
        .flat()
        .reduce((sum, cell) => sum + cell.count, 0);
      expect(totalInCells).toBe(0);
    });
  });

  describe('detectEmergentPatterns', () => {
    it('should detect patterns with high lift', async () => {
      // Create assets where "optimize+reliability" pair has high success rate
      // but overall baseline is low
      const assets = [
        // 3 assets with optimize+reliability, all high GDI (success)
        { asset_id: 'a-0', signals: ['optimize', 'reliability'], gdi_score: 80, rating: 5 },
        { asset_id: 'a-1', signals: ['optimize', 'reliability'], gdi_score: 75, rating: 4 },
        { asset_id: 'a-2', signals: ['optimize', 'reliability'], gdi_score: 70, rating: 4 },
        // 7 other assets with low GDI (lowers the baseline)
        ...Array.from({ length: 7 }, (_, i) => ({
          asset_id: `low-${i}`,
          signals: ['security', 'performance'],
          gdi_score: 20,
          rating: 2,
        })),
      ];
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await detectEmergentPatterns();

      expect(result.length).toBeGreaterThan(0);
      const optimizeReliability = result.find(
        (p) => p.signal_cluster.includes('optimize') && p.signal_cluster.includes('reliability'),
      );
      expect(optimizeReliability).toBeDefined();
      expect(optimizeReliability!.success_rate).toBe(1);
      expect(optimizeReliability!.lift).toBeGreaterThanOrEqual(1.5);
    });

    it('should skip signal pairs with fewer than 3 occurrences', async () => {
      const assets = [
        { asset_id: 'a-1', signals: ['optimize', 'reliability'], gdi_score: 80, rating: 4 },
        { asset_id: 'a-2', signals: ['optimize'], gdi_score: 40, rating: 3 },
      ];
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await detectEmergentPatterns();

      expect(result).toHaveLength(0);
    });

    it('should return empty when no assets exist', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await detectEmergentPatterns();

      expect(result).toHaveLength(0);
    });

    it('should limit results to 10 sorted by lift descending', async () => {
      const assets = Array.from({ length: 50 }, (_, i) => ({
        asset_id: `a-${i}`,
        signals: ['optimize', 'reliability', 'security', 'performance'],
        gdi_score: 70 + (i % 20),
        rating: 4,
      }));
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await detectEmergentPatterns();

      expect(result.length).toBeLessThanOrEqual(10);
      for (let i = 1; i < result.length; i++) {
        expect(result[i]!.lift).toBeLessThanOrEqual(result[i - 1]!.lift);
      }
    });
  });

  describe('getDiversityIndex', () => {
    it('should calculate diversity indices correctly', async () => {
      const assets = [
        { signals: ['optimize', 'reliability'] },
        { signals: ['optimize', 'security'] },
        { signals: ['innovate'] },
        { signals: ['optimize', 'reliability', 'performance'] },
      ];
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await getDiversityIndex();

      expect(result.shannon).toBeGreaterThan(0);
      expect(result.simpson).toBeGreaterThan(0);
      expect(result.simpson).toBeLessThanOrEqual(1);
      expect(result.gini).toBeGreaterThanOrEqual(0);
      expect(result.gini).toBeGreaterThanOrEqual(0);
      expect(result.total_categories).toBe(5);
      expect(result.distribution).toBeDefined();
      expect(result.distribution['optimize']).toBe(3);
    });

    it('should return zero diversity for single signal type', async () => {
      const assets = [
        { signals: ['optimize'] },
        { signals: ['optimize'] },
        { signals: ['optimize'] },
      ];
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await getDiversityIndex();

      expect(result.total_categories).toBe(1);
      expect(result.simpson).toBe(0);
    });

    it('should handle empty asset list', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await getDiversityIndex();

      expect(result.total_categories).toBe(0);
      expect(result.distribution).toEqual({});
    });
  });

  describe('getRedQueenEffect', () => {
    it('should calculate red queen effect metrics', async () => {
      mockPrisma.evolutionEvent.findMany.mockResolvedValue([
        { asset_id: 'a-1', event_type: 'mutated' },
        { asset_id: 'a-2', event_type: 'forked' },
        { asset_id: 'a-1', event_type: 'mutated' },
      ]);
      mockPrisma.gDIScoreRecord.findMany.mockResolvedValue([
        { overall: 50 },
        { overall: 55 },
        { overall: 52 },
      ]);

      const result = await getRedQueenEffect();

      expect(result.period_days).toBe(30);
      expect(result.avg_mutation_rate).toBe(0.1);
      expect(result.avg_gdi_change).toBeGreaterThan(0);
      expect(result.coevolution_pairs).toBeGreaterThanOrEqual(0);
      expect(result.arms_race_detected).toBe(false);
    });

    it('should detect arms race when mutation rate exceeds 2', async () => {
      const events = Array.from({ length: 70 }, (_, i) => ({
        asset_id: `a-${i % 10}`,
        event_type: 'mutated',
      }));
      mockPrisma.evolutionEvent.findMany.mockResolvedValue(events);
      mockPrisma.gDIScoreRecord.findMany.mockResolvedValue([]);

      const result = await getRedQueenEffect();

      expect(result.arms_race_detected).toBe(true);
      expect(result.avg_mutation_rate).toBeCloseTo(70 / 30, 1);
    });

    it('should handle zero GDI records', async () => {
      mockPrisma.evolutionEvent.findMany.mockResolvedValue([]);
      mockPrisma.gDIScoreRecord.findMany.mockResolvedValue([]);

      const result = await getRedQueenEffect();

      expect(result.avg_gdi_change).toBe(0);
      expect(result.avg_mutation_rate).toBe(0);
      expect(result.arms_race_detected).toBe(false);
    });

    it('should handle single GDI record', async () => {
      mockPrisma.evolutionEvent.findMany.mockResolvedValue([]);
      mockPrisma.gDIScoreRecord.findMany.mockResolvedValue([
        { overall: 50 },
      ]);

      const result = await getRedQueenEffect();

      expect(result.avg_gdi_change).toBe(0);
    });
  });

  describe('detectMacroEvents', () => {
    it('should detect explosion when signal count is 3x average', async () => {
      const assets = Array.from({ length: 30 }, (_, i) => ({
        asset_id: `a-${i}`,
        signals: ['optimize'],
        created_at: new Date(),
        gdi_score: 60,
      }));
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await detectMacroEvents();

      expect(result.length).toBeGreaterThan(0);
      const explosion = result.find((e) => e.type === 'explosion');
      expect(explosion).toBeDefined();
      expect(explosion!.category).toBe('optimize');
      expect(explosion!.affected_assets).toBe(30);
    });

    it('should detect extinction when only 1 asset has a signal and more than 50 assets', async () => {
      const assets = [
        ...Array.from({ length: 55 }, (_, i) => ({
          asset_id: `a-${i}`,
          signals: ['optimize'],
          created_at: new Date(),
          gdi_score: 60,
        })),
        {
          asset_id: 'rare',
          signals: ['rare_signal'],
          created_at: new Date(),
          gdi_score: 50,
        },
      ];
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await detectMacroEvents();

      const extinction = result.find((e) => e.type === 'extinction');
      expect(extinction).toBeDefined();
      expect(extinction!.category).toBe('rare_signal');
      expect(extinction!.affected_assets).toBe(1);
    });

    it('should not detect extinction when fewer than 50 assets', async () => {
      const assets = [
        { asset_id: 'a-1', signals: ['optimize'], created_at: new Date(), gdi_score: 60 },
        { asset_id: 'a-2', signals: ['rare_signal'], created_at: new Date(), gdi_score: 50 },
      ];
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await detectMacroEvents();

      const extinction = result.find((e) => e.type === 'extinction');
      expect(extinction).toBeUndefined();
    });

    it('should return empty when no assets in period', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await detectMacroEvents();

      expect(result).toHaveLength(0);
    });

    it('should sort events by magnitude descending', async () => {
      const assets = [
        ...Array.from({ length: 50 }, (_, i) => ({
          asset_id: `a-${i}`,
          signals: ['optimize'],
          created_at: new Date(),
          gdi_score: 60,
        })),
        ...Array.from({ length: 20 }, (_, i) => ({
          asset_id: `b-${i}`,
          signals: ['reliability'],
          created_at: new Date(),
          gdi_score: 55,
        })),
      ];
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await detectMacroEvents();

      for (let i = 1; i < result.length; i++) {
        expect(result[i]!.magnitude).toBeLessThanOrEqual(result[i - 1]!.magnitude);
      }
    });
  });
});
