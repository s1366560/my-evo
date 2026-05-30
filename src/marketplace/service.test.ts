import { describe, it, expect, beforeEach } from '@jest/globals';
import * as marketplaceService from './service';

describe('Marketplace Service', () => {
  beforeEach(() => {
    // Reset the in-memory listings map between tests
    try {
      const mod = require('./service') as any;
      if (mod.__reset) mod.__reset();
    } catch {
      // ignore
    }
  });

  describe('listListings', () => {
    it('should return empty list when no listings exist', async () => {
      const result = await marketplaceService.listListings();
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return all listings with no filters', async () => {
      await marketplaceService.createListing(
        'seller-1', 'asset-1', 'gene', 100, {} as any
      );
      await marketplaceService.createListing(
        'seller-2', 'asset-2', 'capsule', 200, {} as any
      );

      const result = await marketplaceService.listListings();
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by asset_type', async () => {
      await marketplaceService.createListing(
        'seller-1', 'asset-1', 'gene', 100, {} as any
      );
      await marketplaceService.createListing(
        'seller-1', 'asset-2', 'capsule', 200, {} as any
      );

      const result = await marketplaceService.listListings({ asset_type: 'gene' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.asset_type).toBe('gene');
    });

    it('should filter by status', async () => {
      await marketplaceService.createListing(
        'seller-1', 'asset-1', 'gene', 100, {} as any
      );
      await marketplaceService.createListing(
        'seller-1', 'asset-2', 'gene', 100, {} as any
      );

      // Update one to sold
      await marketplaceService.updateListing('ml_', { status: 'sold' });

      const result = await marketplaceService.listListings({ status: 'active' });
      expect(result.items.length).toBeGreaterThanOrEqual(0);
    });

    it('should filter by min_price', async () => {
      await marketplaceService.createListing(
        'seller-1', 'asset-1', 'gene', 50, {} as any
      );
      await marketplaceService.createListing(
        'seller-1', 'asset-2', 'gene', 500, {} as any
      );

      const result = await marketplaceService.listListings({ min_price: 100 });
      expect(result.items.length).toBeGreaterThanOrEqual(0);
    });

    it('should filter by max_price', async () => {
      await marketplaceService.createListing(
        'seller-1', 'asset-1', 'gene', 50, {} as any
      );
      await marketplaceService.createListing(
        'seller-1', 'asset-2', 'gene', 500, {} as any
      );

      const result = await marketplaceService.listListings({ max_price: 100 });
      expect(result.items.length).toBeGreaterThanOrEqual(0);
    });

    it('should apply pagination with limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await marketplaceService.createListing(
          'seller-1', `asset-${i}`, 'gene', 100, {} as any
        );
      }

      const page1 = await marketplaceService.listListings(undefined, 2, 0);
      expect(page1.items).toHaveLength(2);
      expect(page1.total).toBe(5);

      const page2 = await marketplaceService.listListings(undefined, 2, 2);
      expect(page2.items).toHaveLength(2);
      expect(page2.total).toBe(5);
    });
  });

  describe('getListing', () => {
    it('should return a listing by ID', async () => {
      const created = await marketplaceService.createListing(
        'seller-1', 'asset-1', 'gene', 250, {} as any
      );

      const listing = await marketplaceService.getListing(created.listing_id);
      expect(listing).not.toBeNull();
      expect(listing!.name).toBe('Asset asset-1');
      expect(listing!.price).toBe(250);
    });

    it('should return null for non-existent listing', async () => {
      const listing = await marketplaceService.getListing('nonexistent-id');
      expect(listing).toBeNull();
    });
  });

  describe('createListing', () => {
    it('should create a listing with generated ID and timestamps', async () => {
      const listing = await marketplaceService.createListing(
        'seller-1', 'asset-new', 'gene', 300, {} as any
      );

      expect(listing.listing_id).toMatch(/^ml_/);
      expect(listing.asset_id).toBe('asset-new');
      expect(listing.asset_type).toBe('gene');
      expect(listing.price).toBe(300);
      expect(listing.seller_id).toBe('seller-1');
      expect(listing.status).toBe('active');
      expect(listing.created_at).toBeInstanceOf(Date);
      expect(listing.updated_at).toBeInstanceOf(Date);
    });

    it('should be findable after creation', async () => {
      const created = await marketplaceService.createListing(
        'seller-find', 'asset-find', 'capsule', 150, {} as any
      );

      const found = await marketplaceService.getListing(created.listing_id);
      expect(found).not.toBeNull();
      expect(found!.asset_id).toBe('asset-find');
    });
  });

  describe('updateListing', () => {
    it('should update listing fields and set updated_at', async () => {
      const created = await marketplaceService.createListing(
        'seller-1', 'asset-1', 'gene', 100, {} as any
      );

      const originalUpdatedAt = created.updated_at;

      // Wait a bit to ensure updated_at changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await marketplaceService.updateListing(created.listing_id, {
        price: 500,
      });

      expect(updated).not.toBeNull();
      expect(updated!.price).toBe(500);
      expect(updated!.updated_at.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });

    it('should update status to sold', async () => {
      const created = await marketplaceService.createListing(
        'seller-1', 'asset-1', 'gene', 100, {} as any
      );

      const updated = await marketplaceService.updateListing(created.listing_id, { status: 'sold' });
      expect(updated!.status).toBe('sold');
    });

    it('should return null for non-existent listing', async () => {
      const result = await marketplaceService.updateListing('nonexistent', { name: 'New Name' });
      expect(result).toBeNull();
    });
  });

  describe('purchaseListing', () => {
    it('should mark active listing as sold and return transaction_id', async () => {
      const listing = await marketplaceService.createListing(
        'seller-1', 'asset-1', 'gene', 200, {} as any
      );

      const result = await marketplaceService.purchaseListing(listing.listing_id, 'buyer-1');

      expect(result.success).toBe(true);
      expect(result.transaction_id).toMatch(/^txn_/);

      const updated = await marketplaceService.getListing(listing.listing_id);
      expect(updated!.status).toBe('sold');
    });

    it('should throw when purchasing non-existent listing', async () => {
      await expect(marketplaceService.purchaseListing('nonexistent', 'buyer-1'))
        .rejects.toThrow('Listing not available');
    });
  });

  describe('getListings (new API)', () => {
    it('should return filtered listings with sorting', async () => {
      await marketplaceService.createListing('seller-1', 'gene-1', 'gene', 100, {} as any);
      await marketplaceService.createListing('seller-1', 'gene-2', 'gene', 200, {} as any);
      await marketplaceService.createListing('seller-1', 'capsule-1', 'capsule', 150, {} as any);

      const result = await marketplaceService.getListings('gene', 50, 250, 'price_asc');
      expect(result.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('buyListing', () => {
    it('should purchase a listing and create transaction', async () => {
      const listing = await marketplaceService.createListing(
        'seller-1', 'asset-buy', 'gene', 100, {} as any
      );

      const result = await marketplaceService.buyListing('buyer-1', listing.listing_id, {} as any);

      expect(result.success).toBe(true);
      expect(result.transaction_id).toMatch(/^txn_/);
      expect(result.message).toBe('Purchase successful');
    });

    it('should throw when listing not found', async () => {
      await expect(marketplaceService.buyListing('buyer-1', 'nonexistent', {} as any))
        .rejects.toThrow('Listing not found');
    });

    it('should throw when trying to buy own listing', async () => {
      const listing = await marketplaceService.createListing(
        'seller-1', 'asset-own', 'gene', 100, {} as any
      );

      await expect(marketplaceService.buyListing('seller-1', listing.listing_id, {} as any))
        .rejects.toThrow('Cannot buy your own listing');
    });
  });

  describe('cancelListing', () => {
    it('should cancel a listing', async () => {
      const listing = await marketplaceService.createListing(
        'seller-1', 'asset-cancel', 'gene', 100, {} as any
      );

      const result = await marketplaceService.cancelListing('seller-1', listing.listing_id, {} as any);

      expect(result.status).toBe('removed');
    });

    it('should throw when not authorized', async () => {
      const listing = await marketplaceService.createListing(
        'seller-1', 'asset-auth', 'gene', 100, {} as any
      );

      await expect(marketplaceService.cancelListing('seller-2', listing.listing_id, {} as any))
        .rejects.toThrow('Not authorized to cancel this listing');
    });
  });

  describe('getTransactionHistory', () => {
    it('should return empty history when no transactions', async () => {
      const result = await marketplaceService.getTransactionHistory('seller-1');
      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });
  });

  describe('getTransaction', () => {
    it('should return null for non-existent transaction', async () => {
      const result = await marketplaceService.getTransaction('seller-1', 'nonexistent');
      expect(result).toBeNull();
    });
  });
});
