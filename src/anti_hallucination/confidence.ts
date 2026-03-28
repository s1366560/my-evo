/**
 * Confidence Decay Model
 * Implements Chapter 28 Section 28.4 confidence tracking and decay
 *
 * Formula: C(t) = C0 × e^(-λt) × (1 + α×n_positive) × (1 - β×n_negative)
 */

import type { ConfidenceSnapshot, DecayProjection, FeedbackHistory } from './types';

// Default decay parameters
const DEFAULT_LAMBDA = 0.023;        // ~30 day half-life
const DEFAULT_ALPHA = 0.05;          // +5% per positive event
const DEFAULT_BETA = 0.15;           // -15% per negative event
const MIN_CONFIDENCE = 0.1;
const MAX_CONFIDENCE = 1.0;

/**
 * Calculate confidence at a given time using the decay model
 */
export function calculateConfidence(
  initialConfidence: number,
  createdAt: Date | string,
  feedback: FeedbackHistory,
  options?: {
    lambda?: number;
    alpha?: number;
    beta?: number;
    currentTime?: Date;
  }
): number {
  const now = options?.currentTime ? options.currentTime : new Date();
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const lambda = options?.lambda ?? DEFAULT_LAMBDA;
  const alpha = options?.alpha ?? DEFAULT_ALPHA;
  const beta = options?.beta ?? DEFAULT_BETA;

  // Days since creation
  const t = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

  // Natural exponential decay
  const naturalDecay = Math.exp(-lambda * t);

  // Positive feedback boost
  const positiveFactor = 1 + alpha * feedback.positive_count;

  // Negative feedback penalty (floor at 0.1)
  const negativeFactor = Math.max(MIN_CONFIDENCE, 1 - beta * feedback.negative_count);

  // Fetch frequency boost (log scale to prevent overflow)
  const fetchFactor = 1 + Math.log(1 + feedback.fetch_count) * 0.01;

  const final = initialConfidence * naturalDecay * positiveFactor * negativeFactor * fetchFactor;

  return Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, final));
}

/**
 * Project confidence decay over a time horizon
 */
export function projectDecay(
  currentConfidence: number,
  createdAt: Date | string,
  feedback: FeedbackHistory,
  horizonDays: number,
  intervalDays: number = 7,
  options?: { lambda?: number; alpha?: number; beta?: number }
): DecayProjection[] {
  const projections: DecayProjection[] = [];
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const now = new Date();

  for (let daysFromNow = 0; daysFromNow <= horizonDays; daysFromNow += intervalDays) {
    const futureDate = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
    const confidence = calculateConfidence(currentConfidence, created, feedback, {
      ...options,
      currentTime: futureDate,
    });

    projections.push({
      date: futureDate.toISOString().split('T')[0],
      confidence: Math.round(confidence * 1000) / 1000,
    });
  }

  return projections;
}

/**
 * Get confidence grade and label
 */
export function getConfidenceGrade(confidence: number): { grade: string; label: string; color: string } {
  if (confidence >= 0.9) return { grade: 'A+', label: '极高', color: '🟢' };
  if (confidence >= 0.7) return { grade: 'A', label: '高', color: '🟢' };
  if (confidence >= 0.5) return { grade: 'B', label: '中等', color: '🟡' };
  if (confidence >= 0.3) return { grade: 'C', label: '低', color: '🟠' };
  if (confidence >= 0.1) return { grade: 'D', label: '极低', color: '🔴' };
  return { grade: 'F', label: '失效', color: '⚫' };
}

/**
 * Create a confidence snapshot from current state
 */
export function createSnapshot(
  assetId: string,
  initialConfidence: number,
  createdAt: string,
  feedback: FeedbackHistory,
  options?: { horizonDays?: number; lambda?: number; alpha?: number; beta?: number }
): ConfidenceSnapshot {
  const horizonDays = options?.horizonDays ?? 30;
  const currentConfidence = calculateConfidence(
    initialConfidence,
    createdAt,
    feedback,
    options as Parameters<typeof calculateConfidence>[3]
  );

  return {
    asset_id: assetId,
    initial_confidence: initialConfidence,
    current_confidence: currentConfidence,
    decay_factor: options?.lambda ?? DEFAULT_LAMBDA,
    positive_count: feedback.positive_count,
    negative_count: feedback.negative_count,
    last_fetch_count: feedback.fetch_count,
    created_at: createdAt,
    updated_at: new Date().toISOString(),
    projected_decay: projectDecay(
      initialConfidence,
      createdAt,
      feedback,
      horizonDays,
      7,
      options
    ),
  };
}

/**
 * Decay parameters configuration
 */
export interface DecayConfig {
  lambda: number;   // Decay coefficient (0.01-0.05)
  alpha: number;    // Positive enhancement factor (0.02-0.1)
  beta: number;     // Negative penalty factor (0.1-0.3)
  halfLifeDays: number;
}

export const DECAY_PRESETS: Record<string, DecayConfig> = {
  conservative: { lambda: 0.015, alpha: 0.02, beta: 0.10, halfLifeDays: 46 },
  default: { lambda: 0.023, alpha: 0.05, beta: 0.15, halfLifeDays: 30 },
  aggressive: { lambda: 0.035, alpha: 0.08, beta: 0.20, halfLifeDays: 20 },
};
