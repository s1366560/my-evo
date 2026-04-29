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
      await marketplaceService.createListing({
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Gene A',
        description: 'Test gene',
        price: 100,
        seller_id: 'seller-1',
        status: 'active',
      });
      await marketplaceService.createListing({
        asset_id: 'asset-2',
        asset_type: 'capsule',
        name: 'Capsule B',
        description: 'Test capsule',
        price: 200,
        seller_id: 'seller-2',
        status: 'active',
      });

      const result = await marketplaceService.listListings();
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by asset_type', async () => {
      await marketplaceService.createListing({
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Gene A',
        description: 'Test gene',
        price: 100,
        seller_id: 'seller-1',
        status: 'active',
      });
      await marketplaceService.createListing({
        asset_id: 'asset-2',
        asset_type: 'capsule',
        name: 'Capsule B',
        description: 'Test capsule',
        price: 200,
        seller_id: 'seller-1',
        status: 'active',
      });

      const result = await marketplaceService.listListings({ asset_type: 'gene' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.asset_type).toBe('gene');
    });

    it('should filter by status', async () => {
      await marketplaceService.createListing({
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Active Gene',
        description: 'Active listing',
        price: 100,
        seller_id: 'seller-1',
        status: 'active',
      });
      await marketplaceService.createListing({
        asset_id: 'asset-2',
        asset_type: 'gene',
        name: 'Sold Gene',
        description: 'Sold listing',
        price: 100,
        seller_id: 'seller-1',
        status: 'sold',
      });

      const result = await marketplaceService.listListings({ status: 'active' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.status).toBe('active');
    });

    it('should filter by min_price', async () => {
      await marketplaceService.createListing({
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Cheap Gene',
        description: 'Cheap',
        price: 50,
        seller_id: 'seller-1',
        status: 'active',
      });
      await marketplaceService.createListing({
        asset_id: 'asset-2',
        asset_type: 'gene',
        name: 'Expensive Gene',
        description: 'Expensive',
        price: 500,
        seller_id: 'seller-1',
        status: 'active',
      });

      const result = await marketplaceService.listListings({ min_price: 100 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.price).toBe(500);
    });

    it('should filter by max_price', async () => {
      await marketplaceService.createListing({
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Cheap Gene',
        description: 'Cheap',
        price: 50,
        seller_id: 'seller-1',
        status: 'active',
      });
      await marketplaceService.createListing({
        asset_id: 'asset-2',
        asset_type: 'gene',
        name: 'Expensive Gene',
        description: 'Expensive',
        price: 500,
        seller_id: 'seller-1',
        status: 'active',
      });

      const result = await marketplaceService.listListings({ max_price: 100 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.price).toBe(50);
    });

    it('should apply pagination with limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await marketplaceService.createListing({
          asset_id: `asset-${i}`,
          asset_type: 'gene',
          name: `Gene ${i}`,
          description: `Gene ${i}`,
          price: 100,
          seller_id: 'seller-1',
          status: 'active',
        });
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
      const created = await marketplaceService.createListing({
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Test Gene',
        description: 'Test description',
        price: 250,
        seller_id: 'seller-1',
        status: 'active',
      });

      const listing = await marketplaceService.getListing(created.listing_id);
      expect(listing).not.toBeNull();
      expect(listing!.name).toBe('Test Gene');
      expect(listing!.price).toBe(250);
    });

    it('should return null for non-existent listing', async () => {
      const listing = await marketplaceService.getListing('nonexistent-id');
      expect(listing).toBeNull();
    });
  });

  describe('createListing', () => {
    it('should create a listing with generated ID and timestamps', async () => {
      const listing = await marketplaceService.createListing({
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'New Gene',
        description: 'A brand new gene',
        price: 300,
        seller_id: 'seller-1',
        status: 'active',
      });

      expect(listing.listing_id).toMatch(/^ml_/);
      expect(listing.asset_id).toBe('asset-1');
      expect(listing.asset_type).toBe('gene');
      expect(listing.name).toBe('New Gene');
      expect(listing.price).toBe(300);
      expect(listing.seller_id).toBe('seller-1');
      expect(listing.status).toBe('active');
      expect(listing.created_at).toBeInstanceOf(Date);
      expect(listing.updated_at).toBeInstanceOf(Date);
    });

    it('should be findable after creation', async () => {
      const created = await marketplaceService.createListing({
        asset_id: 'asset-find',
        asset_type: 'capsule',
        name: 'Findable Capsule',
        description: 'Should be findable',
        price: 150,
        seller_id: 'seller-find',
        status: 'active',
      });

      const found = await marketplaceService.getListing(created.listing_id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Findable Capsule');
    });
  });

  describe('updateListing', () => {
    it('should update listing fields and set updated_at', async () => {
      const created = await marketplaceService.createListing({
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Original Name',
        description: 'Original description',
        price: 100,
        seller_id: 'seller-1',
        status: 'active',
      });

      const originalUpdatedAt = created.updated_at;

      // Wait a bit to ensure updated_at changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await marketplaceService.updateListing(created.listing_id, {
        name: 'Updated Name',
        price: 500,
      });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.price).toBe(500);
      expect(updated!.description).toBe('Original description'); // unchanged
      expect(updated!.updated_at.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });

    it('should update status to sold', async () => {
      const created = await marketplaceService.createListing({
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'For Sale',
        description: 'Available',
        price: 100,
        seller_id: 'seller-1',
        status: 'active',
      });

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
      const listing = await marketplaceService.createListing({
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Purchase Test',
        description: 'Will be purchased',
        price: 200,
        seller_id: 'seller-1',
        status: 'active',
      });

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

    it('should throw when purchasing already sold listing', async () => {
      const listing = await marketplaceService.createListing({
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Already Sold',
        description: 'Already sold',
        price: 100,
        seller_id: 'seller-1',
        status: 'sold',
      });

      await expect(marketplaceService.purchaseListing(listing.listing_id, 'buyer-1'))
        .rejects.toThrow('Listing not available');
    });

    it('should throw when purchasing removed listing', async () => {
      const listing = await marketplaceService.createListing({
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Removed',
        description: 'Removed',
        price: 100,
        seller_id: 'seller-1',
        status: 'removed',
      });

      await expect(marketplaceService.purchaseListing(listing.listing_id, 'buyer-1'))
        .rejects.toThrow('Listing not available');
    });
  });
});
