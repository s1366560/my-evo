/**
 * Bounty Service — Core Branches Unit Tests
 *
 * Covers the four core service operations for the bounty module with an
 * emphasis on the milestone split logic, expired-bounty filtering,
 * and self-bid rejection. These tests are intentionally mock-Prisma
 * based and complementary to the broader bounty.test.ts suite.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import * as bountyService from './service';
import type { CreateBountyRequest, CreateBidRequest } from './types';

// Minimal mock Prisma client tailored to the bounty service surface.
function createMockPrisma(): PrismaClient {
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

describe('Bounty Service — core branches', () => {
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  // ─── createBounty: milestone split ─────────────────────────────────────
  describe('createBounty — milestone split', () => {
    it('splits a bounty into N milestones whose percentages sum to 100', async () => {
      // Capture the milestones JSON written by createBounty so we can verify
      // the milestone split semantics. The mock returns a minimal stub row.
      (prisma.bounty.create as jest.Mock).mockImplementation(
        (args: { data: { milestones: string } }) => {
          return Promise.resolve({
            id: 'row-1',
            bounty_id: 'bty_split_1',
            title: 'Multi-phase bounty',
            description: 'Deliver in 3 phases',
            requirements: ['phase-1', 'phase-2', 'phase-3'],
            status: 'open',
            amount: 1000,
            deadline: new Date('2026-12-31T00:00:00Z'),
            creator_id: 'user_creator',
            winner_id: null,
            deliverable: null,
            created_at: new Date('2026-01-01T00:00:00Z'),
            completed_at: null,
            milestones: JSON.parse(args.data.milestones),
          });
        },
      );

      const req: CreateBountyRequest = {
        title: 'Multi-phase bounty',
        description: 'Deliver in 3 phases',
        requirements: ['phase-1', 'phase-2', 'phase-3'],
        amount: 1000,
        deadline: '2026-12-31T00:00:00Z',
        milestones: [
          { title: 'Discovery', description: 'Spec', percentage: 20 },
          { title: 'Build', description: 'Implement', percentage: 50 },
          { title: 'Polish', description: 'QA + handoff', percentage: 30 },
        ],
      };

      const result = await bountyService.createBounty(prisma, 'user_creator', req);

      expect(result.success).toBe(true);
      expect(prisma.bounty.create).toHaveBeenCalledTimes(1);

      const createCall = (prisma.bounty.create as jest.Mock).mock.calls[0]?.[0] as {
        data: { milestones: string };
      };
      const persistedMilestones = JSON.parse(createCall.data.milestones) as Array<{
        milestone_id: string;
        title: string;
        percentage: number;
      }>;

      expect(persistedMilestones).toHaveLength(3);
      // Milestone IDs follow the pattern <bountyId>_ms<N> (1-indexed).
      const ids = persistedMilestones.map((m) => m.milestone_id);
      expect(new Set(ids).size).toBe(3);
      expect(ids).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/_ms1$/),
          expect.stringMatching(/_ms2$/),
          expect.stringMatching(/_ms3$/),
        ]),
      );
      // Verify order: _ms1, _ms2, _ms3
      expect(ids[0]!).toMatch(/_ms1$/);
      expect(ids[1]!).toMatch(/_ms2$/);
      expect(ids[2]!).toMatch(/_ms3$/);
      // Percentages preserved exactly.
      expect(persistedMilestones.map((m) => m.percentage)).toEqual([20, 50, 30]);
      // Sum must equal 100 for a well-formed milestone split.
      const totalPct = persistedMilestones.reduce((s, m) => s + m.percentage, 0);
      expect(totalPct).toBe(100);
    });
  });

  // ─── getBounty: detail with milestones + bids ────────────────────────
  describe('getBounty — detail assembly', () => {
    it('returns a bounty with its milestones and bids', async () => {
      (prisma.bounty.findUnique as jest.Mock).mockResolvedValue({
        id: 'row-1',
        bounty_id: 'bty_split_1',
        title: 'Split Bounty',
        description: 'Test milestone split',
        requirements: ['req-1'],
        status: 'open',
        amount: 1000,
        deadline: new Date('2026-12-31T00:00:00Z'),
        creator_id: 'user_creator',
        winner_id: null,
        deliverable: null,
        created_at: new Date('2026-01-01T00:00:00Z'),
        completed_at: null,
        bids: [
          {
            id: 'bid-row-1',
            bid_id: 'bid_1',
            bounty_id: 'bty_split_1',
            bidder_id: 'user_bidder',
            proposed_amount: 800,
            estimated_time: '5 days',
            approach: 'use AI agents',
            status: 'pending',
            submitted_at: new Date('2026-02-01T00:00:00Z'),
          },
        ],
        milestoneRecords: [
          {
            id: 'ms-row-1',
            milestone_id: 'bty_1_ms1',
            title: 'Discovery',
            description: 'Spec',
            percentage: 100,
            status: 'pending',
            deliverable: null,
            paid_credits: 0,
          },
        ],
      });

      const result = await bountyService.getBountyById(prisma, 'bty_split_1');

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.bounty.bounty_id).toBe('bty_split_1');
      expect(result?.bounty.bids).toHaveLength(1);
      expect(result?.bounty.bids[0]?.bidder_id).toBe('user_bidder');
      expect(result?.bounty.milestones).toHaveLength(1);
      expect(result?.bounty.milestones[0]?.milestone_id).toBe('bty_1_ms1');
    });
  });

  // ─── listBounties: expired filter ─────────────────────────────────────
  describe('listBounties — expired filter', () => {
    it('forwards a deadline > now filter when exclude_expired is set', async () => {
      (prisma.bounty.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.bounty.count as jest.Mock).mockResolvedValue(0);

      await bountyService.listBounties(prisma, { status: 'open', exclude_expired: true });

      const findManyCall = (prisma.bounty.findMany as jest.Mock).mock.calls[0]?.[0] as {
        where: Record<string, unknown>;
      };
      // The Prisma where clause must include a deadline filter.
      const deadline = findManyCall.where.deadline as { gt?: Date } | undefined;
      expect(deadline).toBeDefined();
      expect(deadline?.gt).toBeInstanceOf(Date);
      expect((deadline?.gt as Date).getTime()).toBeGreaterThan(Date.now() - 1000);
    });
  });

  // ─── placeBid (createBid): self-bid rejection ─────────────────────────
  describe('createBid — self-bid rejection', () => {
    it('refuses to let the creator place a bid on their own bounty', async () => {
      (prisma.bounty.findUnique as jest.Mock).mockResolvedValue({
        id: 'row-1',
        bounty_id: 'bty_split_1',
        title: 'Split Bounty',
        description: 'Test milestone split',
        requirements: ['req-1'],
        status: 'open',
        amount: 1000,
        deadline: new Date('2026-12-31T00:00:00Z'),
        creator_id: 'user_creator',
        winner_id: null,
        deliverable: null,
        created_at: new Date('2026-01-01T00:00:00Z'),
        completed_at: null,
      });

      const req: CreateBidRequest = {
        proposed_amount: 900,
        estimated_time: '4 days',
        approach: 'use AI agents',
      };

      const result = await bountyService.createBid(prisma, 'bty_split_1', 'user_creator', req);

      // Self-bid must be rejected.
      expect(result).toBeNull();
      // And no bid row should ever have been written.
      expect(prisma.bountyBid.create).not.toHaveBeenCalled();
    });
  });
});
