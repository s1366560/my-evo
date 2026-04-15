import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import type {
  DriftReport,
  DriftType,
  BranchingMetrics,
  TimelineEvent,
  TimelineEventType,
  SignalForecast,
  GdiForecast,
} from '../shared/types';
import type { RiskAlert } from './types';
import {
  DRIFT_THRESHOLD,
  DRIFT_CRITICAL_MULTIPLIER,
  DRIFT_WINDOW_DAYS,
  SIGNAL_HISTORY_DAYS,
  FORECAST_HORIZON_DAYS,
  BRANCHING_DEPTH_LIMIT,
} from '../shared/constants';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function getPrismaClient(prismaClient?: PrismaClient): PrismaClient {
  return prismaClient ?? prisma;
}

function computeJensenShannon(
  baseline: Record<string, number>,
  current: Record<string, number>,
): number {
  const allKeys = new Set([
    ...Object.keys(baseline),
    ...Object.keys(current),
  ]);

  const p: number[] = [];
  const q: number[] = [];

  for (const key of allKeys) {
    p.push(baseline[key] ?? 0);
    q.push(current[key] ?? 0);
  }

  const pSum = p.reduce((a, b) => a + b, 0);
  const qSum = q.reduce((a, b) => a + b, 0);

  if (pSum === 0 || qSum === 0) {
    return 0;
  }

  const pNorm = p.map((v) => v / pSum);
  const qNorm = q.map((v) => v / qSum);

  const m = pNorm.map((v, i) => (v + (qNorm[i] ?? 0)) / 2);

  const klPm = pNorm.reduce((sum, v, i) => {
    return sum + (v > 0 ? v * Math.log2(v / (m[i] ?? 1)) : 0);
  }, 0);

  const klQm = qNorm.reduce((sum, v, i) => {
    return sum + (v > 0 ? v * Math.log2(v / (m[i] ?? 1)) : 0);
  }, 0);

  return Math.sqrt((klPm + klQm) / 2);
}

function normalizeFrequencies(
  signals: string[],
): Record<string, number> {
  const freq: Record<string, number> = {};
  for (const s of signals) {
    freq[s] = (freq[s] ?? 0) + 1;
  }
  return freq;
}

export async function getDriftReport(
  nodeId: string,
  prismaClient?: PrismaClient,
): Promise<DriftReport> {
  const client = getPrismaClient(prismaClient);
  const windowMs = DRIFT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const now = new Date();
  const baselineStart = new Date(now.getTime() - 2 * windowMs);
  const currentStart = new Date(now.getTime() - windowMs);

  const [baselineAssets, currentAssets] = await Promise.all([
    client.asset.findMany({
      where: {
        author_id: nodeId,
        created_at: { gte: baselineStart, lt: currentStart },
      },
      select: { signals: true },
    }),
    client.asset.findMany({
      where: {
        author_id: nodeId,
        created_at: { gte: currentStart },
      },
      select: { signals: true },
    }),
  ]);

  const baselineSignals = baselineAssets.flatMap((a: { signals: string[] }) => a.signals);
  const currentSignals = currentAssets.flatMap((a: { signals: string[] }) => a.signals);

  const baselineFreq = normalizeFrequencies(baselineSignals);
  const currentFreq = normalizeFrequencies(currentSignals);

  const driftScore = computeJensenShannon(baselineFreq, currentFreq);

  const status: DriftReport['status'] =
    driftScore >= DRIFT_THRESHOLD * DRIFT_CRITICAL_MULTIPLIER
      ? 'critical'
      : driftScore >= DRIFT_THRESHOLD
        ? 'drifting'
        : 'normal';

  const topDriftSignals = Object.keys({
    ...baselineFreq,
    ...currentFreq,
  })
    .map((signal) => ({
      signal,
      baseline_freq: baselineFreq[signal] ?? 0,
      current_freq: currentFreq[signal] ?? 0,
      delta: (currentFreq[signal] ?? 0) - (baselineFreq[signal] ?? 0),
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);

  const driftTypes: DriftType[] = [];
  if (driftScore >= DRIFT_THRESHOLD) {
    driftTypes.push('signal');
  }
  if (status === 'critical') {
    driftTypes.push('capability', 'style');
  }

  const recommendations =
    status === 'critical'
      ? [
          'Review recent asset signal distributions',
          'Consider realigning with baseline capabilities',
          'Check for unintended behavioral changes',
        ]
      : status === 'drifting'
        ? [
            'Monitor signal distribution changes',
            'Verify intentional evolution direction',
          ]
        : ['No action needed'];

  return {
    node_id: nodeId,
    drift_score: Math.round(driftScore * 1000) / 1000,
    threshold: DRIFT_THRESHOLD,
    status,
    drift_types: driftTypes,
    top_drift_signals: topDriftSignals,
    baseline_window: baselineStart.toISOString(),
    current_window: currentStart.toISOString(),
    recommendations,
  };
}

export async function getBranchingMetrics(
  prismaClient?: PrismaClient,
): Promise<BranchingMetrics> {
  const client = getPrismaClient(prismaClient);
  const assets = await client.asset.findMany({
    where: { parent_id: { not: null } },
    select: { parent_id: true, generation: true },
    take: 1000,
  });

  const parentMap: Record<string, number> = {};
  let maxDepth = 0;

  for (const asset of assets) {
    if (asset.parent_id) {
      parentMap[asset.parent_id] =
        (parentMap[asset.parent_id] ?? 0) + 1;
      if (asset.generation > maxDepth) {
        maxDepth = asset.generation;
      }
    }
  }

  const branchingFactors = Object.values(parentMap);
  const avgBranchingFactor =
    branchingFactors.length > 0
      ? branchingFactors.reduce((a, b) => a + b, 0) /
        branchingFactors.length
      : 0;

  const allSignals = await client.asset.findMany({
    where: { status: 'published' },
    select: { signals: true },
    take: 1000,
  });

  const signalGroups: Record<string, number> = {};
  for (const a of allSignals) {
    for (const s of a.signals) {
      signalGroups[s] = (signalGroups[s] ?? 0) + 1;
    }
  }

  const convergenceClusters = Object.entries(signalGroups)
    .filter(([, count]) => count >= 3)
    .slice(0, 5)
    .map(([signal, count]) => ({
      signals: [signal],
      member_count: count,
      avg_similarity: 0.75,
    }));

  const divergenceHotspots = Object.entries(signalGroups)
    .slice(0, 5)
    .map(([signal, count]) => ({
      signal,
      variant_count: count,
      status:
        count > 50
          ? ('saturated' as const)
          : count > 20
            ? ('high_diversity' as const)
            : count > 5
              ? ('healthy' as const)
              : ('low' as const),
    }));

  return {
    total_branches: assets.length,
    avg_branching_factor: Math.round(avgBranchingFactor * 100) / 100,
    deepest_path: Math.min(maxDepth, BRANCHING_DEPTH_LIMIT),
    convergence_clusters: convergenceClusters,
    divergence_hotspots: divergenceHotspots,
  };
}

export async function getTimeline(
  nodeId: string,
  eventType?: TimelineEventType,
  limit = 20,
  offset = 0,
  prismaClient?: PrismaClient,
): Promise<TimelineEvent[]> {
  const client = getPrismaClient(prismaClient);
  const where: Record<string, unknown> = { actor_id: nodeId };
  if (eventType) {
    where.event_type = eventType;
  }

  const events = await client.evolutionEvent.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: limit,
    skip: offset,
  });

  return events.map((e: { id: string; actor_id: string; event_type: string; asset_id: string; from_version: number; to_version: number; changes: string | null; timestamp: Date }) => ({
    event_id: e.id,
    node_id: e.actor_id,
    event_type: e.event_type as TimelineEventType,
    description: `${e.event_type} on asset ${e.asset_id}`,
    metadata: {
      asset_id: e.asset_id,
      from_version: e.from_version,
      to_version: e.to_version,
      changes: e.changes ?? '',
    },
    timestamp: e.timestamp.toISOString(),
  }));
}

export async function getSignalForecast(
  signal: string,
  prismaClient?: PrismaClient,
): Promise<SignalForecast> {
  const client = getPrismaClient(prismaClient);
  const historyDays = SIGNAL_HISTORY_DAYS;
  const cutoff = new Date(
    Date.now() - historyDays * 24 * 60 * 60 * 1000,
  );

  const weeklyData = await client.asset.findMany({
    where: {
      signals: { has: signal },
      status: 'published',
      created_at: { gte: cutoff },
    },
    select: { created_at: true },
    orderBy: { created_at: 'asc' },
  });

  const weekBuckets = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  for (const a of weeklyData) {
    const weeksAgo = Math.floor(
      (Date.now() - a.created_at.getTime()) / weekMs,
    );
    if (weeksAgo >= 0 && weeksAgo < 9) {
      weekBuckets[8 - weeksAgo]!++;
    }
  }

  const recentTrend = weekBuckets.slice(-3).reduce((a, b) => a + b, 0);
  const olderTrend = weekBuckets.slice(0, 3).reduce((a, b) => a + b, 0);

  const trend: SignalForecast['trend'] =
    recentTrend > olderTrend * 1.2
      ? 'rising'
      : recentTrend < olderTrend * 0.8
        ? 'declining'
        : 'stable';

  const totalAssets = await client.asset.count({
    where: { status: 'published', signals: { has: signal } },
  });

  const allSignals = await client.asset.findMany({
    where: { status: 'published' },
    select: { signals: true },
  });

  const signalCounts: Record<string, number> = {};
  for (const a of allSignals) {
    for (const s of a.signals) {
      signalCounts[s] = (signalCounts[s] ?? 0) + 1;
    }
  }

  const sorted = Object.entries(signalCounts).sort(
    ([, a], [, b]) => b - a,
  );
  const currentRank =
    sorted.findIndex(([s]) => s === signal) + 1 || sorted.length;

  const predictionBase = Math.max(recentTrend / 3, 1);
  const predictedRank7d = Math.max(
    1,
    currentRank + (trend === 'rising' ? -1 : trend === 'declining' ? 1 : 0),
  );
  const predictedRank14d = Math.max(
    1,
    predictedRank7d + (trend === 'rising' ? -1 : trend === 'declining' ? 1 : 0),
  );
  const predictedRank30d = Math.max(
    1,
    predictedRank14d + (trend === 'rising' ? -2 : trend === 'declining' ? 2 : 0),
  );

  return {
    signal,
    current_rank: currentRank,
    predicted_rank_7d: predictedRank7d,
    predicted_rank_14d: predictedRank14d,
    predicted_rank_30d: predictedRank30d,
    confidence: 0.7,
    trend,
  };
}

export async function listSignalForecasts(
  limit = 5,
  prismaClient?: PrismaClient,
): Promise<SignalForecast[]> {
  const client = getPrismaClient(prismaClient);
  const assets = await client.asset.findMany({
    where: { status: 'published' },
    select: { signals: true },
  });

  const signalCounts = new Map<string, number>();
  for (const asset of assets) {
    for (const signal of asset.signals) {
      signalCounts.set(signal, (signalCounts.get(signal) ?? 0) + 1);
    }
  }

  const topSignals = Array.from(signalCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([signal]) => signal);

  const forecasts: SignalForecast[] = [];
  for (const signal of topSignals) {
    forecasts.push(await getSignalForecast(signal, client));
  }

  return forecasts;
}

export async function getGdiForecast(
  assetId: string,
  prismaClient?: PrismaClient,
): Promise<GdiForecast> {
  const client = getPrismaClient(prismaClient);
  const asset = await client.asset.findUnique({
    where: { asset_id: assetId },
  });

  if (!asset) {
    return {
      asset_id: assetId,
      current_gdi: 0,
      predicted_7d: 0,
      predicted_14d: 0,
      predicted_30d: 0,
      risk_of_archive: true,
    };
  }

  const gdiRecords = await client.gDIScoreRecord.findMany({
    where: { asset_id: assetId },
    orderBy: { calculated_at: 'desc' },
    take: 10,
  });

  const currentGdi = asset.gdi_score;
  let trendDelta = 0;

  if (gdiRecords.length >= 2) {
    const recent = gdiRecords.slice(0, Math.min(5, gdiRecords.length));
    const deltaSum = recent.reduce((sum: number, r: { overall: number }, i: number) => {
      if (i < recent.length - 1) {
        return sum + (recent[i]!.overall - recent[i + 1]!.overall);
      }
      return sum;
    }, 0);
    trendDelta = deltaSum / Math.max(recent.length - 1, 1);
  }

  const predicted7d = Math.min(
    100,
    Math.max(0, currentGdi + trendDelta),
  );
  const predicted14d = Math.min(
    100,
    Math.max(0, currentGdi + trendDelta * 2),
  );
  const predicted30d = Math.min(
    100,
    Math.max(0, currentGdi + trendDelta * 4),
  );

  return {
    asset_id: assetId,
    current_gdi: currentGdi,
    predicted_7d: Math.round(predicted7d * 100) / 100,
    predicted_14d: Math.round(predicted14d * 100) / 100,
    predicted_30d: Math.round(predicted30d * 100) / 100,
    risk_of_archive: predicted30d < 20,
  };
}

export async function getRiskAlerts(
  nodeId: string,
  prismaClient?: PrismaClient,
): Promise<RiskAlert[]> {
  const client = getPrismaClient(prismaClient);
  const alerts: RiskAlert[] = [];

  const activeQuarantines = await client.quarantineRecord.findMany({
    where: { node_id: nodeId, is_active: true },
  });

  for (const q of activeQuarantines) {
    alerts.push({
      alert_id: crypto.randomUUID(),
      node_id: nodeId,
      type: 'quarantine',
      severity: q.level === 'L3' ? 'high' : q.level === 'L2' ? 'medium' : 'low',
      message: `Node in ${q.level} quarantine: ${q.reason}`,
      detected_at: q.started_at.toISOString(),
    });
  }

  const lowGdiAssets = await client.asset.findMany({
    where: {
      author_id: nodeId,
      status: 'published',
      gdi_score: { lt: 25 },
    },
    take: 5,
  });

  for (const a of lowGdiAssets) {
    alerts.push({
      alert_id: crypto.randomUUID(),
      node_id: nodeId,
      type: 'low_gdi',
      severity: 'medium',
      message: `Asset "${a.name}" has low GDI score: ${a.gdi_score.toFixed(1)}`,
      detected_at: a.updated_at.toISOString(),
    });
  }

  const similarityViolations = await client.similarityRecord.findMany({
    where: {
      score: { gte: 0.85 },
    },
    take: 5,
    orderBy: { detected_at: 'desc' },
  });

  for (const s of similarityViolations) {
      const relatedAsset = await client.asset.findUnique({
        where: { asset_id: s.asset_id },
      });
    if (relatedAsset && relatedAsset.author_id === nodeId) {
      alerts.push({
        alert_id: crypto.randomUUID(),
        node_id: nodeId,
        type: 'similarity',
        severity: s.score >= 0.95 ? 'high' : 'medium',
        message: `High similarity detected for asset ${s.asset_id}: ${s.score.toFixed(2)}`,
        detected_at: s.detected_at.toISOString(),
      });
    }
  }

  return alerts.sort(
    (a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime(),
  );
}
