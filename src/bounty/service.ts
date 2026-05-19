/**
 * Bounty Module — Business Logic Service
 */

import { PrismaClient } from '@prisma/client';
import type {
  CreateBountyRequest,
  UpdateBountyRequest,
  BountyFilters,
  CreateBidRequest,
  BountyListResponse,
  BountyDetailResponse,
  BountySummary,
  BidResponse,
  BountyStats,
} from './types';

function toSummary(b: {
  id: string; bounty_id: string; title: string; description: string;
  status: string; amount: number; deadline: Date; creator_id: string;
  created_at: Date; bidCount?: number;
}): BountySummary {
  return {
    id: b.id,
    bounty_id: b.bounty_id,
    title: b.title,
    description: b.description,
    status: b.status,
    amount: b.amount,
    deadline: b.deadline.toISOString(),
    creator_id: b.creator_id,
    bid_count: b.bidCount ?? 0,
    created_at: b.created_at.toISOString(),
  };
}

// ─── Bounty CRUD ────────────────────────────────────────────────────────────

export async function createBounty(
  prisma: PrismaClient,
  creatorId: string,
  req: CreateBountyRequest,
): Promise<BountyDetailResponse> {
  const bountyId = `bty_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const milestoneData = (req.milestones ?? []).map((m, i) => ({
    milestone_id: `${bountyId}_ms${i + 1}`,
    title: m.title,
    description: m.description,
    percentage: m.percentage,
  }));

  const bounty = await prisma.bounty.create({
    data: {
      bounty_id: bountyId,
      title: req.title,
      description: req.description,
      requirements: req.requirements,
      amount: req.amount,
      deadline: new Date(req.deadline),
      creator_id: creatorId,
      milestones: JSON.stringify(milestoneData),
    },
  });

  return { success: true, bounty: toDetail(prisma, bounty, []) };
}

export async function getBountyById(
  prisma: PrismaClient,
  bountyId: string,
): Promise<BountyDetailResponse | null> {
  const bounty = await prisma.bounty.findUnique({
    where: { bounty_id: bountyId },
    include: {
      bids: { orderBy: { submitted_at: 'desc' } },
      milestoneRecords: { orderBy: { created_at: 'asc' } },
    },
  });
  if (!bounty) return null;
  return { success: true, bounty: toDetail(prisma, bounty, bounty.bids) };
}

export async function listBounties(
  prisma: PrismaClient,
  filters: BountyFilters,
): Promise<BountyListResponse> {
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.creator_id) where.creator_id = filters.creator_id;
  if (filters.min_amount !== undefined) where.amount = { ...(where.amount as object ?? {}), gte: filters.min_amount };
  if (filters.max_amount !== undefined) where.amount = { ...(where.amount as object ?? {}), lte: filters.max_amount };

  const [bounties, total] = await Promise.all([
    prisma.bounty.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limit,
      include: { _count: { select: { bids: true } } },
    }),
    prisma.bounty.count({ where }),
  ]);

  return {
    success: true,
    total,
    bounties: bounties.map((b) =>
      toSummary({ ...b, bidCount: b._count.bids }),
    ),
  };
}

export async function updateBounty(
  prisma: PrismaClient,
  bountyId: string,
  creatorId: string,
  req: UpdateBountyRequest,
): Promise<BountyDetailResponse | null> {
  const existing = await prisma.bounty.findUnique({ where: { bounty_id: bountyId } });
  if (!existing) return null;
  if (existing.creator_id !== creatorId) return null; // Forbidden

  const data: Record<string, unknown> = {};
  if (req.title !== undefined) data.title = req.title;
  if (req.description !== undefined) data.description = req.description;
  if (req.requirements !== undefined) data.requirements = req.requirements;
  if (req.status !== undefined) {
    data.status = req.status;
    if (req.status === 'completed') data.completed_at = new Date();
  }
  if (req.winner_id !== undefined) {
    data.winner_id = req.winner_id;
    data.status = 'completed';
    data.completed_at = new Date();
  }

  const bounty = await prisma.bounty.update({
    where: { bounty_id: bountyId },
    data,
    include: {
      bids: { orderBy: { submitted_at: 'desc' } },
      milestoneRecords: { orderBy: { created_at: 'asc' } },
    },
  });

  return { success: true, bounty: toDetail(prisma, bounty, bounty.bids) };
}

export async function deleteBounty(
  prisma: PrismaClient,
  bountyId: string,
  creatorId: string,
): Promise<boolean> {
  const existing = await prisma.bounty.findUnique({ where: { bounty_id: bountyId } });
  if (!existing || existing.creator_id !== creatorId) return false;
  await prisma.bounty.delete({ where: { bounty_id: bountyId } });
  return true;
}

// ─── Bidding ────────────────────────────────────────────────────────────────

export async function createBid(
  prisma: PrismaClient,
  bountyId: string,
  bidderId: string,
  req: CreateBidRequest,
): Promise<BidResponse | null> {
  const bounty = await prisma.bounty.findUnique({ where: { bounty_id: bountyId } });
  if (!bounty || bounty.status !== 'open') return null;

  // Prevent duplicate bid
  const existing = await prisma.bountyBid.findFirst({
    where: { bounty_id: bountyId, bidder_id: bidderId, status: { not: 'rejected' } },
  });
  if (existing) return null;

  const bidId = `bid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const bid = await prisma.bountyBid.create({
    data: {
      bid_id: bidId,
      bounty_id: bountyId,
      bidder_id: bidderId,
      proposed_amount: req.proposed_amount,
      estimated_time: req.estimated_time,
      approach: req.approach,
    },
  });

  return {
    success: true,
    bid: {
      id: bid.id,
      bid_id: bid.bid_id,
      bounty_id: bid.bounty_id,
      bidder_id: bid.bidder_id,
      proposed_amount: bid.proposed_amount,
      estimated_time: bid.estimated_time,
      approach: bid.approach,
      status: bid.status,
      submitted_at: bid.submitted_at.toISOString(),
    },
  };
}

export async function getBidsForBounty(
  prisma: PrismaClient,
  bountyId: string,
): Promise<{ success: boolean; bids: BidResponse['bid'][] }> {
  const bids = await prisma.bountyBid.findMany({
    where: { bounty_id: bountyId },
    orderBy: { submitted_at: 'desc' },
  });

  return {
    success: true,
    bids: bids.map((b) => ({
      id: b.id,
      bid_id: b.bid_id,
      bounty_id: b.bounty_id,
      bidder_id: b.bidder_id,
      proposed_amount: b.proposed_amount,
      estimated_time: b.estimated_time,
      approach: b.approach,
      status: b.status,
      submitted_at: b.submitted_at.toISOString(),
    })),
  };
}

export async function updateBidStatus(
  prisma: PrismaClient,
  bountyId: string,
  bidId: string,
  creatorId: string,
  status: string,
): Promise<boolean> {
  const bounty = await prisma.bounty.findUnique({ where: { bounty_id: bountyId } });
  if (!bounty || bounty.creator_id !== creatorId) return false;

  await prisma.bountyBid.updateMany({
    where: { bid_id: bidId, bounty_id: bountyId },
    data: { status },
  });

  if (status === 'accepted') {
    // Reject all other pending bids
    await prisma.bountyBid.updateMany({
      where: { bounty_id: bountyId, status: 'pending' },
      data: { status: 'rejected' },
    });
    // Update bounty status
    await prisma.bounty.update({
      where: { bounty_id: bountyId },
      data: { status: 'in_progress' },
    });
  }

  return true;
}

// ─── Milestones ─────────────────────────────────────────────────────────────

export async function updateMilestoneStatus(
  prisma: PrismaClient,
  bountyId: string,
  milestoneId: string,
  creatorId: string,
  data: { status: string; deliverable?: string },
): Promise<boolean> {
  const bounty = await prisma.bounty.findUnique({ where: { bounty_id: bountyId } });
  if (!bounty || bounty.creator_id !== creatorId) return false;

  await prisma.bountyMilestone.updateMany({
    where: { milestone_id: milestoneId, bounty_id: bountyId },
    data,
  });

  return true;
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export async function getBountyStats(
  prisma: PrismaClient,
): Promise<BountyStats> {
  const [open, inProgress, completed, totalValue, total] = await Promise.all([
    prisma.bounty.count({ where: { status: 'open' } }),
    prisma.bounty.count({ where: { status: 'in_progress' } }),
    prisma.bounty.count({ where: { status: 'completed' } }),
    prisma.bounty.aggregate({ _sum: { amount: true }, where: { status: { not: 'cancelled' } } }),
    prisma.bounty.count({}),
  ]);

  return {
    success: true,
    stats: {
      open,
      in_progress: inProgress,
      completed,
      total_value: totalValue._sum.amount ?? 0,
      total_bounties: total,
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toDetail(
  prisma: PrismaClient,
  b: {
    id: string; bounty_id: string; title: string; description: string;
    requirements: string[]; status: string; amount: number; deadline: Date;
    creator_id: string; winner_id: string | null; deliverable: unknown;
    created_at: Date; completed_at: Date | null;
    bids?: Array<{
      id: string; bid_id: string; bounty_id: string; bidder_id: string;
      proposed_amount: number; estimated_time: string; approach: string;
      status: string; submitted_at: Date;
    }>;
    milestoneRecords?: Array<{
      id: string; milestone_id: string; title: string; description: string;
      percentage: number; status: string; deliverable: string | null; paid_credits: number;
    }>;
  },
  bidsOverride?: Array<{
    id: string; bid_id: string; bounty_id: string; bidder_id: string;
    proposed_amount: number; estimated_time: string; approach: string;
    status: string; submitted_at: Date;
  }>,
) {
  const milestones = (b.milestoneRecords ?? []).map((m) => ({
    id: m.id,
    milestone_id: m.milestone_id,
    title: m.title,
    description: m.description,
    percentage: m.percentage,
    status: m.status,
    deliverable: m.deliverable,
    paid_credits: m.paid_credits,
  }));

  const bids = (bidsOverride ?? b.bids ?? []).map((bid) => ({
    id: bid.id,
    bid_id: bid.bid_id,
    bounty_id: bid.bounty_id,
    bidder_id: bid.bidder_id,
    proposed_amount: bid.proposed_amount,
    estimated_time: bid.estimated_time,
    approach: bid.approach,
    status: bid.status,
    submitted_at: bid.submitted_at.toISOString(),
  }));

  return {
    id: b.id,
    bounty_id: b.bounty_id,
    title: b.title,
    description: b.description,
    requirements: b.requirements,
    status: b.status,
    amount: b.amount,
    deadline: b.deadline.toISOString(),
    creator_id: b.creator_id,
    bid_count: bids.length,
    winner_id: b.winner_id,
    deliverable: (b.deliverable as Record<string, unknown>) ?? null,
    created_at: b.created_at.toISOString(),
    completed_at: b.completed_at?.toISOString() ?? null,
    milestones,
    bids,
  };
}
