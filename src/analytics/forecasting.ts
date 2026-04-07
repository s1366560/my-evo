/**
 * Forecasting Module
 *
 * Predicts asset trends, signal popularity, and GDI scores
 * based on historical data using simple time-series heuristics.
 */

import type { PrismaClient } from '@prisma/client';
import {
  SIGNAL_HISTORY_DAYS,
  FORECAST_HORIZON_DAYS,
} from '../shared/constants';

// ─── Trend Prediction ─────────────────────────────────────────────────────────

export type TrendDirection = 'rising' | 'stable' | 'declining';

/**
 * Predict the trend for an asset over a given horizon (days).
 *
 * Uses a moving average of weekly activity counts to extrapolate.
 */
export async function predictTrend(
  assetId: string,
  horizonDays: number = FORECAST_HORIZON_DAYS,
): Promise<{
  assetId: string;
  horizonDays: number;
  trend: TrendDirection;
  projectedActivityCount: number;
  confidence: number;
  factors: string[];
}> {
  const cutoff = new Date(
    Date.now() - SIGNAL_HISTORY_DAYS * 24 * 60 * 60 * 1000,
  );

  const events = await getPrisma().evolutionEvent.findMany({
    where: {
      asset_id: assetId,
      timestamp: { gte: cutoff },
    },
    orderBy: { timestamp: 'asc' },
  });

  // Bucket events into weekly chunks
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weekBuckets = new Array<number>(9).fill(0);

  for (const ev of events) {
    const weeksAgo = Math.floor(
      (Date.now() - ev.timestamp.getTime()) / weekMs,
    );
    if (weeksAgo >= 0 && weeksAgo < 9) {
      weekBuckets[8 - weeksAgo]!++;
    }
  }

  // Trend: compare recent 3 weeks vs older 3 weeks
  const recent3 = weekBuckets.slice(-3).reduce((a, b) => a + b, 0);
  const older3 = weekBuckets.slice(0, 3).reduce((a, b) => a + b, 0);

  const trend: TrendDirection =
    recent3 > older3 * 1.2
      ? 'rising'
      : recent3 < older3 * 0.8
        ? 'declining'
        : 'stable';

  // Simple linear projection: average weekly rate * horizon
  const avgWeekly = Math.max(
    weekBuckets.reduce((a, b) => a + b, 0) / Math.max(weekBuckets.filter((b) => b > 0).length, 1),
    0,
  );

  const horizonWeeks = horizonDays / 7;
  const projectedActivityCount = Math.round(avgWeekly * horizonWeeks);

  // Confidence decreases with longer horizons and lower sample sizes
  const sampleSize = events.length;
  const confidence = Math.max(
    0,
    Math.min(0.9, 0.5 + 0.05 * Math.min(sampleSize, 8) - 0.01 * horizonWeeks),
  );

  const factors: string[] = [];
  if (trend === 'rising') factors.push('recent_activity_up');
  if (trend === 'declining') factors.push('recent_activity_down');
  if (sampleSize < 5) factors.push('low_sample_size');
  if (horizonDays > 30) factors.push('long_horizon_reduced_confidence');

  return {
    assetId,
    horizonDays,
    trend,
    projectedActivityCount,
    confidence: Math.round(confidence * 100) / 100,
    factors,
  };
}

/**
 * Predict popularity (usage count) for a gene over a given number of days ahead.
 *
 * Based on recent download / usage velocity.
 */
export async function predictPopularity(
  geneId: string,
  daysAhead: number = 30,
): Promise<{
  geneId: string;
  daysAhead: number;
  currentScore: number;
  predictedScore: number;
  velocity: number; // events per day
  trend: TrendDirection;
}> {
  const cutoff = new Date(
    Date.now() - SIGNAL_HISTORY_DAYS * 24 * 60 * 60 * 1000,
  );

  const asset = await getPrisma().asset.findUnique({
    where: { asset_id: geneId },
    select: { downloads: true, gdi_score: true, created_at: true },
  });

  if (!asset) {
    return {
      geneId,
      daysAhead,
      currentScore: 0,
      predictedScore: 0,
      velocity: 0,
      trend: 'stable',
    };
  }

  // Use GDI score as a proxy for popularity signal
  const currentScore = Math.round(asset.gdi_score * 10) / 10;

  // Count events in recent window as a velocity proxy
  const recentEvents = await getPrisma().evolutionEvent.findMany({
    where: {
      asset_id: geneId,
      timestamp: { gte: cutoff },
    },
  });

  const daysInWindow = SIGNAL_HISTORY_DAYS;
  const velocity = recentEvents.length / daysInWindow; // events per day

  // Simple linear extrapolation
  const predictedScore = Math.min(
    100,
    Math.max(
      0,
      currentScore + velocity * daysAhead * 0.5,
    ),
  );

  const trend: TrendDirection =
    velocity > 0.1 ? 'rising' : velocity < 0.02 ? 'declining' : 'stable';

  return {
    geneId,
    daysAhead,
    currentScore,
    predictedScore: Math.round(predictedScore * 10) / 10,
    velocity: Math.round(velocity * 1000) / 1000,
    trend,
  };
}

// ─── GDI Score Prediction ────────────────────────────────────────────────────

/**
 * Predict the future GDI score for an asset.
 * Uses linear regression on recent GDI score records.
 */
export async function predictGDIScore(
  assetId: string,
): Promise<{
  assetId: string;
  currentScore: number;
  predictedScore: number;
  trend: TrendDirection;
  confidence: number;
}> {
  const asset = await getPrisma().asset.findUnique({
    where: { asset_id: assetId },
    select: { gdi_score: true },
  });

  if (!asset) {
    return {
      assetId,
      currentScore: 0,
      predictedScore: 0,
      trend: 'stable',
      confidence: 0,
    };
  }

  const records = await getPrisma().gDIScoreRecord.findMany({
    where: { asset_id: assetId },
    orderBy: { calculated_at: 'desc' },
    take: 10,
  });

  const currentScore = asset.gdi_score;

  if (records.length < 2) {
    return {
      assetId,
      currentScore,
      predictedScore: currentScore,
      trend: 'stable',
      confidence: 0.3,
    };
  }

  // Linear regression on (index, score)
  const n = records.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += records[i]!.overall;
    sumXY += i * records[i]!.overall;
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / Math.max(n * sumX2 - sumX * sumX, 1);
  const intercept = (sumY - slope * sumX) / n;

  // Project 7 days ahead (approximate next week)
  const predictedScore = Math.min(
    100,
    Math.max(0, intercept + slope * n),
  );

  const trend: TrendDirection =
    slope > 0.5
      ? 'rising'
      : slope < -0.5
        ? 'declining'
        : 'stable';

  // Confidence based on R² (goodness of fit)
  const yMean = sumY / n;
  const ssTot = records.reduce((s, r) => s + (r.overall - yMean) ** 2, 0);
  const ssRes = records.reduce((s, r, i) => s + (r.overall - (intercept + slope * i)) ** 2, 0);
  const rSquared = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  return {
    assetId,
    currentScore: Math.round(currentScore * 100) / 100,
    predictedScore: Math.round(predictedScore * 100) / 100,
    trend,
    confidence: Math.round(rSquared * 100) / 100,
  };
}

/**
 * Evaluate the accuracy of previous predictions for an asset.
 *
 * Compares predicted scores (from stored GDI records) against actuals.
 */
export async function evaluatePredictionAccuracy(
  assetId: string,
): Promise<{
  assetId: string;
  sampleSize: number;
  mae: number;   // Mean Absolute Error
  mape: number; // Mean Absolute Percentage Error (%)
  directionAccuracy: number; // % of correct trend directions
}> {
  const records = await getPrisma().gDIScoreRecord.findMany({
    where: { asset_id: assetId },
    orderBy: { calculated_at: 'asc' },
    take: 30,
  });

  if (records.length < 3) {
    return {
      assetId,
      sampleSize: records.length,
      mae: 0,
      mape: 0,
      directionAccuracy: 0,
    };
  }

  // For each record, the "prediction" is the previous record's value
  let totalAbsoluteError = 0;
  let totalPctError = 0;
  let directionCorrect = 0;

  for (let i = 1; i < records.length; i++) {
    const predicted = records[i - 1]!.overall;
    const actual = records[i]!.overall;
    const absError = Math.abs(actual - predicted);
    totalAbsoluteError += absError;
    totalPctError += predicted !== 0 ? (absError / Math.abs(predicted)) * 100 : 0;

    const predDir = predicted > records[i - 1]!.overall ? 1 : predicted < records[i - 1]!.overall ? -1 : 0;
    const actualDir = actual > records[i - 1]!.overall ? 1 : actual < records[i - 1]!.overall ? -1 : 0;
    if (predDir === actualDir) directionCorrect++;
  }

  const n = records.length - 1;
  const mae = totalAbsoluteError / n;
  const mape = totalPctError / n;
  const directionAccuracy = directionCorrect / n;

  return {
    assetId,
    sampleSize: n,
    mae: Math.round(mae * 100) / 100,
    mape: Math.round(mape * 100) / 100,
    directionAccuracy: Math.round(directionAccuracy * 100) / 100,
  };
}

// ─── Prisma accessor ─────────────────────────────────────────────────────────

let _prisma: PrismaClient | null = null;

export function setPrismaForForecasting(p: PrismaClient): void {
  _prisma = p;
}

function getPrisma(): PrismaClient {
  if (!_prisma) {
    const { PrismaClient } = require('@prisma/client');
    _prisma = new PrismaClient();
  }
  return _prisma!;
}
