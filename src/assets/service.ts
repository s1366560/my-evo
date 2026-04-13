import { Prisma, PrismaClient } from '@prisma/client';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
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
  SATEXP_K,
  GDI_PROMOTION_THRESHOLD,
  GDI_INTRINSIC_MIN,
  GDI_CONFIDENCE_MIN,
  NODE_REPUTATION_MIN,
} from '../shared/constants';
import {
  ASSET_QUALITY_DISPUTE_TYPES,
  blocksAssetPromotion,
  summarizeAssetQualityDisputes,
} from '../shared/dispute-consensus';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
  SimilarityViolationError,
  ConflictError,
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
const PUBLISH_MESSAGE_NAMESPACE = '5df41981-f3a2-4f5f-a2d7-4dd34c4f583a';

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export { prisma };

// ─── GDI Helper Functions ──────────────────────────────────────────────────────

function satExp(x: number, k: number): number {
  // Saturation exponential: x / (x + k)
  return x / (x + k);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function wilsonLower(upvotes: number, downvotes: number): number {
  // Wilson 95% lower bound on upvote proportion
  const n = upvotes + downvotes;
  if (n === 0) return 0.5;
  const p = upvotes / n;
  const z = 1.645; // 95% confidence
  const denominator = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return Math.max(0, (center - margin) / denominator);
}

function getCarbonCost(assetType: AssetType): number {
  const costs: Record<string, number> = {
    gene: CARBON_COST_GENE,
    capsule: CARBON_COST_CAPSULE,
    recipe: CARBON_COST_RECIPE,
  };
  return costs[assetType.toLowerCase()] ?? 0;
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'P2002';
}

function toPublishResponse(
  asset: {
    asset_id: string;
    asset_type: string;
    gdi_score: number;
    gdi_mean?: number | null;
    gdi_lower?: number | null;
    carbon_cost: number;
  },
  similarityResults: SimilarityResult[],
): PublishResponse {
  return {
    status: 'ok',
    asset_id: asset.asset_id,
    asset_type: asset.asset_type as AssetType,
    gdi_score: asset.gdi_mean ?? asset.gdi_score ?? INITIAL_GDI_SCORE,
    gdi_mean: asset.gdi_mean ?? asset.gdi_score ?? INITIAL_GDI_SCORE,
    gdi_lower: asset.gdi_lower ?? asset.gdi_score ?? INITIAL_GDI_SCORE,
    carbon_cost: asset.carbon_cost,
    similarity_check: similarityResults,
  };
}

type PublishComparableAsset = {
  asset_type: string;
  name: string;
  description: string;
  content: string | null;
  signals: string[];
  tags: string[];
  author_id: string;
  carbon_cost: number;
  parent_id: string | null;
  gene_ids: string | null;
  config: Prisma.JsonValue | null;
};

function toComparablePublishAsset(
  nodeId: string,
  payload: PublishPayload,
  carbonCost: number,
  content: string,
): PublishComparableAsset {
  return {
    asset_type: payload.asset_type,
    name: payload.name.trim(),
    description: payload.description.trim(),
    content,
    signals: payload.signals ?? [],
    tags: payload.tags ?? [],
    author_id: nodeId,
    carbon_cost: carbonCost,
    parent_id: payload.parent_id ?? null,
    gene_ids: payload.gene_ids?.join(',') ?? null,
    config: (payload.config ?? null) as Prisma.JsonValue | null,
  };
}

function assertReplayMatchesExistingAsset(
  existingAsset: PublishComparableAsset,
  expectedAsset: PublishComparableAsset,
): void {
  const matches =
    existingAsset.asset_type === expectedAsset.asset_type
    && existingAsset.name === expectedAsset.name
    && existingAsset.description === expectedAsset.description
    && (existingAsset.content ?? null) === expectedAsset.content
    && JSON.stringify(existingAsset.signals ?? []) === JSON.stringify(expectedAsset.signals)
    && JSON.stringify(existingAsset.tags ?? []) === JSON.stringify(expectedAsset.tags)
    && existingAsset.author_id === expectedAsset.author_id
    && existingAsset.carbon_cost === expectedAsset.carbon_cost
    && (existingAsset.parent_id ?? null) === expectedAsset.parent_id
    && (existingAsset.gene_ids ?? null) === expectedAsset.gene_ids
    && JSON.stringify(existingAsset.config ?? null) === JSON.stringify(expectedAsset.config);

  if (!matches) {
    throw new ConflictError('message_id already used for different publish payload');
  }
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

  const assetId = payload.source_message_id
    ? uuidv5(`${nodeId}:${payload.source_message_id}`, PUBLISH_MESSAGE_NAMESPACE)
    : uuidv4();
  const carbonCost = getCarbonCost(payload.asset_type);
  const content = payload.content ?? '';
  const comparablePayload = toComparablePublishAsset(nodeId, payload, carbonCost, content);

  if (payload.source_message_id) {
    const existingAsset = await prisma.asset.findUnique({ where: { asset_id: assetId } });
    if (existingAsset) {
      assertReplayMatchesExistingAsset(existingAsset, comparablePayload);
      return toPublishResponse(existingAsset, []);
    }
  }

  const node = await prisma.node.findUnique({ where: { node_id: nodeId } });
  if (!node) throw new NotFoundError('Node', nodeId);

  if (node.credit_balance < carbonCost) {
    throw new InsufficientCreditsError(carbonCost, node.credit_balance);
  }

  const similarityResults = content.length > 0
    ? await checkSimilarity(assetId, content, payload.asset_type)
    : [];

  const highSimilarity = similarityResults.find((r) => r.severity === 'high');
  if (highSimilarity) throw new SimilarityViolationError(highSimilarity.score);

  const countIncrement = payload.asset_type === 'gene' ? { gene_count: { increment: 1 } }
    : payload.asset_type === 'capsule' ? { capsule_count: { increment: 1 } }
    : {};
  let asset:
    | {
      asset_id: string;
      asset_type: string;
      gdi_score: number;
      gdi_mean?: number | null;
      gdi_lower?: number | null;
      carbon_cost: number;
    };

  try {
    asset = await prisma.$transaction(async (tx) => {
      if (payload.source_message_id) {
        const existingAsset = await tx.asset.findUnique({ where: { asset_id: assetId } });
        if (existingAsset) {
          assertReplayMatchesExistingAsset(existingAsset, comparablePayload);
          return existingAsset;
        }
      }

      const charged = await tx.node.updateMany({
        where: { node_id: nodeId, credit_balance: { gte: carbonCost } },
        data: { credit_balance: { decrement: carbonCost }, ...countIncrement },
      });
      if (charged.count !== 1) {
        const latestNode = await tx.node.findUnique({ where: { node_id: nodeId } });
        if (!latestNode) {
          throw new NotFoundError('Node', nodeId);
        }
        throw new InsufficientCreditsError(carbonCost, latestNode.credit_balance);
      }

      const chargedNode = await tx.node.findUnique({ where: { node_id: nodeId } });
      if (!chargedNode) {
        throw new NotFoundError('Node', nodeId);
      }

      const createdAsset = await tx.asset.create({
        data: {
          asset_id: assetId,
          asset_type: comparablePayload.asset_type,
          name: comparablePayload.name,
          description: comparablePayload.description,
          content: comparablePayload.content,
          signals: comparablePayload.signals,
          tags: comparablePayload.tags,
          author_id: comparablePayload.author_id,
          status: 'published',
          gdi_score: INITIAL_GDI_SCORE,
          carbon_cost: comparablePayload.carbon_cost,
          parent_id: comparablePayload.parent_id,
          generation: 0,
          ancestors: [],
          fork_count: 0,
          config: comparablePayload.config as Prisma.InputJsonValue,
          gene_ids: comparablePayload.gene_ids,
        },
      });

      for (const similarityResult of similarityResults) {
        await tx.similarityRecord.create({
          data: {
            asset_id: similarityResult.asset_id,
            compared_to: similarityResult.compared_to,
            score: similarityResult.score,
            severity: similarityResult.severity,
            strategy: similarityResult.strategy,
          },
        });
      }

      await tx.creditTransaction.create({
        data: {
          node_id: nodeId,
          amount: -carbonCost,
          type: 'publish_cost',
          description: `Published ${payload.asset_type}: ${assetId}`,
          balance_after: chargedNode.credit_balance,
        },
      });
      await tx.evolutionEvent.create({
        data: {
          asset_id: assetId,
          event_type: 'created',
          from_version: 0,
          to_version: 1,
          changes: `Created ${payload.asset_type}: ${payload.name}`,
          actor_id: nodeId,
          node_id: nodeId,
        },
      });

      return createdAsset;
    });
  } catch (error) {
    if (payload.source_message_id && isUniqueConstraintError(error)) {
      const existingAsset = await prisma.asset.findUnique({ where: { asset_id: assetId } });
      if (existingAsset) {
        assertReplayMatchesExistingAsset(existingAsset, comparablePayload);
        return toPublishResponse(existingAsset, []);
      }
    }
    throw error;
  }

  // Compute and persist the initial GDI score
  let gdi_mean = INITIAL_GDI_SCORE;
  let gdi_lower = INITIAL_GDI_SCORE;
  try {
    const gdiResult = await calculateGDI(assetId);
    gdi_mean = gdiResult.gdi_mean;
    gdi_lower = gdiResult.gdi_lower;
  } catch {
    // calculateGDI may fail if the asset has no history yet — fall back to initial score
  }

  return {
    ...toPublishResponse(asset, similarityResults),
    gdi_score: gdi_mean,
    gdi_mean,
    gdi_lower,
  };
}

export async function fetchAsset(nodeId: string, assetId: string): Promise<Record<string, unknown>> {
  const fetchedAsset = await prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({ where: { asset_id: assetId } });
    if (!asset) {
      throw new NotFoundError('Asset', assetId);
    }
    const canRead = asset.author_id === nodeId || asset.status === 'published' || asset.status === 'promoted';
    if (!canRead) {
      throw new NotFoundError('Asset', assetId);
    }

    const charged = await tx.node.updateMany({
      where: { node_id: nodeId, credit_balance: { gte: 1 } },
      data: { credit_balance: { decrement: 1 } },
    });
    if (charged.count !== 1) {
      const latestNode = await tx.node.findUnique({ where: { node_id: nodeId } });
      if (!latestNode) {
        throw new NotFoundError('Node', nodeId);
      }
      throw new InsufficientCreditsError(1, latestNode.credit_balance);
    }

    const downloadMarked = await tx.asset.updateMany({
      where: {
        asset_id: assetId,
        OR: [
          { status: { in: ['published', 'promoted'] } },
          { author_id: nodeId },
        ],
      },
      data: { downloads: { increment: 1 } },
    });
    if (downloadMarked.count !== 1) {
      throw new NotFoundError('Asset', assetId);
    }

    const fetchedAsset = await tx.asset.findUnique({ where: { asset_id: assetId } });
    if (!fetchedAsset) {
      throw new NotFoundError('Asset', assetId);
    }

    await tx.assetDownload.create({
      data: {
        asset_id: assetId,
        node_id: nodeId,
      },
    });
    const chargedNode = await tx.node.findUnique({ where: { node_id: nodeId } });
    if (!chargedNode) {
      throw new NotFoundError('Node', nodeId);
    }

    await tx.creditTransaction.create({
      data: {
        node_id: nodeId,
        amount: -1,
        type: 'fetch_cost',
        description: `Fetched asset: ${assetId}`,
        balance_after: chargedNode.credit_balance,
      },
    });
    return fetchedAsset;
  });

  return {
    asset_id: fetchedAsset.asset_id,
    asset_type: fetchedAsset.asset_type,
    name: fetchedAsset.name,
    description: fetchedAsset.description,
    content: fetchedAsset.content,
    signals: fetchedAsset.signals,
    tags: fetchedAsset.tags,
    author_id: fetchedAsset.author_id,
    status: fetchedAsset.status,
    gdi_score: fetchedAsset.gdi_score,
    downloads: fetchedAsset.downloads,
    version: fetchedAsset.version,
    carbon_cost: fetchedAsset.carbon_cost,
    created_at: fetchedAsset.created_at.toISOString(),
    updated_at: fetchedAsset.updated_at.toISOString(),
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

/**
 * Auto-promotion gate for assets.
 *
 * All FIVE conditions must be met simultaneously for promotion:
 * 1. gdi_lower >= 25
 * 2. intrinsic >= 0.4
 * 3. confidence >= 0.5
 * 4. source node reputation >= 30
 * 5. validation consensus: NOT majority-failed
 */
export async function promoteAsset(
  assetId: string,
): Promise<{ promoted: boolean; reason?: string }> {
  const asset = await prisma.asset.findUnique({ where: { asset_id: assetId } });
  if (!asset) throw new NotFoundError('Asset', assetId);
  if (asset.status === 'promoted') return { promoted: false, reason: 'already_promoted' };
  if (asset.status === 'rejected') return { promoted: false, reason: 'already_rejected' };

  // Fetch the latest GDI record (may be stale if older than 30 days)
  const gdiRecord = await prisma.gDIScoreRecord.findUnique({ where: { asset_id: assetId } });
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const needsRecalc = !gdiRecord
    || (Date.now() - new Date(gdiRecord.updatedAt).getTime()) > THIRTY_DAYS_MS;

  let gdi_lower = gdiRecord?.gdiLower ?? gdiRecord?.overall ?? 0;
  let intrinsic = gdiRecord?.intrinsic ?? 0;
  const confidence = asset.confidence ?? 1.0;

  if (needsRecalc) {
    const newScores = await calculateGDI(assetId);
    gdi_lower = newScores.gdi_lower;
    intrinsic = newScores.dimensions.intrinsic ?? 0;
    // Upsert the updated scores so next call uses cached values
    await prisma.gDIScoreRecord.upsert({
      where: { asset_id: assetId },
      create: {
        asset_id: assetId,
        overall: newScores.gdi_mean,
        gdiMean: newScores.gdi_mean,
        gdiLower: newScores.gdi_lower,
        intrinsic: newScores.dimensions.intrinsic ?? 0,
        usage_mean: newScores.dimensions.usage_mean ?? 0,
        social_mean: newScores.dimensions.social_mean ?? 0,
        freshness: newScores.dimensions.freshness ?? 0,
      },
      update: {
        overall: newScores.gdi_mean,
        gdiMean: newScores.gdi_mean,
        gdiLower: newScores.gdi_lower,
        intrinsic: newScores.dimensions.intrinsic ?? 0,
        usage_mean: newScores.dimensions.usage_mean ?? 0,
        social_mean: newScores.dimensions.social_mean ?? 0,
        freshness: newScores.dimensions.freshness ?? 0,
      },
    });
  }

  // ─── CONDITION 1: GDI lower bound >= 25 ───
  if (gdi_lower < GDI_PROMOTION_THRESHOLD) {
    return { promoted: false, reason: `gdi_lower_${gdi_lower.toFixed(1)}_below_${GDI_PROMOTION_THRESHOLD}` };
  }

  // ─── CONDITION 2: intrinsic >= 0.4 ───
  if (intrinsic < GDI_INTRINSIC_MIN) {
    return { promoted: false, reason: `intrinsic_${intrinsic.toFixed(2)}_below_${GDI_INTRINSIC_MIN}` };
  }

  // ─── CONDITION 3: confidence >= 0.5 ───
  if (confidence < GDI_CONFIDENCE_MIN) {
    return { promoted: false, reason: `confidence_${confidence.toFixed(2)}_below_${GDI_CONFIDENCE_MIN}` };
  }

  // ─── CONDITION 4: node reputation >= 30 ───
  const node = await prisma.node.findUnique({ where: { node_id: asset.author_id } });
  if (!node || node.reputation < NODE_REPUTATION_MIN) {
    return { promoted: false, reason: `node_reputation_${node?.reputation ?? 0}_below_${NODE_REPUTATION_MIN}` };
  }

  // ─── CONDITION 5: validation consensus not majority-failed ───
  const disputes = await prisma.dispute.findMany({
    where: {
      type: { in: [...ASSET_QUALITY_DISPUTE_TYPES] },
      OR: [
        { related_asset_id: assetId },
        { target_id: assetId },
      ],
    },
    select: { status: true, ruling: true },
  });
  if (blocksAssetPromotion(disputes)) {
    return { promoted: false, reason: 'validation_majority_failed' };
  }

  // ─── ALL CONDITIONS MET: promote ───
  await prisma.asset.update({
    where: { asset_id: assetId },
    data: { status: 'promoted' },
  });

  await prisma.evolutionEvent.create({
    data: {
      asset_id: assetId,
      event_type: 'promoted',
      from_version: asset.version,
      to_version: asset.version,
      changes: 'Asset promoted by system (auto-promotion gate)',
      actor_id: 'system',
    },
  });

  // Award credits to source node
  await prisma.creditTransaction.create({
    data: {
      node_id: asset.author_id,
      type: 'ASSET_PROMOTED',
      amount: 100,
      description: `Asset ${assetId} auto-promoted`,
      balance_after: 0,
    },
  });

  await prisma.node.update({
    where: { node_id: asset.author_id },
    data: { credit_balance: { increment: 100 } },
  });

  return { promoted: true };
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

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // ─── DIMENSION 1: INTRINSIC (weight 35%) ─── fixed at publish time
  const node = await prisma.node.findUnique({ where: { node_id: asset.author_id } });
  const nodeRep = node?.reputation ?? 50;

  const triggerCount = (asset.signals as string[])?.length ?? 0;
  const summaryLen = (asset.description?.length ?? 0);

  // Get blast_radius from asset metadata if stored
  let blastFiles = 1, blastLines = 1;
  if (asset.config && typeof asset.config === 'object') {
    const meta = asset.config as Record<string, unknown>;
    if (meta.blast_radius && typeof meta.blast_radius === 'object') {
      const br = meta.blast_radius as Record<string, unknown>;
      blastFiles = (br.files as number) ?? 1;
      blastLines = (br.lines as number) ?? 1;
    }
  }

  const confidence = clamp01(asset.confidence ?? 1.0);
  const successStreak = clamp01((asset.execution_count ?? 0) / 10);
  const blastRadiusSafety = Math.max(0, 1 - (blastFiles * blastLines) / 1000);
  const triggerSpec = clamp01(triggerCount / 5);
  const summaryQuality = clamp01(summaryLen / 200);
  const nodeRepScore = clamp01(nodeRep / 100);

  const intrinsic = (confidence + successStreak + blastRadiusSafety + triggerSpec + summaryQuality + nodeRepScore) / 6;

  // ─── DIMENSION 2: USAGE (weight 30%) ─── rolling window
  const fetchRecords = await prisma.assetDownload.findMany({
    where: { asset_id: assetId, created_at: { gte: thirtyDaysAgo } },
  });
  const fetch30d = fetchRecords.length;
  const unique30dSet = new Set(fetchRecords.map(r => r.node_id));
  const unique30d = unique30dSet.size;
  const exec90d = asset.execution_count ?? 0;

  const usage_mean =
    0.40 * satExp(fetch30d, SATEXP_K.fetch)
    + 0.30 * satExp(unique30d, SATEXP_K.unique)
    + 0.30 * satExp(exec90d, SATEXP_K.exec);
  const usage_lower = usage_mean * (0.5 + 0.5 * clamp01(unique30d / 5));

  // ─── DIMENSION 3: SOCIAL (weight 20%) ─── votes + validation + reproducibility
  const votes = await prisma.assetVote.findMany({ where: { asset_id: assetId } });
  const upvotes = votes.filter(v => v.vote_type === 'up').length;
  const downvotes = votes.filter(v => v.vote_type === 'down').length;

  const disputes = await prisma.dispute.findMany({
    where: {
      type: { in: [...ASSET_QUALITY_DISPUTE_TYPES] },
      OR: [
        { related_asset_id: assetId },
        { target_id: assetId },
      ],
    },
    select: { status: true, ruling: true },
  });
  const disputeSummary = summarizeAssetQualityDisputes(disputes);
  const passes = disputeSummary.passes;
  const fails = disputeSummary.blocks
    ? Math.max(1, disputeSummary.fails)
    : disputeSummary.fails;

  const vote_mean = (upvotes + 1) / (upvotes + downvotes + 2);
  const vote_lower = wilsonLower(upvotes, downvotes);

  const val_total = passes + fails;
  const val_mean = val_total > 0 ? passes / val_total : 0.5;
  const val_lower = wilsonLower(passes, fails);

  // Reproducibility from EvolutionEvents
  const evts = await prisma.evolutionEvent.findMany({
    where: { asset_id: assetId, created_at: { gte: ninetyDaysAgo } },
  });
  const crossNodeSet = new Set(evts.map(e => e.node_id ?? ''));
  const crossNodeSuccess = evts.filter(e => e.outcome && (e.outcome as Record<string, unknown>)?.status === 'success').length;
  const repro_rate = evts.length > 0 ? crossNodeSuccess / evts.length : 0;
  const repro_mean = repro_rate;
  const repro_lower = repro_rate;

  const hasEvolutionEvent = evts.length > 0;
  const bundle = hasEvolutionEvent ? 1 : 0.5;

  const social_mean = 0.35 * vote_mean + 0.35 * val_mean + 0.20 * repro_mean + 0.10 * bundle;
  const social_lower = 0.35 * vote_lower + 0.35 * val_lower + 0.20 * repro_lower + 0.10 * bundle;

  // ─── DIMENSION 4: FRESHNESS (weight 15%) ───
  const lastActivity = asset.last_verified_at ?? asset.updated_at ?? asset.created_at;
  const daysSinceActivity = (now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000);
  const freshness = Math.exp(-daysSinceActivity / 90);

  // ─── FINAL GDI SCORES ───
  const gdi_mean = 100 * (
    GDI_WEIGHTS.intrinsic * intrinsic
    + GDI_WEIGHTS.usage * usage_mean
    + GDI_WEIGHTS.social * social_mean
    + GDI_WEIGHTS.freshness * freshness
  );

  const gdi_lower = 100 * (
    GDI_WEIGHTS.intrinsic * intrinsic
    + GDI_WEIGHTS.usage * usage_lower
    + GDI_WEIGHTS.social * social_lower
    + GDI_WEIGHTS.freshness * freshness
  );

  // Store detailed scores in GDIScoreRecord
  const gdiRecord = await prisma.gDIScoreRecord.create({
    data: {
      asset_id: assetId,
      overall: gdi_mean,
      intrinsic,
      usage_mean,
      usage_lower,
      social_mean,
      social_lower,
      freshness,
    },
  });

  // Update the asset's summary scores
  await prisma.asset.update({
    where: { asset_id: assetId },
    data: {
      gdi_score: gdi_mean,
      gdi_mean,
      gdi_lower,
    },
  });

  return {
    asset_id: assetId,
    overall: gdi_mean,
    gdi_mean,
    gdi_lower,
    dimensions: {
      intrinsic,
      usage_mean,
      usage_lower,
      social_mean,
      social_lower,
      freshness,
    },
    calculated_at: gdiRecord.calculated_at.toISOString(),
  };
}

export { getCarbonCost };
