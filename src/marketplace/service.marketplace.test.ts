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
  },
  serviceTransaction: {
    count: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
  bounty: {
    count: jest.fn(),
  },
  node: {
    findFirst: jest.fn(),
  },
  question: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
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
    mockPrisma.serviceTransaction.count.mockResolvedValue(0);
    mockPrisma.serviceTransaction.aggregate.mockResolvedValue({ _sum: { price_paid: 0 } });
    mockPrisma.serviceTransaction.findMany.mockResolvedValue([]);
    mockPrisma.bounty.count.mockResolvedValue(0);
    mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1' });
    mockPrisma.question.findFirst.mockResolvedValue(null);
    mockPrisma.question.findMany.mockResolvedValue([]);
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
      ).rejects.toThrow(ValidationError);
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
