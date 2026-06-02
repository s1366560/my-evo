// Asset marketplace service — GEP protocol implementation
// Supports Gene / Capsule / Recipe assets with versioning, reviews, purchases, recycling.
import { prisma, isMockMode, mockStore } from '../db/index.js';
import { HttpError } from '../middleware/errorHandler.js';
import type {
  AssetDto, AssetVersionDto, AssetReviewDto, AssetPurchaseDto,
  CreateAssetDto, UpdateAssetDto, PublishAssetDto,
  CreateReviewDto, PurchaseAssetDto, RecipeStepDto,
} from '../shared/types.js';

// ── DTO mappers ───────────────────────────────────────────
function toDto(a: any): AssetDto {
  return {
    id: a.id, title: a.title, description: a.description ?? null,
    type: a.type, kind: a.kind ?? null, published: a.published ?? false,
    status: a.status ?? 'draft', price: a.price ?? null,
    publishedVersionId: a.publishedVersionId ?? null,
    authorId: a.authorId, nodeId: a.nodeId ?? null,
    metadata: a.metadata ?? {},
    createdAt: a.createdAt, updatedAt: a.updatedAt,
  };
}

function toStepDto(s: any): RecipeStepDto {
  return { order: s.order, kind: s.kind, title: s.title, body: s.body, metadata: s.metadata ?? {} };
}

function toVersionDto(v: any): AssetVersionDto {
  return {
    id: v.id, assetId: v.assetId, versionNo: v.versionNo,
    title: v.title, description: v.description ?? null,
    content: v.content ?? null, url: v.url ?? null,
    metadata: v.metadata ?? {}, price: v.price ?? null,
    authorId: v.authorId, changelog: v.changelog ?? null,
    createdAt: v.createdAt,
    steps: v.steps?.map(toStepDto),
  };
}

function toReviewDto(r: any): AssetReviewDto {
  return {
    id: r.id, assetId: r.assetId, userId: r.userId,
    rating: r.rating, comment: r.comment ?? null,
    createdAt: r.createdAt, updatedAt: r.updatedAt,
  };
}

function toPurchaseDto(p: any): AssetPurchaseDto {
  return {
    id: p.id, assetId: p.assetId, versionId: p.versionId,
    userId: p.userId, pricePaid: p.pricePaid,
    status: p.status, idempotencyKey: p.idempotencyKey ?? null,
    createdAt: p.createdAt,
  };
}

export interface ListOptions {
  page: number;
  limit: number;
  type?: string;
  status?: string;
  authorId?: string;
  nodeId?: string;
  q?: string;
}

export class AssetService {
  // ─── LIST ─────────────────────────────────────────────
  async listAssets(opts: ListOptions): Promise<{ data: AssetDto[]; pagination: { page: number; limit: number; total: number } }> {
    if (isMockMode()) return this.mockListAssets(opts);
    const where: any = {};
    if (opts.type) where.type = opts.type;
    if (opts.status) where.status = opts.status;
    if (opts.authorId) where.authorId = opts.authorId;
    if (opts.nodeId) where.nodeId = opts.nodeId;
    if (opts.q) where.title = { contains: opts.q, mode: 'insensitive' };
    const [rows, total] = await Promise.all([
      prisma!.asset.findMany({ where, skip: (opts.page - 1) * opts.limit, take: opts.limit, orderBy: { createdAt: 'desc' } }),
      prisma!.asset.count({ where }),
    ]);
    return { data: rows.map(toDto), pagination: { page: opts.page, limit: opts.limit, total } };
  }

  // ─── DETAIL ────────────────────────────────────────────
  async getAsset(id: string): Promise<AssetDto> {
    if (isMockMode()) return this.mockGetAsset(id);
    const a = await prisma!.asset.findUnique({ where: { id }, include: { versions: { orderBy: { versionNo: 'desc' } } } });
    if (!a) throw new HttpError(404, 'Asset not found');
    const dto = toDto(a) as any;
    dto.versions = a.versions.map(toVersionDto);
    try {
      const agg = await prisma!.$queryRawUnsafe<{ _avg: number | null; _count: number }[]>(
        `SELECT AVG(rating)::float as "_avg", COUNT(*)::int as "_count" FROM asset_reviews WHERE "assetId" = $1`, id
      );
      dto.avgRating = agg[0]?._avg ?? null;
      dto.reviewCount = agg[0]?._count ?? 0;
    } catch { dto.avgRating = 0; dto.reviewCount = 0; }
    return dto;
  }

  // ─── CREATE ────────────────────────────────────────────
  async createAsset(userId: string, data: CreateAssetDto): Promise<AssetDto> {
    if (isMockMode()) return this.mockCreateAsset(userId, data);
    const a = await prisma!.asset.create({
      data: {
        title: data.title, description: data.description ?? null,
        type: data.type, kind: data.kind ?? null,
        content: data.content ?? null, url: data.url ?? null,
        metadata: (data.metadata as any) ?? {}, price: data.price ?? null,
        published: false, status: 'draft',
        authorId: userId, nodeId: data.nodeId ?? null,
      },
    });
    return toDto(a);
  }

  // ─── UPDATE ────────────────────────────────────────────
  async updateAsset(userId: string, assetId: string, data: UpdateAssetDto): Promise<AssetDto> {
    if (isMockMode()) return this.mockUpdateAsset(userId, assetId, data);
    const existing = await prisma!.asset.findUnique({ where: { id: assetId } });
    if (!existing) throw new HttpError(404, 'Asset not found');
    if (existing.authorId !== userId) throw new HttpError(403, 'Not your asset');
    if (existing.status === 'recycled') throw new HttpError(400, 'Cannot update recycled asset');
    const a = await prisma!.asset.update({ where: { id: assetId }, data: data as any });
    return toDto(a);
  }

  // ─── PUBLISH (version bump) ────────────────────────────
  async publishAsset(userId: string, assetId: string, data: PublishAssetDto): Promise<AssetVersionDto> {
    if (isMockMode()) return this.mockPublishAsset(userId, assetId, data);
    const existing = await prisma!.asset.findUnique({
      where: { id: assetId },
      include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } },
    });
    if (!existing) throw new HttpError(404, 'Asset not found');
    if (existing.authorId !== userId) throw new HttpError(403, 'Not your asset');
    if (existing.status === 'recycled') throw new HttpError(400, 'Cannot publish recycled asset');

    const nextVersionNo = (existing.versions[0]?.versionNo ?? 0) + 1;
    const version = await prisma!.assetVersion.create({
      data: {
        assetId, versionNo: nextVersionNo,
        title: existing.title, description: existing.description,
        content: existing.content, url: existing.url,
        metadata: (existing.metadata as any) ?? {}, price: existing.price,
        authorId: userId, changelog: data.changelog ?? null,
        steps: data.steps?.length
          ? { create: data.steps.map(s => ({ order: s.order, kind: s.kind, title: s.title, body: s.body, metadata: (s.metadata as any) ?? {} })) }
          : undefined,
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    await prisma!.asset.update({
      where: { id: assetId },
      data: { published: true, status: 'published', publishedVersionId: version.id },
    });
    return toVersionDto(version);
  }

  // ─── VERSION HISTORY ────────────────────────────────────
  async getVersionHistory(assetId: string): Promise<AssetVersionDto[]> {
    if (isMockMode()) return this.mockGetVersionHistory(assetId);
    const versions = await prisma!.assetVersion.findMany({
      where: { assetId }, orderBy: { versionNo: 'desc' },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    return versions.map(toVersionDto);
  }

  // ─── REVIEW ────────────────────────────────────────────
  async createReview(userId: string, assetId: string, data: CreateReviewDto): Promise<AssetReviewDto> {
    if (isMockMode()) return this.mockCreateReview(userId, assetId, data);
    const asset = await prisma!.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new HttpError(404, 'Asset not found');
    if (!asset.published) throw new HttpError(400, 'Cannot review an unpublished asset');
    const review = await prisma!.assetReview.create({
      data: { assetId, userId, rating: data.rating, comment: data.comment ?? null },
    });
    return toReviewDto(review);
  }

  // ─── PURCHASE ──────────────────────────────────────────
  async purchaseAsset(userId: string, assetId: string, data: PurchaseAssetDto): Promise<AssetPurchaseDto> {
    if (isMockMode()) return this.mockPurchaseAsset(userId, assetId, data);
    const asset = await prisma!.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new HttpError(404, 'Asset not found');
    if (!asset.published) throw new HttpError(400, 'Asset not available for purchase');
    if (!asset.publishedVersionId) throw new HttpError(400, 'No published version');
    if (asset.authorId === userId) throw new HttpError(400, 'Cannot purchase own asset');
    const price = asset.price ?? 0;
    if (data.idempotencyKey) {
      const existing = await prisma!.assetPurchase.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
      if (existing) return toPurchaseDto(existing);
    }
    const buyer = await prisma!.user.findUnique({ where: { id: userId } });
    if (!buyer) throw new HttpError(404, 'User not found');
    if (price > 0 && buyer.credits < price) throw new HttpError(400, 'Insufficient credits');
    const purchase = await prisma!.assetPurchase.create({
      data: {
        assetId, versionId: asset.publishedVersionId, userId,
        pricePaid: price, status: 'completed',
        idempotencyKey: data.idempotencyKey ?? null,
      },
    });
    if (price > 0) {
      await prisma!.user.update({ where: { id: userId }, data: { credits: { decrement: price } } });
      await prisma!.user.update({ where: { id: asset.authorId }, data: { credits: { increment: price } } });
    }
    return toPurchaseDto(purchase);
  }

  // ─── RECYCLE ───────────────────────────────────────────
  async recycleAsset(userId: string, assetId: string): Promise<AssetDto> {
    if (isMockMode()) return this.mockRecycleAsset(userId, assetId);
    const existing = await prisma!.asset.findUnique({ where: { id: assetId } });
    if (!existing) throw new HttpError(404, 'Asset not found');
    if (existing.authorId !== userId) throw new HttpError(403, 'Not your asset');
    if (existing.status === 'recycled') throw new HttpError(400, 'Already recycled');
    const a = await prisma!.asset.update({
      where: { id: assetId },
      data: { status: 'recycled', published: false, publishedVersionId: null },
    });
    return toDto(a);
  }
}

// Mock helpers — declared as standalone module functions.
// They are bound to the AssetService prototype below so they can use `this`.
async function mockListAssets(this: AssetService, opts: ListOptions) {
  let rows = Array.from(mockStore.assetDtos.values());
  if (opts.type) rows = rows.filter(a => a.type === opts.type);
  if (opts.status) rows = rows.filter(a => a.status === opts.status);
  if (opts.authorId) rows = rows.filter(a => a.authorId === opts.authorId);
  if (opts.nodeId) rows = rows.filter(a => a.nodeId === opts.nodeId);
  if (opts.q) {
    const q = opts.q.toLowerCase();
    rows = rows.filter(a => a.title.toLowerCase().includes(q));
  }
  const total = rows.length;
  const slice = rows.slice((opts.page - 1) * opts.limit, opts.page * opts.limit);
  return { data: slice, pagination: { page: opts.page, limit: opts.limit, total } };
}

async function mockGetAsset(this: AssetService, id: string): Promise<AssetDto> {
  const a = mockStore.assetDtos.get(id);
  if (!a) throw new HttpError(404, 'Asset not found');
  const versions = (mockStore.assetVersionDtos.get(id) ?? []).map(toVersionDto);
  const reviews = mockStore.assetReviewDtos.get(id) ?? [];
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  return { ...a, versions, avgRating, reviewCount: reviews.length } as any;
}

async function mockCreateAsset(this: AssetService, userId: string, data: CreateAssetDto): Promise<AssetDto> {
  const id = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();
  const a: AssetDto = {
    id, title: data.title, description: data.description ?? null,
    type: data.type as any, kind: data.kind ?? null,
    published: false, status: 'draft', price: data.price ?? null,
    publishedVersionId: null, authorId: userId, nodeId: data.nodeId ?? null,
    metadata: (data.metadata as any) ?? {}, createdAt: now, updatedAt: now,
  };
  mockStore.assetDtos.set(id, a);
  return a;
}

async function mockUpdateAsset(this: AssetService, userId: string, assetId: string, data: UpdateAssetDto): Promise<AssetDto> {
  const a = mockStore.assetDtos.get(assetId);
  if (!a) throw new HttpError(404, 'Asset not found');
  if (a.authorId !== userId) throw new HttpError(403, 'Not your asset');
  if (a.status === 'recycled') throw new HttpError(400, 'Cannot update recycled asset');
  const merged: AssetDto = { ...a, ...data, metadata: data.metadata ? (data.metadata as any) : a.metadata, updatedAt: new Date() } as any;
  mockStore.assetDtos.set(assetId, merged);
  return merged;
}

async function mockPublishAsset(this: AssetService, userId: string, assetId: string, data: PublishAssetDto): Promise<AssetVersionDto> {
  const a = mockStore.assetDtos.get(assetId);
  if (!a) throw new HttpError(404, 'Asset not found');
  if (a.authorId !== userId) throw new HttpError(403, 'Not your asset');
  if (a.status === 'recycled') throw new HttpError(400, 'Cannot publish recycled asset');
  const versions = mockStore.assetVersionDtos.get(assetId) ?? [];
  const nextNo = versions.length > 0 ? Math.max(...versions.map(v => v.versionNo)) + 1 : 1;
  const vId = `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const v: any = {
    id: vId, assetId, versionNo: nextNo,
    title: a.title, description: a.description,
    content: (a as any).content ?? null, url: (a as any).url ?? null,
    metadata: a.metadata ?? {}, price: a.price,
    authorId: userId, changelog: data.changelog ?? null,
    createdAt: new Date(),
    steps: data.steps ?? [],
  };
  versions.push(v);
  mockStore.assetVersionDtos.set(assetId, versions);
  const updated = { ...a, published: true, status: 'published', publishedVersionId: vId, updatedAt: new Date() };
  mockStore.assetDtos.set(assetId, updated);
  return toVersionDto(v);
}

async function mockGetVersionHistory(this: AssetService, assetId: string): Promise<AssetVersionDto[]> {
  const versions = mockStore.assetVersionDtos.get(assetId) ?? [];
  return versions.sort((a, b) => b.versionNo - a.versionNo).map(toVersionDto);
}

async function mockCreateReview(this: AssetService, userId: string, assetId: string, data: CreateReviewDto): Promise<AssetReviewDto> {
  const a = mockStore.assetDtos.get(assetId);
  if (!a) throw new HttpError(404, 'Asset not found');
  if (!a.published) throw new HttpError(400, 'Cannot review an unpublished asset');
  const reviews = mockStore.assetReviewDtos.get(assetId) ?? [];
  const r: AssetReviewDto = {
    id: `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    assetId, userId, rating: data.rating, comment: data.comment ?? null,
    createdAt: new Date(), updatedAt: new Date(),
  };
  reviews.push(r);
  mockStore.assetReviewDtos.set(assetId, reviews);
  return r;
}

async function mockPurchaseAsset(this: AssetService, userId: string, assetId: string, data: PurchaseAssetDto): Promise<AssetPurchaseDto> {
  const a = mockStore.assetDtos.get(assetId);
  if (!a) throw new HttpError(404, 'Asset not found');
  if (!a.published) throw new HttpError(400, 'Asset not available for purchase');
  if (!a.publishedVersionId) throw new HttpError(400, 'No published version');
  if (a.authorId === userId) throw new HttpError(400, 'Cannot purchase own asset');
  const price = a.price ?? 0;
  const purchases = mockStore.assetPurchaseDtos.get(assetId) ?? [];
  if (data.idempotencyKey) {
    const existing = purchases.find(p => p.idempotencyKey === data.idempotencyKey);
    if (existing) return existing;
  }
  const buyer = await mockStore.findUserById(userId);
  if (!buyer) throw new HttpError(404, 'User not found');
  if (price > 0 && buyer.credits < price) throw new HttpError(400, 'Insufficient credits');
  const purchase: AssetPurchaseDto = {
    id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    assetId, versionId: a.publishedVersionId, userId,
    pricePaid: price, status: 'completed',
    idempotencyKey: data.idempotencyKey ?? null,
    createdAt: new Date(),
  };
  purchases.push(purchase);
  mockStore.assetPurchaseDtos.set(assetId, purchases);
  if (price > 0) {
    await mockStore.updateUser(userId, { credits: buyer.credits - price });
    const seller = await mockStore.findUserById(a.authorId);
    if (seller) await mockStore.updateUser(a.authorId, { credits: seller.credits + price });
  }
  return purchase;
}

async function mockRecycleAsset(this: AssetService, userId: string, assetId: string): Promise<AssetDto> {
  const a = mockStore.assetDtos.get(assetId);
  if (!a) throw new HttpError(404, 'Asset not found');
  if (a.authorId !== userId) throw new HttpError(403, 'Not your asset');
  if (a.status === 'recycled') throw new HttpError(400, 'Already recycled');
  const updated: AssetDto = { ...a, status: 'recycled', published: false, publishedVersionId: null, updatedAt: new Date() };
  mockStore.assetDtos.set(assetId, updated);
  return updated;
}

// Augment the AssetService class with the mock implementations
// Module augmentation: declare the mock methods as if they were on the class
declare module './service.js' {
  interface AssetService {
    mockListAssets(opts: ListOptions): Promise<{ data: AssetDto[]; pagination: { page: number; limit: number; total: number } }>;
    mockGetAsset(id: string): Promise<AssetDto>;
    mockCreateAsset(userId: string, data: CreateAssetDto): Promise<AssetDto>;
    mockUpdateAsset(userId: string, assetId: string, data: UpdateAssetDto): Promise<AssetDto>;
    mockPublishAsset(userId: string, assetId: string, data: PublishAssetDto): Promise<AssetVersionDto>;
    mockGetVersionHistory(assetId: string): Promise<AssetVersionDto[]>;
    mockCreateReview(userId: string, assetId: string, data: CreateReviewDto): Promise<AssetReviewDto>;
    mockPurchaseAsset(userId: string, assetId: string, data: PurchaseAssetDto): Promise<AssetPurchaseDto>;
    mockRecycleAsset(userId: string, assetId: string): Promise<AssetDto>;
  }
}

const proto = AssetService.prototype as any;
proto.mockListAssets = mockListAssets;
proto.mockGetAsset = mockGetAsset;
proto.mockCreateAsset = mockCreateAsset;
proto.mockUpdateAsset = mockUpdateAsset;
proto.mockPublishAsset = mockPublishAsset;
proto.mockGetVersionHistory = mockGetVersionHistory;
proto.mockCreateReview = mockCreateReview;
proto.mockPurchaseAsset = mockPurchaseAsset;
proto.mockRecycleAsset = mockRecycleAsset;

export const assetService = new AssetService();
