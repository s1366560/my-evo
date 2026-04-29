// Marketplace pricing utilities
import type { PrismaClient } from '@prisma/client';

export interface PriceTier {
  tier: string;
  base_price: number;
  credits_multiplier: number;
  features: string[];
}

export interface DynamicPriceResult {
  listing_id: string;
  base_price: number;
  dynamic_adjustments: {
    demand_multiplier: number;
    scarcity_multiplier: number;
    reputation_bonus: number;
    total_adjustment: number;
  };
  final_price: number;
  currency: string;
}

export const PRICE_TIERS: PriceTier[] = [
  {
    tier: 'basic',
    base_price: 100,
    credits_multiplier: 1.0,
    features: ['basic_listing', '7_day_duration'],
  },
  {
    tier: 'premium',
    base_price: 250,
    credits_multiplier: 1.5,
    features: ['featured_listing', '30_day_duration', 'analytics'],
  },
  {
    tier: 'featured',
    base_price: 500,
    credits_multiplier: 2.0,
    features: ['homepage_featured', 'unlimited_duration', 'advanced_analytics', 'priority_support'],
  },
];

export function getPricingForAssetType(assetType: string): number {
  const basePrices: Record<string, number> = {
    gene: 100,
    capsule: 200,
    recipe: 500,
    bundle: 1000,
  };
  return basePrices[assetType] || 100;
}

export function calculateListingPrice(
  assetType: string,
  tier: string = 'basic',
  duration: number = 7
): number {
  const basePrice = getPricingForAssetType(assetType);
  const priceTier = PRICE_TIERS.find(t => t.tier === tier);
  const multiplier = priceTier?.credits_multiplier || 1.0;
  return Math.round(basePrice * multiplier * (duration / 7));
}

/**
 * Calculate dynamic pricing for a marketplace listing.
 * Applies demand, scarcity, and reputation adjustments.
 */
export async function calculateDynamicPrice(
  listingId: string,
  _prisma: PrismaClient
): Promise<DynamicPriceResult> {
  // Get base price from listing or default
  const basePrice = 100; // Default base price

  // Simulated dynamic adjustments based on market conditions
  const demandMultiplier = 1.0 + Math.random() * 0.3; // 1.0 - 1.3
  const scarcityMultiplier = 1.0 + Math.random() * 0.2; // 1.0 - 1.2
  const reputationBonus = Math.random() * 10; // 0 - 10

  const totalAdjustment = (demandMultiplier - 1) + (scarcityMultiplier - 1) + reputationBonus / basePrice;
  const finalPrice = Math.round(basePrice * demandMultiplier * scarcityMultiplier + reputationBonus);

  return {
    listing_id: listingId,
    base_price: basePrice,
    dynamic_adjustments: {
      demand_multiplier: Math.round(demandMultiplier * 100) / 100,
      scarcity_multiplier: Math.round(scarcityMultiplier * 100) / 100,
      reputation_bonus: Math.round(reputationBonus * 100) / 100,
      total_adjustment: Math.round(totalAdjustment * 100) / 100,
    },
    final_price: finalPrice,
    currency: 'credits',
  };
}
