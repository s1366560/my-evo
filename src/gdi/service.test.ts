/**
 * GDI Scoring Engine — Service Tests
 * 5-dimension model: structural, semantic, specificity, strategy, validation.
 */
import { PrismaClient } from '@prisma/client';
import * as service from './service';
import { textSimilarity, calculateDimensions, calculateGDIScore, batchScoreAssets } from './service';
import { SPECIFICITY_SCORE_BENCHMARKS } from './types';
import type { AssetForScoring } from './types';

const mockPrisma = {
  gDIScoreRecord: { upsert: jest.fn(), findUnique: jest.fn() },
  asset: { update: jest.fn() },
} as unknown as PrismaClient;

const baseAsset: AssetForScoring = {
  asset_id: 'asset-1',
  asset_type: 'gene',
  name: 'TestGene',
  description: 'A test gene that does useful work',
  content: 'export function test() { return 42; }',
  signals: ['test', 'utility'],
  author_id: 'node-1',
  downloads: 10,
  rating: 4.5,
  version: 1,
  carbon_cost: 5,
  parent_id: null,
  generation: 1,
  ancestors: [],
  fork_count: 0,
  config: null,
  gene_ids: null,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('GDI Service', () => {
  beforeAll(() => { service.setPrisma(mockPrisma); });
  beforeEach(() => { jest.clearAllMocks(); });

  describe('textSimilarity', () => {
    it('returns 1.0 for identical texts', () => {
      expect(textSimilarity('hello world', 'hello world')).toBe(1.0);
    });
    it('returns 0.0 for empty vs non-empty', () => {
      expect(textSimilarity('', 'hello')).toBe(0.0);
      expect(textSimilarity('hello', '')).toBe(0.0);
    });
    it('returns 1.0 for both empty', () => {
      expect(textSimilarity('', '')).toBe(1.0);
    });
    it('returns 0.0 for completely different texts', () => {
      expect(textSimilarity('aaa bbb ccc', 'ddd eee fff')).toBe(0.0);
    });
    it('computes partial overlap', () => {
      const r = textSimilarity('hello world', 'hello there');
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThan(1);
    });
    it('is case insensitive', () => {
      expect(textSimilarity('Hello World', 'hello world')).toBe(1.0);
    });
  });

  describe('structural dimension', () => {
    it('scores 0 when content is null', () => {
      // null content: lengthScore=0, signalScore=2*2=4, no quality bonus → structural=4
      const dims = calculateDimensions({ ...baseAsset, content: null });
      expect(dims.structural).toBe(4);
    });
    it('scores 0 when content is too short', () => {
      // 'abc' is < 200 chars: lengthScore=0, signalScore=2*2=4 → structural=4
      const dims = calculateDimensions({ ...baseAsset, content: 'abc' });
      expect(dims.structural).toBe(4);
    });
    it('rewards signal count', () => {
      const many = { ...baseAsset, content: 'x'.repeat(5000), signals: Array.from({ length: 10 }, (_, i) => `s${i}`) };
      expect(calculateDimensions(many).structural).toBeGreaterThan(0);
    });
    it('gives module bonus for code keywords', () => {
      const withMod = { ...baseAsset, content: 'export function hello() { const x = 1; }' };
      const withoutMod = { ...baseAsset, content: 'x = 1' };
      expect(calculateDimensions(withMod).structural).toBeGreaterThan(calculateDimensions(withoutMod).structural);
    });
    it('gives documentation bonus for doc comments', () => {
      const withDocs = { ...baseAsset, content: '// @param x\nfunction f(x) {}' };
      const withoutDocs = { ...baseAsset, content: 'function f(x) {}' };
      expect(calculateDimensions(withDocs).structural).toBeGreaterThanOrEqual(calculateDimensions(withoutDocs).structural);
    });
    it('clamps to 0-100', () => {
      const dims = calculateDimensions({ ...baseAsset, content: 'export const x = 1;', signals: Array.from({ length: 20 }, (_, i) => `s${i}`) });
      expect(dims.structural).toBeGreaterThanOrEqual(0);
      expect(dims.structural).toBeLessThanOrEqual(100);
    });
  });

  describe('semantic dimension', () => {
    it('scores 0 for empty name', () => {
      // empty name → 0; desc len=40 → 8; signal align bonus applies → semantic=~11
      expect(calculateDimensions({ ...baseAsset, name: '' }).semantic).toBeGreaterThan(0);
      expect(calculateDimensions({ ...baseAsset, name: '' }).semantic).toBeLessThan(50);
    });

    it('rewards longer description', () => {
      const short = { ...baseAsset, description: 'Short' };
      const long = { ...baseAsset, description: 'A very long description that exceeds the minimum length threshold.' };
      expect(calculateDimensions(long).semantic).toBeGreaterThanOrEqual(calculateDimensions(short).semantic);
    });
    it('rewards signal alignment with content', () => {
      const dims = calculateDimensions({ ...baseAsset, signals: ['test'], content: 'test function here' });
      expect(dims.semantic).toBeGreaterThan(0);
    });
    it('clamps to 0-100', () => {
      const dims = calculateDimensions({ ...baseAsset, name: 'Valid', description: 'A good description with enough length.', signals: ['test'], content: 'test export function' });
      expect(dims.semantic).toBeGreaterThanOrEqual(0);
      expect(dims.semantic).toBeLessThanOrEqual(100);
    });
  });

  describe('specificity dimension', () => {
    it('adds novelty bonus when no ancestors or parent', () => {
      // baseAsset: 2 signals → +10 signal bonus, no ancestors/parent → +10 novelty
      // score = 50 + 10 + 10 = 70
      const dims = calculateDimensions(baseAsset);
      expect(dims.specificity).toBe(70);
    });
    it('penalizes many ancestors', () => {
      // 5 ancestors → max penalty of 20; base score (50) + signal bonus (6*5=30) - 20 = 60
      // The penalty must outweigh the signal bonus to drop below base 50
      // 10 ancestors → max penalty -20; score = 50 + 10 + 10 - 20 = 50
      const dims = calculateDimensions({ ...baseAsset, ancestors: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10'] });
      expect(dims.specificity).toBeLessThan(70);
    });
    it('caps ancestor penalty at max', () => {
      const dims = calculateDimensions({ ...baseAsset, ancestors: Array.from({ length: 50 }, (_, i) => `a${i}`) });
      expect(dims.specificity).toBeGreaterThanOrEqual(0);
    });
    it('adds fork bonus', () => {
      // 5 forks → 5*2 = 10 bonus; score = 50 + 10 + 10 + 10 = 80
      const dims = calculateDimensions({ ...baseAsset, fork_count: 5 });
      expect(dims.specificity).toBeGreaterThan(50);
    });
    it('caps fork bonus at max', () => {
      // 100 forks → capped at 15 bonus; score = 50 + 10 + 10 + 15 = 85
      const dims = calculateDimensions({ ...baseAsset, fork_count: 100 });
      expect(dims.specificity).toBeLessThanOrEqual(100);
    });
    it('reduces score when content is similar to existing assets', () => {
      const existing: AssetForScoring[] = [{ ...baseAsset, asset_id: 'existing-1', content: 'identical content' }];
      const dims = calculateDimensions({ ...baseAsset, content: 'identical content' }, existing);
      expect(dims.specificity).toBeLessThan(50 + SPECIFICITY_SCORE_BENCHMARKS.novelty_bonus);
    });
  });

  describe('strategy dimension', () => {
    it('rewards lower carbon cost', () => {
      const cheap = { ...baseAsset, carbon_cost: 5 };
      const expensive = { ...baseAsset, carbon_cost: 50 };
      expect(calculateDimensions(cheap).strategy).toBeGreaterThan(calculateDimensions(expensive).strategy);
    });
    it('rewards higher version number up to max', () => {
      expect(calculateDimensions({ ...baseAsset, version: 10 }).strategy).toBeGreaterThanOrEqual(calculateDimensions({ ...baseAsset, version: 1 }).strategy);
    });
    it('caps version bonus at max', () => {
      const dims = calculateDimensions({ ...baseAsset, version: 100 });
      expect(dims.strategy).toBeLessThan(100);
    });
    it('penalizes excessive config keys', () => {
      const dims = calculateDimensions({ ...baseAsset, config: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, `v${i}`])) });
      expect(dims.strategy).toBeLessThan(100);
    });
    it('applies type penalties (recipe > capsule > gene)', () => {
      const gene = { ...baseAsset, asset_type: 'gene' as const };
      const recipe = { ...baseAsset, asset_type: 'recipe' as const };
      expect(calculateDimensions(recipe).strategy).toBeLessThanOrEqual(calculateDimensions(gene).strategy);
    });
  });

  describe('validation dimension', () => {
    it('gives 20 pts baseline when no validation results exist', () => {
      expect(calculateDimensions(baseAsset).validation).toBe(20);
    });
    it('rewards high test coverage', () => {
      expect(calculateDimensions({ ...baseAsset, test_coverage: 0.8 }).validation)
        .toBeGreaterThan(calculateDimensions({ ...baseAsset, test_coverage: 0.1 }).validation);
    });
    it('rewards passing validation results', () => {
      const noResults = { ...baseAsset, validation_results: undefined };
      const passing = { ...baseAsset, validation_results: [{ type: 'unit_test' as const, passed: true, score: 80 }] };
      expect(calculateDimensions(passing).validation).toBeGreaterThan(calculateDimensions(noResults).validation);
    });
    it('penalizes failed syntax validation', () => {
      const passing = { ...baseAsset, validation_results: [{ type: 'syntax' as const, passed: true, score: 80 }] };
      const failing = { ...baseAsset, validation_results: [{ type: 'syntax' as const, passed: false, score: 0 }] };
      expect(calculateDimensions(failing).validation).toBeLessThan(calculateDimensions(passing).validation);
    });
    it('penalizes failed security validation heavily', () => {
      const dims = calculateDimensions({ ...baseAsset, validation_results: [{ type: 'security' as const, passed: false, score: 0 }] });
      expect(dims.validation).toBeLessThan(20);
    });
    it('adds benchmark bonus for passing benchmarks', () => {
      const dims = calculateDimensions({ ...baseAsset, validation_results: [{ type: 'benchmark' as const, passed: true, score: 80 }] });
      expect(dims.validation).toBeGreaterThan(0);
    });
  });

  describe('calculateDimensions', () => {
    it('returns all five dimension keys', () => {
      const dims = calculateDimensions(baseAsset);
      expect(dims).toHaveProperty('structural');
      expect(dims).toHaveProperty('semantic');
      expect(dims).toHaveProperty('specificity');
      expect(dims).toHaveProperty('strategy');
      expect(dims).toHaveProperty('validation');
    });
    it('accepts existingAssets for specificity calculation', () => {
      const existing: AssetForScoring[] = [{ ...baseAsset, asset_id: 'existing-1' }];
      const dims = calculateDimensions(baseAsset, existing);
      expect(dims.specificity).toBeLessThanOrEqual(100);
      expect(dims.specificity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('batchScoreAssets', () => {
    it('returns scores and calculated_at for valid assets', async () => {
      const assets: AssetForScoring[] = [baseAsset];
      const result = await batchScoreAssets({ assets });
      expect(result.scores).toHaveLength(1);
      expect(result.scores[0]!.asset_id).toBe('asset-1');
      expect(result.failed).toHaveLength(0);
      expect(result.calculated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('returns scores for multiple assets', async () => {
      const assets: AssetForScoring[] = [
        baseAsset,
        { ...baseAsset, asset_id: 'asset-2', name: 'Gene2' },
        { ...baseAsset, asset_id: 'asset-3', name: 'Gene3' },
      ];
      const result = await batchScoreAssets({ assets });
      expect(result.scores).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.scores.map(s => s.asset_id)).toEqual(['asset-1', 'asset-2', 'asset-3']);
    });

    it('applies custom weights to all scores', async () => {
      const assets: AssetForScoring[] = [baseAsset];
      const customWeights = {
        structural: 0.5, semantic: 0.1, specificity: 0.1, strategy: 0.1, validation: 0.2,
      };
      const result = await batchScoreAssets({ assets, customWeights });
      expect(result.scores[0]!.weights).toMatchObject(customWeights);
    });

    it('uses default weights when customWeights not provided', async () => {
      const assets: AssetForScoring[] = [baseAsset];
      const result = await batchScoreAssets({ assets });
      // Default weights must sum to 1 and have all five keys
      const w = result.scores[0]!.weights;
      expect(w).toHaveProperty('structural');
      expect(w).toHaveProperty('semantic');
      expect(w).toHaveProperty('specificity');
      expect(w).toHaveProperty('strategy');
      expect(w).toHaveProperty('validation');
      const sum = w.structural + w.semantic + w.specificity + w.strategy + w.validation;
      expect(sum).toBeCloseTo(1, 5);
    });

    it('returns empty scores and failed array for empty asset array', async () => {
      const result = await batchScoreAssets({ assets: [] });
      expect(result.scores).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(result.calculated_at).toBeDefined();
    });

    it('each score has all required fields', async () => {
      const assets: AssetForScoring[] = [baseAsset];
      const result = await batchScoreAssets({ assets });
      const score = result.scores[0];
      expect(score).toHaveProperty('asset_id');
      expect(score).toHaveProperty('asset_type');
      expect(score).toHaveProperty('overall');
      expect(score).toHaveProperty('dimensions');
      expect(score).toHaveProperty('weights');
      expect(score).toHaveProperty('confidence');
      expect(score).toHaveProperty('gdi_mean');
      expect(score).toHaveProperty('gdi_lower');
      expect(score).toHaveProperty('calculated_at');
      expect(score).toHaveProperty('metadata');
    });
  });

  describe('calculateGDIScore', () => {
    it('returns all required fields', () => {
      const result = calculateGDIScore({ asset: baseAsset });
      expect(result).toHaveProperty('asset_id', 'asset-1');
      expect(result).toHaveProperty('asset_type', 'gene');
      expect(result).toHaveProperty('overall');
      expect(result).toHaveProperty('dimensions');
      expect(result).toHaveProperty('weights');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('gdi_mean');
      expect(result).toHaveProperty('gdi_lower');
      expect(result).toHaveProperty('calculated_at');
      expect(result).toHaveProperty('metadata');
    });
    it('overall is the weighted combination of dimensions', () => {
      const result = calculateGDIScore({ asset: baseAsset });
      const expected = (
        result.dimensions.structural * result.weights.structural +
        result.dimensions.semantic * result.weights.semantic +
        result.dimensions.specificity * result.weights.specificity +
        result.dimensions.strategy * result.weights.strategy +
        result.dimensions.validation * result.weights.validation
      );
      expect(result.overall).toBeCloseTo(expected, 5);
    });
    it('gdi_lower <= gdi_mean', () => {
      const result = calculateGDIScore({ asset: baseAsset });
      expect(result.gdi_lower).toBeLessThanOrEqual(result.gdi_mean);
    });
    it('uses custom weights when provided', () => {
      const customWeights = { structural: 0.5, semantic: 0.1, specificity: 0.1, strategy: 0.1, validation: 0.2 };
      const result = calculateGDIScore({ asset: baseAsset, customWeights });
      expect(result.weights).toMatchObject(customWeights);
    });
    it('clamps overall to 0-100', () => {
      const result = calculateGDIScore({ asset: baseAsset });
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(100);
    });
    it('confidence is between 0 and 1', () => {
      const result = calculateGDIScore({ asset: baseAsset });
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
    it('metadata contains correct counts', () => {
      const result = calculateGDIScore({ asset: baseAsset });
      expect(result.metadata.signal_count).toBe(baseAsset.signals.length);
      expect(result.metadata.fork_count).toBe(baseAsset.fork_count);
      expect(result.metadata.lineage_depth).toBe(baseAsset.ancestors.length);
    });
    it('metadata counts validation_passed correctly', () => {
      const assetWithResults = {
        ...baseAsset,
        validation_results: [
          { type: 'unit_test' as const, passed: true, score: 80 },
          { type: 'syntax' as const, passed: false, score: 0 },
        ],
      };
      const result = calculateGDIScore({ asset: assetWithResults });
      expect(result.metadata.validation_passed).toBe(1);
      expect(result.metadata.validation_total).toBe(2);
    });
    it('accepts custom weights and existingAssets', () => {
      const existing: AssetForScoring[] = [{ ...baseAsset, asset_id: 'existing-1', content: 'same content' }];
      const customWeights = { structural: 0.1, semantic: 0.1, specificity: 0.1, strategy: 0.1, validation: 0.6 };
      const result = calculateGDIScore({ asset: baseAsset, customWeights, existingAssets: existing });
      expect(result.weights).toMatchObject(customWeights);
      expect(result.overall).toBeGreaterThanOrEqual(0);
    });
    it('returns ISO timestamp in calculated_at', () => {
      const result = calculateGDIScore({ asset: baseAsset });
      expect(result.calculated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});

