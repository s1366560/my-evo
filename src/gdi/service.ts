/**
 * GDI (Genetic Diversity Index) Scoring Engine Service
 * 5-dimension model: structural, semantic, specificity, strategy, validation.
 * 
 * Performance optimizations:
 * - In-memory caching for computed scores
 * - Batch scoring support
 * - Configurable confidence thresholds
 */
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_GDI_WEIGHTS,
  DEFAULT_GDI_CONFIG,
  STRUCTURAL_SCORE_BENCHMARKS,
  SEMANTIC_SCORE_BENCHMARKS,
  SPECIFICITY_SCORE_BENCHMARKS,
  STRATEGY_SCORE_BENCHMARKS,
  VALIDATION_SCORE_BENCHMARKS,
} from './types';
import type {
  AssetForScoring,
  GDIDimensions,
  GDIScoreResult,
  GDIScoreMetadata,
  GDIWeights,
  ScoreRequest,
} from './types';
import { MemoryCache, CACHE_TTL, cacheKeys } from '../shared/cache';

let prisma = new PrismaClient();

// ===== PERFORMANCE: GDI Score Cache =====
const gdiScoreCache = new MemoryCache(500);

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

export function textSimilarity(text1: string, text2: string): number {
  if (!text1 && !text2) return 1.0;
  if (!text1 || !text2) return 0.0;
  const tok = (t: string) =>
    new Set(t.toLowerCase().split(/\s+/).filter((x) => x.length > 0));
  const s1 = tok(text1), s2 = tok(text2);
  const inter = new Set([...s1].filter((x) => s2.has(x)));
  const union = new Set([...s1, ...s2]);
  return union.size === 0 ? 0 : inter.size / union.size;
}

function weightedScore(dimensions: GDIDimensions, weights: GDIWeights): number {
  return (
    dimensions.structural * weights.structural +
    dimensions.semantic * weights.semantic +
    dimensions.specificity * weights.specificity +
    dimensions.strategy * weights.strategy +
    dimensions.validation * weights.validation
  );
}

function computeConfidence(asset: AssetForScoring): number {
  const sig = clamp01(asset.signals.length / STRUCTURAL_SCORE_BENCHMARKS.max_signals);
  const val = asset.validation_results ? clamp01(asset.validation_results.length / 5) : 0.3;
  return clamp01(sig * 0.6 + val * 0.4);
}

function calculateStructuralScore(asset: AssetForScoring): number {
  const len = asset.content ? asset.content.length : 0;
  let lengthScore = 0;
  if (len >= STRUCTURAL_SCORE_BENCHMARKS.min_content_length) {
    const ideal = STRUCTURAL_SCORE_BENCHMARKS.ideal_content_length;
    lengthScore = len <= ideal
      ? 60 * (len / ideal)
      : clamp(60 - ((len - ideal) / STRUCTURAL_SCORE_BENCHMARKS.max_content_length) * 10, 50, 60);
  }
  const signalScore = clamp(asset.signals.length * 2, 0, 20);
  let qualityScore = 0;
  if (asset.content) {
    if (/\b(export|import|module|class|function|const|async|interface|type)\b/gi.test(asset.content)) {
      qualityScore += STRUCTURAL_SCORE_BENCHMARKS.module_bonus;
    }
    if (/\b(@param|@returns)/gi.test(asset.content ?? '') || /\/\*\*|\/\/\//.test(asset.content ?? '')) {
      qualityScore += STRUCTURAL_SCORE_BENCHMARKS.documentation_bonus;
    }
  }
  return clamp(lengthScore + signalScore + qualityScore, 0, 100);
}

function calculateSemanticScore(asset: AssetForScoring): number {
  const nameLen = asset.name.trim().length;
  const descLen = asset.description.trim().length;
  const nameScore = nameLen >= SEMANTIC_SCORE_BENCHMARKS.name_min_length
    ? (nameLen <= SEMANTIC_SCORE_BENCHMARKS.name_max_length ? 25 : 10) : 0;
  const descScore = descLen >= SEMANTIC_SCORE_BENCHMARKS.description_min_length
    ? clamp(descLen / 200 * 40, 0, 40) : 0;
  let alignScore = 0;
  if (asset.signals.length > 0 && asset.content) {
    const lower = asset.content.toLowerCase();
    const matched = asset.signals.filter((s) => lower.includes(s.toLowerCase())).length;
    alignScore = clamp((matched / asset.signals.length) * 30, 0, 35);
  }
  return clamp(nameScore + descScore + alignScore, 0, 100);
}

function calculateSpecificityScore(asset: AssetForScoring, existing: AssetForScoring[] = []): number {
  let score = 50;
  const uniq = new Set(asset.signals.map((s) => s.toLowerCase())).size;
  score += uniq >= SPECIFICITY_SCORE_BENCHMARKS.min_unique_signals
    ? clamp(uniq * 5, 0, 40)
    : -clamp((SPECIFICITY_SCORE_BENCHMARKS.min_unique_signals - uniq) * 10, 0, 20);
  if (asset.ancestors.length === 0 && asset.parent_id === null) {
    score += SPECIFICITY_SCORE_BENCHMARKS.novelty_bonus;
  }
  score -= clamp(asset.ancestors.length * SPECIFICITY_SCORE_BENCHMARKS.ancestor_penalty, 0, SPECIFICITY_SCORE_BENCHMARKS.max_ancestor_penalty);
  score += clamp(asset.fork_count * SPECIFICITY_SCORE_BENCHMARKS.fork_bonus, 0, SPECIFICITY_SCORE_BENCHMARKS.max_fork_bonus);
  if (asset.content && existing.length > 0) {
    const sims = existing.filter((a) => a.content && a.asset_id !== asset.asset_id)
      .map((a) => textSimilarity(asset.content!, a.content!));
    const avg = sims.length > 0 ? sims.reduce((a, b) => a + b, 0) / sims.length : 0;
    score -= avg * 20;
  }
  return clamp(score, 0, 100);
}

function calculateStrategyScore(asset: AssetForScoring): number {
  const cfg = STRATEGY_SCORE_BENCHMARKS;
  const costRatio = asset.carbon_cost / cfg.ideal_carbon_cost;
  const costScore = costRatio <= 1 ? 25 : clamp(25 / costRatio, 5, 25);
  const versionBonus = clamp(asset.version * cfg.version_bonus, 0, cfg.max_version_bonus);
  let configPenalty = 0;
  if (asset.config && typeof asset.config === 'object') {
    configPenalty = clamp(Object.keys(asset.config).length * cfg.config_complexity_penalty, 0, 15);
  }
  const typePenalty = cfg.type_penalty[asset.asset_type] ?? 0;
  return clamp(50 + costScore + versionBonus - configPenalty - typePenalty, 0, 100);
}

function calculateValidationScore(asset: AssetForScoring): number {
  const cfg = VALIDATION_SCORE_BENCHMARKS;
  let coverageScore = 0;
  if (asset.test_coverage !== undefined) {
    const cov = clamp01(asset.test_coverage);
    if (cov >= cfg.ideal_test_coverage) coverageScore = 60;
    else if (cov >= cfg.min_test_coverage) coverageScore = clamp(cov * 60 / cfg.ideal_test_coverage, 0, 60);
  }
  let validationScore = 0;
  if (asset.validation_results && asset.validation_results.length > 0) {
    let total = 0, weighted = 0;
    for (const r of asset.validation_results) {
      let s = r.passed ? r.score : 0;
      if (!r.passed) {
        if (r.type === 'syntax') s -= cfg.syntax_penalty;
        else if (r.type === 'security') s -= cfg.security_penalty;
      } else if (r.type === 'benchmark') {
        s = Math.min(100, s + cfg.benchmark_bonus);
      }
      weighted += s; total += 100;
    }
    validationScore = (weighted / total) * 40;
  } else {
    validationScore = 20;
  }
  return clamp(coverageScore + validationScore, 0, 100);
}

// ===== Batch Scoring =====

export interface BatchScoreResult {
  scores: GDIScoreResult[];
  failed: Array<{ asset_id: string; error: string }>;
  calculated_at: string;
}

export async function batchScoreAssets(
  request: { assets: AssetForScoring[]; customWeights?: Partial<GDIWeights> },
): Promise<BatchScoreResult> {
  const weights: GDIWeights = request.customWeights
    ? { ...DEFAULT_GDI_WEIGHTS, ...request.customWeights }
    : DEFAULT_GDI_WEIGHTS;

  const scores: GDIScoreResult[] = [];
  const failed: Array<{ asset_id: string; error: string }> = [];

  for (const asset of request.assets) {
    // ===== PERFORMANCE: Check cache first =====
    const cacheKey = cacheKeys.gdiScore(asset.asset_id);
    const cached = gdiScoreCache.get<GDIScoreResult>(cacheKey);
    if (cached) {
      scores.push(cached);
      continue;
    }

    try {
      const result = calculateGDIScore({ asset, customWeights: weights });
      // Cache the result
      gdiScoreCache.set(cacheKey, result, CACHE_TTL.GDI_SCORES);
      scores.push(result);
    } catch (err) {
      failed.push({ asset_id: asset.asset_id, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return { scores, failed, calculated_at: new Date().toISOString() };
}

// ===== Score History =====

export async function getGDIScoreHistory(assetId: string): Promise<{ asset_id: string; history: Array<{ overall: number; calculated_at: string }> } | null> {
  try {
    const records = await (prisma as any).gDIScoreRecord.findMany({
      where: { asset_id: assetId },
      orderBy: { calculated_at: 'asc' },
      select: { overall: true, calculated_at: true },
    });
    if (!records || records.length === 0) return null;
    return { asset_id: assetId, history: records };
  } catch {
    // Prisma table may not exist (no migration run); return null gracefully
    return null;
  }
}

// ===== Config / Weights =====

export function getGDIConfig() {
  return DEFAULT_GDI_CONFIG;
}

export function getGDIWeights() {
  return DEFAULT_GDI_WEIGHTS;
}

export { calculateSpecificityScore, calculateStrategyScore, calculateValidationScore };

export function calculateDimensions(
  asset: AssetForScoring,
  existingAssets: AssetForScoring[] = [],
): GDIDimensions {
  return {
    structural: calculateStructuralScore(asset),
    semantic: calculateSemanticScore(asset),
    specificity: calculateSpecificityScore(asset, existingAssets),
    strategy: calculateStrategyScore(asset),
    validation: calculateValidationScore(asset),
  };
}

export function calculateGDIScore(request: ScoreRequest): GDIScoreResult {
  // ===== PERFORMANCE: Check cache for non-custom weighted requests =====
  if (!request.customWeights) {
    const cacheKey = cacheKeys.gdiScore(request.asset.asset_id);
    const cached = gdiScoreCache.get<GDIScoreResult>(cacheKey);
    if (cached) return cached;
  }

  const { asset, customWeights, existingAssets = [] } = request;
  const weights: GDIWeights = customWeights
    ? { ...DEFAULT_GDI_WEIGHTS, ...customWeights }
    : DEFAULT_GDI_WEIGHTS;

  const dimensions = calculateDimensions(asset, existingAssets);
  const overall = weightedScore(dimensions, weights);
  const confidence = computeConfidence(asset);
  const gdi_lower = clamp(overall * (0.7 + 0.3 * confidence), 0, 100);

  const now = new Date();
  const createdAt = typeof asset.created_at === 'string'
    ? new Date(asset.created_at) : asset.created_at;
  const ageDays = Math.max(0, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  const metadata: GDIScoreMetadata = {
    content_length: asset.content ? asset.content.length : 0,
    signal_count: asset.signals.length,
    unique_signals: new Set(asset.signals.map((s) => s.toLowerCase())).size,
    validation_passed: asset.validation_results?.filter((r) => r.passed).length ?? 0,
    validation_total: asset.validation_results?.length ?? 0,
    lineage_depth: asset.ancestors.length,
    fork_count: asset.fork_count,
    age_days: Math.round(ageDays * 10) / 10,
  };

  const result: GDIScoreResult = {
    asset_id: asset.asset_id,
    asset_type: asset.asset_type,
    overall: clamp(overall, 0, 100),
    dimensions,
    weights,
    confidence,
    gdi_mean: clamp(overall, 0, 100),
    gdi_lower: clamp(gdi_lower, 0, 100),
    calculated_at: now.toISOString(),
    metadata,
  };

  // ===== PERFORMANCE: Cache result if using default weights =====
  if (!customWeights) {
    const cacheKey = cacheKeys.gdiScore(asset.asset_id);
    gdiScoreCache.set(cacheKey, result, CACHE_TTL.GDI_SCORES);
  }

  return result;
}
