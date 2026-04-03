import { PrismaClient } from '@prisma/client';
import * as service from './service';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
  ForbiddenError,
} from '../shared/errors';

const {
  createListing,
  buyListing,
  cancelListing,
  getListings,
  getTransactionHistory,
} = service;

const mockPrisma = {
  asset: {
    findUnique: jest.fn(),
  },
  node: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  marketplaceListing: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  marketplaceTransaction: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  creditTransaction: {
    create: jest.fn(),
  },
} as any;

describe('Marketplace Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createListing', () => {
    it('should create a listing successfully', async () => {
      const asset = {
        asset_id: 'asset-1',
        author_id: 'seller-1',
        status: 'published',
      };
      const seller = { node_id: 'seller-1', reputation: 80 };
      const listing = {
        listing_id: 'list-1',
        seller_id: 'seller-1',
        asset_id: 'asset-1',
        asset_type: 'gene',
        price: 100,
        status: 'active',
        buyer_id: null,
        listed_at: new Date('2025-01-01'),
        sold_at: null,
        expires_at: new Date('2025-01-31'),
      };

      mockPrisma.asset.findUnique.mockResolvedValue(asset);
      mockPrisma.node.findFirst.mockResolvedValue(seller);
      mockPrisma.marketplaceListing.findFirst.mockResolvedValue(null);
      mockPrisma.marketplaceListing.create.mockResolvedValue(listing);

      const result = await createListing('seller-1', 'asset-1', 'gene', 100);

      expect(result.listing_id).toBe('list-1');
      expect(result.seller_id).toBe('seller-1');
      expect(result.asset_id).toBe('asset-1');
      expect(result.asset_type).toBe('gene');
      expect(result.price).toBe(100);
      expect(result.status).toBe('active');
    });

    it('should throw NotFoundError when asset does not exist', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(
        createListing('seller-1', 'missing', 'gene', 100),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError when seller is not the owner', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        author_id: 'other-seller',
        status: 'published',
      });

      await expect(
        createListing('seller-1', 'asset-1', 'gene', 100),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ValidationError when asset is not published', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        author_id: 'seller-1',
        status: 'draft',
      });

      await expect(
        createListing('seller-1', 'asset-1', 'gene', 100),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when price is below minimum', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        author_id: 'seller-1',
        status: 'published',
      });

      await expect(
        createListing('seller-1', 'asset-1', 'gene', 5),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when price is above maximum', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        author_id: 'seller-1',
        status: 'published',
      });

      await expect(
        createListing('seller-1', 'asset-1', 'gene', 200_000),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for low reputation seller with high price', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        author_id: 'seller-1',
        status: 'published',
      });
      mockPrisma.node.findFirst.mockResolvedValue({
        node_id: 'seller-1',
        reputation: 20,
      });

      await expect(
        createListing('seller-1', 'asset-1', 'gene', 60_000),
      ).rejects.toThrow(ValidationError);
    });

    it('should allow low reputation seller within capped price', async () => {
      const asset = {
        asset_id: 'asset-1',
        author_id: 'seller-1',
        status: 'published',
      };
      const seller = { node_id: 'seller-1', reputation: 20 };
      const listing = {
        listing_id: 'list-1',
        seller_id: 'seller-1',
        asset_id: 'asset-1',
        asset_type: 'gene',
        price: 1000,
        status: 'active',
        buyer_id: null,
        listed_at: new Date(),
        sold_at: null,
        expires_at: new Date(),
      };

      mockPrisma.asset.findUnique.mockResolvedValue(asset);
      mockPrisma.node.findFirst.mockResolvedValue(seller);
      mockPrisma.marketplaceListing.findFirst.mockResolvedValue(null);
      mockPrisma.marketplaceListing.create.mockResolvedValue(listing);

      const result = await createListing('seller-1', 'asset-1', 'gene', 1000);

      expect(result.price).toBe(1000);
    });

    it('should throw ValidationError when active listing already exists', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        author_id: 'seller-1',
        status: 'published',
      });
      mockPrisma.node.findFirst.mockResolvedValue({
        node_id: 'seller-1',
        reputation: 80,
      });
      mockPrisma.marketplaceListing.findFirst.mockResolvedValue({
        listing_id: 'existing-listing',
        status: 'active',
      });

      await expect(
        createListing('seller-1', 'asset-1', 'gene', 100),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('buyListing', () => {
    const activeListing = {
      listing_id: 'list-1',
      seller_id: 'seller-1',
      asset_id: 'asset-1',
      price: 100,
      status: 'active',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    it('should complete a purchase successfully', async () => {
      const buyer = { node_id: 'buyer-1', credit_balance: 500 };
      const seller = { node_id: 'seller-1', credit_balance: 200 };

      mockPrisma.marketplaceListing.findUnique.mockResolvedValue(activeListing);
      mockPrisma.node.findFirst
        .mockResolvedValueOnce(buyer)
        .mockResolvedValueOnce(seller);
      mockPrisma.marketplaceListing.update.mockResolvedValue({
        ...activeListing,
        status: 'sold',
        buyer_id: 'buyer-1',
      });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.marketplaceTransaction.create.mockResolvedValue({
        transaction_id: 'tx-1',
        listing_id: 'list-1',
        seller_id: 'seller-1',
        buyer_id: 'buyer-1',
        asset_id: 'asset-1',
        price: 100,
        fee: 5,
        seller_receives: 95,
        completed_at: new Date(),
      });

      const result = await buyListing('buyer-1', 'list-1');

      expect(result.transaction_id).toBe('tx-1');
      expect(result.buyer_id).toBe('buyer-1');
      expect(result.seller_id).toBe('seller-1');
      expect(result.price).toBe(100);
      expect(result.fee).toBe(5);
      expect(result.seller_receives).toBe(95);
    });

    it('should throw NotFoundError when listing does not exist', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue(null);

      await expect(buyListing('buyer-1', 'missing')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw ValidationError when listing is not active', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue({
        ...activeListing,
        status: 'sold',
      });

      await expect(buyListing('buyer-1', 'list-1')).rejects.toThrow(
        ValidationError,
      );
    });

    it('should throw ValidationError when buying own listing', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue(activeListing);

      await expect(buyListing('seller-1', 'list-1')).rejects.toThrow(
        ValidationError,
      );
    });

    it('should throw ValidationError when listing has expired', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue({
        ...activeListing,
        expires_at: new Date('2020-01-01'),
      });

      await expect(buyListing('buyer-1', 'list-1')).rejects.toThrow(
        ValidationError,
      );
    });

    it('should throw NotFoundError when buyer does not exist', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue(activeListing);
      mockPrisma.node.findFirst.mockResolvedValue(null);

      await expect(buyListing('buyer-1', 'list-1')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw InsufficientCreditsError when buyer cannot afford', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue(activeListing);
      mockPrisma.node.findFirst.mockResolvedValue({
        node_id: 'buyer-1',
        credit_balance: 50,
      });

      await expect(buyListing('buyer-1', 'list-1')).rejects.toThrow(
        InsufficientCreditsError,
      );
    });

    it('should deduct credits from buyer and credit seller', async () => {
      const buyer = { node_id: 'buyer-1', credit_balance: 500 };
      const seller = { node_id: 'seller-1', credit_balance: 200 };

      mockPrisma.marketplaceListing.findUnique.mockResolvedValue(activeListing);
      mockPrisma.node.findFirst
        .mockResolvedValueOnce(buyer)
        .mockResolvedValueOnce(seller);
      mockPrisma.marketplaceListing.update.mockResolvedValue({});
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.marketplaceTransaction.create.mockResolvedValue({
        transaction_id: 'tx-1',
        listing_id: 'list-1',
        seller_id: 'seller-1',
        buyer_id: 'buyer-1',
        asset_id: 'asset-1',
        price: 100,
        fee: 5,
        seller_receives: 95,
        completed_at: new Date(),
      });

      await buyListing('buyer-1', 'list-1');

      expect(mockPrisma.node.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.marketplaceTransaction.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelListing', () => {
    it('should cancel an active listing', async () => {
      const listing = {
        listing_id: 'list-1',
        seller_id: 'seller-1',
        asset_id: 'asset-1',
        asset_type: 'gene',
        price: 100,
        status: 'active',
        buyer_id: null,
        listed_at: new Date(),
        sold_at: null,
        expires_at: new Date(),
      };

      mockPrisma.marketplaceListing.findUnique.mockResolvedValue(listing);
      mockPrisma.marketplaceListing.update.mockResolvedValue({
        ...listing,
        status: 'cancelled',
      });

      const result = await cancelListing('seller-1', 'list-1');

      expect(result.status).toBe('cancelled');
      expect(result.listing_id).toBe('list-1');
    });

    it('should throw NotFoundError when listing does not exist', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue(null);

      await expect(cancelListing('seller-1', 'missing')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw ForbiddenError when caller is not the seller', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue({
        listing_id: 'list-1',
        seller_id: 'seller-1',
        status: 'active',
      });

      await expect(cancelListing('impostor', 'list-1')).rejects.toThrow(
        ForbiddenError,
      );
    });

    it('should throw ValidationError when listing is not active', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue({
        listing_id: 'list-1',
        seller_id: 'seller-1',
        status: 'sold',
      });

      await expect(cancelListing('seller-1', 'list-1')).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe('getListings', () => {
    it('should return active listings with default sorting', async () => {
      const listings = [
        {
          listing_id: 'list-1',
          seller_id: 'seller-1',
          asset_id: 'asset-1',
          asset_type: 'gene',
          price: 100,
          status: 'active',
          buyer_id: null,
          listed_at: new Date(),
          sold_at: null,
          expires_at: new Date(),
        },
      ];

      mockPrisma.marketplaceListing.findMany.mockResolvedValue(listings);
      mockPrisma.marketplaceListing.count.mockResolvedValue(1);

      const result = await getListings();

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0]!.listing_id).toBe('list-1');
    });

    it('should filter by asset type', async () => {
      mockPrisma.marketplaceListing.findMany.mockResolvedValue([]);
      mockPrisma.marketplaceListing.count.mockResolvedValue(0);

      await getListings('gene');

      expect(mockPrisma.marketplaceListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ asset_type: 'gene' }),
        }),
      );
    });

    it('should filter by price range', async () => {
      mockPrisma.marketplaceListing.findMany.mockResolvedValue([]);
      mockPrisma.marketplaceListing.count.mockResolvedValue(0);

      await getListings(undefined, 50, 200);

      const callArgs = mockPrisma.marketplaceListing.findMany.mock.calls[0]![0];
      expect(callArgs.where.price).toEqual({ gte: 50, lte: 200 });
    });

    it('should sort by price ascending', async () => {
      mockPrisma.marketplaceListing.findMany.mockResolvedValue([]);
      mockPrisma.marketplaceListing.count.mockResolvedValue(0);

      await getListings(undefined, undefined, undefined, 'price_asc');

      const callArgs = mockPrisma.marketplaceListing.findMany.mock.calls[0]![0];
      expect(callArgs.orderBy).toEqual({ price: 'asc' });
    });

    it('should sort by price descending', async () => {
      mockPrisma.marketplaceListing.findMany.mockResolvedValue([]);
      mockPrisma.marketplaceListing.count.mockResolvedValue(0);

      await getListings(undefined, undefined, undefined, 'price_desc');

      const callArgs = mockPrisma.marketplaceListing.findMany.mock.calls[0]![0];
      expect(callArgs.orderBy).toEqual({ price: 'desc' });
    });

    it('should apply limit and offset', async () => {
      mockPrisma.marketplaceListing.findMany.mockResolvedValue([]);
      mockPrisma.marketplaceListing.count.mockResolvedValue(0);

      await getListings(undefined, undefined, undefined, 'newest', 10, 5);

      const callArgs = mockPrisma.marketplaceListing.findMany.mock.calls[0]![0];
      expect(callArgs.take).toBe(10);
      expect(callArgs.skip).toBe(5);
    });

    it('should return empty items when no listings', async () => {
      mockPrisma.marketplaceListing.findMany.mockResolvedValue([]);
      mockPrisma.marketplaceListing.count.mockResolvedValue(0);

      const result = await getListings();

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getTransactionHistory', () => {
    it('should return transactions for a node', async () => {
      const transactions = [
        {
          transaction_id: 'tx-1',
          listing_id: 'list-1',
          seller_id: 'node-1',
          buyer_id: 'node-2',
          asset_id: 'asset-1',
          price: 100,
          fee: 5,
          seller_receives: 95,
          completed_at: new Date('2025-06-01'),
        },
      ];

      mockPrisma.marketplaceTransaction.findMany.mockResolvedValue(transactions);

      const result = await getTransactionHistory('node-1');

      expect(result).toHaveLength(1);
      expect(result[0]!.transaction_id).toBe('tx-1');
      expect(result[0]!.price).toBe(100);
      expect(result[0]!.fee).toBe(5);
      expect(result[0]!.seller_receives).toBe(95);
      expect(result[0]!.completed_at).toBe('2025-06-01T00:00:00.000Z');
    });

    it('should query with OR filter for buyer or seller', async () => {
      mockPrisma.marketplaceTransaction.findMany.mockResolvedValue([]);

      await getTransactionHistory('node-1');

      expect(mockPrisma.marketplaceTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ buyer_id: 'node-1' }, { seller_id: 'node-1' }],
          },
        }),
      );
    });

    it('should apply limit and offset', async () => {
      mockPrisma.marketplaceTransaction.findMany.mockResolvedValue([]);

      await getTransactionHistory('node-1', 10, 5);

      expect(mockPrisma.marketplaceTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 5,
        }),
      );
    });

    it('should return empty array when no transactions', async () => {
      mockPrisma.marketplaceTransaction.findMany.mockResolvedValue([]);

      const result = await getTransactionHistory('node-1');

      expect(result).toEqual([]);
    });
  });
});
