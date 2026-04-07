/**
 * Data Aggregation API Module
 *
 * Provides time-range and category-based aggregation
 * of analytics data for dashboard consumption.
 */

import type { PrismaClient } from '@prisma/client';

// ─── Time-Range Aggregation ─────────────────────────────────────────────────

export type MetricType =
  | 'gdi_score'
  | 'downloads'
  | 'events'
  | 'reputation'
  | 'credits';

export interface AggregationBucket {
  timestamp: string;
  value: number;
  count: number;
}

export interface AggregationResult {
  metric: MetricType;
  start: string;
  end: string;
  granularity: 'hour' | 'day' | 'week';
  buckets: AggregationBucket[];
  min: number;
  max: number;
  avg: number;
  sum: number;
}

/**
 * Aggregate a metric over a time range with configurable granularity.
 */
export async function aggregateByTimeRange(
  metric: MetricType,
  start: Date,
  end: Date,
  granularity: 'hour' | 'day' | 'week' = 'day',
): Promise<AggregationResult> {
  const buckets = await buildTimeBuckets(metric, start, end, granularity);

  const values = buckets.map((b) => b.value);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = values.length > 0 ? sum / values.length : 0;

  return {
    metric,
    start: start.toISOString(),
    end: end.toISOString(),
    granularity,
    buckets,
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    avg: Math.round(avg * 100) / 100,
    sum: Math.round(sum * 100) / 100,
  };
}

// ─── Category Aggregation ─────────────────────────────────────────────────────

export interface CategoryBucket {
  category: string;
  count: number;
  avgScore: number;
  totalDownloads: number;
}

export interface CategoryAggregationResult {
  category: string;
  buckets: CategoryBucket[];
  totalAssets: number;
  topCategory: string;
}

/**
 * Aggregate assets by a given category (asset_type, signal, tag, etc.).
 */
export async function aggregateByCategory(
  category: 'asset_type' | 'signal' | 'tag',
): Promise<CategoryAggregationResult> {
  const assets = await getPrisma().asset.findMany({
    where: { status: 'published' },
    select: {
      asset_type: true,
      signals: true,
      tags: true,
      gdi_score: true,
      downloads: true,
    },
  });

  const categoryMap = new Map<string, { count: number; scoreSum: number; downloads: number }>();

  for (const asset of assets) {
    let key: string;

    if (category === 'asset_type') {
      key = asset.asset_type;
    } else if (category === 'signal') {
      // Each signal becomes its own entry; skip if none
      for (const sig of asset.signals) {
        key = sig;
        const existing = categoryMap.get(key) ?? { count: 0, scoreSum: 0, downloads: 0 };
        categoryMap.set(key, {
          count: existing.count + 1,
          scoreSum: existing.scoreSum + asset.gdi_score,
          downloads: existing.downloads + asset.downloads,
        });
      }
      continue;
    } else {
      // tag
      for (const tag of asset.tags) {
        key = tag;
        const existing = categoryMap.get(key) ?? { count: 0, scoreSum: 0, downloads: 0 };
        categoryMap.set(key, {
          count: existing.count + 1,
          scoreSum: existing.scoreSum + asset.gdi_score,
          downloads: existing.downloads + asset.downloads,
        });
      }
      continue;
    }

    const existing = categoryMap.get(key) ?? { count: 0, scoreSum: 0, downloads: 0 };
    categoryMap.set(key, {
      count: existing.count + 1,
      scoreSum: existing.scoreSum + asset.gdi_score,
      downloads: existing.downloads + asset.downloads,
    });
  }

  const buckets: CategoryBucket[] = Array.from(categoryMap.entries())
    .map(([cat, stats]) => ({
      category: cat,
      count: stats.count,
      avgScore: Math.round((stats.scoreSum / stats.count) * 100) / 100,
      totalDownloads: stats.downloads,
    }))
    .sort((a, b) => b.count - a.count);

  const totalAssets = buckets.reduce((s, b) => s + b.count, 0);
  const topCategory = buckets.length > 0 ? buckets[0]!.category : '';

  return {
    category,
    buckets,
    totalAssets,
    topCategory,
  };
}

// ─── Dashboard Data ───────────────────────────────────────────────────────────

export interface DashboardMetrics {
  nodeId: string;
  totalAssets: number;
  avgGdi: number;
  totalDownloads: number;
  totalEvents: number;
  activeSwarms: number;
  quarantined: boolean;
  reputation: number;
  creditBalance: number;
  recentGdiTrend: number; // slope
  topSignals: Array<{ signal: string; count: number }>;
  assetTypeBreakdown: Array<{ type: string; count: number }>;
}

/**
 * Aggregate all key metrics for a node's dashboard view.
 */
export async function getDashboardData(
  nodeId: string,
): Promise<DashboardMetrics> {
  const [node, assets, events, activeSwarmCount, recentGdiTrend] =
    await Promise.all([
      getPrisma().node.findUnique({
        where: { node_id: nodeId },
        select: {
          reputation: true,
          credit_balance: true,
          quarantineRecords: {
            where: { is_active: true },
            take: 1,
          },
        },
      }),
      getPrisma().asset.findMany({
        where: { author_id: nodeId, status: 'published' },
        select: {
          asset_type: true,
          gdi_score: true,
          downloads: true,
          signals: true,
          updated_at: true,
        },
      }),
      getPrisma().evolutionEvent.findMany({
        where: { actor_id: nodeId },
        select: { timestamp: true },
      }),
      getPrisma().swarmTask.count({
        where: {
          workers: { has: nodeId },
          status: { in: ['pending', 'in_progress'] },
        },
      }),
      computeRecentGdiTrend(nodeId),
    ]);

  const totalAssets = assets.length;
  const avgGdi =
    assets.length > 0
      ? assets.reduce((s, a) => s + a.gdi_score, 0) / assets.length
      : 0;
  const totalDownloads = assets.reduce((s, a) => s + a.downloads, 0);

  // Count signals
  const signalCounts = new Map<string, number>();
  for (const asset of assets) {
    for (const sig of asset.signals) {
      signalCounts.set(sig, (signalCounts.get(sig) ?? 0) + 1);
    }
  }

  const topSignals = Array.from(signalCounts.entries())
    .map(([signal, count]) => ({ signal, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Asset type breakdown
  const typeCounts = new Map<string, number>();
  for (const asset of assets) {
    typeCounts.set(
      asset.asset_type,
      (typeCounts.get(asset.asset_type) ?? 0) + 1,
    );
  }

  const assetTypeBreakdown = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    nodeId,
    totalAssets,
    avgGdi: Math.round(avgGdi * 100) / 100,
    totalDownloads,
    totalEvents: events.length,
    activeSwarms: activeSwarmCount,
    quarantined: (node?.quarantineRecords.length ?? 0) > 0,
    reputation: node?.reputation ?? 0,
    creditBalance: node?.credit_balance ?? 0,
    recentGdiTrend: Math.round(recentGdiTrend * 100) / 100,
    topSignals,
    assetTypeBreakdown,
  };
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

async function buildTimeBuckets(
  metric: MetricType,
  start: Date,
  end: Date,
  granularity: 'hour' | 'day' | 'week',
): Promise<AggregationBucket[]> {
  const rangeMs = end.getTime() - start.getTime();

  let bucketMs: number;
  if (granularity === 'hour') {
    bucketMs = 60 * 60 * 1000;
  } else if (granularity === 'day') {
    bucketMs = 24 * 60 * 60 * 1000;
  } else {
    bucketMs = 7 * 24 * 60 * 60 * 1000;
  }

  const numBuckets = Math.max(1, Math.floor(rangeMs / bucketMs));
  const buckets: AggregationBucket[] = Array.from({ length: numBuckets }, (_, i) => {
    const bucketStart = new Date(start.getTime() + i * bucketMs);
    const bucketEnd = new Date(bucketStart.getTime() + bucketMs);
    return {
      timestamp: bucketStart.toISOString(),
      value: 0,
      count: 0,
    };
  });

  // Fetch raw data based on metric type
  let rawData: Array<{ date: Date; value: number }> = [];

  if (metric === 'events') {
    const events = await getPrisma().evolutionEvent.findMany({
      where: { timestamp: { gte: start, lte: end } },
      select: { timestamp: true },
    });
    rawData = events.map((e) => ({ date: e.timestamp, value: 1 }));
  } else if (metric === 'gdi_score') {
    const records = await getPrisma().gDIScoreRecord.findMany({
      where: { calculated_at: { gte: start, lte: end } },
      select: { calculated_at: true, overall: true },
    });
    rawData = records.map((r) => ({ date: r.calculated_at, value: r.overall }));
  } else if (metric === 'reputation') {
    const events = await getPrisma().reputationEvent.findMany({
      where: { timestamp: { gte: start, lte: end } },
      select: { timestamp: true, delta: true },
    });
    rawData = events.map((e) => ({ date: e.timestamp, value: e.delta }));
  } else if (metric === 'credits') {
    const txns = await getPrisma().creditTransaction.findMany({
      where: { timestamp: { gte: start, lte: end } },
      select: { timestamp: true, amount: true },
    });
    rawData = txns.map((t) => ({ date: t.timestamp, value: t.amount }));
  }

  // Assign raw data to buckets
  for (const point of rawData) {
    const bucketIdx = Math.min(
      numBuckets - 1,
      Math.floor((point.date.getTime() - start.getTime()) / bucketMs),
    );
    if (bucketIdx >= 0) {
      if (metric === 'events') {
        buckets[bucketIdx]!.value++;
      } else {
        buckets[bucketIdx]!.value += point.value;
      }
      buckets[bucketIdx]!.count++;
    }
  }

  // For non-event metrics, average the values
  if (metric !== 'events') {
    for (const bucket of buckets) {
      if (bucket.count > 0) {
        bucket.value = bucket.value / bucket.count;
      }
    }
  }

  return buckets;
}

async function computeRecentGdiTrend(nodeId: string): Promise<number> {
  const assets = await getPrisma().asset.findMany({
    where: { author_id: nodeId, status: 'published' },
    select: { gdi_score: true, updated_at: true },
    orderBy: { updated_at: 'desc' },
    take: 10,
  });

  if (assets.length < 2) return 0;

  // Use index as x, gdi as y for simple slope
  const n = assets.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += assets[i]!.gdi_score;
    sumXY += i * assets[i]!.gdi_score;
    sumX2 += i * i;
  }

  const denom = n * sumX2 - sumX * sumX;
  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
}

// ─── Prisma accessor ──────────────────────────────────────────────────────────

let _prisma: PrismaClient | null = null;

export function setPrismaForAggregation(p: PrismaClient): void {
  _prisma = p;
}

function getPrisma(): PrismaClient {
  if (!_prisma) {
    const { PrismaClient } = require('@prisma/client');
    _prisma = new PrismaClient();
  }
  return _prisma!;
}
