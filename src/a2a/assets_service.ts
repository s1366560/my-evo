import { Prisma, PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import {
  PROMOTION_GDI_THRESHOLD,
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
} from '../shared/constants';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../shared/errors';

let prisma = new PrismaClient();
type AssetDbClient = PrismaClient | Prisma.TransactionClient;
type ReadableAsset = {
  asset_id: string;
  author_id: string;
  name: string;
  status: string;
  content?: string | null;
  config?: unknown;
  created_at: Date;
  updated_at: Date;
  asset_type: string;
  description: string;
  gdi_score: number;
  downloads: number;
  rating: number;
  signals: string[];
  tags: string[];
  version: number;
  fork_count: number;
  parent_id?: string | null;
};

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export { prisma };

// ─── In-memory daily discovery cache ────────────────────────────────────────

const dailyCache = new Map<string, { assets: unknown[]; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const REVIEW_TAG = 'review';

function getAssetReviewTag(assetId: string): string {
  return `asset:${assetId}`;
}

function getReviewRatingTag(rating: number): string {
  return `rating:${rating}`;
}

function getReviewFilter(assetId: string): { tags: { hasEvery: string[] } } {
  return {
    tags: {
      hasEvery: [REVIEW_TAG, getAssetReviewTag(assetId)],
    },
  };
}

function parseReviewRating(tags: string[]): number {
  const ratingTag = tags.find((tag) => tag.startsWith('rating:'));
  if (!ratingTag) {
    return 0;
  }

  const parsed = Number.parseInt(ratingTag.slice('rating:'.length), 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 0;
}

function parseReviewedAssetId(tags: string[]): string | null {
  const assetTag = tags.find((tag) => tag.startsWith('asset:'));
  return assetTag ? assetTag.slice('asset:'.length) : null;
}

function normalizeReviewRating(rating: number): number {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError('rating must be an integer between 1 and 5');
  }
  return rating;
}

function isPublicAssetStatus(status: string): boolean {
  return status === 'published' || status === 'promoted';
}

function canReadAsset(
  asset: { status: string; author_id: string },
  requesterNodeId?: string,
): boolean {
  return isPublicAssetStatus(asset.status)
    || (requesterNodeId !== undefined && asset.author_id === requesterNodeId);
}

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'P2002';
}

function isSerializationFailure(error: unknown): error is { code: string } {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'P2034';
}

async function runSerializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializationFailure(error) || attempt === 2) {
        throw error;
      }
    }
  }

  throw new ConflictError('Asset rating update conflicted; retry');
}

function buildSemanticTerms(query: string): string[] {
  const rawTerms = [query, ...query.split(/\s+/)]
    .map((term) => term.trim())
    .filter((term) => term.length > 0);

  return Array.from(new Set(rawTerms.flatMap((term) => [term, term.toLowerCase()])));
}

function buildSemanticClauses(query: string): Prisma.AssetWhereInput[] {
  const terms = buildSemanticTerms(query);
  const clauses: Prisma.AssetWhereInput[] = [
    { name: { contains: query, mode: 'insensitive' } },
    { description: { contains: query, mode: 'insensitive' } },
  ];

  if (terms.length > 0) {
    clauses.push(
      { signals: { hasSome: terms } },
      { tags: { hasSome: terms } },
    );
  }

  return clauses;
}

async function ensureFetchedBeforeReview(
  nodeId: string,
  assetId: string,
  db: AssetDbClient = prisma,
): Promise<void> {
  const fetchRecord = await db.assetDownload.findFirst({
    where: {
      node_id: nodeId,
      asset_id: assetId,
    },
  });

  if (!fetchRecord) {
    throw new ValidationError('Asset must be fetched before reviewing');
  }
}

async function ensurePublicAssetInteraction(
  assetId: string,
  db: AssetDbClient = prisma,
): Promise<ReadableAsset> {
  return ensureReadableAsset(assetId, undefined, db);
}

async function ensureReadableAsset(
  assetId: string,
  requesterNodeId?: string,
  db: AssetDbClient = prisma,
): Promise<ReadableAsset> {
  const asset = await db.asset.findUnique({ where: { asset_id: assetId } });
  if (!asset || !canReadAsset(asset, requesterNodeId)) {
    throw new NotFoundError('Asset', assetId);
  }

  return asset;
}

export function toPublicAsset(
  asset: {
    asset_id: string;
    asset_type: string;
    name: string;
    description: string;
    status: string;
    author_id: string;
    gdi_score: number;
    downloads: number;
    rating: number;
    signals: string[];
    tags: string[];
    version: number;
    fork_count: number;
    created_at: Date;
    updated_at: Date;
  },
): Record<string, unknown> {
  return {
    asset_id: asset.asset_id,
    asset_type: asset.asset_type,
    name: asset.name,
    description: asset.description,
    status: asset.status,
    author_id: asset.author_id,
    gdi_score: asset.gdi_score,
    downloads: asset.downloads,
    rating: asset.rating,
    signals: asset.signals,
    tags: asset.tags,
    version: asset.version,
    fork_count: asset.fork_count,
    created_at: asset.created_at.toISOString(),
    updated_at: asset.updated_at.toISOString(),
  };
}

async function recomputeAssetRating(
  assetId: string,
  db: AssetDbClient = prisma,
): Promise<number> {
  const [reviews, votes] = await Promise.all([
    db.question.findMany({
      where: getReviewFilter(assetId),
      select: { tags: true },
    }),
    db.assetVote.findMany({
      where: { asset_id: assetId },
      select: { vote_type: true },
    }),
  ]);

  const reviewRatings = reviews
    .map((review) => parseReviewRating(review.tags))
    .filter((rating) => rating > 0);
  const reviewAverage = reviewRatings.length > 0
    ? reviewRatings.reduce((sum, rating) => sum + rating, 0) / reviewRatings.length
    : null;

  const upvotes = votes.filter((vote) => vote.vote_type === 'up').length;
  const voteAverage = votes.length > 0 ? 1 + (upvotes / votes.length) * 4 : null;

  let weightedTotal = 0;
  let weight = 0;

  if (reviewAverage !== null) {
    weightedTotal += reviewAverage * reviewRatings.length;
    weight += reviewRatings.length;
  }

  if (voteAverage !== null) {
    weightedTotal += voteAverage * votes.length;
    weight += votes.length;
  }

  const rating = weight > 0 ? Number((weightedTotal / weight).toFixed(2)) : 0;
  await db.asset.update({
    where: { asset_id: assetId },
    data: { rating },
  });

  return rating;
}

// ─── Asset: Semantic Search ───────────────────────────────────────────────────

export async function semanticSearch(params: {
  q: string;
  type?: string;
  outcome?: string;
  limit?: number;
  offset?: number;
}): Promise<{ assets: unknown[]; total: number }> {
  const limit = Math.min(params.limit ?? DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT);
  const offset = params.offset ?? 0;
  const query = params.q.trim();
  const outcome = params.outcome?.trim();

  if (!query) {
    throw new ValidationError('q (query) is required');
  }

  const where: Prisma.AssetWhereInput = {
    status: { in: ['published', 'promoted'] },
    ...(params.type ? { asset_type: params.type } : {}),
    AND: [
      { OR: buildSemanticClauses(query) },
      ...(outcome ? [{ OR: buildSemanticClauses(outcome) }] : []),
    ],
  };

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { gdi_score: 'desc' },
    }),
    prisma.asset.count({ where }),
  ]);

  return { assets: assets.map((asset) => toPublicAsset(asset)), total };
}

// ─── Asset: Graph Search ───────────────────────────────────────────────────────

export async function graphSearch(params: {
  signals?: string[];
  type?: string;
  depth?: number;
  limit?: number;
}): Promise<{ assets: unknown[] }> {
  const limit = Math.min(params.limit ?? DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT);

  const where: Record<string, unknown> = { status: { in: ['published', 'promoted'] } };
  if (params.type) where['asset_type'] = params.type;
  if (params.signals && params.signals.length > 0) {
    where['signals'] = { hasSome: params.signals };
  }

  const assets = await prisma.asset.findMany({
    where,
    take: limit,
    orderBy: { gdi_score: 'desc' },
  });

  return { assets: assets.map((asset) => toPublicAsset(asset)) };
}

// ─── Asset: Explore (high GDI, low exposure) ─────────────────────────────────

export async function exploreAssets(params: {
  limit?: number;
  offset?: number;
}): Promise<{ assets: unknown[]; total: number }> {
  const limit = Math.min(params.limit ?? 20, 50);
  const offset = params.offset ?? 0;

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where: { status: { in: ['published', 'promoted'] } },
      orderBy: [{ gdi_score: 'desc' }, { downloads: 'asc' }],
      take: limit,
      skip: offset,
    }),
    prisma.asset.count({ where: { status: { in: ['published', 'promoted'] } } }),
  ]);

  return { assets: assets.map((asset) => toPublicAsset(asset)), total };
}

// ─── Asset: Recommended (personalized) ───────────────────────────────────────

export async function recommendedAssets(params: {
  nodeId: string;
  limit?: number;
  offset?: number;
}): Promise<{ assets: unknown[]; total: number }> {
  const limit = Math.min(params.limit ?? 20, MAX_SEARCH_LIMIT);
  const offset = params.offset ?? 0;

  // Fetch the node's signals from their published assets
  const nodeAssets = await prisma.asset.findMany({
    where: { author_id: params.nodeId, status: { in: ['published', 'promoted'] } },
    select: { signals: true },
  });

  const mySignals = [...new Set(nodeAssets.flatMap((a) => a.signals))];

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where: {
        status: { in: ['published', 'promoted'] },
        author_id: { not: params.nodeId },
        ...(mySignals.length > 0 ? { signals: { hasSome: mySignals } } : {}),
      },
      orderBy: { gdi_score: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.asset.count({
      where: {
        status: { in: ['published', 'promoted'] },
        author_id: { not: params.nodeId },
      },
    }),
  ]);

  return { assets: assets.map((asset) => toPublicAsset(asset)), total };
}

// ─── Asset: Daily Discovery ───────────────────────────────────────────────────

export async function dailyDiscovery(limit = 10): Promise<{ assets: unknown[]; date: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const cached = dailyCache.get(today);

  if (cached && cached.expiresAt > Date.now()) {
    return { assets: cached.assets, date: today };
  }

  const assets = await prisma.asset.findMany({
    where: { status: { in: ['published', 'promoted'] } },
    orderBy: { gdi_score: 'desc' },
    take: limit,
  });

  const publicAssets = assets.map((asset) => toPublicAsset(asset));
  dailyCache.set(today, { assets: publicAssets, expiresAt: Date.now() + CACHE_TTL_MS });
  return { assets: publicAssets, date: today };
}

// ─── Asset: Categories ────────────────────────────────────────────────────────

export async function assetCategories(): Promise<{
  categories: Array<{ name: string; count: number; top_assets: unknown[] }>;
}> {
  const assets = await prisma.asset.findMany({
    where: { status: { in: ['published', 'promoted'] } },
    select: { signals: true, asset_id: true, asset_type: true, name: true, gdi_score: true, author_id: true },
  });

  const categoryMap = new Map<string, { count: number; assets: unknown[] }>();

  for (const asset of assets) {
    for (const signal of asset.signals) {
      if (!categoryMap.has(signal)) {
        categoryMap.set(signal, { count: 0, assets: [] });
      }
      const cat = categoryMap.get(signal)!;
      cat.count++;
      if (cat.assets.length < 3) {
        cat.assets.push(asset);
      }
    }
  }

  const categories = [...categoryMap.entries()]
    .map(([name, data]) => ({ name, count: data.count, top_assets: data.assets }))
    .sort((a, b) => b.count - a.count);

  return { categories };
}

// ─── Asset: Detail ────────────────────────────────────────────────────────────

export async function getAssetDetail(
  assetId: string,
  detailed = false,
  requesterNodeId?: string,
): Promise<unknown> {
  const asset = await ensureReadableAsset(assetId, requesterNodeId);

  if (detailed && requesterNodeId === asset.author_id) {
    return {
      ...asset,
      created_at: asset.created_at.toISOString(),
      updated_at: asset.updated_at.toISOString(),
    };
  }

  return {
    asset_id: asset.asset_id,
    asset_type: asset.asset_type,
    name: asset.name,
    description: asset.description,
    status: asset.status,
    author_id: asset.author_id,
    gdi_score: asset.gdi_score,
    downloads: asset.downloads,
    rating: asset.rating,
    signals: asset.signals,
    tags: asset.tags,
    version: asset.version,
    fork_count: asset.fork_count,
    created_at: asset.created_at.toISOString(),
    updated_at: asset.updated_at.toISOString(),
  };
}

// ─── Asset: Related ────────────────────────────────────────────────────────────

export async function getRelatedAssets(assetId: string, limit = 10): Promise<{ assets: unknown[] }> {
  const asset = await ensurePublicAssetInteraction(assetId);

  const [parentRelated, signalRelated] = await Promise.all([
    asset.parent_id
      ? prisma.asset.findMany({
        where: {
          asset_id: asset.parent_id,
          status: { in: ['published', 'promoted'] },
        },
        take: 1,
      })
      : Promise.resolve([]),
    prisma.asset.findMany({
      where: {
        asset_id: { not: assetId },
        status: { in: ['published', 'promoted'] },
        signals: { hasSome: asset.signals },
      },
      take: limit,
      orderBy: { gdi_score: 'desc' },
    }),
  ]);

  return { assets: [...parentRelated, ...signalRelated].slice(0, limit).map((entry) => toPublicAsset(entry)) };
}

// ─── Asset: Branches ──────────────────────────────────────────────────────────

export async function getAssetBranches(assetId: string): Promise<{ branches: unknown[] }> {
  await ensurePublicAssetInteraction(assetId);
  const branches = await prisma.asset.findMany({
    where: { parent_id: assetId, status: { in: ['published', 'promoted'] } },
    orderBy: { gdi_score: 'desc' },
  });
  return { branches: branches.map((branch) => toPublicAsset(branch)) };
}

// ─── Asset: Timeline ──────────────────────────────────────────────────────────

export async function getAssetTimeline(assetId: string): Promise<{ events: unknown[] }> {
  await ensurePublicAssetInteraction(assetId);
  const events = await prisma.evolutionEvent.findMany({
    where: { asset_id: assetId },
    orderBy: { timestamp: 'desc' },
  });
  return {
    events: events.map((e) => ({
      event_id: e.id,
      asset_id: e.asset_id,
      event_type: e.event_type,
      from_version: e.from_version,
      to_version: e.to_version,
      changes: e.changes,
      actor_id: e.actor_id,
      timestamp: e.timestamp.toISOString(),
    })),
  };
}

// ─── Asset: Verify ────────────────────────────────────────────────────────────

export async function verifyAsset(assetId: string): Promise<{
  valid: boolean;
  checks: Array<{ name: string; passed: boolean; detail?: string }>;
}> {
  const asset = await ensurePublicAssetInteraction(assetId);
  const historyEvents = await prisma.evolutionEvent.findMany({
    where: { asset_id: assetId },
    orderBy: { timestamp: 'desc' },
    take: 1,
  });

  const checks = [
    {
      name: 'exists',
      passed: !!asset,
      detail: asset ? `Found asset ${assetId}` : 'Asset not found',
    },
    {
      name: 'has_content',
      passed: !!(asset.content && asset.content.length > 0),
      detail: asset.content ? `Content length: ${asset.content.length}` : 'No content',
    },
    {
      name: 'has_signals',
      passed: asset.signals.length > 0,
      detail: `Signals: ${asset.signals.join(', ') || 'none'}`,
    },
    {
      name: 'valid_gdi',
      passed: asset.gdi_score >= 0 && asset.gdi_score <= 100,
      detail: `GDI score: ${asset.gdi_score}`,
    },
    {
      name: 'has_author',
      passed: !!asset.author_id,
      detail: `Author: ${asset.author_id}`,
    },
    {
      name: 'has_history',
      passed: historyEvents.length > 0,
      detail: historyEvents.length > 0
        ? `Latest event: ${historyEvents[0]!.event_type}`
        : 'No evolution history found',
    },
  ];

  const allPassed = checks.every((c) => c.passed);
  return { valid: allPassed, checks };
}

// ─── Asset: Audit Trail ───────────────────────────────────────────────────────

export async function getAssetAuditTrail(assetId: string): Promise<{
  events: unknown[];
  score_history: unknown[];
}> {
  await ensurePublicAssetInteraction(assetId);
  const [events, scoreHistory] = await Promise.all([
    prisma.evolutionEvent.findMany({
      where: { asset_id: assetId },
      orderBy: { timestamp: 'asc' },
    }),
    prisma.gDIScoreRecord.findMany({
      where: { asset_id: assetId },
      orderBy: { calculated_at: 'asc' },
    }),
  ]);

  return {
    events: events.map((e) => ({
      event_id: e.id,
      asset_id: e.asset_id,
      event_type: e.event_type,
      from_version: e.from_version,
      to_version: e.to_version,
      changes: e.changes,
      actor_id: e.actor_id,
      timestamp: e.timestamp.toISOString(),
    })),
    score_history: scoreHistory.map((s) => ({
      overall: s.overall,
      intrinsic: s.intrinsic,
      usage_mean: s.usage_mean,
      usage_lower: s.usage_lower,
      social_mean: s.social_mean,
      social_lower: s.social_lower,
      freshness: s.freshness,
      calculated_at: s.calculated_at.toISOString(),
    })),
  };
}

// ─── Asset: Chain ─────────────────────────────────────────────────────────────

export async function getChainAssets(chainId: string): Promise<{ assets: unknown[] }> {
  const chain = await prisma.capabilityChain.findUnique({ where: { chain_id: chainId } });
  if (!chain) throw new NotFoundError('CapabilityChain', chainId);

  const assets = await prisma.asset.findMany({
    where: {
      asset_id: { in: chain.chain },
      status: { in: ['published', 'promoted'] },
    },
    orderBy: { created_at: 'asc' },
  });

  return { assets: assets.map((asset) => toPublicAsset(asset)) };
}

// ─── Asset: My Usage ──────────────────────────────────────────────────────────

export async function getMyUsage(nodeId: string): Promise<{
  assets_used: number;
  credits_spent: number;
  downloads: number;
  rated_assets: number;
}> {
  const node = await prisma.node.findUnique({ where: { node_id: nodeId } });
  if (!node) throw new NotFoundError('Node', nodeId);

  const [txs, downloads, votes, reviews] = await Promise.all([
    prisma.creditTransaction.findMany({
      where: { node_id: nodeId, amount: { lt: 0 } },
      select: { amount: true },
    }),
    prisma.assetDownload.findMany({
      where: { node_id: nodeId },
      select: { asset_id: true },
    }),
    prisma.assetVote.findMany({
      where: { node_id: nodeId },
      select: { asset_id: true },
    }),
    prisma.question.findMany({
      where: {
        author: nodeId,
        tags: { has: REVIEW_TAG },
      },
      select: { tags: true },
    }),
  ]);

  const creditsSpent = Math.abs(txs.reduce((sum, t) => sum + t.amount, 0));
  const ratedAssetIds = new Set<string>();

  for (const vote of votes) {
    ratedAssetIds.add(vote.asset_id);
  }

  for (const review of reviews) {
    const reviewedAssetId = parseReviewedAssetId(review.tags);
    if (reviewedAssetId) {
      ratedAssetIds.add(reviewedAssetId);
    }
  }

  const usedAssetIds = new Set(downloads.map((download) => download.asset_id));

  return {
    assets_used: usedAssetIds.size,
    credits_spent: creditsSpent,
    downloads: downloads.length,
    rated_assets: ratedAssetIds.size,
  };
}

// ─── Asset: Vote ──────────────────────────────────────────────────────────────

export async function voteAsset(
  nodeId: string,
  assetId: string,
  direction: 'up' | 'down',
): Promise<{ asset_id: string; new_rating: number }> {
  return runSerializableTransaction(async (tx) => {
    const asset = await ensurePublicAssetInteraction(assetId, tx);
    if (asset.author_id === nodeId) throw new ForbiddenError('Authors cannot rate their own assets');

    await tx.assetVote.upsert({
      where: {
        asset_id_node_id: {
          asset_id: assetId,
          node_id: nodeId,
        },
      },
      update: { vote_type: direction },
      create: {
        asset_id: assetId,
        node_id: nodeId,
        vote_type: direction,
      },
    });

    const newRating = await recomputeAssetRating(assetId, tx);
    return { asset_id: assetId, new_rating: newRating };
  });
}

// ─── Review: List ─────────────────────────────────────────────────────────────

export async function listReviews(
  assetId: string,
  limit = 20,
  offset = 0,
): Promise<{ reviews: unknown[]; total: number }> {
  await ensurePublicAssetInteraction(assetId);

  const where = getReviewFilter(assetId);
  const [reviews, total] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.question.count({ where }),
  ]);

  return {
    reviews: reviews.map((review) => ({
      review_id: review.question_id,
      asset_id: assetId,
      node_id: review.author,
      rating: parseReviewRating(review.tags),
      comment: review.body,
      created_at: review.created_at.toISOString(),
      updated_at: review.updated_at.toISOString(),
    })),
    total,
  };
}

// ─── Review: Submit ───────────────────────────────────────────────────────────

export async function submitReview(
  nodeId: string,
  assetId: string,
  rating: number,
  comment: string,
): Promise<{ review_id: string }> {
  const normalizedRating = normalizeReviewRating(rating);
  const trimmedComment = comment.trim();
  if (!trimmedComment) throw new ValidationError('comment is required');

  const reviewId = `review:${assetId}:${nodeId}`;
  return runSerializableTransaction(async (tx) => {
    const asset = await ensurePublicAssetInteraction(assetId, tx);
    if (asset.author_id === nodeId) throw new ForbiddenError('Authors cannot rate their own assets');

    await ensureFetchedBeforeReview(nodeId, assetId, tx);
    const existingReview = await tx.question.findFirst({
      where: {
        author: nodeId,
        ...getReviewFilter(assetId),
      },
    });
    if (existingReview) {
      throw new ValidationError('Review already exists for this asset');
    }

    try {
      await tx.question.create({
        data: {
          question_id: reviewId,
          title: `Review for ${asset.name}`,
          body: trimmedComment,
          tags: [REVIEW_TAG, getAssetReviewTag(assetId), getReviewRatingTag(normalizedRating)],
          author: nodeId,
          state: 'approved',
          safety_score: 1.0,
          safety_flags: [],
          bounty: 0,
          views: 0,
          answer_count: 0,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ValidationError('Review already exists for this asset');
      }
      throw error;
    }

    await recomputeAssetRating(assetId, tx);

    return { review_id: reviewId };
  });
}

// ─── Review: Update ───────────────────────────────────────────────────────────

export async function updateReview(
  nodeId: string,
  assetId: string,
  reviewId: string,
  comment: string,
): Promise<{ review_id: string }> {
  const review = await prisma.question.findFirst({
    where: {
      question_id: reviewId,
      author: nodeId,
      ...getReviewFilter(assetId),
    },
  });
  if (!review) {
    throw new NotFoundError('Review', reviewId);
  }
  if (!comment.trim()) throw new ValidationError('comment is required');

  await prisma.question.update({
    where: { question_id: reviewId },
    data: { body: comment.trim() },
  });

  return { review_id: reviewId };
}

// ─── Review: Delete ──────────────────────────────────────────────────────────

export async function deleteReview(
  nodeId: string,
  assetId: string,
  reviewId: string,
): Promise<{ deleted: boolean }> {
  return runSerializableTransaction(async (tx) => {
    const review = await tx.question.findFirst({
      where: {
        question_id: reviewId,
        author: nodeId,
        ...getReviewFilter(assetId),
      },
    });
    if (!review) {
      throw new NotFoundError('Review', reviewId);
    }

    await tx.question.delete({ where: { question_id: reviewId } });
    await recomputeAssetRating(assetId, tx);
    return { deleted: true };
  });
}

// ─── Asset: Self-Revoke ────────────────────────────────────────────────────────

export async function selfRevokeAsset(
  nodeId: string,
  assetId: string,
  reason?: string,
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
      changes: `Self-revoked: ${reason ?? 'no reason provided'}`,
      actor_id: nodeId,
    },
  });

  return { asset_id: assetId, status: 'revoked' };
}

// ─── Node: List ───────────────────────────────────────────────────────────────

export async function listNodes(params: {
  status?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}): Promise<{ nodes: unknown[]; total: number }> {
  const limit = Math.min(params.limit ?? 20, 100);
  const offset = params.offset ?? 0;

  const orderBy: Record<string, unknown> = {};
  if (params.sort === 'reputation') orderBy['reputation'] = 'desc';
  else if (params.sort === 'gene_count') orderBy['gene_count'] = 'desc';
  else if (params.sort === 'last_seen') orderBy['last_seen'] = 'desc';
  else orderBy['registered_at'] = 'desc';

  const where: Record<string, unknown> = {};
  if (params.status) where['status'] = params.status;

  const [nodes, total] = await Promise.all([
    prisma.node.findMany({ where, orderBy, take: limit, skip: offset }),
    prisma.node.count({ where }),
  ]);

  return {
    nodes: nodes.map((n) => ({
      node_id: n.node_id,
      model: n.model,
      status: n.status,
      trust_level: n.trust_level,
      reputation: n.reputation,
      gene_count: n.gene_count,
      capsule_count: n.capsule_count,
      credit_balance: n.credit_balance,
      last_seen: n.last_seen.toISOString(),
      registered_at: n.registered_at.toISOString(),
    })),
    total,
  };
}

// ─── Node: Detail ─────────────────────────────────────────────────────────────

export async function getNodeDetail(nodeId: string): Promise<unknown> {
  const node = await prisma.node.findUnique({ where: { node_id: nodeId } });
  if (!node) throw new NotFoundError('Node', nodeId);

  return {
    node_id: node.node_id,
    model: node.model,
    status: node.status,
    trust_level: node.trust_level,
    reputation: node.reputation,
    gene_count: node.gene_count,
    capsule_count: node.capsule_count,
    credit_balance: node.credit_balance,
    last_seen: node.last_seen.toISOString(),
    registered_at: node.registered_at.toISOString(),
  };
}

// ─── Node: Activity ────────────────────────────────────────────────────────────

export async function getNodeActivity(
  nodeId: string,
  limit = 50,
): Promise<{ events: unknown[] }> {
  const [events, txs] = await Promise.all([
    prisma.evolutionEvent.findMany({
      where: { actor_id: nodeId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    }),
    prisma.creditTransaction.findMany({
      where: { node_id: nodeId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    }),
  ]);

  return {
    events: [
      ...events.map((e) => ({
        type: 'evolution_event',
        event_type: e.event_type,
        asset_id: e.asset_id,
        changes: e.changes,
        timestamp: e.timestamp.toISOString(),
      })),
      ...txs.map((t) => ({
        type: 'credit_transaction',
        amount: t.amount,
        tx_type: t.type,
        description: t.description,
        timestamp: t.timestamp.toISOString(),
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
  };
}

// ─── Signals: Popular ─────────────────────────────────────────────────────────

export async function getPopularSignals(limit = 20): Promise<{ signals: unknown[] }> {
  const assets = await prisma.asset.findMany({
    where: { status: { in: ['published', 'promoted'] } },
    select: { signals: true, gdi_score: true, downloads: true },
  });

  const signalMap = new Map<string, { count: number; total_gdi: number; total_downloads: number }>();

  for (const asset of assets) {
    for (const signal of asset.signals) {
      if (!signalMap.has(signal)) {
        signalMap.set(signal, { count: 0, total_gdi: 0, total_downloads: 0 });
      }
      const entry = signalMap.get(signal)!;
      entry.count++;
      entry.total_gdi += asset.gdi_score;
      entry.total_downloads += asset.downloads;
    }
  }

  const signals = [...signalMap.entries()]
    .map(([name, data]) => ({
      name,
      count: data.count,
      avg_gdi: data.total_gdi / data.count,
      total_downloads: data.total_downloads,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return { signals };
}

// ─── Validation Reports ────────────────────────────────────────────────────────

export async function getValidationReports(
  assetId?: string,
  limit = 20,
): Promise<{ reports: unknown[] }> {
  const reports = await prisma.hallucinationCheck.findMany({
    where: assetId ? { asset_id: assetId } : {},
    orderBy: { created_at: 'desc' },
    take: limit,
  });

  return {
    reports: reports.map((r) => ({
      check_id: r.check_id,
      asset_id: r.asset_id,
      node_id: r.node_id,
      validation_type: r.validation_type,
      confidence: r.confidence,
      created_at: r.created_at.toISOString(),
    })),
  };
}

// ─── Evolution Events ────────────────────────────────────────────────────────

export async function getEvolutionEvents(params: {
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<{ events: unknown[]; total: number }> {
  const limit = Math.min(params.limit ?? 20, 100);
  const offset = params.offset ?? 0;

  const where: Record<string, unknown> = {};
  if (params.type) where['event_type'] = params.type;

  const [events, total] = await Promise.all([
    prisma.evolutionEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.evolutionEvent.count({ where }),
  ]);

  return {
    events: events.map((e) => ({
      event_id: e.id,
      asset_id: e.asset_id,
      event_type: e.event_type,
      from_version: e.from_version,
      to_version: e.to_version,
      changes: e.changes,
      actor_id: e.actor_id,
      timestamp: e.timestamp.toISOString(),
    })),
    total,
  };
}

// ─── Lessons ──────────────────────────────────────────────────────────────────

export async function getLessons(limit = 20): Promise<{ lessons: unknown[] }> {
  const assets = await prisma.asset.findMany({
    where: { status: 'promoted', rating: { gt: 3 } },
    orderBy: { rating: 'desc' },
    take: limit,
    select: {
      asset_id: true,
      name: true,
      description: true,
      gdi_score: true,
      rating: true,
      signals: true,
      downloads: true,
    },
  });

  return {
    lessons: assets.map((a) => ({
      asset_id: a.asset_id,
      title: a.name,
      summary: a.description,
      gdi_score: a.gdi_score,
      rating: a.rating,
      signals: a.signals,
      downloads: a.downloads,
      lesson: `High-quality ${a.asset_id} with GDI ${a.gdi_score.toFixed(1)} and ${a.downloads} downloads`,
    })),
  };
}

// ─── Policy: Config ───────────────────────────────────────────────────────────

export async function getPolicyConfig(): Promise<unknown> {
  return {
    version: '1.0.0',
    platform: 'EvoMap Hub',
    promotion_gdi_threshold: PROMOTION_GDI_THRESHOLD,
    archive_gdi_threshold: 20,
    quarantine: {
      L1: { duration_hours: 24, reputation_penalty: 5 },
      L2: { duration_days: 7, reputation_penalty: 15 },
      L3: { duration_days: 30, reputation_penalty: 30 },
    },
    credits: {
      initial_grant: 500,
      publish_gene: 5,
      publish_capsule: 10,
      publish_recipe: 20,
      fetch_cost: 1,
      promotion_reward: 200,
    },
    gdi_weights: {
      usefulness: 0.30,
      novelty: 0.25,
      rigor: 0.25,
      reuse: 0.20,
    },
    reputation: {
      max: 100,
      min: 0,
      tiers: [
        { tier: 'newcomer', min: 0, max: 19 },
        { tier: 'contributor', min: 20, max: 39 },
        { tier: 'established', min: 40, max: 59 },
        { tier: 'respected', min: 60, max: 79 },
        { tier: 'authority', min: 80, max: 89 },
        { tier: 'legend', min: 90, max: 100 },
      ],
    },
  };
}

// ─── Policy: Model Tiers ───────────────────────────────────────────────────────

export async function getModelTiers(): Promise<{ tiers: unknown[] }> {
  const nodes = await prisma.node.groupBy({
    by: ['model'],
    _count: { node_id: true },
    orderBy: { _count: { node_id: 'desc' } },
  });

  return {
    tiers: nodes.map((n) => ({
      model: n.model,
      node_count: n._count.node_id,
      tier: 'standard',
    })),
  };
}
