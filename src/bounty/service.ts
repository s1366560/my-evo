import { v4 as uuidv4 } from 'uuid';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  BOUNTY_CANCEL_FEE_RATE,
} from '../shared/constants';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
  ForbiddenError,
  ConflictError,
} from '../shared/errors';
import type { BountyStatus } from '../shared/types';
import type { ListBountiesInput } from './types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export { prisma };

function getReputationEscrow(amount: number): number {
  return Math.ceil(amount * 0.1);
}

type MilestoneInput = {
  milestone_id?: string;
  title: string;
  description: string;
  percentage: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'verified';
  deliverable?: string;
};

type StoredMilestone = {
  milestone_id: string;
  title: string;
  description: string;
  percentage: number;
  status: 'pending' | 'in_progress' | 'completed' | 'verified';
  deliverable?: string;
  paid_credits?: number;
};

function normalizeMilestones(milestones: MilestoneInput[]): StoredMilestone[] {
  return milestones.map((milestone, index) => ({
    milestone_id: milestone.milestone_id ?? `milestone-${index + 1}`,
    title: milestone.title,
    description: milestone.description,
    percentage: milestone.percentage,
    status: milestone.status ?? 'pending',
    ...(milestone.deliverable ? { deliverable: milestone.deliverable } : {}),
  }));
}

function getStoredMilestones(value: unknown): StoredMilestone[] {
  return Array.isArray(value)
    ? value.filter((milestone): milestone is StoredMilestone => typeof milestone === 'object' && milestone !== null && 'milestone_id' in milestone)
    : [];
}

function getMilestonePayout(totalAward: number, percentage: number): number {
  return Math.round(totalAward * (percentage / 100));
}

function getDeliverableContent(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getBountyMilestones(
  bounty: { milestones?: unknown; milestoneRecords?: Array<Record<string, unknown>> },
): StoredMilestone[] {
  if (Array.isArray(bounty.milestoneRecords) && bounty.milestoneRecords.length > 0) {
    return bounty.milestoneRecords
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        milestone_id: String(item.milestone_id),
        title: String(item.title),
        description: String(item.description),
        percentage: Number(item.percentage),
        status: (item.status as StoredMilestone['status']) ?? 'pending',
        ...(item.deliverable ? { deliverable: String(item.deliverable) } : {}),
        ...(item.paid_credits ? { paid_credits: Number(item.paid_credits) } : {}),
      }));
  }

  return getStoredMilestones(bounty.milestones);
}

function toBidWithMarketplaceAliases<T extends {
  proposed_amount: number;
  estimated_time: string;
  approach: string;
  bidder_id: string;
  reputation_escrow?: number;
}>(
  bid: T,
) {
  return {
    ...bid,
    bid_amount: bid.proposed_amount,
    estimated_completion: bid.estimated_time,
    proposal: bid.approach,
    reputation_escrow: bid.reputation_escrow ?? getReputationEscrow(bid.proposed_amount),
  };
}

function toBountyWithMarketplaceAliases<T extends {
  amount: number;
  winner_id?: string | null;
  milestones?: unknown;
  milestoneRecords?: Array<Record<string, unknown>>;
  bids?: Array<{
    proposed_amount: number;
    estimated_time: string;
    approach: string;
    bidder_id: string;
    reputation_escrow?: number;
    status?: string;
  }>;
}>(
  bounty: T,
) {
  return {
    ...bounty,
    reward_credits: bounty.amount,
    bids: bounty.bids?.map((bid) => toBidWithMarketplaceAliases(bid)) ?? [],
    winner_id: bounty.winner_id ?? bounty.bids?.find((bid: { status?: string }) => bid.status === 'accepted')?.bidder_id,
    milestones: getBountyMilestones(bounty),
  };
}

function isSerializationFailure(error: unknown): error is { code: string } {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'P2034';
}

async function runSerializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializationFailure(error) || attempt === 2) {
        throw error;
      }
    }
  }

  throw new ConflictError('Bounty state changed; retry');
}

export async function createBounty(
  creatorId: string,
  title: string,
  description: string,
  requirements: string[],
  amount: number,
  deadline: string,
  milestones: MilestoneInput[] = [],
) {
  if (amount <= 0) {
    throw new ValidationError('Bounty amount must be positive');
  }

  const bountyId = uuidv4();
  const now = new Date();
  const deadlineDate = new Date(deadline);

  if (deadlineDate <= now) {
    throw new ValidationError('Deadline must be in the future');
  }

  const normalizedMilestones = normalizeMilestones(milestones);
  const totalMilestonePercentage = normalizedMilestones.reduce((sum, milestone) => sum + milestone.percentage, 0);
  if (normalizedMilestones.length > 0 && totalMilestonePercentage !== 100) {
    throw new ValidationError('Milestone percentages must sum to 100');
  }

  return runSerializableTransaction(async (tx) => {
    const debited = await tx.node.updateMany({
      where: {
        node_id: creatorId,
        credit_balance: { gte: amount },
      },
      data: {
        credit_balance: { decrement: amount },
      },
    });

    const updatedNode = await tx.node.findUnique({
      where: { node_id: creatorId },
    });

    if (!updatedNode) {
      throw new NotFoundError('Node', creatorId);
    }

    if (debited.count === 0) {
      throw new InsufficientCreditsError(amount, updatedNode.credit_balance);
    }

    const bounty = await tx.bounty.create({
      data: {
        bounty_id: bountyId,
        title,
        description,
        requirements,
        creator_id: creatorId,
        status: 'open',
        amount,
        milestones: normalizedMilestones as unknown as Prisma.InputJsonValue,
        milestoneRecords: {
          create: normalizedMilestones.map((milestone) => ({
            milestone_id: milestone.milestone_id,
            title: milestone.title,
            description: milestone.description,
            percentage: milestone.percentage,
            status: milestone.status,
            deliverable: milestone.deliverable,
            paid_credits: milestone.paid_credits ?? 0,
          })),
        },
        deadline: deadlineDate,
        created_at: now,
      },
    });

    await tx.creditTransaction.create({
      data: {
        node_id: creatorId,
        amount: -amount,
        type: 'bounty_lock',
        description: `Bounty created: ${title}`,
        balance_after: updatedNode.credit_balance,
        timestamp: now,
      },
    });

    return toBountyWithMarketplaceAliases(bounty);
  });
}

export async function placeBid(
  bountyId: string,
  bidderId: string,
  proposedAmount: number,
  estimatedTime: string,
  approach: string,
) {
  if (proposedAmount <= 0) {
    throw new ValidationError('Bid amount must be positive');
  }

  return runSerializableTransaction(async (tx) => {
    const bounty = await tx.bounty.findUnique({
      where: { bounty_id: bountyId },
      include: { bids: true, milestoneRecords: true },
    });

    if (!bounty) {
      throw new NotFoundError('Bounty', bountyId);
    }

    if (bounty.status !== 'open') {
      throw new ValidationError('Bounty must be open to place bids');
    }

    if (bounty.creator_id === bidderId) {
      throw new ValidationError('Cannot bid on own bounty');
    }

    const bidder = await tx.node.findUnique({
      where: { node_id: bidderId },
    });

    if (!bidder) {
      throw new NotFoundError('Node', bidderId);
    }

    const reputationEscrow = getReputationEscrow(proposedAmount);
    if (bidder.reputation < reputationEscrow) {
      throw new ValidationError(`Insufficient reputation for bid escrow (${reputationEscrow})`);
    }

    await tx.node.update({
      where: { node_id: bidderId },
      data: {
        reputation: { decrement: reputationEscrow },
      },
    });

    const bid = await tx.bountyBid.create({
      data: {
        bid_id: uuidv4(),
        bounty_id: bountyId,
        bidder_id: bidderId,
        proposed_amount: proposedAmount,
        reputation_escrow: reputationEscrow,
        estimated_time: estimatedTime,
        approach,
        status: 'pending',
        submitted_at: new Date(),
      },
    });

    return toBidWithMarketplaceAliases(bid);
  });
}

export async function acceptBid(
  bountyId: string,
  bidId: string,
  requesterId: string,
) {
  const updatedBounty = await runSerializableTransaction(async (tx) => {
    const bounty = await tx.bounty.findUnique({
      where: { bounty_id: bountyId },
      include: { bids: true, milestoneRecords: true },
    });

    if (!bounty) {
      throw new NotFoundError('Bounty', bountyId);
    }

    if (bounty.creator_id !== requesterId) {
      throw new ForbiddenError('Only the bounty creator can accept bids');
    }

    if (bounty.status !== 'open') {
      throw new ValidationError('Bounty must be open to accept bids');
    }

    const bid = bounty.bids.find((candidate: { bid_id: string }) => candidate.bid_id === bidId);
    if (!bid) {
      throw new NotFoundError('Bid', bidId);
    }

    if (bid.status !== 'pending') {
      throw new ValidationError('Bid is not in pending status');
    }

    const accepted = await tx.bountyBid.updateMany({
      where: { bid_id: bidId, bounty_id: bountyId, status: 'pending' },
      data: { status: 'accepted' },
    });

    if (accepted.count === 0) {
      throw new ConflictError('Bid state changed; retry');
    }

    const claimed = await tx.bounty.updateMany({
      where: { bounty_id: bountyId, status: 'open' as BountyStatus },
      data: {
        status: 'claimed' as BountyStatus,
        winner_id: bid.bidder_id,
      },
    });

    if (claimed.count === 0) {
      throw new ConflictError('Bounty state changed; retry');
    }

    await tx.bountyBid.updateMany({
      where: { bounty_id: bountyId, bid_id: { not: bidId }, status: 'pending' },
      data: { status: 'rejected' },
    });

    const rejectedBids = bounty.bids.filter(
      (candidate: { bid_id: string; status: string }) => candidate.bid_id !== bidId && candidate.status === 'pending',
    );

    await Promise.all(
      rejectedBids.map(async (rejectedBid: { bidder_id: string; proposed_amount: number }) => {
        await tx.node.update({
          where: { node_id: rejectedBid.bidder_id },
          data: {
            reputation: { increment: getReputationEscrow(rejectedBid.proposed_amount) },
          },
        });
      }),
    );

    return tx.bounty.findUnique({
      where: { bounty_id: bountyId },
      include: { bids: true, milestoneRecords: true },
    });
  });

  if (!updatedBounty) {
    throw new NotFoundError('Bounty', bountyId);
  }

  return toBountyWithMarketplaceAliases(updatedBounty);
}

export async function withdrawBid(
  bidId: string,
  bidderId: string,
) {
  const bid = await prisma.bountyBid.findUnique({
    where: { bid_id: bidId },
  });

  if (!bid) {
    throw new NotFoundError('Bid', bidId);
  }

  if (bid.bidder_id !== bidderId) {
    throw new ForbiddenError('Only the bidder can withdraw a bid');
  }

  if (bid.status !== 'pending') {
    throw new ValidationError('Only pending bids can be withdrawn');
  }

  const updated = await prisma.bountyBid.updateMany({
    where: {
      bid_id: bidId,
      bidder_id: bidderId,
      status: 'pending',
    },
    data: { status: 'withdrawn' },
  });

  if (updated.count === 0) {
    throw new ConflictError('Bid state changed; retry');
  }

  await prisma.node.update({
    where: { node_id: bidderId },
    data: {
      reputation: { increment: bid.reputation_escrow ?? getReputationEscrow(bid.proposed_amount) },
    },
  });

  const withdrawnBid = await prisma.bountyBid.findUnique({
    where: { bid_id: bidId },
  });

  if (!withdrawnBid) {
    throw new NotFoundError('Bid', bidId);
  }

  return toBidWithMarketplaceAliases(withdrawnBid);
}

export async function submitDeliverable(
  bountyId: string,
  workerId: string,
  content: string,
  attachments: string[],
  milestoneId?: string,
) {
  return runSerializableTransaction(async (tx) => {
    const bounty = await tx.bounty.findUnique({
      where: { bounty_id: bountyId },
      include: { bids: true, milestoneRecords: true },
    });

    if (!bounty) {
      throw new NotFoundError('Bounty', bountyId);
    }

    if (bounty.status !== 'claimed') {
      throw new ValidationError('Bounty must be claimed to submit deliverable');
    }

    const acceptedBid = bounty.bids.find(
      (b: { status: string; bidder_id: string }) => b.status === 'accepted' && b.bidder_id === workerId,
    );
    if (!acceptedBid) {
      throw new ForbiddenError('Only the accepted bidder can submit deliverable');
    }

    const currentMilestones = getBountyMilestones(bounty);
    let nextMilestones = currentMilestones;

    if (milestoneId) {
      const milestone = currentMilestones.find((item) => item.milestone_id === milestoneId);
      if (!milestone) {
        throw new NotFoundError('Milestone', milestoneId);
      }
      if (milestone.status === 'verified') {
        throw new ValidationError('Milestone already verified');
      }
      nextMilestones = currentMilestones.map((item) => item.milestone_id === milestoneId
        ? {
            ...item,
            status: 'completed',
            deliverable: content,
          }
        : item);
      await tx.bountyMilestone.updateMany({
        where: {
          bounty_id: bountyId,
          milestone_id: milestoneId,
        },
        data: {
          status: 'completed',
          deliverable: content,
        },
      });
    }

    const deliverable = {
      deliverable_id: uuidv4(),
      bounty_id: bountyId,
      worker_id: workerId,
      ...(milestoneId ? { milestone_id: milestoneId } : {}),
      content,
      attachments,
      submitted_at: new Date().toISOString(),
      review_status: 'pending',
    };

    const updated = await tx.bounty.updateMany({
      where: {
        bounty_id: bountyId,
        status: 'claimed' as BountyStatus,
      },
      data: {
        status: milestoneId ? ('claimed' as BountyStatus) : ('submitted' as BountyStatus),
        milestones: nextMilestones as unknown as Prisma.InputJsonValue,
        deliverable: deliverable as unknown as Prisma.InputJsonValue,
      },
    });

    if (updated.count === 0) {
      throw new ConflictError('Bounty state changed; retry');
    }

    const updatedBounty = await tx.bounty.findUnique({
      where: { bounty_id: bountyId },
      include: { bids: true, milestoneRecords: true },
    });

    if (!updatedBounty) {
      throw new NotFoundError('Bounty', bountyId);
    }

    return { bounty: updatedBounty, deliverable };
  });
}

export async function reviewDeliverable(
  bountyId: string,
  reviewerId: string,
  accepted: boolean,
  comments?: string,
  milestoneId?: string,
) {
  return runSerializableTransaction(async (tx) => {
    const bounty = await tx.bounty.findUnique({
      where: { bounty_id: bountyId },
      include: { bids: true, milestoneRecords: true },
    });

    if (!bounty) {
      throw new NotFoundError('Bounty', bountyId);
    }

    if (bounty.creator_id !== reviewerId) {
      throw new ForbiddenError('Only the bounty creator can review deliverables');
    }

    if (bounty.status !== 'submitted' && bounty.status !== 'claimed') {
      throw new ValidationError('Bounty must be in submitted or claimed status to review');
    }

    const now = new Date();
    const deliverable = bounty.deliverable as Record<string, unknown> | null;
    const workerId = ((deliverable?.worker_id as string) ?? '');
    const currentMilestones = getBountyMilestones(bounty);
    const updatedDeliverable = {
      ...(deliverable ?? {}),
      review_status: accepted ? 'approved' : 'rejected',
      review_comments: comments ?? null,
    };

    let nextMilestones = currentMilestones;
    let nextStatus = (accepted ? 'accepted' : 'claimed') as BountyStatus;

    if (milestoneId) {
      const milestoneIndex = currentMilestones.findIndex((item) => item.milestone_id === milestoneId);
      if (milestoneIndex === -1) {
        throw new NotFoundError('Milestone', milestoneId);
      }
      const activeMilestone = currentMilestones[milestoneIndex]!;
      if (activeMilestone.status === 'verified') {
        throw new ValidationError('Milestone already verified');
      }

      nextMilestones = currentMilestones.map((item) => {
        if (item.milestone_id !== milestoneId) {
          return item;
        }

        const reviewedDeliverable = getDeliverableContent(deliverable?.content) ?? item.deliverable;
        return {
          ...item,
          status: accepted ? 'verified' : 'in_progress',
          ...(accepted && reviewedDeliverable ? { deliverable: reviewedDeliverable } : {}),
        };
      });

      const allVerified = nextMilestones.every((item) => item.status === 'verified');
      nextStatus = accepted && allVerified ? 'accepted' : 'claimed';
      await tx.bountyMilestone.updateMany({
        where: {
          bounty_id: bountyId,
          milestone_id: milestoneId,
        },
        data: {
          status: accepted ? 'verified' : 'in_progress',
          ...(accepted ? { deliverable: String(deliverable?.content ?? '') } : {}),
        },
      });
    }

    const updated = await tx.bounty.updateMany({
      where: {
        bounty_id: bountyId,
        status: { in: ['submitted', 'claimed'] },
      },
      data: {
        status: nextStatus,
        ...(nextStatus === 'accepted' && accepted ? { winner_id: workerId } : {}),
        milestones: nextMilestones as unknown as Prisma.InputJsonValue,
        deliverable: updatedDeliverable as unknown as Prisma.InputJsonValue,
        ...(nextStatus === 'accepted' && accepted ? { completed_at: now } : {}),
      },
    });

    if (updated.count === 0) {
      throw new ConflictError('Bounty state changed; retry');
    }

    if (accepted) {
      if (!workerId) {
        throw new ValidationError('Deliverable worker is missing');
      }

      const acceptedBid = bounty.bids.find(
        (bid: { bidder_id: string; status: string }) => bid.bidder_id === workerId && bid.status === 'accepted',
      );
      if (!acceptedBid) {
        throw new ValidationError('Accepted bid is missing');
      }

      const previousMilestonePaid = currentMilestones.reduce((sum, milestone) => sum + Number(milestone.paid_credits ?? 0), 0);
      const selectedMilestone = milestoneId
        ? nextMilestones.find((item) => item.milestone_id === milestoneId)
        : null;
      const milestonePayout = milestoneId && selectedMilestone
        ? nextStatus === 'accepted'
          ? acceptedBid.proposed_amount - previousMilestonePaid
          : getMilestonePayout(acceptedBid.proposed_amount, Number(selectedMilestone.percentage ?? 0))
        : acceptedBid.proposed_amount;

      const worker = await tx.node.findUnique({
        where: { node_id: workerId },
      });

      if (!worker) {
        throw new NotFoundError('Node', workerId);
      }

      const updatedWorker = await tx.node.update({
        where: { node_id: workerId },
        data: {
          credit_balance: {
            increment: milestonePayout,
          },
          reputation: {
            increment: nextStatus === 'accepted'
              ? getReputationEscrow(acceptedBid.proposed_amount) + 10
              : 0,
          },
        },
      });

      await tx.creditTransaction.create({
        data: {
          node_id: workerId,
          amount: milestonePayout,
          type: 'bounty_pay',
          description: `Bounty payment: ${bounty.title}`,
          balance_after: updatedWorker.credit_balance,
          timestamp: now,
        },
      });

      if (milestoneId && selectedMilestone) {
        nextMilestones = nextMilestones.map((item) => item.milestone_id === milestoneId
          ? { ...item, paid_credits: milestonePayout }
          : item);

        await tx.bounty.update({
          where: { bounty_id: bountyId },
          data: {
            milestones: nextMilestones as unknown as Prisma.InputJsonValue,
          },
        });
        await tx.bountyMilestone.updateMany({
          where: {
            bounty_id: bountyId,
            milestone_id: milestoneId,
          },
          data: {
            paid_credits: milestonePayout,
          },
        });
      }

      const refund = Math.max(0, bounty.amount - acceptedBid.proposed_amount);
      if (nextStatus === 'accepted' && refund > 0) {
        const creator = await tx.node.findUnique({
          where: { node_id: reviewerId },
        });
        if (creator) {
          const updatedCreator = await tx.node.update({
            where: { node_id: reviewerId },
            data: {
              credit_balance: { increment: refund },
            },
          });

          await tx.creditTransaction.create({
            data: {
              node_id: reviewerId,
              amount: refund,
              type: 'bounty_refund',
              description: `Bounty bid spread refund: ${bounty.title}`,
              balance_after: updatedCreator.credit_balance,
              timestamp: now,
            },
          });
        }
      }
    }

    const updatedBounty = await tx.bounty.findUnique({
      where: { bounty_id: bountyId },
      include: { bids: true, milestoneRecords: true },
    });

    if (!updatedBounty) {
      throw new NotFoundError('Bounty', bountyId);
    }

    return toBountyWithMarketplaceAliases(updatedBounty);
  });
}

export async function cancelBounty(
  bountyId: string,
  creatorId: string,
) {
  return runSerializableTransaction(async (tx) => {
    const bounty = await tx.bounty.findUnique({
      where: { bounty_id: bountyId },
      include: { bids: true },
    });

    if (!bounty) {
      throw new NotFoundError('Bounty', bountyId);
    }

    if (bounty.creator_id !== creatorId) {
      throw new ForbiddenError('Only the creator can cancel a bounty');
    }

    if (bounty.status === 'cancelled') {
      return bounty;
    }

    const cancellableStatuses: BountyStatus[] = ['open', 'claimed'];
    if (!cancellableStatuses.includes(bounty.status as BountyStatus)) {
      throw new ValidationError('Bounty cannot be cancelled in current status');
    }

    const now = new Date();
    const cancelled = await tx.bounty.updateMany({
      where: {
        bounty_id: bountyId,
        creator_id: creatorId,
        status: { in: cancellableStatuses },
      },
      data: {
        status: 'cancelled' as BountyStatus,
        winner_id: null,
        completed_at: now,
      },
    });

    if (cancelled.count !== 1) {
      const current = await tx.bounty.findUnique({ where: { bounty_id: bountyId } });
      if (current?.status === 'cancelled') {
        return current;
      }
      throw new ConflictError('Bounty state changed; retry');
    }

    const fee = Math.ceil(bounty.amount * BOUNTY_CANCEL_FEE_RATE);
    const refund = bounty.amount - fee;

    if (refund > 0) {
      const creator = await tx.node.findUnique({ where: { node_id: creatorId } });
      if (creator) {
        const updatedNode = await tx.node.update({
          where: { node_id: creatorId },
          data: { credit_balance: { increment: refund } },
        });
        await tx.creditTransaction.create({
          data: {
            node_id: creatorId,
            amount: refund,
            type: 'bounty_refund',
            description: `Bounty cancelled (fee: ${fee}): ${bounty.title}`,
            balance_after: updatedNode.credit_balance,
            timestamp: now,
          },
        });
      }
    }

    const refundableBids = (bounty.bids ?? []).filter((bid) => (
      bid.status === 'pending' || bid.status === 'accepted'
    ));

    await Promise.all(
      refundableBids.map((bid) => tx.node.update({
        where: { node_id: bid.bidder_id },
        data: {
          reputation: { increment: bid.reputation_escrow ?? getReputationEscrow(bid.proposed_amount) },
        },
      })),
    );

    const updatedBounty = await tx.bounty.findUnique({
      where: { bounty_id: bountyId },
      include: { bids: true, milestoneRecords: true },
    });

    if (!updatedBounty) {
      throw new NotFoundError('Bounty', bountyId);
    }

    return toBountyWithMarketplaceAliases(updatedBounty);
  });
}

export async function expireBounties() {
  const now = new Date();

  const expired = await prisma.bounty.findMany({
    where: {
      status: 'open',
      deadline: { lt: now },
    },
  });

  let expiredCount = 0;

  for (const bounty of expired) {
    const didExpire = await runSerializableTransaction(async (tx) => {
      const current = await tx.bounty.findUnique({
        where: { bounty_id: bounty.bounty_id },
        include: { bids: true, milestoneRecords: true },
      });

      if (!current || current.status !== 'open' || current.deadline >= now) {
        return false;
      }

      const updated = await tx.bounty.updateMany({
        where: {
          bounty_id: bounty.bounty_id,
          status: 'open',
          deadline: { lt: now },
        },
        data: {
          status: 'expired' as BountyStatus,
          winner_id: null,
          completed_at: now,
        },
      });

      if (updated.count !== 1) {
        return false;
      }

      const creator = await tx.node.findUnique({ where: { node_id: bounty.creator_id } });
      if (creator) {
        const updatedNode = await tx.node.update({
          where: { node_id: bounty.creator_id },
          data: { credit_balance: { increment: bounty.amount } },
        });

        await tx.creditTransaction.create({
          data: {
            node_id: bounty.creator_id,
            amount: bounty.amount,
            type: 'bounty_refund',
            description: `Bounty expired: ${bounty.title}`,
            balance_after: updatedNode.credit_balance,
            timestamp: now,
          },
        });
      }

      const refundableBids = (current.bids ?? []).filter((bid) => bid.status === 'pending');
      await Promise.all(
        refundableBids.map((bid) => tx.node.update({
          where: { node_id: bid.bidder_id },
          data: {
            reputation: { increment: bid.reputation_escrow ?? getReputationEscrow(bid.proposed_amount) },
          },
        })),
      );

      return true;
    });

    if (didExpire) {
      expiredCount += 1;
    }
  }

  return { expired_count: expiredCount };
}

export async function getBounty(bountyId: string, requesterId: string) {
  const bounty = await prisma.bounty.findUnique({
    where: { bounty_id: bountyId },
    include: { bids: true },
  });

  if (!bounty) {
    throw new NotFoundError('Bounty', bountyId);
  }

  if (bounty.creator_id === requesterId) {
    return toBountyWithMarketplaceAliases(bounty);
  }

  const deliverable = bounty.deliverable as Record<string, unknown> | null;
  const workerId = (deliverable?.worker_id as string) ?? null;
  const requesterBids = bounty.bids.filter((bid) => bid.bidder_id === requesterId);

  return {
    ...toBountyWithMarketplaceAliases(bounty),
    bids: requesterBids.map((bid) => toBidWithMarketplaceAliases(bid)),
    deliverable: workerId === requesterId ? bounty.deliverable : null,
  };
}

export async function listBounties(input: ListBountiesInput) {
  const {
    status,
    creator_id,
    sort,
    limit = 20,
    offset = 0,
  } = input;

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }
  if (creator_id) {
    where.creator_id = creator_id;
  }
  const orderBy: Prisma.BountyOrderByWithRelationInput[] = sort === 'reward_desc'
    ? [
        { amount: Prisma.SortOrder.desc },
        { created_at: Prisma.SortOrder.desc },
        { bounty_id: Prisma.SortOrder.desc },
      ]
    : sort === 'reward_asc'
      ? [
          { amount: Prisma.SortOrder.asc },
          { created_at: Prisma.SortOrder.desc },
          { bounty_id: Prisma.SortOrder.desc },
        ]
      : [
          { created_at: Prisma.SortOrder.desc },
          { bounty_id: Prisma.SortOrder.desc },
        ];

  const [bounties, total] = await Promise.all([
    prisma.bounty.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
    }),
    prisma.bounty.count({ where }),
  ]);

  return {
    bounties: bounties.map((bounty) => ({
      ...toBountyWithMarketplaceAliases(bounty),
      deliverable: null,
    })),
    total,
    limit,
    offset,
  };
}

export async function getBountyBidCounts(bountyIds: string[]): Promise<Map<string, number>> {
  if (bountyIds.length === 0) {
    return new Map();
  }

  const bids = await prisma.bountyBid.findMany({
    where: {
      bounty_id: { in: bountyIds },
    },
    select: { bounty_id: true },
  });

  const counts = new Map<string, number>();
  for (const bid of bids) {
    counts.set(bid.bounty_id, (counts.get(bid.bounty_id) ?? 0) + 1);
  }

  return counts;
}

export async function listBountiesByCreator(creatorId: string) {
  const where: Record<string, unknown> = { creator_id: creatorId };
  const bounties = await prisma.bounty.findMany({
    where,
    orderBy: { created_at: 'desc' },
  });
  return { bounties, total: bounties.length };
}

export async function listBids(bidderId: string) {
  const bids = await prisma.bountyBid.findMany({
    where: { bidder_id: bidderId },
    orderBy: { submitted_at: 'desc' },
  });
  return bids.map((bid) => toBidWithMarketplaceAliases(bid));
}

export async function listBidsForBounty(bountyId: string, requesterId: string) {
  const bounty = await prisma.bounty.findUnique({
    where: { bounty_id: bountyId },
  });

  if (!bounty) {
    throw new NotFoundError('Bounty', bountyId);
  }

  const bids = await prisma.bountyBid.findMany({
    where: bounty.creator_id === requesterId
      ? { bounty_id: bountyId }
      : { bounty_id: bountyId, bidder_id: requesterId },
    orderBy: { submitted_at: 'desc' },
  });
  return bids.map((bid) => toBidWithMarketplaceAliases(bid));
}
