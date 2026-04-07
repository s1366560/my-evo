import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import {
  CARBON_COST_GENE,
  CARBON_COST_CAPSULE,
  CARBON_COST_RECIPE,
  SIMILARITY_THRESHOLD,
  HIGH_SEVERITY_THRESHOLD,
  MEDIUM_SEVERITY_THRESHOLD,
  INITIAL_GDI_SCORE,
  PROMOTION_GDI_THRESHOLD,
  PROMOTION_REWARD,
  GDI_WEIGHTS,
} from '../shared/constants';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
  SimilarityViolationError,
} from '../shared/errors';
import type {
  PublishPayload,
  PublishResponse,
  GDIScore,
  SimilarityResult,
  AssetType,
} from '../shared/types';
import type { SearchResultItem } from './types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export { prisma };

function getCarbonCost(assetType: AssetType): number {
  const costs: Record<string, number> = {
    gene: CARBON_COST_GENE,
    capsule: CARBON_COST_CAPSULE,
    recipe: CARBON_COST_RECIPE,
  };
  return costs[assetType.toLowerCase()] ?? 0;
}

export function calculateSimilarity(content1: string, content2: string): number {
  if (content1.length === 0 && content2.length === 0) return 1.0;
  if (content1.length === 0 || content2.length === 0) return 0.0;

  const tokenize = (text: string): Set<string> => {
    const normalized = text.toLowerCase().trim();
    return new Set(normalized.split(/\s+/).filter((t) => t.length > 0));
  };

  const set1 = tokenize(content1);
  const set2 = tokenize(content2);
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function getSimilaritySeverity(score: number): 'low' | 'medium' | 'high' {
  if (score >= HIGH_SEVERITY_THRESHOLD) return 'high';
  if (score >= MEDIUM_SEVERITY_THRESHOLD) return 'medium';
  return 'low';
}

async function checkSimilarity(
  assetId: string,
  content: string,
  assetType: AssetType,
): Promise<SimilarityResult[]> {
  const existingAssets = await prisma.asset.findMany({
    where: { asset_type: assetType, status: { in: ['published', 'promoted'] }, content: { not: null } },
    select: { asset_id: true, content: true },
  });

  const results: SimilarityResult[] = [];
  for (const existing of existingAssets) {
    if (!existing.content) continue;
    const score = calculateSimilarity(content, existing.content);
    if (score >= SIMILARITY_THRESHOLD) {
      const severity = getSimilaritySeverity(score);
      results.push({ asset_id: assetId, compared_to: existing.asset_id, score, severity, strategy: 'jaccard' });
      await prisma.similarityRecord.create({
        data: { asset_id: assetId, compared_to: existing.asset_id, score, severity, strategy: 'jaccard' },
      });
    }
  }
  return results;
}

export async function publishAsset(nodeId: string, payload: PublishPayload): Promise<PublishResponse> {
  if (!payload.name || payload.name.trim().length === 0) {
    throw new ValidationError('Asset name is required');
  }
  if (!payload.description || payload.description.trim().length === 0) {
    throw new ValidationError('Asset description is required');
  }

  const node = await prisma.node.findUnique({ where: { node_id: nodeId } });
  if (!node) throw new NotFoundError('Node', nodeId);

  const carbonCost = getCarbonCost(payload.asset_type);
  if (node.credit_balance < carbonCost) {
    throw new InsufficientCreditsError(carbonCost, node.credit_balance);
  }

  const assetId = uuidv4();
  const content = payload.content ?? '';
  const similarityResults = content.length > 0
    ? await checkSimilarity(assetId, content, payload.asset_type)
    : [];

  const highSimilarity = similarityResults.find((r) => r.severity === 'high');
  if (highSimilarity) throw new SimilarityViolationError(highSimilarity.score);

  const asset = await prisma.asset.create({
    data: {
      asset_id: assetId,
      asset_type: payload.asset_type,
      name: payload.name.trim(),
      description: payload.description.trim(),
      content,
      signals: payload.signals ?? [],
      tags: payload.tags ?? [],
      author_id: nodeId,
      status: 'published',
      gdi_score: INITIAL_GDI_SCORE,
      carbon_cost: carbonCost,
      parent_id: payload.parent_id ?? null,
      generation: 0,
      ancestors: [],
      fork_count: 0,
      config: (payload.config ?? null) as unknown as import('@prisma/client').Prisma.InputJsonValue,
      gene_ids: payload.gene_ids?.join(',') ?? null,
    },
  });

  const newBalance = node.credit_balance - carbonCost;
  const countIncrement = payload.asset_type === 'gene' ? { gene_count: { increment: 1 } }
    : payload.asset_type === 'capsule' ? { capsule_count: { increment: 1 } }
    : {};
  await prisma.node.update({
    where: { node_id: nodeId },
    data: { credit_balance: newBalance, ...countIncrement },
  });
  await prisma.creditTransaction.create({
    data: {
      node_id: nodeId,
      amount: -carbonCost,
      type: 'publish_cost',
      description: `Published ${payload.asset_type}: ${assetId}`,
      balance_after: newBalance,
    },
  });
  await prisma.evolutionEvent.create({
    data: {
      asset_id: assetId,
      event_type: 'created',
      from_version: 0,
      to_version: 1,
      changes: `Created ${payload.asset_type}: ${payload.name}`,
      actor_id: nodeId,
    },
  });

  return {
    status: 'ok',
    asset_id: asset.asset_id,
    asset_type: asset.asset_type as AssetType,
    gdi_score: asset.gdi_score,
    carbon_cost: asset.carbon_cost,
    similarity_check: similarityResults,
  };
}

export async function fetchAsset(nodeId: string, assetId: string): Promise<Record<string, unknown>> {
  const asset = await prisma.asset.findUnique({ where: { asset_id: assetId } });
  if (!asset) throw new NotFoundError('Asset', assetId);

  const node = await prisma.node.findUnique({ where: { node_id: nodeId } });
  if (!node) throw new NotFoundError('Node', nodeId);
  if (node.credit_balance < 1) throw new InsufficientCreditsError(1, node.credit_balance);

  const updatedDownloads = asset.downloads + 1;
  const newBalance = node.credit_balance - 1;

  await prisma.asset.update({ where: { asset_id: assetId }, data: { downloads: updatedDownloads } });
  await prisma.node.update({ where: { node_id: nodeId }, data: { credit_balance: newBalance } });
  await prisma.creditTransaction.create({
    data: {
      node_id: nodeId,
      amount: -1,
      type: 'fetch_cost',
      description: `Fetched asset: ${assetId}`,
      balance_after: newBalance,
    },
  });

  return {
    asset_id: asset.asset_id,
    asset_type: asset.asset_type,
    name: asset.name,
    description: asset.description,
    content: asset.content,
    signals: asset.signals,
    tags: asset.tags,
    author_id: asset.author_id,
    status: asset.status,
    gdi_score: asset.gdi_score,
    downloads: updatedDownloads,
    version: asset.version,
    carbon_cost: asset.carbon_cost,
    created_at: asset.created_at.toISOString(),
    updated_at: asset.updated_at.toISOString(),
  };
}

export async function revokeAsset(
  nodeId: string,
  assetId: string,
): Promise<{ asset_id: string; status: string }> {
  const asset = await prisma.asset.findUnique({ where: { asset_id: assetId } });
  if (!asset) throw new NotFoundError('Asset', assetId);
  if (asset.author_id !== nodeId) throw new ValidationError('Only the asset author can revoke it');

  await prisma.asset.update({ where: { asset_id: assetId }, data: { status: 'revoked' } });
  await prisma.evolutionEvent.create({
    data: {
      asset_id: assetId,
      event_type: 'revoked',
      from_version: asset.version,
      to_version: asset.version,
      changes: 'Asset revoked by author',
      actor_id: nodeId,
    },
  });

  const node = await prisma.node.findUnique({ where: { node_id: nodeId } });
  const newReputation = Math.max(0, (node?.reputation ?? 0) - 100);
  await prisma.node.update({ where: { node_id: nodeId }, data: { reputation: newReputation } });
  await prisma.reputationEvent.create({
    data: { node_id: nodeId, event_type: 'revoked', delta: -100, reason: `Asset revoked: ${assetId}` },
  });

  return { asset_id: assetId, status: 'revoked' };
}

export async function promoteAsset(
  assetId: string,
): Promise<{ asset_id: string; status: string; gdi_score: number }> {
  const asset = await prisma.asset.findUnique({ where: { asset_id: assetId } });
  if (!asset) throw new NotFoundError('Asset', assetId);
  if (asset.gdi_score < PROMOTION_GDI_THRESHOLD) {
    throw new ValidationError(
      `GDI score ${asset.gdi_score} is below promotion threshold ${PROMOTION_GDI_THRESHOLD}`,
    );
  }

  await prisma.asset.update({ where: { asset_id: assetId }, data: { status: 'promoted' } });

  const node = await prisma.node.findUnique({ where: { node_id: asset.author_id } });
  if (node) {
    const newReputation = Math.min(100, node.reputation + 50);
    const newBalance = node.credit_balance + PROMOTION_REWARD;
    await prisma.node.update({
      where: { node_id: asset.author_id },
      data: { reputation: newReputation, credit_balance: newBalance },
    });
    await prisma.creditTransaction.create({
      data: {
        node_id: asset.author_id,
        amount: PROMOTION_REWARD,
        type: 'promotion_reward',
        description: `Asset promoted: ${assetId}`,
        balance_after: newBalance,
      },
    });
    await prisma.reputationEvent.create({
      data: { node_id: asset.author_id, event_type: 'promoted', delta: 50, reason: `Asset promoted: ${assetId}` },
    });
  }

  await prisma.evolutionEvent.create({
    data: {
      asset_id: assetId,
      event_type: 'promoted',
      from_version: asset.version,
      to_version: asset.version,
      changes: 'Asset promoted by system',
      actor_id: 'system',
    },
  });

  return { asset_id: assetId, status: 'promoted', gdi_score: asset.gdi_score };
}

export async function searchAssets(query: string): Promise<SearchResultItem[]> {
  const assets = await prisma.asset.findMany({
    where: {
      status: { in: ['published', 'promoted'] },
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { signals: { has: query } },
        { tags: { has: query } },
      ],
    },
    take: 20,
    orderBy: { gdi_score: 'desc' },
  });

  return assets.map((a: { asset_id: string; asset_type: string; name: string; description: string; gdi_score: number; downloads: number; author_id: string; signals: string[]; tags: string[] }) => ({
    asset_id: a.asset_id,
    asset_type: a.asset_type as AssetType,
    name: a.name,
    description: a.description,
    gdi_score: a.gdi_score,
    downloads: a.downloads,
    author_id: a.author_id,
    signals: a.signals,
    tags: a.tags,
  }));
}

export async function calculateGDI(assetId: string): Promise<GDIScore> {
  const asset = await prisma.asset.findUnique({ where: { asset_id: assetId } });
  if (!asset) throw new NotFoundError('Asset', assetId);

  const usefulness = Math.min(100, (asset.downloads * 2) + (asset.rating * 10));
  const novelty = Math.max(0, 100 - (asset.fork_count * 10));
  const rigor = asset.gdi_score;
  const reuse = Math.min(100, asset.downloads * 3);

  const overall =
    usefulness * GDI_WEIGHTS.usefulness +
    novelty * GDI_WEIGHTS.novelty +
    rigor * GDI_WEIGHTS.rigor +
    reuse * GDI_WEIGHTS.reuse;

  const gdiRecord = await prisma.gDIScoreRecord.create({
    data: { asset_id: assetId, overall, usefulness, novelty, rigor, reuse },
  });

  await prisma.asset.update({ where: { asset_id: assetId }, data: { gdi_score: overall } });

  return {
    asset_id: assetId,
    overall,
    dimensions: { usefulness, novelty, rigor, reuse },
    calculated_at: gdiRecord.calculated_at.toISOString(),
  };
}

export { getCarbonCost };
