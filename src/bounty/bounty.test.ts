/**
 * Bounty Module — Unit Tests
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import * as bountyService from './service';
import type {
  CreateBountyRequest,
  UpdateBountyRequest,
  CreateBidRequest,
} from './types';

// Minimal mock Prisma client
function createMockPrisma(_overrides?: Partial<PrismaClient>): PrismaClient {
  const bounty = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  };
  const bountyBid = {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  };
  const bountyMilestone = {
    updateMany: jest.fn(),
  };
  return { bounty, bountyBid, bountyMilestone } as unknown as PrismaClient;
}

describe('Bounty Service', () => {
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  describe('createBounty', () => {
    it('creates a bounty with correct fields', async () => {
      const mockBounty = {
        id: 'id1',
        bounty_id: 'bty_test',
        title: 'Test Bounty',
        description: 'Test description',
        requirements: ['req1', 'req2'],
        status: 'open',
        amount: 500,
        deadline: new Date('2026-12-31'),
        creator_id: 'user1',
        winner_id: null,
        deliverable: null,
        created_at: new Date(),
        completed_at: null,
      };

      (prisma.bounty.create as jest.Mock).mockResolvedValue(mockBounty);

      const req: CreateBountyRequest = {
        title: 'Test Bounty',
        description: 'Test description',
        requirements: ['req1', 'req2'],
        amount: 500,
        deadline: '2026-12-31T00:00:00Z',
      };

      const result = await bountyService.createBounty(prisma, 'user1', req);

      expect(result.success).toBe(true);
      expect(result.bounty.title).toBe('Test Bounty');
      expect(result.bounty.amount).toBe(500);
      expect(result.bounty.creator_id).toBe('user1');
      expect(prisma.bounty.create).toHaveBeenCalledTimes(1);
    });

    it('creates milestones when provided', async () => {
      const mockBounty = {
        id: 'id1',
        bounty_id: 'bty_test2',
        title: 'Bounty With Milestones',
        description: 'Desc',
        requirements: ['req1'],
        status: 'open',
        amount: 1000,
        deadline: new Date('2026-12-31'),
        creator_id: 'user1',
        winner_id: null,
        deliverable: null,
        created_at: new Date(),
        completed_at: null,
      };

      (prisma.bounty.create as jest.Mock).mockResolvedValue(mockBounty);

      const req: CreateBountyRequest = {
        title: 'Bounty With Milestones',
        description: 'Desc',
        requirements: ['req1'],
        amount: 1000,
        deadline: '2026-12-31T00:00:00Z',
        milestones: [
          { title: 'Phase 1', description: 'First phase', percentage: 50 },
          { title: 'Phase 2', description: 'Second phase', percentage: 50 },
        ],
      };

      const result = await bountyService.createBounty(prisma, 'user1', req);

      expect(result.success).toBe(true);
      const createCall = (prisma.bounty.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.milestones).toBeDefined();
      const milestones = JSON.parse(createCall.data.milestones as string);
      expect(milestones).toHaveLength(2);
      expect(milestones[0].title).toBe('Phase 1');
    });
  });

  describe('getBountyById', () => {
    it('returns null for non-existent bounty', async () => {
      (prisma.bounty.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await bountyService.getBountyById(prisma, 'nonexistent');
      expect(result).toBeNull();
    });

    it('returns bounty with bids and milestones', async () => {
      const mockBounty = {
        id: 'id1',
        bounty_id: 'bty_test',
        title: 'Bounty',
        description: 'Desc',
        requirements: ['req1'],
        status: 'open',
        amount: 500,
        deadline: new Date('2026-12-31'),
        creator_id: 'user1',
        winner_id: null,
        deliverable: null,
        created_at: new Date(),
        completed_at: null,
        bids: [{
          id: 'bid1',
          bid_id: 'bid_test',
          bounty_id: 'bty_test',
          bidder_id: 'user2',
          proposed_amount: 450,
          estimated_time: '3 days',
          approach: 'Use AI agents',
          status: 'pending',
          submitted_at: new Date(),
        }],
        milestoneRecords: [{
          id: 'ms1',
          milestone_id: 'bty_test_ms1',
          title: 'Phase 1',
          description: 'First phase',
          percentage: 50,
          status: 'pending',
          deliverable: null,
          paid_credits: 0,
        }],
      };

      (prisma.bounty.findUnique as jest.Mock).mockResolvedValue(mockBounty);

      const result = await bountyService.getBountyById(prisma, 'bty_test');

      expect(result).not.toBeNull();
      expect(result!.bounty.bids).toHaveLength(1);
      expect((result!.bounty.bids ?? [])[0]?.proposed_amount).toBe(450);
      expect(result!.bounty.milestones).toHaveLength(1);
    });
  });

  describe('listBounties', () => {
    it('returns paginated list', async () => {
      const mockBounties = [
        { id: 'id1', bounty_id: 'bty_1', title: 'Bounty 1', description: 'Desc', requirements: [], status: 'open', amount: 100, deadline: new Date('2026-12-31'), creator_id: 'user1', created_at: new Date(), _count: { bids: 3 } },
        { id: 'id2', bounty_id: 'bty_2', title: 'Bounty 2', description: 'Desc', requirements: [], status: 'open', amount: 200, deadline: new Date('2026-12-31'), creator_id: 'user1', created_at: new Date(), _count: { bids: 1 } },
      ];

      (prisma.bounty.findMany as jest.Mock).mockResolvedValue(mockBounties);
      (prisma.bounty.count as jest.Mock).mockResolvedValue(2);

      const result = await bountyService.listBounties(prisma, { limit: 20 });

      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
      expect(result.bounties).toHaveLength(2);
      expect((result.bounties ?? [])[0]?.bid_count).toBe(3);
    });

    it('filters by status', async () => {
      (prisma.bounty.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.bounty.count as jest.Mock).mockResolvedValue(0);

      await bountyService.listBounties(prisma, { status: 'open' });

      const findManyCall = (prisma.bounty.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.status).toBe('open');
    });
  });

  describe('updateBounty', () => {
    it('updates title and description', async () => {
      const existing = {
        id: 'id1', bounty_id: 'bty_test', title: 'Old', description: 'Old Desc',
        requirements: [], status: 'open', amount: 500, deadline: new Date('2026-12-31'),
        creator_id: 'user1', winner_id: null, deliverable: null, created_at: new Date(),
        completed_at: null, bids: [], milestoneRecords: [],
      };

      const updated = { ...existing, title: 'New Title', description: 'New Desc' };

      (prisma.bounty.findUnique as jest.Mock).mockResolvedValue(existing);
      (prisma.bounty.update as jest.Mock).mockResolvedValue(updated);

      const req: UpdateBountyRequest = { title: 'New Title', description: 'New Desc' };
      const result = await bountyService.updateBounty(prisma, 'bty_test', 'user1', req);

      expect(result).not.toBeNull();
      expect(result!.bounty.title).toBe('New Title');
    });

    it('returns null for non-creator', async () => {
      (prisma.bounty.findUnique as jest.Mock).mockResolvedValue({
        id: 'id1', bounty_id: 'bty_test', title: 'Old', description: 'Desc',
        requirements: [], status: 'open', amount: 500, deadline: new Date('2026-12-31'),
        creator_id: 'user1', winner_id: null, deliverable: null, created_at: new Date(),
        completed_at: null,
      });

      const result = await bountyService.updateBounty(prisma, 'bty_test', 'wrong_user', {});
      expect(result).toBeNull();
    });
  });

  describe('createBid', () => {
    it('rejects bid on closed bounty', async () => {
      (prisma.bounty.findUnique as jest.Mock).mockResolvedValue({
        bounty_id: 'bty_test', status: 'completed', creator_id: 'user1',
      });

      const req: CreateBidRequest = { proposed_amount: 400, estimated_time: '2 days', approach: 'Approach' };
      const result = await bountyService.createBid(prisma, 'bty_test', 'user2', req);

      expect(result).toBeNull();
    });

    it('rejects duplicate bid from same bidder', async () => {
      (prisma.bounty.findUnique as jest.Mock).mockResolvedValue({
        bounty_id: 'bty_test', status: 'open', creator_id: 'user1',
      });
      (prisma.bountyBid.findFirst as jest.Mock).mockResolvedValue({ bid_id: 'existing' });

      const req: CreateBidRequest = { proposed_amount: 400, estimated_time: '2 days', approach: 'Approach' };
      const result = await bountyService.createBid(prisma, 'bty_test', 'user2', req);

      expect(result).toBeNull();
    });

    it('creates bid successfully', async () => {
      (prisma.bounty.findUnique as jest.Mock).mockResolvedValue({
        bounty_id: 'bty_test', status: 'open', creator_id: 'user1',
      });
      (prisma.bountyBid.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.bountyBid.create as jest.Mock).mockResolvedValue({
        id: 'bid1', bid_id: 'bid_test', bounty_id: 'bty_test', bidder_id: 'user2',
        proposed_amount: 400, estimated_time: '2 days', approach: 'Approach',
        status: 'pending', submitted_at: new Date(),
      });

      const req: CreateBidRequest = { proposed_amount: 400, estimated_time: '2 days', approach: 'Approach' };
      const result = await bountyService.createBid(prisma, 'bty_test', 'user2', req);

      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
      expect(result!.bid.proposed_amount).toBe(400);
    });
  });

  describe('updateBidStatus', () => {
    it('rejects bid by non-creator', async () => {
      (prisma.bounty.findUnique as jest.Mock).mockResolvedValue({
        bounty_id: 'bty_test', creator_id: 'user1',
      });

      const result = await bountyService.updateBidStatus(prisma, 'bty_test', 'bid1', 'wrong_user', 'accepted');
      expect(result).toBe(false);
    });

    it('accepts bid and rejects other pending bids', async () => {
      (prisma.bounty.findUnique as jest.Mock).mockResolvedValue({
        bounty_id: 'bty_test', creator_id: 'user1',
      });
      (prisma.bountyBid.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.bounty.update as jest.Mock).mockResolvedValue({});

      const result = await bountyService.updateBidStatus(prisma, 'bty_test', 'bid1', 'user1', 'accepted');

      expect(result).toBe(true);
      // Should have been called twice: once for the accepted bid, once to reject others
      expect((prisma.bountyBid.updateMany as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('deleteBounty', () => {
    it('deletes by creator', async () => {
      (prisma.bounty.findUnique as jest.Mock).mockResolvedValue({
        bounty_id: 'bty_test', creator_id: 'user1',
      });
      (prisma.bounty.delete as jest.Mock).mockResolvedValue({});

      const result = await bountyService.deleteBounty(prisma, 'bty_test', 'user1');
      expect(result).toBe(true);
    });

    it('prevents deletion by non-creator', async () => {
      (prisma.bounty.findUnique as jest.Mock).mockResolvedValue({
        bounty_id: 'bty_test', creator_id: 'user1',
      });

      const result = await bountyService.deleteBounty(prisma, 'bty_test', 'wrong_user');
      expect(result).toBe(false);
    });
  });

  describe('getBountyStats', () => {
    it('returns correct stats', async () => {
      (prisma.bounty.count as jest.Mock)
        .mockResolvedValueOnce(5)   // open
        .mockResolvedValueOnce(3)   // in_progress
        .mockResolvedValueOnce(10)  // completed
        .mockResolvedValueOnce(18); // total
      (prisma.bounty.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 5000 } });

      const result = await bountyService.getBountyStats(prisma);

      expect(result.success).toBe(true);
      expect(result.stats.open).toBe(5);
      expect(result.stats.in_progress).toBe(3);
      expect(result.stats.completed).toBe(10);
      expect(result.stats.total_value).toBe(5000);
      expect(result.stats.total_bounties).toBe(18);
    });
  });
});
