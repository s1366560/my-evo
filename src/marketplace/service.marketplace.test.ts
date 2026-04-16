import { PrismaClient } from '@prisma/client';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../shared/errors';
import * as service from './service.marketplace';

const mockPrisma = {
  serviceListing: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  servicePurchase: {
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  serviceTransaction: {
    create: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  bounty: {
    count: jest.fn(),
  },
  node: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  creditTransaction: {
    create: jest.fn(),
  },
  question: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  dispute: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
} as any;

describe('Service marketplace helpers', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.serviceListing.findMany.mockResolvedValue([]);
    mockPrisma.serviceListing.count.mockResolvedValue(0);
    mockPrisma.serviceListing.findFirst.mockResolvedValue(null);
    mockPrisma.servicePurchase.findFirst.mockResolvedValue(null);
    mockPrisma.servicePurchase.count.mockResolvedValue(0);
    mockPrisma.servicePurchase.update.mockResolvedValue({});
    mockPrisma.servicePurchase.create.mockResolvedValue({});
    mockPrisma.serviceTransaction.count.mockResolvedValue(0);
    mockPrisma.serviceTransaction.aggregate.mockResolvedValue({ _sum: { price_paid: 0 } });
    mockPrisma.serviceTransaction.findMany.mockResolvedValue([]);
    mockPrisma.serviceTransaction.findFirst.mockResolvedValue(null);
    mockPrisma.serviceTransaction.create.mockResolvedValue({});
    mockPrisma.serviceTransaction.update.mockResolvedValue({});
    mockPrisma.serviceTransaction.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.bounty.count.mockResolvedValue(0);
    mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1' });
    mockPrisma.node.update.mockResolvedValue({ node_id: 'node-1', credit_balance: 95 });
    mockPrisma.creditTransaction.create.mockResolvedValue({});
    mockPrisma.question.findFirst.mockResolvedValue(null);
    mockPrisma.question.findMany.mockResolvedValue([]);
    mockPrisma.dispute.create.mockResolvedValue({});
    mockPrisma.$transaction = jest.fn(async (arg: any) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg(mockPrisma);
    });
  });

  describe('searchServiceListings', () => {
    it('should search active listings with text and category filters', async () => {
      const createdAt = new Date('2026-01-01T00:00:00Z');
      mockPrisma.serviceListing.findMany.mockResolvedValue([{
        listing_id: 'listing_1',
        seller_id: 'node-1',
        title: 'Code review service',
        description: 'Review TypeScript code',
        category: 'engineering',
        tags: ['typescript'],
        price_type: 'fixed',
        price_credits: 50,
        license_type: 'non-exclusive',
        status: 'active',
        created_at: createdAt,
      }]);
      mockPrisma.serviceListing.count.mockResolvedValue(1);

      const result = await service.searchServiceListings({
        query: 'review',
        category: 'engineering',
        limit: 10,
        offset: 5,
      });

      expect(result.total).toBe(1);
      expect(result.items[0]?.listing_id).toBe('listing_1');
      expect(mockPrisma.serviceListing.findMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          category: 'engineering',
          OR: [
            { title: { contains: 'review', mode: 'insensitive' } },
            { description: { contains: 'review', mode: 'insensitive' } },
            { category: { contains: 'review', mode: 'insensitive' } },
            { tags: { has: 'review' } },
          ],
        },
        take: 10,
        skip: 5,
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('getServiceListing', () => {
    it('should return listing details with derived marketplace stats', async () => {
      const createdAt = new Date('2026-01-01T00:00:00Z');
      mockPrisma.serviceListing.findFirst.mockResolvedValue({
        listing_id: 'listing_1',
        seller_id: 'node-1',
        title: 'Review service',
        description: 'Review TypeScript code',
        category: 'engineering',
        tags: ['typescript'],
        price_type: 'fixed',
        price_credits: 50,
        license_type: 'exclusive',
        status: 'active',
        created_at: createdAt,
      });
      mockPrisma.servicePurchase.count.mockResolvedValue(3);
      mockPrisma.question.findMany.mockResolvedValue([
        { tags: ['service_review', 'service:listing_1', 'rating:5'] },
        { tags: ['service_review', 'service:listing_1', 'rating:3'] },
      ]);

      const result = await service.getServiceListing('listing_1');

      expect(result).toMatchObject({
        listing_id: 'listing_1',
        price_type: 'fixed',
        license_type: 'exclusive',
        stats: {
          views: 0,
          purchases: 3,
          rating: 4,
          rating_count: 2,
        },
      });
      expect(mockPrisma.question.findMany).toHaveBeenCalledWith({
        where: {
          tags: { hasEvery: ['service_review', 'service:listing_1'] },
        },
        select: { tags: true },
      });
    });
  });

  describe('getMarketStats', () => {
    it('should expose credit-marketplace stats aligned with Chapter 21', async () => {
      mockPrisma.serviceListing.count
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(3);
      mockPrisma.serviceTransaction.count.mockResolvedValue(6);
      mockPrisma.serviceTransaction.aggregate.mockResolvedValue({ _sum: { price_paid: 1260 } });
      mockPrisma.serviceListing.findMany
        .mockResolvedValueOnce([
          { price_credits: 80 },
          { price_credits: 220 },
          { price_credits: 1800 },
        ])
        .mockResolvedValueOnce([
          { category: 'code_review' },
          { category: 'translation' },
          { category: 'code_review' },
          { category: 'data_analysis' },
        ]);
      mockPrisma.bounty.count
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);

      const result = await service.getMarketStats();

      expect(result).toEqual({
        total_listings: 4,
        active_listings: 3,
        total_transactions: 6,
        total_volume: 1260,
        total_volume_credits: 1260,
        average_price: 700,
        price_tiers: {
          budget: 1,
          standard: 1,
          premium: 1,
          elite: 0,
        },
        top_categories: [
          { category: 'code_review', count: 2 },
          { category: 'data_analysis', count: 1 },
          { category: 'translation', count: 1 },
        ],
        bounties: {
          total: 7,
          open: 3,
          completed: 2,
          cancelled: 1,
        },
        categories: {
          code_review: 2,
          translation: 1,
          data_analysis: 1,
        },
      });
    });
  });

  describe('updateServiceListing', () => {
    it('should update seller-owned listings and normalize price type', async () => {
      const createdAt = new Date('2026-01-01T00:00:00Z');
      mockPrisma.serviceListing.findFirst.mockResolvedValue({
        listing_id: 'listing_1',
        seller_id: 'node-1',
        title: 'Old',
        description: 'Old desc',
        category: 'engineering',
        tags: [],
        price_type: 'free',
        price_credits: 0,
        license_type: 'exclusive',
        status: 'active',
        created_at: createdAt,
      });
      mockPrisma.serviceListing.update.mockResolvedValue({
        listing_id: 'listing_1',
        seller_id: 'node-1',
        title: 'New',
        description: 'Updated desc',
        category: 'engineering',
        tags: [],
        price_type: 'fixed',
        price_credits: 25,
        license_type: 'exclusive',
        status: 'paused',
        created_at: createdAt,
      });

      const result = await service.updateServiceListing('node-1', 'listing_1', {
        title: 'New',
        description: 'Updated desc',
        price_credits: 25,
        status: 'paused',
      });

      expect(result.price_type).toBe('fixed');
      expect(result.status).toBe('paused');
      expect(mockPrisma.serviceListing.update).toHaveBeenCalledWith({
        where: { listing_id: 'listing_1' },
        data: {
          title: 'New',
          description: 'Updated desc',
          price_credits: 25,
          price_type: 'fixed',
          status: 'paused',
        },
      });
    });

    it('should reject updates from non-sellers', async () => {
      mockPrisma.serviceListing.findFirst.mockResolvedValue({
        listing_id: 'listing_1',
        seller_id: 'node-2',
      });

      await expect(
        service.updateServiceListing('node-1', 'listing_1', { title: 'Nope' }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should reject invalid listing statuses', async () => {
      mockPrisma.serviceListing.findFirst.mockResolvedValue({
        listing_id: 'listing_1',
        seller_id: 'node-1',
        price_type: 'free',
        price_credits: 0,
      });

      await expect(
        service.updateServiceListing('node-1', 'listing_1', { status: 'deleted' }),
      ).rejects.toThrow('status must be one of active, paused, archived, cancelled, sold, expired');
    });
  });

  describe('createServiceListing', () => {
    it('should persist architecture-native price and license enums', async () => {
      const createdAt = new Date('2026-01-03T00:00:00Z');
      mockPrisma.serviceListing.create.mockResolvedValue({
        listing_id: 'listing_1',
        seller_id: 'node-1',
        title: 'Review service',
        description: 'I review code',
        category: 'engineering',
        tags: ['typescript'],
        price_type: 'fixed',
        price_credits: 50,
        license_type: 'non-exclusive',
        status: 'active',
        created_at: createdAt,
      });

      const result = await service.createServiceListing('node-1', {
        title: 'Review service',
        description: 'I review code',
        category: 'engineering',
        tags: ['typescript'],
        price_type: 'fixed',
        price_credits: 50,
        license_type: 'non-exclusive',
      });

      expect(result).toMatchObject({
        listing_id: 'listing_1',
        price_type: 'fixed',
        license_type: 'non-exclusive',
      });
      expect(mockPrisma.serviceListing.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          listing_id: expect.stringMatching(/^listing_/),
          price_type: 'fixed',
          license_type: 'non-exclusive',
        }),
      });
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'service_listing_fee',
          amount: -5,
        }),
      });
    });

    it('should reject unknown sellers', async () => {
      mockPrisma.node.findFirst.mockResolvedValue(null);

      await expect(
        service.createServiceListing('missing-node', {
          title: 'Review service',
          description: 'I review code',
          category: 'engineering',
          tags: [],
          price_type: 'free',
          license_type: 'open_source',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should reject sellers without listing-fee credits', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', credit_balance: 3 });

      await expect(
        service.createServiceListing('node-1', {
          title: 'Review service',
          description: 'I review code',
          category: 'engineering',
          tags: [],
          price_type: 'fixed',
          price_credits: 50,
          license_type: 'non-exclusive',
        }),
      ).rejects.toThrow('Insufficient credits');
    });
  });

  describe('purchaseService', () => {
    it('should lock buyer funds in escrow and mark exclusive listings as sold', async () => {
      const purchasedAt = new Date('2026-01-02T00:00:00Z');
      mockPrisma.serviceListing.findFirst.mockResolvedValue({
        listing_id: 'listing_1',
        seller_id: 'node-2',
        price_credits: 200,
        price_type: 'fixed',
        license_type: 'exclusive',
        status: 'active',
      });
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', credit_balance: 500 });
      mockPrisma.servicePurchase.create.mockResolvedValue({
        purchase_id: 'pur-1',
        listing_id: 'listing_1',
        buyer_id: 'node-1',
        seller_id: 'node-2',
        price_paid: 200,
        status: 'pending',
        purchased_at: purchasedAt,
      });
      mockPrisma.serviceListing.update.mockResolvedValue({});
      mockPrisma.serviceTransaction.create.mockResolvedValue({});

      const result = await service.purchaseService('node-1', 'listing_1');

      expect(result.transaction_id).toMatch(/^stx-/);
      expect(result.escrow).toEqual({
        escrow_id: 'escrow_pur-1',
        amount: 200,
        status: 'locked',
        locked_at: purchasedAt.toISOString(),
      });
      expect(mockPrisma.node.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { node_id: 'node-1' },
        data: { credit_balance: { decrement: 200 } },
      });
      expect(mockPrisma.serviceTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          purchase_id: expect.stringMatching(/^pur-/),
          status: 'pending',
          escrow_id: expect.stringMatching(/^escrow_pur-/),
          completed_at: null,
        }),
      });
      expect(mockPrisma.serviceListing.update).toHaveBeenCalledWith({
        where: { listing_id: 'listing_1' },
        data: { status: 'sold' },
      });
    });
  });

  describe('confirmPurchase', () => {
    it('should release escrow and pay the seller when confirming a purchase', async () => {
      const purchasedAt = new Date('2026-01-02T00:00:00Z');
      const confirmedAt = new Date('2026-01-03T00:00:00Z');
      mockPrisma.servicePurchase.findFirst.mockResolvedValue({
        purchase_id: 'pur-1',
        listing_id: 'listing_1',
        buyer_id: 'node-1',
        seller_id: 'node-2',
        price_paid: 200,
        status: 'pending',
        purchased_at: purchasedAt,
      });
      mockPrisma.serviceTransaction.findFirst.mockResolvedValue({
        transaction_id: 'stx-1',
        purchase_id: 'pur-1',
        listing_id: 'listing_1',
        buyer_id: 'node-1',
        seller_id: 'node-2',
        price_paid: 200,
        fee: 10,
        status: 'pending',
        escrow_id: 'escrow_pur-1',
        locked_at: purchasedAt,
      });
      mockPrisma.servicePurchase.update.mockResolvedValue({
        purchase_id: 'pur-1',
        listing_id: 'listing_1',
        buyer_id: 'node-1',
        seller_id: 'node-2',
        price_paid: 200,
        status: 'confirmed',
        purchased_at: purchasedAt,
        confirmed_at: confirmedAt,
      });
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-2', credit_balance: 100 });
      mockPrisma.node.update.mockResolvedValue({ node_id: 'node-2', credit_balance: 290 });

      const result = await service.confirmPurchase('node-1', 'pur-1');

      expect(result.transaction_id).toBe('stx-1');
      expect(result.escrow).toEqual({
        escrow_id: 'escrow_pur-1',
        amount: 200,
        status: 'released',
        locked_at: purchasedAt.toISOString(),
        released_at: confirmedAt.toISOString(),
      });
      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { node_id: 'node-2' },
        data: { credit_balance: { increment: 190 } },
      });
      expect(mockPrisma.serviceTransaction.update).toHaveBeenCalledWith({
        where: { transaction_id: 'stx-1' },
        data: expect.objectContaining({
          status: 'completed',
          released_at: expect.any(Date),
          completed_at: expect.any(Date),
        }),
      });
    });
  });

  describe('disputePurchase', () => {
    it('should return locked escrow details for disputed purchases', async () => {
      const purchasedAt = new Date('2026-01-02T00:00:00Z');
      mockPrisma.servicePurchase.findFirst.mockResolvedValue({
        purchase_id: 'pur-1',
        listing_id: 'listing_1',
        buyer_id: 'node-1',
        seller_id: 'node-2',
        price_paid: 200,
        status: 'pending',
        purchased_at: purchasedAt,
      });
      mockPrisma.serviceTransaction.findFirst.mockResolvedValue({
        transaction_id: 'stx-1',
        purchase_id: 'pur-1',
        listing_id: 'listing_1',
        buyer_id: 'node-1',
        seller_id: 'node-2',
        price_paid: 200,
        fee: 10,
        status: 'pending',
        escrow_id: 'escrow_pur-1',
        locked_at: purchasedAt,
      });

      const result = await service.disputePurchase('node-1', 'pur-1', 'Service failed');

      expect(result).toEqual({
        dispute_id: expect.stringMatching(/^dis-/),
        purchase_id: 'pur-1',
        transaction_id: 'stx-1',
        amount: 200,
        status: 'disputed',
        escrow: {
          escrow_id: 'escrow_pur-1',
          amount: 200,
          status: 'locked',
          locked_at: purchasedAt.toISOString(),
        },
      });
      expect(mockPrisma.serviceTransaction.update).toHaveBeenCalledWith({
        where: { transaction_id: 'stx-1' },
        data: { status: 'disputed' },
      });
    });
  });

  describe('getTransaction', () => {
    it('should expose transaction aliases and escrow detail', async () => {
      const lockedAt = new Date('2026-01-02T00:00:00Z');
      const releasedAt = new Date('2026-01-03T00:00:00Z');
      const completedAt = new Date('2026-01-03T00:00:00Z');
      mockPrisma.serviceTransaction.findFirst.mockResolvedValue({
        transaction_id: 'tx-1',
        purchase_id: 'pur-1',
        buyer_id: 'node-1',
        seller_id: 'node-2',
        listing_id: 'listing_1',
        price_paid: 200,
        fee: 10,
        status: 'completed',
        escrow_id: 'escrow_tx-1',
        locked_at: lockedAt,
        released_at: releasedAt,
        completed_at: completedAt,
      });

      const result = await service.getTransaction('node-1', 'tx-1');

      expect(result).toEqual({
        transaction_id: 'tx-1',
        purchase_id: 'pur-1',
        buyer_id: 'node-1',
        seller_id: 'node-2',
        listing_id: 'listing_1',
        price_paid: 200,
        amount: 200,
        fee: 10,
        platform_fee: 10,
        seller_revenue: 190,
        status: 'completed',
        escrow: {
          escrow_id: 'escrow_tx-1',
          amount: 200,
          status: 'released',
          locked_at: lockedAt.toISOString(),
          released_at: releasedAt.toISOString(),
        },
        created_at: lockedAt.toISOString(),
        completed_at: completedAt.toISOString(),
      });
    });
  });

  describe('getTransaction', () => {
    it('should return detail contract fields including escrow and seller revenue', async () => {
      const lockedAt = new Date('2026-01-02T00:00:00Z');
      mockPrisma.serviceTransaction.findFirst.mockResolvedValue({
        transaction_id: 'stx-1',
        purchase_id: 'pur-1',
        listing_id: 'listing_1',
        buyer_id: 'node-1',
        seller_id: 'node-2',
        price_paid: 200,
        fee: 10,
        status: 'pending',
        escrow_id: 'escrow_pur-1',
        locked_at: lockedAt,
        released_at: null,
        completed_at: null,
      });

      const result = await service.getTransaction('node-1', 'stx-1');

      expect(result).toMatchObject({
        transaction_id: 'stx-1',
        purchase_id: 'pur-1',
        amount: 200,
        platform_fee: 10,
        seller_revenue: 190,
        status: 'pending',
        escrow: {
          escrow_id: 'escrow_pur-1',
          amount: 200,
          status: 'locked',
          locked_at: lockedAt.toISOString(),
        },
      });
    });
  });

  describe('rateService', () => {
    it('should create a review for a purchased service', async () => {
      const createdAt = new Date('2026-01-02T00:00:00Z');
      const updatedAt = new Date('2026-01-02T01:00:00Z');
      mockPrisma.serviceListing.findFirst.mockResolvedValue({
        listing_id: 'svc-1',
        title: 'Code review service',
      });
      mockPrisma.servicePurchase.findFirst.mockResolvedValue({
        purchase_id: 'pur-1',
        listing_id: 'svc-1',
        buyer_id: 'node-1',
        status: 'confirmed',
      });
      mockPrisma.question.upsert.mockResolvedValue({
        question_id: 'srvrev-stable',
        body: 'Great service',
        created_at: createdAt,
        updated_at: updatedAt,
      });

      const result = await service.rateService('node-1', 'svc-1', 5, 'Great service');

      expect(result.review_id).toBe('srvrev-stable');
      expect(result.rating).toBe(5);
      expect(mockPrisma.question.upsert).toHaveBeenCalledWith({
        where: expect.objectContaining({
          question_id: expect.stringMatching(/^srvrev-/),
        }),
        create: expect.objectContaining({
          title: 'Review for Code review service',
          body: 'Great service',
          tags: ['service_review', 'service:svc-1', 'rating:5'],
          author: 'node-1',
        }),
        update: {
          title: 'Review for Code review service',
          body: 'Great service',
          tags: ['service_review', 'service:svc-1', 'rating:5'],
        },
      });
    });

    it('should update an existing review for the same buyer and listing', async () => {
      const createdAt = new Date('2026-01-02T00:00:00Z');
      const updatedAt = new Date('2026-01-02T01:00:00Z');
      mockPrisma.serviceListing.findFirst.mockResolvedValue({
        listing_id: 'svc-1',
        title: 'Code review service',
      });
      mockPrisma.servicePurchase.findFirst.mockResolvedValue({
        purchase_id: 'pur-1',
        listing_id: 'svc-1',
        buyer_id: 'node-1',
        status: 'confirmed',
      });
      mockPrisma.question.findFirst.mockResolvedValue({
        question_id: 'srvrev-existing',
      });
      mockPrisma.question.update.mockResolvedValue({
        question_id: 'srvrev-existing',
        body: 'Updated review',
        created_at: createdAt,
        updated_at: updatedAt,
      });

      const result = await service.rateService('node-1', 'svc-1', 4, 'Updated review');

      expect(result.review_id).toBe('srvrev-existing');
      expect(result.rating).toBe(4);
      expect(mockPrisma.question.update).toHaveBeenCalledWith({
        where: { question_id: 'srvrev-existing' },
        data: {
          title: 'Review for Code review service',
          body: 'Updated review',
          tags: ['service_review', 'service:svc-1', 'rating:4'],
        },
      });
    });

    it('should require a confirmed purchase before rating', async () => {
      mockPrisma.serviceListing.findFirst.mockResolvedValue({
        listing_id: 'svc-1',
        title: 'Code review service',
      });

      await expect(
        service.rateService('node-1', 'svc-1', 5),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should reject invalid ratings', async () => {
      await expect(
        service.rateService('node-1', 'svc-1', 6),
      ).rejects.toThrow(ValidationError);
    });

    it('should fail when the listing does not exist', async () => {
      mockPrisma.servicePurchase.findFirst.mockResolvedValue({
        purchase_id: 'pur-1',
      });

      await expect(
        service.rateService('node-1', 'missing', 5),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
