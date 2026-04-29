import { describe, it, expect } from '@jest/globals';
import {
  PRICE_TIERS,
  getPricingForAssetType,
  calculateListingPrice,
} from './pricing';

describe('Marketplace Pricing', () => {
  describe('PRICE_TIERS', () => {
    it('should have basic, premium, and featured tiers', () => {
      const tiers = PRICE_TIERS.map(t => t.tier);
      expect(tiers).toContain('basic');
      expect(tiers).toContain('premium');
      expect(tiers).toContain('featured');
    });

    it('should have increasing credits multipliers', () => {
      const multipliers = PRICE_TIERS.map(t => t.credits_multiplier);
      expect(multipliers[0]!).toBeLessThan(multipliers[1]!);
      expect(multipliers[1]!).toBeLessThan(multipliers[2]!);
    });
  });

  describe('getPricingForAssetType', () => {
    it('should return 100 for gene type', () => {
      expect(getPricingForAssetType('gene')).toBe(100);
    });

    it('should return 200 for capsule type', () => {
      expect(getPricingForAssetType('capsule')).toBe(200);
    });

    it('should return 500 for recipe type', () => {
      expect(getPricingForAssetType('recipe')).toBe(500);
    });

    it('should return 1000 for bundle type', () => {
      expect(getPricingForAssetType('bundle')).toBe(1000);
    });

    it('should return 100 for unknown asset type', () => {
      expect(getPricingForAssetType('unknown')).toBe(100);
    });
  });

  describe('calculateListingPrice', () => {
    it('should return base price for basic tier at 7 days', () => {
      const price = calculateListingPrice('gene', 'basic', 7);
      expect(price).toBe(100); // 100 * 1.0 * (7/7)
    });

    it('should apply premium multiplier', () => {
      const price = calculateListingPrice('gene', 'premium', 7);
      expect(price).toBe(150); // 100 * 1.5 * (7/7)
    });

    it('should apply featured multiplier', () => {
      const price = calculateListingPrice('gene', 'featured', 7);
      expect(price).toBe(200); // 100 * 2.0 * (7/7)
    });

    it('should scale price proportionally by duration', () => {
      const price7 = calculateListingPrice('gene', 'basic', 7);
      const price14 = calculateListingPrice('gene', 'basic', 14);
      expect(price14).toBe(price7 * 2);
    });

    it('should handle capsule base price', () => {
      const price = calculateListingPrice('capsule', 'basic', 7);
      expect(price).toBe(200);
    });

    it('should handle recipe base price', () => {
      const price = calculateListingPrice('recipe', 'basic', 7);
      expect(price).toBe(500);
    });

    it('should handle bundle base price', () => {
      const price = calculateListingPrice('bundle', 'basic', 7);
      expect(price).toBe(1000);
    });

    it('should default to basic tier', () => {
      const explicit = calculateListingPrice('gene', 'basic', 7);
      const defaulted = calculateListingPrice('gene', undefined, 7);
      expect(explicit).toBe(defaulted);
    });

    it('should default to 7-day duration', () => {
      const explicit = calculateListingPrice('gene', 'basic', 7);
      const defaulted = calculateListingPrice('gene', 'basic');
      expect(explicit).toBe(defaulted);
    });

    it('should round the final price', () => {
      // 100 * 1.5 * (10/7) = 214.28... → 214
      const price = calculateListingPrice('gene', 'premium', 10);
      expect(Number.isInteger(price)).toBe(true);
    });
  });
});
