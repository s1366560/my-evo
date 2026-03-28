/**
 * Confidence Decay Model
 * Chapter 28: Anti-Hallucination — Dynamic Asset Confidence Tracking
 *
 * C(t) = C₀ × e^(-λ·Δt) × (1 + α·n_positive) × (1 - β·n_negative)
 *
 * - C₀: initial confidence (GDI score at publish time)
 * - λ:  decay constant (half-life 30 days by default)
 * - Δt: days since publication
 * - n_positive: count of positive verifications
 * - n_negative: count of negative verifications
 * - α: positive enhancement factor (0.05)
 * - β: negative decay factor (0.15)
 *
 * Confidence grades:
 *   A+ (0.9-1.0): 🟢极高 — full operations
 *   A  (0.7-0.9): 🟢高   — full operations, high-difficulty tasks
 *   B  (0.5-0.7): 🟡中等 — basic operations, standard tasks
 *   C  (0.3-0.5): 🟠低   — limited operations, extra verification required
 *   D  (0.1-0.3): 🔴极低 — self-use only, no sharing
 *   F  (<0.1):    ⚫失效 — auto-archived, marked as failure case
 */

import { AssetRecord } from './types';

// ============ Configuration ============

/** Decay half-life in days (default 30 days → 50% confidence after 30 days) */
export const CONFIDENCE_HALF_LIFE_DAYS = 30;

/** Decay constant λ = ln(2) / half_life */
export const CONFIDENCE_DECAY_LAMBDA = Math.LN2 / CONFIDENCE_HALF_LIFE_DAYS;

/** Enhancement factor per positive verification */
export const CONFIDENCE_POSITIVE_FACTOR = 0.05; // +5% per positive

/** Decay factor per negative verification */
export const CONFIDENCE_NEGATIVE_FACTOR = 0.15; // -15% per negative

/** Floor for negative factor (confidence never drops below 10% of C₀) */
export const CONFIDENCE_FLOOR_RATIO = 0.10;

// ============ Types ============

export interface ConfidenceRecord {
  asset_id: string;
  initial_confidence: number;    // C₀ — GDI at time of publish
  positive_count: number;       // successful verifications
  negative_count: number;       // failed verifications
  last_verified_at?: string;    // timestamp of last verification
  created_at: string;           // when confidence tracking started
}

export interface ConfidenceScore {
  asset_id: string;
  initial_confidence: number;   // C₀ — GDI score at publish (0-100)
  current_confidence: number;   // C(t) — the live decaying score (0-100)
  grade: ConfidenceGrade;
  grade_label: string;
  days_since_publish: number;
  positive_count: number;
  negative_count: number;
  natural_decay_ratio: number;  // e^(-λΔt) — how much natural decay applied
  positive_boost: number;        // (1 + α·n_positive)
  negative_penalty: number;      // (1 - β·n_negative)
  projected_confidence_7d: number;
  projected_confidence_14d: number;
  projected_confidence_30d: number;
  last_verified_at?: string;
  calculated_at: string;
}

export type ConfidenceGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * Grade thresholds on 0-100 scale (matching GDI)
 * A+: ≥90, A: ≥70, B: ≥50, C: ≥30, D: ≥10, F: <10
 */
export const CONFIDENCE_GRADE_THRESHOLDS: Record<ConfidenceGrade, number> = {
  'A+': 90,
  'A':  70,
  'B':  50,
  'C':  30,
  'D':  10,
  'F':   0,
};

export const CONFIDENCE_GRADE_LABELS: Record<ConfidenceGrade, string> = {
  'A+': '🟢极高',
  'A':  '🟢高',
  'B':  '🟡中等',
  'C':  '🟠低',
  'D':  '🔴极低',
  'F':  '⚫失效',
};

// ============ In-Memory Store ============

const confidenceStore = new Map<string, ConfidenceRecord>();

// ============ Core Calculation ============

/**
 * Calculate the current confidence score for an asset
 */
export function calculateConfidence(
  assetId: string,
  currentGdi: number,
  options?: {
    positiveCount?: number;
    negativeCount?: number;
    publishedAt?: string;
    lastVerifiedAt?: string;
    daysSincePublish?: number;
  }
): ConfidenceScore {
  const positiveCount = options?.positiveCount ?? 0;
  const negativeCount = options?.negativeCount ?? 0;
  const daysSincePublish = options?.daysSincePublish ??
    daysBetween(options?.publishedAt ?? new Date().toISOString(), new Date().toISOString());

  // Natural exponential decay: e^(-λ·Δt)
  // At half-life (30 days), naturalDecay ≈ 0.5 → asset retains ~50% effective quality
  const naturalDecay = Math.exp(-CONFIDENCE_DECAY_LAMBDA * daysSincePublish);

  // Positive enhancement: (1 + α·n_positive)
  // Each positive verification adds 5% to the effective score
  const positiveBoost = 1 + CONFIDENCE_POSITIVE_FACTOR * positiveCount;

  // Negative penalty: max(floor, 1 - β·n_negative)
  // Each negative verification reduces by 15%, floor at 10%
  const negativePenalty = Math.max(
    CONFIDENCE_FLOOR_RATIO,
    1 - CONFIDENCE_NEGATIVE_FACTOR * negativeCount
  );

  // Combined confidence: C₀ × decay × positive × negative
  // C₀ = current GDI score (0-100 scale)
  // Note: no Math.min(1,...) cap needed since GDI≤100 and all factors ≤1.2
  const currentConfidence = Math.max(0,
    currentGdi * naturalDecay * positiveBoost * negativePenalty
  );

  // Determine grade
  const grade = computeGrade(currentConfidence);

  // Project future confidence
  const projectAt = (days: number) => {
    const decay = Math.exp(-CONFIDENCE_DECAY_LAMBDA * (daysSincePublish + days));
    return Math.max(0, currentGdi * decay * positiveBoost * negativePenalty);
  };

  return {
    asset_id: assetId,
    initial_confidence: currentGdi,
    current_confidence: Math.round(currentConfidence * 10000) / 10000,
    grade,
    grade_label: CONFIDENCE_GRADE_LABELS[grade],
    days_since_publish: Math.round(daysSincePublish * 100) / 100,
    positive_count: positiveCount,
    negative_count: negativeCount,
    natural_decay_ratio: Math.round(naturalDecay * 10000) / 10000,
    positive_boost: Math.round(positiveBoost * 10000) / 10000,
    negative_penalty: Math.round(negativePenalty * 10000) / 10000,
    projected_confidence_7d:  Math.round(projectAt(7)  * 10000) / 10000,
    projected_confidence_14d: Math.round(projectAt(14) * 10000) / 10000,
    projected_confidence_30d: Math.round(projectAt(30) * 10000) / 10000,
    last_verified_at: options?.lastVerifiedAt,
    calculated_at: new Date().toISOString(),
  };
}

/**
 * Compute the confidence grade from a 0-1 score
 */
export function computeGrade(score: number): ConfidenceGrade {
  if (score >= CONFIDENCE_GRADE_THRESHOLDS['A+']) return 'A+';
  if (score >= CONFIDENCE_GRADE_THRESHOLDS['A'])  return 'A';
  if (score >= CONFIDENCE_GRADE_THRESHOLDS['B'])  return 'B';
  if (score >= CONFIDENCE_GRADE_THRESHOLDS['C'])  return 'C';
  if (score >= CONFIDENCE_GRADE_THRESHOLDS['D'])  return 'D';
  return 'F';
}

/**
 * Get the allowed operations for a given confidence grade
 */
export function gradeAllowedOps(grade: ConfidenceGrade): string[] {
  switch (grade) {
    case 'A+': return ['all', 'governance_vote', 'high_difficulty_task'];
    case 'A':  return ['all', 'high_difficulty_task'];
    case 'B':  return ['basic', 'standard_task'];
    case 'C':  return ['basic', 'requires_extra_verification'];
    case 'D':  return ['self_use_only'];
    case 'F':  return ['archived'];
  }
}

// ============ Confidence Record Management ============

/**
 * Initialize confidence tracking when an asset is first published
 */
export function initConfidence(assetId: string, gdiScore: number): ConfidenceRecord {
  const record: ConfidenceRecord = {
    asset_id: assetId,
    initial_confidence: gdiScore,
    positive_count: 0,
    negative_count: 0,
    created_at: new Date().toISOString(),
  };
  confidenceStore.set(assetId, record);
  return record;
}

/**
 * Record a positive verification event
 */
export function recordPositiveVerification(assetId: string): ConfidenceRecord | null {
  const record = confidenceStore.get(assetId);
  if (!record) return null;
  record.positive_count++;
  record.last_verified_at = new Date().toISOString();
  return record;
}

/**
 * Record a negative verification event
 */
export function recordNegativeVerification(assetId: string): ConfidenceRecord | null {
  const record = confidenceStore.get(assetId);
  if (!record) return null;
  record.negative_count++;
  record.last_verified_at = new Date().toISOString();
  return record;
}

/**
 * Get the full confidence record for an asset
 */
export function getConfidenceRecord(assetId: string): ConfidenceRecord | undefined {
  return confidenceStore.get(assetId);
}

/**
 * Calculate confidence for an AssetRecord (combining store data with asset data)
 */
export function calculateAssetConfidence(record: AssetRecord): ConfidenceScore {
  return calculateConfidence(record.asset.id, record.gdi?.total ?? 50, {
    positiveCount: 0,  // TODO: track separately; for now use report_count as proxy
    negativeCount: 0,
    publishedAt: record.published_at,
    lastVerifiedAt: undefined,
  });
}

/**
 * Get confidence score for an asset with current GDI
 */
export function getAssetConfidence(assetId: string, gdiScore: number, publishedAt: string): ConfidenceScore {
  return calculateConfidence(assetId, gdiScore, {
    publishedAt,
  });
}

// ============ Batch Operations ============

/**
 * Get confidence scores for multiple assets
 */
export function getBatchConfidence(assets: AssetRecord[]): ConfidenceScore[] {
  return assets.map(record => calculateAssetConfidence(record));
}

/**
 * Get all assets filtered by minimum confidence grade
 */
export function filterByMinGrade(assets: AssetRecord[], minGrade: ConfidenceGrade): AssetRecord[] {
  const threshold = CONFIDENCE_GRADE_THRESHOLDS[minGrade];
  return assets.filter(record => {
    const score = calculateAssetConfidence(record);
    return score.current_confidence >= threshold;
  });
}

// ============ Hub-Level Analytics ============

/**
 * Summary statistics across all tracked assets
 */
export function getConfidenceStats(): {
  total_tracked: number;
  grade_distribution: Record<ConfidenceGrade, number>;
  avg_confidence: number;
  decay_alert_count: number; // assets projected to drop below 0.5 in 7 days
} {
  const records = [...confidenceStore.values()];
  const gradeDist: Record<ConfidenceGrade, number> = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
  let totalConfidence = 0;
  let decayAlertCount = 0;

  for (const record of records) {
    const score = calculateConfidence(record.asset_id, record.initial_confidence);
    gradeDist[score.grade]++;
    totalConfidence += score.current_confidence;
    if (score.projected_confidence_7d < 0.5) decayAlertCount++;
  }

  return {
    total_tracked: records.length,
    grade_distribution: gradeDist,
    avg_confidence: records.length > 0 ? Math.round((totalConfidence / records.length) * 100) / 100 : 0,
    decay_alert_count: decayAlertCount,
  };
}

// ============ Utilities ============

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
}

/**
 * Reset all confidence records — FOR TESTING ONLY
 */
export function resetConfidenceStore(): void {
  confidenceStore.clear();
}

// ============ Decay Parameters (for API exposure) ============

export const CONFIDENCE_PARAMS = {
  half_life_days: CONFIDENCE_HALF_LIFE_DAYS,
  decay_lambda: Math.round(CONFIDENCE_DECAY_LAMBDA * 10000) / 10000,
  positive_factor: CONFIDENCE_POSITIVE_FACTOR,
  negative_factor: CONFIDENCE_NEGATIVE_FACTOR,
  floor_ratio: CONFIDENCE_FLOOR_RATIO,
};
