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
  usefulness: number;
  novelty: number;
  rigor: number;
  reuse: number;
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
    usefulness: r.usefulness,
    novelty: r.novelty,
    rigor: r.rigor,
    reuse: r.reuse,
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
  usefulnessDelta: number;
  noveltyDelta: number;
  rigorDelta: number;
  reuseDelta: number;
  verdict: 'above' | 'at' | 'below';
}

export interface BenchmarkSet {
  avg_usefulness: number;
  avg_novelty: number;
  avg_rigor: number;
  avg_reuse: number;
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
      usefulnessDelta: 0,
      noveltyDelta: 0,
      rigorDelta: 0,
      reuseDelta: 0,
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

  const usefulnessDelta = recentRecord
    ? recentRecord.usefulness - benchmarks.avg_usefulness
    : 0;
  const noveltyDelta = recentRecord
    ? recentRecord.novelty - benchmarks.avg_novelty
    : 0;
  const rigorDelta = recentRecord
    ? recentRecord.rigor - benchmarks.avg_rigor
    : 0;
  const reuseDelta = recentRecord
    ? recentRecord.reuse - benchmarks.avg_reuse
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
    usefulnessDelta: Math.round(usefulnessDelta * 100) / 100,
    noveltyDelta: Math.round(noveltyDelta * 100) / 100,
    rigorDelta: Math.round(rigorDelta * 100) / 100,
    reuseDelta: Math.round(reuseDelta * 100) / 100,
    verdict,
  };
}

// ─── Improvement Areas ──────────────────────────────────────────────────────

export interface ImprovementArea {
  dimension: 'usefulness' | 'novelty' | 'rigor' | 'reuse';
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
    dimension: 'usefulness' | 'novelty' | 'rigor' | 'reuse';
    currentScore: number;
    benchmarkScore: number;
  }> = [
    { dimension: 'usefulness', currentScore: asset.usefulness, benchmarkScore: benchmarks.avg_usefulness },
    { dimension: 'novelty', currentScore: asset.novelty, benchmarkScore: benchmarks.avg_novelty },
    { dimension: 'rigor', currentScore: asset.rigor, benchmarkScore: benchmarks.avg_rigor },
    { dimension: 'reuse', currentScore: asset.reuse, benchmarkScore: benchmarks.avg_reuse },
  ];

  const suggestions: Record<string, string> = {
    usefulness: 'Improve documentation and add usage examples to increase practical value.',
    novelty: 'Introduce unique approaches or novel techniques to differentiate from existing solutions.',
    rigor: 'Strengthen validation, add error handling, and ensure production-ready quality.',
    reuse: 'Modularize code, improve parameterization, and reduce hardcoded dependencies.',
  };

  return dimensions
    .map(({ dimension, currentScore, benchmarkScore }) => {
      const gap = benchmarkScore - currentScore;
      return {
        dimension,
        currentScore: Math.round(currentScore * 100) / 100,
        benchmarkScore: Math.round(benchmarkScore * 100) / 100,
        gap: Math.round(gap * 100) / 100,
        priority: (gap > 15 ? 'high' : gap > 8 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
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
  usefulness: number;
  novelty: number;
  rigor: number;
  reuse: number;
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
      usefulness: r.usefulness,
      novelty: r.novelty,
      rigor: r.rigor,
      reuse: r.reuse,
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
      avg_usefulness: 50,
      avg_novelty: 50,
      avg_rigor: 50,
      avg_reuse: 50,
      avg_overall: 50,
    };
  }

  const n = records.length;
  const sum = records.reduce(
    (acc, r) => ({
      usefulness: acc.usefulness + r.usefulness,
      novelty: acc.novelty + r.novelty,
      rigor: acc.rigor + r.rigor,
      reuse: acc.reuse + r.reuse,
      overall: acc.overall + r.overall,
    }),
    { usefulness: 0, novelty: 0, rigor: 0, reuse: 0, overall: 0 },
  );

  return {
    avg_usefulness: Math.round((sum.usefulness / n) * 100) / 100,
    avg_novelty: Math.round((sum.novelty / n) * 100) / 100,
    avg_rigor: Math.round((sum.rigor / n) * 100) / 100,
    avg_reuse: Math.round((sum.reuse / n) * 100) / 100,
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
