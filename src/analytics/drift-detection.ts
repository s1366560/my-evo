/**
 * Signal Drift Detection Module
 *
 * Detects when an asset's behavioral signals shift away from its baseline,
 * indicating potential capability drift or unintended evolution.
 */

import type { PrismaClient } from '@prisma/client';
import {
  DRIFT_THRESHOLD,
  DRIFT_WINDOW_DAYS,
} from '../shared/constants';
import type { DriftType } from '../shared/types';

export { DRIFT_THRESHOLD, DRIFT_WINDOW_DAYS };
export type { DriftType };

// In-memory drift alert log (cooldown mechanism)
interface DriftAlertEntry {
  assetId: string;
  triggeredAt: Date;
  cooldownMs: number;
}

const recentAlerts = new Map<string, DriftAlertEntry>();

// ─── Core Drift Detection ────────────────────────────────────────────────────

/**
 * Detect signal drift for an asset over a given time window.
 *
 * Compares signal frequency distribution between the first half
 * (baseline) and second half (current) of the window.
 */
export async function detectDrift(
  assetId: string,
  windowDays: number = DRIFT_WINDOW_DAYS,
): Promise<{
  assetId: string;
  windowDays: number;
  driftDetected: boolean;
  magnitude: number;
  signals: Array<{ name: string; before: number; after: number; delta: number }>;
}> {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);
  const midpoint = new Date(now.getTime() - windowMs / 2);

  // Fetch all evolution events for the asset within the window
  const events = await getPrisma().evolutionEvent.findMany({
    where: {
      asset_id: assetId,
      timestamp: { gte: windowStart },
    },
    orderBy: { timestamp: 'asc' },
  });

  if (events.length === 0) {
    return {
      assetId,
      windowDays,
      driftDetected: false,
      magnitude: 0,
      signals: [],
    };
  }

  // Split events into baseline (first half) and current (second half)
  const midpointIdx = Math.floor(events.length / 2);
  const baselineEvents = events.slice(0, midpointIdx);
  const currentEvents = events.slice(midpointIdx);

  // Extract signals from events (stored in metadata or changes field)
  const baselineSignals = extractSignalsFromEvents(baselineEvents);
  const currentSignals = extractSignalsFromEvents(currentEvents);

  // Build frequency maps
  const baselineFreq = buildFrequencyMap(baselineSignals);
  const currentFreq = buildFrequencyMap(currentSignals);

  // Compute Jensen-Shannon divergence
  const magnitude = computeJensenShannonDivergence(baselineFreq, currentFreq);

  // Identify which signals have changed
  const allSignals = new Set([...Object.keys(baselineFreq), ...Object.keys(currentFreq)]);
  const signalDeltas = Array.from(allSignals).map((name) => ({
    name,
    before: baselineFreq[name] ?? 0,
    after: currentFreq[name] ?? 0,
    delta: (currentFreq[name] ?? 0) - (baselineFreq[name] ?? 0),
  }));

  // Sort by absolute delta descending
  signalDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    assetId,
    windowDays,
    driftDetected: magnitude >= DRIFT_THRESHOLD,
    magnitude: Math.round(magnitude * 1000) / 1000,
    signals: signalDeltas,
  };
}

/**
 * Calculate the magnitude of drift between two signal distributions.
 */
export function calculateDriftMagnitude(
  before: Record<string, number>,
  after: Record<string, number>,
): number {
  return Math.round(computeJensenShannonDivergence(before, after) * 1000) / 1000;
}

// ─── Drift Alerts ─────────────────────────────────────────────────────────────

/**
 * Trigger a drift alert if cooldown has elapsed.
 * Returns true if alert was triggered, false if suppressed by cooldown.
 */
export function alertOnDrift(driftData: {
  assetId: string;
  magnitude: number;
}): boolean {
  const { assetId, magnitude } = driftData;

  if (magnitude < DRIFT_THRESHOLD) {
    return false;
  }

  const now = new Date();
  const entry = recentAlerts.get(assetId);
  const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24-hour cooldown

  if (entry) {
    const elapsed = now.getTime() - entry.triggeredAt.getTime();
    if (elapsed < COOLDOWN_MS) {
      return false; // Still in cooldown
    }
  }

  recentAlerts.set(assetId, {
    assetId,
    triggeredAt: now,
    cooldownMs: COOLDOWN_MS,
  });

  return true;
}

/**
 * Get drift detection history for an asset.
 * Returns cached alerts from in-memory log (last 100 entries).
 */
export function getDriftHistory(assetId: string): Array<{
  detectedAt: string;
  magnitude: number;
}> {
  const history: Array<{ detectedAt: string; magnitude: number }> = [];

  for (const [, entry] of recentAlerts) {
    if (entry.assetId === assetId) {
      history.push({
        detectedAt: entry.triggeredAt.toISOString(),
        magnitude: DRIFT_THRESHOLD, // only threshold breach entries are stored
      });
    }
  }

  return history.sort(
    (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
  );
}

// ─── Utility Functions ───────────────────────────────────────────────────────

function extractSignalsFromEvents(
  events: Array<{ changes: string | null }>,
): string[] {
  const signals: string[] = [];

  for (const event of events) {
    if (!event.changes) continue;

    try {
      const parsed = JSON.parse(event.changes);
      if (Array.isArray(parsed.signals)) {
        signals.push(...parsed.signals);
      } else if (Array.isArray(parsed)) {
        // events list stored directly as array
        signals.push(...parsed.filter((s: unknown) => typeof s === 'string'));
      }
    } catch {
      // Non-JSON changes — skip
    }
  }

  return signals;
}

function buildFrequencyMap(signals: string[]): Record<string, number> {
  const freq: Record<string, number> = {};
  for (const s of signals) {
    freq[s] = (freq[s] ?? 0) + 1;
  }
  return freq;
}

/**
 * Compute Jensen-Shannon divergence between two distributions.
 * Returns a value in [0, 1], where higher = more divergent.
 */
function computeJensenShannonDivergence(
  p: Record<string, number>,
  q: Record<string, number>,
): number {
  const allKeys = new Set([...Object.keys(p), ...Object.keys(q)]);

  const pArr: number[] = [];
  const qArr: number[] = [];

  for (const key of allKeys) {
    pArr.push(p[key] ?? 0);
    qArr.push(q[key] ?? 0);
  }

  const pSum = pArr.reduce((a, b) => a + b, 0);
  const qSum = qArr.reduce((a, b) => a + b, 0);

  if (pSum === 0 && qSum === 0) return 0;
  if (pSum === 0 || qSum === 0) return 1;

  const pNorm = pArr.map((v) => v / pSum);
  const qNorm = qArr.map((v) => v / qSum);
  const m = pNorm.map((v, i) => (v + (qNorm[i] ?? 0)) / 2);

  const klPm = pNorm.reduce((sum, v, i) => {
    return sum + (v > 0 ? v * Math.log2(v / (m[i] ?? 1)) : 0);
  }, 0);

  const klQm = qNorm.reduce((sum, v, i) => {
    return sum + (v > 0 ? v * Math.log2(v / (m[i] ?? 1)) : 0);
  }, 0);

  return Math.sqrt((klPm + klQm) / 2);
}

// ─── Prisma accessor (allows test injection) ──────────────────────────────────

let _prisma: PrismaClient | null = null;

export function setPrismaForDrift(p: PrismaClient): void {
  _prisma = p;
}

function getPrisma(): PrismaClient {
  if (!_prisma) {
    // Lazy import to avoid circular dependency in production
    const { PrismaClient } = require('@prisma/client');
    _prisma = new PrismaClient();
  }
  return _prisma!;
}
