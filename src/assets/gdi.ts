/**
 * GDI Scoring Algorithm (Global Desirability Index)
 * Phase 2: Asset System
 * 
 * Four dimensions:
 * - Intrinsic (35%): structural completeness, semantic quality, strategy depth
 * - Usage (30%): fetch count, validation reports
 * - Social (20%): votes, discussion participation
 * - Freshness (15%): time decay factor
 */

import { Asset, GDIScore, Gene, Capsule, EvolutionEvent } from './types';
import { getAsset } from './store';

// Weights
const W_INTRINSIC = 0.35;
const W_USAGE = 0.30;
const W_SOCIAL = 0.20;
const W_FRESHNESS = 0.15;

// Freshness half-life: 7 days
const FRESHNESS_HALF_LIFE_DAYS = 7;

// Min/Max for normalization
const MIN_REPORTS = 0;
const MAX_REPORTS = 100; // normalized ceiling

/**
 * Calculate GDI score for an asset
 */
export function calculateGDI(asset: Asset, options?: {
  fetchCount?: number;
  reportCount?: number;
  ageDays?: number;
}): GDIScore {
  const fetchCount = options?.fetchCount ?? 0;
  const reportCount = options?.reportCount ?? 0;
  const ageDays = options?.ageDays ?? assetAgeDays(asset);

  const intrinsic = calculateIntrinsic(asset);
  const usage = calculateUsage(fetchCount, reportCount);
  const social = calculateSocial(asset, fetchCount, reportCount);
  const freshness = calculateFreshness(ageDays);

  const total = Math.min(100,
    intrinsic * W_INTRINSIC +
    usage * W_USAGE +
    social * W_SOCIAL +
    freshness * W_FRESHNESS
  );

  return {
    intrinsic: Math.round(intrinsic * 100) / 100,
    usage: Math.round(usage * 100) / 100,
    social: Math.round(social * 100) / 100,
    freshness: Math.round(freshness * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * Intrinsic quality score (0-100)
 * Based on structural completeness and semantic quality
 */
function calculateIntrinsic(asset: Asset): number {
  if (asset.type === 'Gene') {
    return calculateGeneIntrinsic(asset as Gene);
  } else if (asset.type === 'Capsule') {
    return calculateCapsuleIntrinsic(asset as Capsule);
  } else if (asset.type === 'EvolutionEvent') {
    return calculateEventIntrinsic(asset as EvolutionEvent);
  }
  // Default for other types
  return 50;
}

function calculateGeneIntrinsic(gene: Gene): number {
  let score = 0;
  let max = 0;

  // signals_match (up to 20)
  max += 20;
  score += Math.min(20, gene.signals_match.length * 4);

  // strategy (up to 25)
  max += 25;
  score += Math.min(25, gene.strategy.length * 5);

  // validation commands (up to 20)
  max += 20;
  score += Math.min(20, (gene.validation?.length ?? 0) * 7);

  // constraints defined (up to 15)
  max += 15;
  if (gene.constraints && Object.keys(gene.constraints).length > 0) {
    score += 10;
    if (gene.constraints.max_files) score += 3;
    if (gene.constraints.forbidden_paths?.length) score += 2;
  }

  // preconditions (up to 10)
  max += 10;
  score += Math.min(10, (gene.preconditions?.length ?? 0) * 3);

  // epigenetic_marks (up to 10)
  max += 10;
  score += Math.min(10, (gene.epigenetic_marks?.length ?? 0) * 3);

  return (score / max) * 100;
}

function calculateCapsuleIntrinsic(capsule: Capsule): number {
  let score = 50; // base

  // confidence bonus (up to +20)
  score += capsule.confidence * 20;

  // blast_radius penalty (smaller is better)
  const blastScore = Math.max(0, 20 - (capsule.blast_radius.files + capsule.blast_radius.lines / 10));
  score += blastScore;

  // outcome score (up to +15)
  score += capsule.outcome.score * 15;

  // has diff (+5)
  if (capsule.diff) score += 5;

  // has trigger_context (+5)
  if (capsule.trigger_context) score += 5;

  // success_streak bonus (up to +5)
  score += Math.min(5, (capsule.success_streak ?? 0) * 1);

  return Math.min(100, Math.max(0, score));
}

function calculateEventIntrinsic(event: EvolutionEvent): number {
  let score = 40; // base

  // has parent reference (+15)
  if (event.parent) score += 15;

  // genes_used count (up to +20)
  score += Math.min(20, event.genes_used.length * 5);

  // has mutation_id (+10)
  if (event.mutation_id) score += 10;

  // outcome bonus (up to +15)
  score += event.outcome.score * 15;

  return Math.min(100, Math.max(0, score));
}

/**
 * Usage score (0-100)
 * Based on fetch count and validation reports
 */
function calculateUsage(fetchCount: number, reportCount: number): number {
  // Normalize fetch count (log scale, max at 1000 fetches = 80)
  const fetchScore = Math.min(80, Math.log1p(fetchCount) * 15);

  // Report score (up to 20)
  const normalizedReports = Math.min(reportCount, MAX_REPORTS);
  const reportScore = (normalizedReports / MAX_REPORTS) * 20;

  return Math.min(100, fetchScore + reportScore);
}

/**
 * Social score (0-100)
 * Based on fetch count (adoption signal) and report count (validation signal).
 * Both indicate community engagement with the asset.
 */
function calculateSocial(asset: Asset, fetchCount: number, reportCount: number): number {
  // Fetch adoption signal (up to 40 points)
  // High fetch count = widely used = strong social endorsement
  const fetchScore = Math.min(40, Math.log1p(fetchCount) * 8);

  // Validation report signal (up to 35 points)
  // Reports indicate active quality monitoring
  const reportScore = Math.min(35, reportCount * 10);

  // Combined base score (up to 75)
  const baseSocial = fetchScore + reportScore;

  // Status bonus for lifecycle stage
  const record = getAsset(asset.asset_id);
  let statusBonus = 0;
  if (record) {
    if (record.status === 'active') statusBonus = 20;
    else if (record.status === 'promoted') statusBonus = 15;
    else if (record.status === 'candidate') statusBonus = 10;
  }

  return Math.min(100, baseSocial + statusBonus);
}

/**
 * Freshness score (0-100)
 * Exponential decay with half-life of FRESHNESS_HALF_LIFE_DAYS
 */
function calculateFreshness(ageDays: number): number {
  const decayConstant = Math.LN2 / FRESHNESS_HALF_LIFE_DAYS;
  return Math.max(0, 100 * Math.exp(-decayConstant * ageDays));
}

/**
 * Calculate asset age in days
 */
export function assetAgeDays(asset: Asset): number {
  const created = new Date(asset.created_at).getTime();
  const now = Date.now();
  return (now - created) / (1000 * 60 * 60 * 24);
}

/**
 * Check if asset should be promoted based on GDI
 */
export function shouldPromote(gdi: GDIScore): boolean {
  return gdi.total >= 60;
}

/**
 * Calculate carbon cost for publishing
 * Based on asset type and size
 */
export function calculateCarbonCost(asset: Asset): number {
  let baseCost = 2; // base cost

  if (asset.type === 'Capsule') {
    const capsule = asset as Capsule;
    baseCost = 3; // capsules cost more
    // Additional cost based on blast radius
    baseCost += Math.min(5, capsule.blast_radius.files * 0.5);
  } else if (asset.type === 'EvolutionEvent') {
    baseCost = 1; // events are cheap
  }

  return Math.ceil(baseCost);
}

/**
 * Get reward tier for fetch
 */
export function getFetchRewardTier(gdi: GDIScore): {
  tier: 1 | 2 | 3;
  reward: number;
} {
  if (gdi.total >= 75) return { tier: 1, reward: 12 };
  if (gdi.total >= 50) return { tier: 2, reward: 8 };
  return { tier: 3, reward: 3 };
}

/**
 * Get report reward based on blast radius
 */
export function getReportReward(blastRadius: { files: number; lines: number }): number {
  const size = blastRadius.files + blastRadius.lines / 50;
  if (size > 20) return 30; // large impact
  if (size > 5) return 20;  // medium
  return 10;                // small
}
