import type {
  ConfidenceDecayParams,
  ConfidenceGrade,
  DecayInput,
} from './types';

// ------------------------------------------------------------------
// Default parameters (from architecture spec Ch15 §15.3.2)
// ------------------------------------------------------------------

export const DEFAULT_DECAY_PARAMS: ConfidenceDecayParams = {
  lambda: 0.015,
  half_life_days: 30,
  positive_boost: 0.05,
  negative_penalty: 0.15,
  floor: 0.05,
};

/**
 * Calculate confidence after time-based exponential decay.
 *
 * C(t) = C₀ × e^(-λ × Δt) × (1 + log(1 + positive_count))
 *
 * The result is clamped between `params.floor` and 1.0.
 */
export function calculateDecay(
  initialConfidence: number,
  daysSinceUpdate: number,
  positiveCount: number,
  params: Partial<ConfidenceDecayParams> = {},
): number {
  const p = { ...DEFAULT_DECAY_PARAMS, ...params };

  if (daysSinceUpdate < 0) return Math.min(1, Math.max(p.floor, initialConfidence));
  if (daysSinceUpdate === 0) {
    return Math.min(1, Math.max(p.floor, initialConfidence));
  }

  // Exponential decay: C(t) = C₀ × e^(-λ × Δt)
  const decayed = initialConfidence * Math.exp(-p.lambda * daysSinceUpdate);

  // Usage factor: 1 + log(1 + positive_count)
  // positiveCount=0 → factor=1; positiveCount=9 → factor≈2; positiveCount=99 → factor≈3.6
  const usageFactor = 1 + Math.log(1 + positiveCount);

  // Positive boost: each positive signal adds a fixed amount, also scaled by recency
  const recencyWeight = 1 / (1 + daysSinceUpdate / p.half_life_days);
  const positiveBoost = positiveCount * p.positive_boost * recencyWeight;

  const raw = decayed * usageFactor + positiveBoost;

  return clamp(raw, p.floor, 1);
}

/**
 * Adjust confidence based on usage frequency.
 *
 * Frequent usage recenters the memory and slows perceived decay.
 * Usage within the window acts as a reinforcement signal.
 */
export function adjustByFrequency(
  confidence: number,
  usageCount: number,
  timeWindowDays: number,
  params: Partial<ConfidenceDecayParams> = {},
): number {
  const p = { ...DEFAULT_DECAY_PARAMS, ...params };

  if (timeWindowDays < 0) return confidence;
  if (usageCount <= 0) return confidence;

  // Frequency factor: log-scaled reinforcement, capped to avoid runaway
  // e.g. usageCount=100 in 30 days → factor ≈ 1.3
  const frequencyFactor = 1 + Math.log(1 + usageCount) * 0.1;

  // Recency weight: heavily penalise stale memories even with usage
  const recencyWeight = Math.exp(-0.05 * timeWindowDays);

  // Usage boosts confidence slightly but is tempered by how stale the window is
  const boost = p.positive_boost * Math.min(usageCount, 20) * recencyWeight * frequencyFactor;

  return clamp(confidence + boost, p.floor, 1);
}

/**
 * Compute effective (post-decay, post-frequency) confidence for a node.
 *
 * Applies time-based decay first, then frequency reinforcement.
 */
export function getEffectiveConfidence(
  confidence: number,
  daysSinceUpdate: number,
  usageCount: number,
  positiveCount: number,
  negativeCount: number,
  params: Partial<ConfidenceDecayParams> = {},
): number {
  const p = { ...DEFAULT_DECAY_PARAMS, ...params };

  // Step 1: time-based decay
  let effective = calculateDecay(confidence, daysSinceUpdate, positiveCount, p);

  // Step 2: frequency adjustment (within last half_life_days window)
  const frequencyAdjusted = adjustByFrequency(effective, usageCount, daysSinceUpdate, p);
  effective = frequencyAdjusted;

  // Step 3: negative signal penalty (applied last, is harshest)
  const negativePenalty = negativeCount * p.negative_penalty;
  effective = Math.max(p.floor, effective - negativePenalty);

  return clamp(effective, p.floor, 1);
}

/**
 * Compute a human-readable confidence grade.
 */
export function getConfidenceGrade(confidence: number): ConfidenceGrade {
  if (confidence >= 0.9) return 'A+';
  if (confidence >= 0.7) return 'A';
  if (confidence >= 0.5) return 'B';
  if (confidence >= 0.3) return 'C';
  if (confidence >= 0.1) return 'D';
  return 'F';
}

/**
 * Full decay calculation returning a detailed result object.
 */
export function computeDecay(input: DecayInput): {
  decayed: number;
  grade: ConfidenceGrade;
  effective: number;
  positive_boost: number;
  negative_penalty: number;
  usage_factor: number;
  recency_weight: number;
} {
  const p = { ...DEFAULT_DECAY_PARAMS, ...(input.params ?? {}) };

  const daysSinceUpdate = input.daysSinceUpdate;
  const positiveCount = input.positiveCount;
  const negativeCount = input.negativeCount;

  const usageFactor = 1 + Math.log(1 + positiveCount);
  const recencyWeight = 1 / (1 + daysSinceUpdate / p.half_life_days);
  const positiveBoost = positiveCount * p.positive_boost * recencyWeight;
  const negativePenalty = negativeCount * p.negative_penalty;

  const decayed = input.initialConfidence * Math.exp(-p.lambda * daysSinceUpdate) * usageFactor;
  const afterPositive = Math.min(1, decayed + positiveBoost);
  const effective = Math.max(p.floor, afterPositive - negativePenalty);

  return {
    decayed: clamp(decayed, p.floor, 1),
    grade: getConfidenceGrade(clamp(effective, p.floor, 1)),
    effective: clamp(effective, p.floor, 1),
    positive_boost: clamp(positiveBoost, 0, 1),
    negative_penalty: clamp(negativePenalty, 0, 1),
    usage_factor: usageFactor,
    recency_weight: recencyWeight,
  };
}

// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
