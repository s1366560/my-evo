import { PrismaClient } from '@prisma/client';
import {
  DISCOVERY_PROBABILITY,
  INTEREST_MATCH_BONUS,
} from '../shared/constants';
import { calculateCompatibility } from './matching';
import type { DriftBottle } from '../shared/types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

// ----- Time decay -----

/**
 * Apply exponential decay to base discovery probability based on hours since creation.
 * Newer bottles have higher probability, declining over time.
 * Decay factor: halves every 24 hours.
 */
export function applyTimeDecay(
  baseProbability: number,
  hoursSinceCreation: number,
): number {
  const decayRate = Math.LN2 / 24; // ln(2) per 24 hours = half-life
  const decayFactor = Math.exp(-decayRate * hoursSinceCreation);
  return baseProbability * decayFactor;
}

// ----- Preference weighting -----

/**
 * Adjust probability based on compatibility score.
 * High compatibility increases chance, low compatibility decreases it.
 */
export function applyPreferenceWeight(
  probability: number,
  compatibilityScore: number,
): number {
  // Map [0,1] compatibility to [0.5, 1.5] weight multiplier
  const weight = 0.5 + compatibilityScore;
  const adjusted = probability * weight;
  return Math.min(adjusted, 1);
}

// ----- Discovery probability for a specific user+bottle -----

export interface DiscoveryProbabilityResult {
  bottleId: string;
  userId: string;
  baseProbability: number;
  timeDecayMultiplier: number;
  compatibilityBonus: number;
  finalProbability: number;
}

/**
 * Calculate the discovery probability for a specific bottle and user.
 * Combines base probability, time decay, and interest match bonus.
 */
export async function calculateDiscoveryProbability(
  bottleId: string,
  userId: string,
): Promise<DiscoveryProbabilityResult | null> {
  const record = await prisma.driftBottle.findUnique({
    where: { bottle_id: bottleId },
  });

  if (!record) {
    return null;
  }

  const now = Date.now();
  const thrownMs = (record.thrown_at as Date).getTime();
  const hoursSinceCreation = (now - thrownMs) / (1000 * 60 * 60);

  const timeDecayMultiplier = applyTimeDecay(1, hoursSinceCreation);

  // Calculate compatibility bonus (up to INTEREST_MATCH_BONUS)
  const bottle: DriftBottle = {
    bottle_id: record.bottle_id,
    content: record.content,
    sender_id: record.sender_id,
    status: record.status as DriftBottle['status'],
    signals: record.signals,
    hops: record.hops,
    max_hops: record.max_hops,
    path: record.path,
    finder_id: record.finder_id ?? undefined,
    reply: record.reply ?? undefined,
    thrown_at: (record.thrown_at as Date).toISOString(),
    found_at: record.found_at
      ? (record.found_at as Date).toISOString()
      : undefined,
    expires_at: (record.expires_at as Date).toISOString(),
  };

  const compat = calculateCompatibility(bottle, { tags: [], domain: undefined });
  const compatibilityBonus = Math.min(compat.score * INTEREST_MATCH_BONUS, INTEREST_MATCH_BONUS);

  const withTimeDecay = DISCOVERY_PROBABILITY * timeDecayMultiplier;
  const finalProbability = Math.min(
    withTimeDecay + compatibilityBonus,
    1,
  );

  return {
    bottleId,
    userId,
    baseProbability: DISCOVERY_PROBABILITY,
    timeDecayMultiplier,
    compatibilityBonus,
    finalProbability,
  };
}

// ----- Overall discovery chance (for display) -----

export interface DiscoveryChanceResult {
  bottleId: string;
  estimatedChance: number; // 0-1
  hoursOld: number;
  freshnessLabel: 'fresh' | 'aging' | 'stale';
}

/**
 * Get the overall estimated discovery chance for a bottle (user-agnostic).
 * Useful for displaying on the bottle detail view.
 */
export async function getDiscoveryChance(
  bottleId: string,
): Promise<DiscoveryChanceResult | null> {
  const record = await prisma.driftBottle.findUnique({
    where: { bottle_id: bottleId },
  });

  if (!record) {
    return null;
  }

  const now = Date.now();
  const thrownMs = (record.thrown_at as Date).getTime();
  const hoursOld = (now - thrownMs) / (1000 * 60 * 60);

  const timeDecayMultiplier = applyTimeDecay(1, hoursOld);
  const estimatedChance = DISCOVERY_PROBABILITY * timeDecayMultiplier;

  let freshnessLabel: DiscoveryChanceResult['freshnessLabel'] = 'fresh';
  if (hoursOld > 72) {
    freshnessLabel = 'stale';
  } else if (hoursOld > 24) {
    freshnessLabel = 'aging';
  }

  return {
    bottleId,
    estimatedChance,
    hoursOld,
    freshnessLabel,
  };
}
