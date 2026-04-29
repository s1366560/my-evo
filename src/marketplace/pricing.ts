// Marketplace pricing utilities
export interface PriceTier {
  tier: string;
  base_price: number;
  credits_multiplier: number;
  features: string[];
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
