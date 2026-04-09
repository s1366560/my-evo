/**
 * GDI Trend Analysis Module
 *
 * Analyzes the trajectory of an asset's GDI score over time,
 * compares against benchmarks, and identifies areas for improvement.
 */

import type { PrismaClient } from '@prisma/client';

export type TrendDirection = 'rising' | 'stable' | 'declining';

// ─── GDI Trend Calculation ───────────────────────────────────────────────────

export interface GDITrendPoint {
  date: string;
  overall: number;
  intrinsic: number;
  usage_mean: number;
  usage_lower: number;
  social_mean: number;
  social_lower: number;
  freshness: number;
}

export interface GDITrendResult {
  assetId: string;
  period: string;
  trend: TrendDirection;
  slope: number; // points per day
  volatility: number; // standard deviation of daily changes
  trendPoints: GDITrendPoint[];
}

/**
 * Calculate the GDI trend for an asset over a given period.
 *
 * Period options: '7d', '14d', '30d', '90d'
 */
export async function calculateGDITrend(
  assetId: string,
  period: '7d' | '14d' | '30d' | '90d' = '30d',
): Promise<GDITrendResult> {
  const periodDays: Record<string, number> = {
    '7d': 7,
    '14d': 14,
    '30d': 30,
    '90d': 90,
  };

  const days = periodDays[period] ?? 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const records = await getPrisma().gDIScoreRecord.findMany({
    where: {
      asset_id: assetId,
      calculated_at: { gte: cutoff },
    },
    orderBy: { calculated_at: 'asc' },
  });

  const trendPoints: GDITrendPoint[] = records.map((r) => ({
    date: r.calculated_at.toISOString().split('T')[0] ?? '',
    overall: r.overall,
    intrinsic: r.intrinsic,
    usage_mean: r.usage_mean,
    usage_lower: r.usage_lower,
    social_mean: r.social_mean,
    social_lower: r.social_lower,
    freshness: r.freshness,
  }));

  // Linear regression for slope
  const slope = computeSlope(
    records.map((_, i) => i),
    records.map((r) => r.overall),
  );

  // Compute volatility (standard deviation of day-to-day changes)
  const volatility = computeVolatility(records.map((r) => r.overall));

  const trend: TrendDirection =
    slope > 0.3
      ? 'rising'
      : slope < -0.3
        ? 'declining'
        : 'stable';

  return {
    assetId,
    period,
    trend,
    slope: Math.round(slope * 100) / 100,
    volatility: Math.round(volatility * 100) / 100,
    trendPoints,
  };
}

// ─── Benchmark Comparison ────────────────────────────────────────────────────

export interface BenchmarkComparison {
  assetId: string;
  assetGdi: number;
  benchmarkGdi: number;
  percentile: number; // 0–100
  intrinsicDelta: number;
  usageDelta: number;
  socialDelta: number;
  freshnessDelta: number;
  verdict: 'above' | 'at' | 'below';
}

export interface BenchmarkSet {
  avg_intrinsic: number;
  avg_usage_mean: number;
  avg_social_mean: number;
  avg_freshness: number;
  avg_overall: number;
}

/**
 * Compare an asset's GDI against network-wide benchmarks.
 */
export async function compareWithBenchmarks(
  assetId: string,
): Promise<BenchmarkComparison> {
  const [asset, benchmarks] = await Promise.all([
    getPrisma().asset.findUnique({
      where: { asset_id: assetId },
      select: { gdi_score: true },
    }),
    getBenchmarkSet(),
  ]);

  if (!asset) {
    return {
      assetId,
      assetGdi: 0,
      benchmarkGdi: 0,
      percentile: 0,
      intrinsicDelta: 0,
      usageDelta: 0,
      socialDelta: 0,
      freshnessDelta: 0,
      verdict: 'below',
    };
  }

  const recentRecord = await getPrisma().gDIScoreRecord.findFirst({
    where: { asset_id: assetId },
    orderBy: { calculated_at: 'desc' },
  });

  const assetGdi = asset.gdi_score;
  const benchmarkGdi = benchmarks.avg_overall;

  // Percentile: proportion of assets with lower GDI
  const allAssets = await getPrisma().asset.findMany({
    where: { status: 'published' },
    select: { gdi_score: true },
  });

  const belowCount = allAssets.filter((a) => a.gdi_score < assetGdi).length;
  const percentile = allAssets.length > 0
    ? Math.round((belowCount / allAssets.length) * 100)
    : 50;

  const intrinsicDelta = recentRecord
    ? recentRecord.intrinsic - benchmarks.avg_intrinsic
    : 0;
  const usageDelta = recentRecord
    ? recentRecord.usage_mean - benchmarks.avg_usage_mean
    : 0;
  const socialDelta = recentRecord
    ? recentRecord.social_mean - benchmarks.avg_social_mean
    : 0;
  const freshnessDelta = recentRecord
    ? recentRecord.freshness - benchmarks.avg_freshness
    : 0;

  const verdict = assetGdi > benchmarkGdi * 1.1
    ? 'above'
    : assetGdi < benchmarkGdi * 0.9
      ? 'below'
      : 'at';

  return {
    assetId,
    assetGdi: Math.round(assetGdi * 100) / 100,
    benchmarkGdi: Math.round(benchmarkGdi * 100) / 100,
    percentile,
    intrinsicDelta: Math.round(intrinsicDelta * 100) / 100,
    usageDelta: Math.round(usageDelta * 100) / 100,
    socialDelta: Math.round(socialDelta * 100) / 100,
    freshnessDelta: Math.round(freshnessDelta * 100) / 100,
    verdict,
  };
}

// ─── Improvement Areas ──────────────────────────────────────────────────────

export interface ImprovementArea {
  dimension: 'intrinsic' | 'usage' | 'social' | 'freshness';
  currentScore: number;
  benchmarkScore: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
}

/**
 * Identify specific dimensions where an asset can improve.
 */
export async function identifyImprovementAreas(
  assetId: string,
): Promise<ImprovementArea[]> {
  const [asset, benchmarks] = await Promise.all([
    getPrisma().gDIScoreRecord.findFirst({
      where: { asset_id: assetId },
      orderBy: { calculated_at: 'desc' },
    }),
    getBenchmarkSet(),
  ]);

  if (!asset) return [];

  const dimensions: Array<{
    dimension: 'intrinsic' | 'usage' | 'social' | 'freshness';
    currentScore: number;
    benchmarkScore: number;
  }> = [
    { dimension: 'intrinsic', currentScore: asset.intrinsic, benchmarkScore: benchmarks.avg_intrinsic },
    { dimension: 'usage', currentScore: asset.usage_mean, benchmarkScore: benchmarks.avg_usage_mean },
    { dimension: 'social', currentScore: asset.social_mean, benchmarkScore: benchmarks.avg_social_mean },
    { dimension: 'freshness', currentScore: asset.freshness, benchmarkScore: benchmarks.avg_freshness },
  ];

  const suggestions: Record<string, string> = {
    intrinsic: 'Improve code quality, documentation, and trigger specificity to increase intrinsic value.',
    usage: 'Drive more fetches and unique users to improve the usage dimension.',
    social: 'Encourage positive votes and resolve disputes to strengthen the social dimension.',
    freshness: 'Keep the asset active and verified to maintain freshness score.',
  };

  return dimensions
    .map(({ dimension, currentScore, benchmarkScore }) => {
      const gap = benchmarkScore - currentScore;
      return {
        dimension,
        currentScore: Math.round(currentScore * 100) / 100,
        benchmarkScore: Math.round(benchmarkScore * 100) / 100,
        gap: Math.round(gap * 100) / 100,
        priority: (gap > 0.15 ? 'high' : gap > 0.08 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
        suggestion: suggestions[dimension] ?? '',
      };
    })
    .filter((area) => area.gap > 0)
    .sort((a, b) => b.gap - a.gap);
}

// ─── GDI History ─────────────────────────────────────────────────────────────

export interface GDIHistoryEntry {
  date: string;
  overall: number;
  intrinsic: number;
  usage_mean: number;
  usage_lower: number;
  social_mean: number;
  social_lower: number;
  freshness: number;
  changeFromPrevious: number | null;
}

/**
 * Get the full GDI score history for an asset.
 */
export async function getGDIHistory(
  assetId: string,
  limit = 90,
): Promise<GDIHistoryEntry[]> {
  const records = await getPrisma().gDIScoreRecord.findMany({
    where: { asset_id: assetId },
    orderBy: { calculated_at: 'asc' },
    take: limit,
  });

  return records.map((r, idx) => {
    const prev = idx > 0 ? records[idx - 1]!.overall : null;
    return {
      date: r.calculated_at.toISOString().split('T')[0] ?? '',
      overall: r.overall,
      intrinsic: r.intrinsic,
      usage_mean: r.usage_mean,
      usage_lower: r.usage_lower,
      social_mean: r.social_mean,
      social_lower: r.social_lower,
      freshness: r.freshness,
      changeFromPrevious: prev !== null
        ? Math.round((r.overall - prev) * 100) / 100
        : null,
    };
  });
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

function computeSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += xs[i]!;
    sumY += ys[i]!;
    sumXY += xs[i]! * ys[i]!;
    sumX2 += xs[i]! * xs[i]!;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;

  return (n * sumXY - sumX * sumY) / denom;
}

function computeVolatility(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}

async function getBenchmarkSet(): Promise<BenchmarkSet> {
  const records = await getPrisma().gDIScoreRecord.findMany({
    where: {
      calculated_at: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
    take: 1000,
  });

  if (records.length === 0) {
    return {
      avg_intrinsic: 0.5,
      avg_usage_mean: 0.5,
      avg_social_mean: 0.5,
      avg_freshness: 0.5,
      avg_overall: 50,
    };
  }

  const n = records.length;
  const sum = records.reduce(
    (acc, r) => ({
      intrinsic: acc.intrinsic + r.intrinsic,
      usage_mean: acc.usage_mean + r.usage_mean,
      social_mean: acc.social_mean + r.social_mean,
      freshness: acc.freshness + r.freshness,
      overall: acc.overall + r.overall,
    }),
    { intrinsic: 0, usage_mean: 0, social_mean: 0, freshness: 0, overall: 0 },
  );

  return {
    avg_intrinsic: Math.round((sum.intrinsic / n) * 100) / 100,
    avg_usage_mean: Math.round((sum.usage_mean / n) * 100) / 100,
    avg_social_mean: Math.round((sum.social_mean / n) * 100) / 100,
    avg_freshness: Math.round((sum.freshness / n) * 100) / 100,
    avg_overall: Math.round((sum.overall / n) * 100) / 100,
  };
}

// ─── Prisma accessor ──────────────────────────────────────────────────────────

let _prisma: PrismaClient | null = null;

export function setPrismaForGdiTrends(p: PrismaClient): void {
  _prisma = p;
}

function getPrisma(): PrismaClient {
  if (!_prisma) {
    const { PrismaClient } = require('@prisma/client');
    _prisma = new PrismaClient();
  }
  return _prisma!;
}
