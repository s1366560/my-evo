/**
 * Confidence Decay Model Tests
 * Chapter 28: Anti-Hallucination — Dynamic Asset Confidence Tracking
 */

import {
  calculateConfidence,
  computeGrade,
  gradeAllowedOps,
  initConfidence,
  recordPositiveVerification,
  recordNegativeVerification,
  getConfidenceRecord,
  getAssetConfidence,
  getBatchConfidence,
  filterByMinGrade,
  getConfidenceStats,
  resetConfidenceStore,
  CONFIDENCE_PARAMS,
  CONFIDENCE_GRADE_THRESHOLDS,
  ConfidenceGrade,
} from '../src/assets/confidence';

describe('Confidence Decay Model', () => {
  beforeEach(() => {
    // Freeze time to 2026-03-28T00:00:00Z so that records with published_at
    // "2026-03-28T00:00:00Z" have exactly 0 daysSincePublish and decay does not
    // shift grades across threshold boundaries during the test.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-28T00:00:00Z'));
    resetConfidenceStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('calculateConfidence', () => {
    it('returns initial confidence for a brand new asset (0 days)', () => {
      const score = calculateConfidence('asset_001', 80, { daysSincePublish: 0 });
      expect(score.initial_confidence).toBe(80);
      expect(score.current_confidence).toBe(80);
      expect(score.days_since_publish).toBe(0);
      expect(score.grade).toBe('A');
      expect(score.positive_count).toBe(0);
      expect(score.negative_count).toBe(0);
    });

    it('applies natural exponential decay over time (half-life = 30 days)', () => {
      // At 30 days, confidence should be ~50% of original
      const score = calculateConfidence('asset_002', 80, { daysSincePublish: 30 });
      // e^(-ln(2) * 30/30) = e^(-ln(2)) = 0.5
      // 80 * 0.5 * 1.0 * 1.0 = 40
      expect(score.natural_decay_ratio).toBeCloseTo(0.5, 2);
      expect(score.current_confidence).toBeCloseTo(40, 0);
      expect(score.grade).toBe('C'); // 40/100 = 0.4 → grade C
    });

    it('applies stronger decay at 60 days', () => {
      const score = calculateConfidence('asset_003', 80, { daysSincePublish: 60 });
      // e^(-ln(2) * 60/30) = e^(-2*ln(2)) = 0.25
      // 80 * 0.25 = 20
      expect(score.natural_decay_ratio).toBeCloseTo(0.25, 2);
      expect(score.current_confidence).toBeCloseTo(20, 0);
    });

    it('enhances confidence with positive verifications', () => {
      const scoreNoBoost = calculateConfidence('asset_004', 60, {
        daysSincePublish: 0,
        positiveCount: 0,
      });
      const scoreWithBoost = calculateConfidence('asset_004', 60, {
        daysSincePublish: 0,
        positiveCount: 4, // +5% each → 20% boost
      });
      // 60 * 1.0 * (1 + 0.05*4) * 1.0 = 60 * 1.2 = 72
      expect(scoreWithBoost.positive_boost).toBeCloseTo(1.2, 2);
      expect(scoreWithBoost.current_confidence).toBeGreaterThan(scoreNoBoost.current_confidence);
    });

    it('applies penalty for negative verifications', () => {
      const scoreNoPenalty = calculateConfidence('asset_005', 60, {
        daysSincePublish: 0,
        negativeCount: 0,
      });
      const scoreWithPenalty = calculateConfidence('asset_005', 60, {
        daysSincePublish: 0,
        negativeCount: 2, // -15% each → 30% penalty
      });
      // 60 * 1.0 * 1.0 * (1 - 0.15*2) = 60 * 0.7 = 42
      expect(scoreWithPenalty.negative_penalty).toBeCloseTo(0.7, 2);
      expect(scoreWithPenalty.current_confidence).toBeLessThan(scoreNoPenalty.current_confidence);
    });

    it('never drops below floor ratio (10%)', () => {
      // 6 negative verifications would normally give 1 - 0.9 = 0.1, floor prevents lower
      const score = calculateConfidence('asset_006', 80, {
        daysSincePublish: 0,
        negativeCount: 20,
      });
      expect(score.negative_penalty).toBeGreaterThanOrEqual(0.1);
      expect(score.current_confidence).toBeGreaterThanOrEqual(0);
    });

    it('projects confidence at 7, 14, 30 days forward', () => {
      const score = calculateConfidence('asset_007', 80, { daysSincePublish: 0 });
      expect(score.projected_confidence_7d).toBeLessThan(score.current_confidence);
      expect(score.projected_confidence_14d).toBeLessThan(score.projected_confidence_7d);
      expect(score.projected_confidence_30d).toBeLessThan(score.projected_confidence_14d);
    });

    it('combines decay + positive + negative factors correctly', () => {
      // 30 days (0.5x decay), 2 positive (+10%), no negative
      const score = calculateConfidence('asset_008', 80, {
        daysSincePublish: 30,
        positiveCount: 2,
        negativeCount: 0,
      });
      // 80 * 0.5 * 1.1 * 1.0 = 44
      expect(score.current_confidence).toBeCloseTo(44, 0);
    });
  });

  describe('computeGrade', () => {
    it.each`
      score   | expected
      ${95} | ${'A+'}
      ${90} | ${'A+'}
      ${89} | ${'A'}
      ${70} | ${'A'}
      ${69} | ${'B'}
      ${50} | ${'B'}
      ${49} | ${'C'}
      ${30} | ${'C'}
      ${29} | ${'D'}
      ${10} | ${'D'}
      ${9}  | ${'F'}
      ${0}  | ${'F'}
    `('score $score → grade $expected', ({ score, expected }) => {
      expect(computeGrade(score)).toBe(expected);
    });
  });

  describe('gradeAllowedOps', () => {
    it('A+ allows all operations including governance and high-difficulty tasks', () => {
      const ops = gradeAllowedOps('A+');
      expect(ops).toContain('all');
      expect(ops).toContain('governance_vote');
      expect(ops).toContain('high_difficulty_task');
    });

    it('D only allows self-use', () => {
      const ops = gradeAllowedOps('D');
      expect(ops).toEqual(['self_use_only']);
    });

    it('F assets are archived', () => {
      const ops = gradeAllowedOps('F');
      expect(ops).toEqual(['archived']);
    });
  });

  describe('Confidence Record Management', () => {
    it('initializes a confidence record on publish', () => {
      const record = initConfidence('asset_100', 75);
      expect(record.asset_id).toBe('asset_100');
      expect(record.initial_confidence).toBe(75);
      expect(record.positive_count).toBe(0);
      expect(record.negative_count).toBe(0);
    });

    it('increments positive count on positive verification', () => {
      initConfidence('asset_101', 70);
      recordPositiveVerification('asset_101');
      recordPositiveVerification('asset_101');
      const record = getConfidenceRecord('asset_101');
      expect(record?.positive_count).toBe(2);
    });

    it('increments negative count on negative verification', () => {
      initConfidence('asset_102', 70);
      recordNegativeVerification('asset_102');
      const record = getConfidenceRecord('asset_102');
      expect(record?.negative_count).toBe(1);
    });

    it('returns null for unknown asset on verification', () => {
      const result = recordPositiveVerification('unknown_asset');
      expect(result).toBeNull();
    });
  });

  describe('Batch Operations', () => {
    it('calculates batch confidence for multiple assets', () => {
      const records = [
        makeFakeRecord('a1', 80, '2026-03-28T00:00:00Z'),
        makeFakeRecord('a2', 50, '2026-03-28T00:00:00Z'),
      ];
      const scores = getBatchConfidence(records);
      expect(scores).toHaveLength(2);
      expect(scores[0].asset_id).toBe('a1');
      expect(scores[1].asset_id).toBe('a2');
    });

    it('filters assets by minimum grade', () => {
      // Use a date very close to "now" so decay is negligible (< 0.1 days)
      // This ensures GDI 90 → A+, GDI 75 → A, GDI 55 → B as the comments state
      const today = new Date();
      today.setMinutes(today.getMinutes() - 5);
      const nearNow = today.toISOString();
      const records = [
        makeFakeRecord('a1', 90, nearNow), // A+
        makeFakeRecord('a2', 75, nearNow), // A
        makeFakeRecord('a3', 55, nearNow), // B
      ];
      // 90 → A+, 75 → A, 55 → B
      const filtered = filterByMinGrade(records, 'A');
      expect(filtered).toHaveLength(2);
      expect(filtered.map(r => r.asset.id)).toEqual(['a1', 'a2']);
    });
  });

  describe('getConfidenceStats', () => {
    it('returns zero counts for empty store', () => {
      const stats = getConfidenceStats();
      expect(stats.total_tracked).toBe(0);
      expect(stats.avg_confidence).toBe(0);
      expect(Object.values(stats.grade_distribution).every(v => v === 0)).toBe(true);
    });

    it('accumulates stats from tracked assets', () => {
      initConfidence('x1', 95); // A+
      initConfidence('x2', 65); // B
      initConfidence('x3', 35); // C
      const stats = getConfidenceStats();
      expect(stats.total_tracked).toBe(3);
      expect(stats.grade_distribution['A+']).toBe(1);
      expect(stats.grade_distribution['B']).toBe(1);
      expect(stats.grade_distribution['C']).toBe(1);
    });
  });

  describe('Parameters', () => {
    it('exposes correct decay parameters', () => {
      expect(CONFIDENCE_PARAMS.half_life_days).toBe(30);
      expect(CONFIDENCE_PARAMS.positive_factor).toBe(0.05);
      expect(CONFIDENCE_PARAMS.negative_factor).toBe(0.15);
      expect(CONFIDENCE_PARAMS.floor_ratio).toBe(0.1);
    });
  });
});

// ============ Test Helpers ============

function makeFakeRecord(assetId: string, gdiTotal: number, publishedAt: string) {
  return {
    asset: { type: 'Gene' as const, id: assetId, asset_id: `sha_${assetId}`, schema_version: '1.5', category: 'repair' as const, signals_match: [], strategy: [], constraints: {}, created_at: publishedAt },
    status: 'active' as const,
    owner_id: 'test_node',
    gdi: { intrinsic: 80, usage: 80, social: 80, freshness: 80, total: gdiTotal },
    fetch_count: 0,
    report_count: 0,
    published_at: publishedAt,
    updated_at: publishedAt,
    version: 1,
  };
}
