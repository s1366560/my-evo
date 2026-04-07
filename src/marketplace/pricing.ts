import { PrismaClient } from '@prisma/client';
import type { AssetType } from '../shared/types';
import { NotFoundError } from '../shared/errors';

// ─── Pricing constants ────────────────────────────────────────────────────────

export const BASE_PRICES: Record<AssetType, number> = {
  gene: 100,
  capsule: 200,
  recipe: 300,
};

export const PRICE_TIERS = {
  budget: { max: 99 },
  standard: { min: 100, max: 499 },
  premium: { min: 500, max: 1999 },
  elite: { min: 2000 },
} as const;

export type PriceTier = keyof typeof PRICE_TIERS;

// ─── Prisma singleton ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _prisma: any = null;

export function setPrisma(client: unknown): void {
  _prisma = client;
}

function db() {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

// ─── Dynamic price calculation ────────────────────────────────────────────────

/**
 * price = base_price × gdiFactor × demandFactor × scarcityFactor
 *
 * gdiFactor     = clamp(asset_gdi / network_avg_gdi, 0.5, 2.0)
 * demandFactor  = log(1 + fetch_count) + 1
 * scarcityFactor = 1 / (1 + similar_count)
 */
export async function calculateDynamicPrice(
  listingId: string,
): Promise<{ price: number; breakdown: PriceBreakdown }> {
  const listing = await db().marketplaceListing.findUnique({
    where: { listing_id: listingId },
    include: { asset: true },
  });

  if (!listing) {
    throw new NotFoundError('Listing', listingId);
  }

  const asset = listing.asset as Record<string, unknown>;
  const assetGdi = (asset['gdi_score'] as number) ?? 50;

  const networkStats = await db().node.aggregate({
    _avg: { reputation: true },
  });
  const networkAvgGdi = networkStats._avg.reputation ?? 50;

  const gdiFactor = _clamp(assetGdi / networkAvgGdi, 0.5, 2.0);

  const fetchCount = (asset['downloads'] as number) ?? 0;
  const demandFactor = Math.log(1 + fetchCount) + 1;

  const similarCount = await db().similarityRecord.count({
    where: {
      OR: [{ asset_id: listing.asset_id }, { compared_to: listing.asset_id }],
    },
  });
  const scarcityFactor = 1 / (1 + similarCount);

  const basePrice = BASE_PRICES[listing.asset_type as AssetType] ?? 100;
  const price = Math.round(basePrice * gdiFactor * demandFactor * scarcityFactor);

  return {
    price,
    breakdown: {
      basePrice,
      gdiFactor: _round(gdiFactor),
      demandFactor: _round(demandFactor),
      scarcityFactor: _round(scarcityFactor),
      assetGdi,
      networkAvgGdi: _round(networkAvgGdi),
      fetchCount,
      similarCount,
    },
  };
}

export interface PriceBreakdown {
  basePrice: number;
  gdiFactor: number;
  demandFactor: number;
  scarcityFactor: number;
  assetGdi: number;
  networkAvgGdi: number;
  fetchCount: number;
  similarCount: number;
}

// ─── Demand adjustment ────────────────────────────────────────────────────────

/**
 * Demand multiplier based on time-of-day buckets.
 * Peak hours (9-18) increase price; off-hours decrease it.
 */
export function adjustByDemand(
  _assetType: AssetType,
  date: Date = new Date(),
): { factor: number; period: 'peak' | 'morning' | 'evening' | 'off_hours' } {
  const hour = date.getUTCHours();

  if (hour >= 9 && hour < 18) {
    return { factor: 1.25, period: 'peak' };
  }
  if (hour >= 6 && hour < 9) {
    return { factor: 1.1, period: 'morning' };
  }
  if (hour >= 18 && hour < 22) {
    return { factor: 1.1, period: 'evening' };
  }
  return { factor: 0.9, period: 'off_hours' };
}

// ─── Scarcity adjustment ─────────────────────────────────────────────────────

/**
 * Scarcity multiplier: fewer similar assets → higher price.
 * Rarity bonus caps at 2x for truly unique assets.
 */
export function adjustByScarcity(
  _assetId: string,
  totalSupply: number,
): { factor: number; scarcity: 'common' | 'uncommon' | 'rare' | 'unique' } {
  if (totalSupply === 0) {
    return { factor: 2.0, scarcity: 'unique' };
  }
  if (totalSupply <= 3) {
    return { factor: 1.5, scarcity: 'rare' };
  }
  if (totalSupply <= 10) {
    return { factor: 1.2, scarcity: 'uncommon' };
  }
  return { factor: 1.0, scarcity: 'common' };
}

// ─── Price history ──────────────────────────────────────────────────────────

export async function getPricingHistory(
  assetId: string,
  limit = 30,
): Promise<PricePoint[]> {
  const transactions = await db().marketplaceTransaction.findMany({
    where: { asset_id: assetId },
    orderBy: { completed_at: 'desc' },
    take: limit,
    select: { price: true, completed_at: true },
  });

  return transactions.map((t: { price: number; completed_at: Date }) => ({
    price: t.price,
    timestamp: t.completed_at.toISOString(),
  }));
}

export interface PricePoint {
  price: number;
  timestamp: string;
}

// ─── Price tier classification ────────────────────────────────────────────────

export function classifyPriceTier(price: number): PriceTier {
  if (price <= PRICE_TIERS.budget.max!) return 'budget';
  if (price <= PRICE_TIERS.standard.max!) return 'standard';
  if (price <= PRICE_TIERS.premium.max!) return 'premium';
  return 'elite';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function _round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
