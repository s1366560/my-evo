import { PrismaClient } from '@prisma/client';
import type {
  PhylogenyNode,
  SymbioticRelationship,
  EmergentPattern,
  MacroEvent,
  GeneCategory,
} from '../shared/types';
import type {
  FitnessLandscape,
  FitnessCell,
  DiversityIndex,
  RedQueenEffect,
} from './types';
import {
  FITNESS_GRID_SIZE,
  EMERGENT_MIN_LIFT,
  GENE_CATEGORIES,
} from '../shared/constants';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export async function getPhylogenyTree(
  assetId: string,
): Promise<PhylogenyNode | null> {
  const asset = await prisma.asset.findUnique({
    where: { asset_id: assetId },
  });

  if (!asset) {
    return null;
  }

  const children = await prisma.asset.findMany({
    where: { parent_id: assetId },
    select: { asset_id: true },
  });

  const events = await prisma.evolutionEvent.findMany({
    where: { asset_id: assetId, event_type: 'mutated' },
  });

  return {
    id: asset.asset_id,
    type: asset.asset_type as 'gene' | 'capsule' | 'agent',
    name: asset.name,
    parent_id: asset.parent_id ?? undefined,
    children: children.map((c: { asset_id: string }) => c.asset_id),
    gdi_score: asset.gdi_score,
    category: (asset.signals[0] ?? 'optimize') as GeneCategory,
    created_at: asset.created_at.toISOString(),
    mutations: events.length,
  };
}

export async function detectSymbiosis(): Promise<
  SymbioticRelationship[]
> {
  const assets = await prisma.asset.findMany({
    where: { status: 'published' },
    select: {
      asset_id: true,
      signals: true,
      gdi_score: true,
      author_id: true,
      downloads: true,
    },
    take: 200,
  });

  const relationships: SymbioticRelationship[] = [];

  for (let i = 0; i < assets.length; i++) {
    for (let j = i + 1; j < assets.length; j++) {
      const a = assets[i]!;
      const b = assets[j]!;

      const sharedSignals = a.signals.filter((s: string) =>
        b.signals.includes(s),
      );
      if (sharedSignals.length < 2) {
        continue;
      }

      const jaccard =
        sharedSignals.length /
        new Set([...a.signals, ...b.signals]).size;

      let type: SymbioticRelationship['type'] = 'commensalism';
      if (Math.abs(a.downloads - b.downloads) < 10) {
        type = 'mutualism';
      } else if (
        a.gdi_score < 30 ||
        b.gdi_score < 30
      ) {
        type = 'parasitism';
      }

      if (jaccard > 0.3) {
        relationships.push({
          id: `${a.asset_id}-${b.asset_id}`,
          type,
          source_id: a.asset_id,
          target_id: b.asset_id,
          strength: Math.round(jaccard * 100) / 100,
          detected_at: new Date().toISOString(),
        });
      }
    }
  }

  return relationships
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 20);
}

export async function getFitnessLandscape(): Promise<FitnessLandscape> {
  const assets = await prisma.asset.findMany({
    where: { status: 'published' },
    select: { gdi_score: true, downloads: true, signals: true },
    take: 500,
  });

  const gridSize = FITNESS_GRID_SIZE;
  const grid: FitnessCell[][] = [];

  for (let row = 0; row < gridSize; row++) {
    const gridRow: FitnessCell[] = [];
    for (let col = 0; col < gridSize; col++) {
      const gdiMin = (row / gridSize) * 100;
      const gdiMax = ((row + 1) / gridSize) * 100;
      const dlMin = Math.pow(10, (col / gridSize) * 3);
      const dlMax = Math.pow(10, ((col + 1) / gridSize) * 3);

      const cellAssets = assets.filter(
        (a: { gdi_score: number; downloads: number }) =>
          a.gdi_score >= gdiMin &&
          a.gdi_score < gdiMax &&
          a.downloads >= dlMin &&
          a.downloads < dlMax,
      );

      const avgGdi =
        cellAssets.length > 0
          ? cellAssets.reduce((s: number, a: { gdi_score: number }) => s + a.gdi_score, 0) /
            cellAssets.length
          : 0;

      gridRow.push({
        row,
        col,
        label: `GDI[${gdiMin.toFixed(0)}-${gdiMax.toFixed(0)}] x DL[${dlMin.toFixed(0)}-${dlMax.toFixed(0)}]`,
        count: cellAssets.length,
        avg_gdi: Math.round(avgGdi * 100) / 100,
      });
    }
    grid.push(gridRow);
  }

  return {
    grid_size: gridSize,
    grid,
    x_axis_label: 'Downloads',
    y_axis_label: 'GDI Score',
  };
}

export async function detectEmergentPatterns(): Promise<
  EmergentPattern[]
> {
  const assets = await prisma.asset.findMany({
    where: { status: 'published' },
    select: {
      asset_id: true,
      signals: true,
      gdi_score: true,
      rating: true,
    },
    take: 500,
  });

  const signalPairs: Record<
    string,
    { total: number; successful: number }
  > = {};

  for (const asset of assets) {
    for (let i = 0; i < asset.signals.length; i++) {
      for (
        let j = i + 1;
        j < asset.signals.length;
        j++
      ) {
        const pair = [asset.signals[i], asset.signals[j]]
          .sort()
          .join('+');
        if (!signalPairs[pair]) {
          signalPairs[pair] = { total: 0, successful: 0 };
        }
        signalPairs[pair].total += 1;
        if (asset.gdi_score >= 60) {
          signalPairs[pair].successful += 1;
        }
      }
    }
  }

  const totalAssets = Math.max(assets.length, 1);
  const baselineRate =
    assets.filter((a: { gdi_score: number }) => a.gdi_score >= 60).length / totalAssets;

  const patterns: EmergentPattern[] = [];

  for (const [cluster, data] of Object.entries(signalPairs)) {
    if (data.total < 3) {
      continue;
    }

    const successRate = data.successful / data.total;
    const lift = baselineRate > 0 ? successRate / baselineRate : 0;

    if (lift >= EMERGENT_MIN_LIFT) {
      patterns.push({
        pattern_id: `ep-${cluster.replace(/\+/g, '-')}`,
        signal_cluster: cluster.split('+'),
        success_rate: Math.round(successRate * 100) / 100,
        baseline_rate: Math.round(baselineRate * 100) / 100,
        lift: Math.round(lift * 100) / 100,
        status: 'detected',
        detected_at: new Date().toISOString(),
      });
    }
  }

  return patterns.sort((a, b) => b.lift - a.lift).slice(0, 10);
}

export async function getDiversityIndex(): Promise<DiversityIndex> {
  const assets = await prisma.asset.findMany({
    where: { status: 'published' },
    select: { signals: true },
    take: 1000,
  });

  const categoryCounts: Record<string, number> = {};
  let totalSignals = 0;

  for (const asset of assets) {
    for (const signal of asset.signals) {
      categoryCounts[signal] = (categoryCounts[signal] ?? 0) + 1;
      totalSignals += 1;
    }
  }

  const categories = Object.values(categoryCounts);
  const n = categories.reduce((a, b) => a + b, 0);

  const proportions = categories.map((c) => c / n);

  const shannon = -proportions.reduce(
    (sum, p) => (p > 0 ? sum + p * Math.log(p) : sum),
    0,
  );

  const simpson = 1 - proportions.reduce((sum, p) => sum + p * p, 0);

  const sorted = [...categories].sort((a, b) => a - b);
  const cumSum = sorted.reduce(
    (acc, v) => [...acc, (acc.length > 0 ? (acc[acc.length - 1] ?? 0) : 0) + v],
    [] as number[],
  );
  const gini =
    n > 0
      ? (2 * cumSum.reduce((s, v, i) => s + (i + 1) * v, 0)) /
          (n * sorted.reduce((a, b) => a + b, 0)) -
        1
      : 0;

  return {
    shannon: Math.round(shannon * 1000) / 1000,
    simpson: Math.round(simpson * 1000) / 1000,
    gini: Math.round(Math.abs(gini) * 1000) / 1000,
    total_categories: categories.length,
    distribution: categoryCounts,
  };
}

export async function getRedQueenEffect(): Promise<RedQueenEffect> {
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  );

  const recentEvents = await prisma.evolutionEvent.findMany({
    where: {
      event_type: { in: ['mutated', 'forked'] },
      timestamp: { gte: thirtyDaysAgo },
    },
    select: { asset_id: true, event_type: true },
  });

  const gdiRecords = await prisma.gDIScoreRecord.findMany({
    where: { calculated_at: { gte: thirtyDaysAgo } },
    orderBy: { calculated_at: 'asc' },
    take: 200,
  });

  let avgGdiChange = 0;
  if (gdiRecords.length >= 2) {
    const changes: number[] = [];
    for (let i = 1; i < gdiRecords.length; i++) {
      changes.push(
        Math.abs(gdiRecords[i]!.overall - gdiRecords[i - 1]!.overall),
      );
    }
    avgGdiChange =
      changes.reduce((a, b) => a + b, 0) / changes.length;
  }

  const totalMutations = recentEvents.length;
  const periodDays = 30;
  const avgMutationRate = totalMutations / periodDays;

  const coevolutionAssets = new Set(
    recentEvents.map((e: { asset_id: string }) => e.asset_id),
  );

  return {
    period_days: periodDays,
    avg_mutation_rate: Math.round(avgMutationRate * 100) / 100,
    avg_gdi_change: Math.round(avgGdiChange * 100) / 100,
    coevolution_pairs: Math.floor(coevolutionAssets.size / 2),
    arms_race_detected: avgMutationRate > 2,
  };
}

export async function detectMacroEvents(): Promise<MacroEvent[]> {
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  );

  const assets = await prisma.asset.findMany({
    where: {
      status: 'published',
      created_at: { gte: thirtyDaysAgo },
    },
    select: {
      asset_id: true,
      signals: true,
      created_at: true,
      gdi_score: true,
    },
  });

  const signalCounts: Record<string, number> = {};
  for (const a of assets) {
    for (const s of a.signals) {
      signalCounts[s] = (signalCounts[s] ?? 0) + 1;
    }
  }

  const events: MacroEvent[] = [];

  for (const [signal, count] of Object.entries(signalCounts)) {
    const avgAssetsPerSignal = assets.length / GENE_CATEGORIES;

    if (count >= avgAssetsPerSignal * 3) {
      events.push({
        event_id: `explosion-${signal}`,
        type: 'explosion',
        category: signal as GeneCategory,
        magnitude: Math.round((count / avgAssetsPerSignal) * 100) / 100,
        affected_assets: count,
        detected_at: new Date().toISOString(),
        description: `Signal "${signal}" explosion: ${count} new assets (${(count / avgAssetsPerSignal).toFixed(1)}x average)`,
      });
    }

    if (count === 1 && assets.length > 50) {
      events.push({
        event_id: `extinction-${signal}`,
        type: 'extinction',
        category: signal as GeneCategory,
        magnitude: 1,
        affected_assets: 1,
        detected_at: new Date().toISOString(),
        description: `Signal "${signal}" near extinction: only 1 asset`,
      });
    }
  }

  return events.sort((a, b) => b.magnitude - a.magnitude);
}
