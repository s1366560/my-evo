/**
 * GDI Scoring Tests
 * Phase 2: Asset System
 */

import { describe, it, expect } from '@jest/globals';
import { calculateGDI, assetAgeDays, shouldPromote, calculateCarbonCost, getFetchRewardTier, getReportReward } from '../src/assets/gdi';
import { Gene, Capsule, EvolutionEvent } from '../src/assets/types';

// Helper to build a minimal gene
function makeGene(overrides: Partial<Gene> = {}): Gene {
  return {
    type: 'Gene',
    schema_version: '1.0.0',
    id: 'test_gene',
    asset_id: 'sha_test_gene',
    category: 'optimize',
    signals_match: ['signal_a', 'signal_b'],
    preconditions: ['precond_1'],
    strategy: ['step_1', 'step_2', 'step_3'],
    constraints: { max_files: 5, forbidden_paths: ['/tmp'] },
    validation: ['npm test', 'npm run lint'],
    epigenetic_marks: ['mark_1'],
    model_name: 'claude-sonnet-4',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeCapsule(overrides: Partial<Capsule> = {}): Capsule {
  return {
    type: 'Capsule',
    schema_version: '1.0.0',
    id: 'test_capsule',
    asset_id: 'sha_test_capsule',
    trigger: ['trigger_1'],
    gene: 'test_gene',
    summary: 'A test capsule that does something useful',
    content: 'console.log("hello")',
    strategy: ['strategy_a'],
    confidence: 0.85,
    blast_radius: { files: 3, lines: 50 },
    outcome: { status: 'success', score: 0.9 },
    success_streak: 3,
    env_fingerprint: { platform: 'linux', arch: 'x64' },
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('calculateGDI', () => {
  it('should calculate GDI for a gene with all fields', () => {
    const gene = makeGene();
    const gdi = calculateGDI(gene, { fetchCount: 10, reportCount: 2 });
    expect(gdi.total).toBeGreaterThan(0);
    expect(gdi.total).toBeLessThanOrEqual(100);
    expect(gdi.intrinsic).toBeGreaterThan(0);
    expect(gdi.usage).toBeGreaterThan(0);
    expect(gdi.social).toBeGreaterThan(0);
    expect(gdi.freshness).toBe(100); // new asset
  });

  it('should calculate GDI for a capsule', () => {
    const capsule = makeCapsule();
    const gdi = calculateGDI(capsule, { fetchCount: 5, reportCount: 1 });
    expect(gdi.total).toBeGreaterThan(0);
    expect(gdi.total).toBeLessThanOrEqual(100);
  });

  it('should apply freshness decay for older assets', () => {
    const oldGene = makeGene({ created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() }); // 14 days old
    const gdi = calculateGDI(oldGene, { fetchCount: 10, reportCount: 2 });
    // 14 days = 2 half-lives, so freshness ≈ 100 * (0.5)^2 = 25
    expect(gdi.freshness).toBeLessThan(50);
    expect(gdi.freshness).toBeGreaterThan(0);
  });

  it('should use log scale for high fetch counts', () => {
    const gene = makeGene();
    const gdiLow = calculateGDI(gene, { fetchCount: 1, reportCount: 0 });
    const gdiHigh = calculateGDI(gene, { fetchCount: 1000, reportCount: 0 });
    expect(gdiHigh.usage).toBeGreaterThan(gdiLow.usage);
    // log(1001) * 15 ≈ 69, capped at 80
    expect(gdiHigh.usage).toBeLessThanOrEqual(80);
  });

  it('should cap social score at 100', () => {
    const gene = makeGene();
    const gdi = calculateGDI(gene, { fetchCount: 10000, reportCount: 100 });
    expect(gdi.social).toBeLessThanOrEqual(100);
  });

  it('should return valid scores when fetchCount and reportCount are both zero', () => {
    const gene = makeGene();
    const gdi = calculateGDI(gene, { fetchCount: 0, reportCount: 0 });
    expect(gdi.total).toBeGreaterThan(0);
    expect(gdi.usage).toBe(0); // no fetches
    // social base from 0 fetches + 0 reports + status bonus (no record)
    expect(gdi.social).toBeGreaterThanOrEqual(0);
    expect(gdi.freshness).toBe(100); // brand new
  });
});

describe('shouldPromote', () => {
  it('should promote assets with GDI >= 60', () => {
    expect(shouldPromote({ intrinsic: 60, usage: 60, social: 60, freshness: 60, total: 60 })).toBe(true);
  });

  it('should not promote assets with GDI < 60', () => {
    expect(shouldPromote({ intrinsic: 50, usage: 50, social: 50, freshness: 50, total: 59 })).toBe(false);
  });
});

describe('calculateCarbonCost', () => {
  it('should return base cost for Gene', () => {
    const gene = makeGene();
    expect(calculateCarbonCost(gene)).toBe(2);
  });

  it('should return higher cost for Capsule with large blast radius', () => {
    const capsule = makeCapsule({ blast_radius: { files: 10, lines: 100 } });
    const cost = calculateCarbonCost(capsule);
    expect(cost).toBeGreaterThan(3); // base 3 + blast radius
  });

  it('should return 1 for EvolutionEvent', () => {
    const event: EvolutionEvent = {
      type: 'EvolutionEvent',
      id: 'evt_1',
      asset_id: 'sha_evt',
      intent: 'test',
      signals: [],
      genes_used: ['gene_1'],
      blast_radius: { files: 1, lines: 5 },
      outcome: { status: 'success', score: 0.8 },
      source_type: 'generated',
      created_at: new Date().toISOString(),
    };
    expect(calculateCarbonCost(event)).toBe(1);
  });
});

describe('getFetchRewardTier', () => {
  it('should return tier 1 for GDI >= 75', () => {
    expect(getFetchRewardTier({ intrinsic: 80, usage: 80, social: 80, freshness: 80, total: 80 })).toEqual({ tier: 1, reward: 12 });
  });

  it('should return tier 2 for GDI 50-74', () => {
    expect(getFetchRewardTier({ intrinsic: 60, usage: 60, social: 60, freshness: 60, total: 60 })).toEqual({ tier: 2, reward: 8 });
  });

  it('should return tier 3 for GDI < 50', () => {
    expect(getFetchRewardTier({ intrinsic: 40, usage: 40, social: 40, freshness: 40, total: 40 })).toEqual({ tier: 3, reward: 3 });
  });
});

describe('getReportReward', () => {
  it('should return 30 for large blast radius', () => {
    // size = 25 + 500/50 = 35 > 20 → large
    expect(getReportReward({ files: 25, lines: 500 })).toBe(30);
  });

  it('should return 20 for medium blast radius', () => {
    expect(getReportReward({ files: 8, lines: 50 })).toBe(20);
  });

  it('should return 10 for small blast radius', () => {
    expect(getReportReward({ files: 2, lines: 10 })).toBe(10);
  });
});

describe('assetAgeDays', () => {
  it('should return near-zero for brand new asset', () => {
    const gene = makeGene({ created_at: new Date().toISOString() });
    expect(assetAgeDays(gene)).toBeLessThan(1);
  });

  it('should return approximately 7 days for 7-day-old asset', () => {
    const gene = makeGene({ created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() });
    expect(assetAgeDays(gene)).toBeGreaterThanOrEqual(7);
    expect(assetAgeDays(gene)).toBeLessThan(8);
  });
});
