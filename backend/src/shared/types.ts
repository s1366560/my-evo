// Shared types for the GEP asset marketplace.
// Single source of truth — backend service, controller, and tests all import from here.

// ── GEP asset type discriminator ──────────────────────────
export type GepAssetType = 'Gene' | 'Capsule' | 'Recipe';

// ── Recipe step ───────────────────────────────────────────
export type RecipeStepKind = 'prompt' | 'tool_call' | 'http' | 'note';

export interface RecipeStepDto {
  order: number;
  kind: RecipeStepKind;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

// ── Asset version snapshot ────────────────────────────────
export interface AssetVersionDto {
  id: string;
  assetId: string;
  versionNo: number;
  title: string;
  description: string | null;
  content: string | null;
  url: string | null;
  metadata: Record<string, unknown>;
  price: number | null;
  authorId: string;
  changelog: string | null;
  createdAt: Date;
  steps?: RecipeStepDto[];
}

// ── Asset list / detail DTO ───────────────────────────────
export interface AssetDto {
  id: string;
  title: string;
  description: string | null;
  type: GepAssetType;
  kind: string | null;
  published: boolean;
  status: string;
  price: number | null;
  publishedVersionId: string | null;
  authorId: string;
  nodeId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  /** Populated on detail views */
  versions?: AssetVersionDto[];
  /** Average rating (lazy) */
  avgRating?: number;
  reviewCount?: number;
}

// ── Create / Publish payloads ─────────────────────────────
export interface CreateAssetDto {
  title: string;
  description?: string;
  type: GepAssetType;
  kind?: string;
  content?: string;
  url?: string;
  metadata?: Record<string, unknown>;
  price?: number;
  nodeId?: string;
}

export interface PublishAssetDto {
  changelog?: string;
  steps?: RecipeStepDto[];
}

export interface UpdateAssetDto {
  title?: string;
  description?: string;
  kind?: string;
  content?: string;
  url?: string;
  metadata?: Record<string, unknown>;
  price?: number;
}

// ── Review ────────────────────────────────────────────────
export interface AssetReviewDto {
  id: string;
  assetId: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReviewDto {
  rating: number;
  comment?: string;
}

// ── Purchase ──────────────────────────────────────────────
export interface AssetPurchaseDto {
  id: string;
  assetId: string;
  versionId: string;
  userId: string;
  pricePaid: number;
  status: string;
  idempotencyKey: string | null;
  createdAt: Date;
}

export interface PurchaseAssetDto {
  idempotencyKey?: string;
}
