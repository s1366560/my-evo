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
import type {
  CreateBountyInput,
  PlaceBidInput,
  SubmitDeliverableInput,
  ReviewDeliverableInput,
  CancelBountyInput,
  ListBountiesInput,
} from './types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export { prisma };

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

    return bounty;
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

    return tx.bountyBid.create({
      data: {
        bid_id: uuidv4(),
        bounty_id: bountyId,
        bidder_id: bidderId,
        proposed_amount: proposedAmount,
        estimated_time: estimatedTime,
        approach,
        status: 'pending',
        submitted_at: new Date(),
      },
    });
  });
}

export async function acceptBid(
  bountyId: string,
  bidId: string,
  requesterId: string,
) {
  const bounty = await prisma.bounty.findUnique({
    where: { bounty_id: bountyId },
    include: { bids: true },
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

  const bid = bounty.bids.find((b: { bid_id: string }) => b.bid_id === bidId);
  if (!bid) {
    throw new NotFoundError('Bid', bidId);
  }

  if (bid.status !== 'pending') {
    throw new ValidationError('Bid is not in pending status');
  }

  const updatedBounty = await runSerializableTransaction(async (tx) => {
    const accepted = await tx.bountyBid.updateMany({
      where: { bid_id: bidId, bounty_id: bountyId, status: 'pending' },
      data: { status: 'accepted' },
    });

    if (accepted.count === 0) {
      throw new ConflictError('Bid state changed; retry');
    }

    const claimed = await tx.bounty.updateMany({
      where: { bounty_id: bountyId, status: 'open' as BountyStatus },
      data: { status: 'claimed' as BountyStatus },
    });

    if (claimed.count === 0) {
      throw new ConflictError('Bounty state changed; retry');
    }

    await tx.bountyBid.updateMany({
      where: { bounty_id: bountyId, bid_id: { not: bidId }, status: 'pending' },
      data: { status: 'rejected' },
    });

    return tx.bounty.findUnique({
      where: { bounty_id: bountyId },
      include: { bids: true },
    });
  });

  if (!updatedBounty) {
    throw new NotFoundError('Bounty', bountyId);
  }

  return updatedBounty;
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

  const withdrawnBid = await prisma.bountyBid.findUnique({
    where: { bid_id: bidId },
  });

  if (!withdrawnBid) {
    throw new NotFoundError('Bid', bidId);
  }

  return withdrawnBid;
}

export async function submitDeliverable(
  bountyId: string,
  workerId: string,
  content: string,
  attachments: string[],
) {
  return runSerializableTransaction(async (tx) => {
    const bounty = await tx.bounty.findUnique({
      where: { bounty_id: bountyId },
      include: { bids: true },
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

    const deliverable = {
      deliverable_id: uuidv4(),
      bounty_id: bountyId,
      worker_id: workerId,
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
        status: 'submitted' as BountyStatus,
        deliverable: deliverable as unknown as Prisma.InputJsonValue,
      },
    });

    if (updated.count === 0) {
      throw new ConflictError('Bounty state changed; retry');
    }

    const updatedBounty = await tx.bounty.findUnique({
      where: { bounty_id: bountyId },
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
) {
  return runSerializableTransaction(async (tx) => {
    const bounty = await tx.bounty.findUnique({
      where: { bounty_id: bountyId },
    });

    if (!bounty) {
      throw new NotFoundError('Bounty', bountyId);
    }

    if (bounty.creator_id !== reviewerId) {
      throw new ForbiddenError('Only the bounty creator can review deliverables');
    }

    if (bounty.status !== 'submitted') {
      throw new ValidationError('Bounty must be in submitted status to review');
    }

    const now = new Date();
    const deliverable = bounty.deliverable as Record<string, unknown> | null;
    const updatedDeliverable = {
      ...(deliverable ?? {}),
      review_status: accepted ? 'approved' : 'rejected',
      review_comments: comments ?? null,
    };

    const updated = await tx.bounty.updateMany({
      where: {
        bounty_id: bountyId,
        status: 'submitted' as BountyStatus,
      },
      data: {
        status: (accepted ? 'accepted' : 'claimed') as BountyStatus,
        deliverable: updatedDeliverable as unknown as Prisma.InputJsonValue,
        ...(accepted ? { completed_at: now } : {}),
      },
    });

    if (updated.count === 0) {
      throw new ConflictError('Bounty state changed; retry');
    }

    if (accepted) {
      const workerId = (deliverable?.worker_id as string) ?? '';
      if (!workerId) {
        throw new ValidationError('Deliverable worker is missing');
      }

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
            increment: bounty.amount,
          },
        },
      });

      await tx.creditTransaction.create({
        data: {
          node_id: workerId,
          amount: bounty.amount,
          type: 'bounty_pay',
          description: `Bounty payment: ${bounty.title}`,
          balance_after: updatedWorker.credit_balance,
          timestamp: now,
        },
      });
    }

    const updatedBounty = await tx.bounty.findUnique({
      where: { bounty_id: bountyId },
    });

    if (!updatedBounty) {
      throw new NotFoundError('Bounty', bountyId);
    }

    return updatedBounty;
  });
}

export async function cancelBounty(
  bountyId: string,
  creatorId: string,
) {
  return runSerializableTransaction(async (tx) => {
    const bounty = await tx.bounty.findUnique({
      where: { bounty_id: bountyId },
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

    const updatedBounty = await tx.bounty.findUnique({
      where: { bounty_id: bountyId },
    });

    if (!updatedBounty) {
      throw new NotFoundError('Bounty', bountyId);
    }

    return updatedBounty;
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
    return bounty;
  }

  const deliverable = bounty.deliverable as Record<string, unknown> | null;
  const workerId = (deliverable?.worker_id as string) ?? null;
  const requesterBids = bounty.bids.filter((bid) => bid.bidder_id === requesterId);

  return {
    ...bounty,
    bids: requesterBids,
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
      ...bounty,
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
  return bids;
}
