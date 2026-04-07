import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import {
  BOUNTY_CANCEL_FEE_RATE,
} from '../shared/constants';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
  ForbiddenError,
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
  (prisma as unknown) = client;
}

export { prisma };

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

  const node = await prisma.node.findUnique({
    where: { node_id: creatorId },
  });

  if (!node) {
    throw new NotFoundError('Node', creatorId);
  }

  if (node.credit_balance < amount) {
    throw new InsufficientCreditsError(amount, node.credit_balance);
  }

  const bountyId = uuidv4();
  const now = new Date();
  const deadlineDate = new Date(deadline);

  if (deadlineDate <= now) {
    throw new ValidationError('Deadline must be in the future');
  }

  const [updatedNode, bounty] = await prisma.$transaction([
    prisma.node.update({
      where: { node_id: creatorId },
      data: {
        credit_balance: node.credit_balance - amount,
      },
    }),
    prisma.bounty.create({
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
    }),
  ]);

  await prisma.creditTransaction.create({
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
}

export async function placeBid(
  bountyId: string,
  bidderId: string,
  proposedAmount: number,
  estimatedTime: string,
  approach: string,
) {
  const bounty = await prisma.bounty.findUnique({
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

  if (proposedAmount <= 0) {
    throw new ValidationError('Bid amount must be positive');
  }

  const bid = await prisma.bountyBid.create({
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

  return bid;
}

export async function acceptBid(
  bountyId: string,
  bidId: string,
) {
  const bounty = await prisma.bounty.findUnique({
    where: { bounty_id: bountyId },
    include: { bids: true },
  });

  if (!bounty) {
    throw new NotFoundError('Bounty', bountyId);
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

  const now = new Date();

  await prisma.bountyBid.updateMany({
    where: { bounty_id: bountyId, bid_id: { not: bidId } },
    data: { status: 'rejected' },
  });

  await prisma.bountyBid.update({
    where: { bid_id: bidId },
    data: { status: 'accepted' },
  });

  const updatedBounty = await prisma.bounty.update({
    where: { bounty_id: bountyId },
    data: {
      status: 'claimed' as BountyStatus,
    },
    include: { bids: true },
  });

  return updatedBounty;
}

export async function submitDeliverable(
  bountyId: string,
  workerId: string,
  content: string,
  attachments: string[],
) {
  const bounty = await prisma.bounty.findUnique({
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

  const updatedBounty = await prisma.bounty.update({
    where: { bounty_id: bountyId },
    data: {
      status: 'submitted' as BountyStatus,
      deliverable: deliverable as unknown as import('@prisma/client').Prisma.InputJsonValue,
    },
  });

  return { bounty: updatedBounty, deliverable };
}

export async function reviewDeliverable(
  bountyId: string,
  accepted: boolean,
  comments?: string,
) {
  const bounty = await prisma.bounty.findUnique({
    where: { bounty_id: bountyId },
  });

  if (!bounty) {
    throw new NotFoundError('Bounty', bountyId);
  }

  if (bounty.status !== 'submitted') {
    throw new ValidationError('Bounty must be in submitted status to review');
  }

  const now = new Date();

  if (accepted) {
    const deliverable = bounty.deliverable as Record<string, unknown> | null;
    const workerId = (deliverable?.worker_id as string) ?? '';

    if (workerId) {
      const worker = await prisma.node.findUnique({
        where: { node_id: workerId },
      });

      if (worker) {
        await prisma.$transaction([
          prisma.node.update({
            where: { node_id: workerId },
            data: { credit_balance: worker.credit_balance + bounty.amount },
          }),
          prisma.creditTransaction.create({
            data: {
              node_id: workerId,
              amount: bounty.amount,
              type: 'bounty_pay',
              description: `Bounty payment: ${bounty.title}`,
              balance_after: worker.credit_balance + bounty.amount,
              timestamp: now,
            },
          }),
        ]);
      }
    }

    const updatedDeliverable = {
      ...(bounty.deliverable as Record<string, unknown>),
      review_status: 'approved',
      review_comments: comments ?? null,
    };

    const updatedBounty = await prisma.bounty.update({
      where: { bounty_id: bountyId },
      data: {
        status: 'accepted' as BountyStatus,
        deliverable: updatedDeliverable as unknown as import('@prisma/client').Prisma.InputJsonValue,
        completed_at: now,
      },
    });

    return updatedBounty;
  }

  const updatedDeliverable = {
    ...(bounty.deliverable as Record<string, unknown>),
    review_status: 'rejected',
    review_comments: comments ?? null,
  };

  const updatedBounty = await prisma.bounty.update({
    where: { bounty_id: bountyId },
    data: {
      status: 'claimed' as BountyStatus,
      deliverable: updatedDeliverable as unknown as import('@prisma/client').Prisma.InputJsonValue,
    },
  });

  return updatedBounty;
}

export async function cancelBounty(
  bountyId: string,
  creatorId: string,
) {
  const bounty = await prisma.bounty.findUnique({
    where: { bounty_id: bountyId },
  });

  if (!bounty) {
    throw new NotFoundError('Bounty', bountyId);
  }

  if (bounty.creator_id !== creatorId) {
    throw new ForbiddenError('Only the creator can cancel a bounty');
  }

  const cancellableStatuses: BountyStatus[] = ['open', 'claimed'];
  if (!cancellableStatuses.includes(bounty.status as BountyStatus)) {
    throw new ValidationError('Bounty cannot be cancelled in current status');
  }

  const fee = Math.ceil(bounty.amount * BOUNTY_CANCEL_FEE_RATE);
  const refund = bounty.amount - fee;
  const now = new Date();

  const creator = await prisma.node.findUnique({
    where: { node_id: creatorId },
  });

  if (creator) {
    await prisma.$transaction([
      prisma.node.update({
        where: { node_id: creatorId },
        data: { credit_balance: creator.credit_balance + refund },
      }),
      prisma.creditTransaction.create({
        data: {
          node_id: creatorId,
          amount: refund,
          type: 'bounty_refund',
          description: `Bounty cancelled (fee: ${fee}): ${bounty.title}`,
          balance_after: creator.credit_balance + refund,
          timestamp: now,
        },
      }),
    ]);
  }

  const updatedBounty = await prisma.bounty.update({
    where: { bounty_id: bountyId },
    data: {
      status: 'cancelled' as BountyStatus,
      completed_at: now,
    },
  });

  return updatedBounty;
}

export async function expireBounties() {
  const now = new Date();

  const expired = await prisma.bounty.findMany({
    where: {
      status: 'open',
      deadline: { lt: now },
    },
  });

  for (const bounty of expired) {
    const creator = await prisma.node.findUnique({
      where: { node_id: bounty.creator_id },
    });

    if (creator) {
      await prisma.$transaction([
        prisma.node.update({
          where: { node_id: bounty.creator_id },
          data: { credit_balance: creator.credit_balance + bounty.amount },
        }),
        prisma.creditTransaction.create({
          data: {
            node_id: bounty.creator_id,
            amount: bounty.amount,
            type: 'bounty_refund',
            description: `Bounty expired: ${bounty.title}`,
            balance_after: creator.credit_balance + bounty.amount,
            timestamp: now,
          },
        }),
      ]);
    }

    await prisma.bounty.update({
      where: { bounty_id: bounty.bounty_id },
      data: { status: 'expired' as BountyStatus, completed_at: now },
    });
  }

  return { expired_count: expired.length };
}

export async function getBounty(bountyId: string) {
  const bounty = await prisma.bounty.findUnique({
    where: { bounty_id: bountyId },
    include: { bids: true },
  });

  if (!bounty) {
    throw new NotFoundError('Bounty', bountyId);
  }

  return bounty;
}

export async function listBounties(input: ListBountiesInput) {
  const { status, limit = 20, offset = 0 } = input;

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }
  const [bounties, total] = await Promise.all([
    prisma.bounty.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.bounty.count({ where }),
  ]);

  return { bounties, total, limit, offset };
}

export async function listBountiesByCreator(creatorId: string, lang?: string) {
  const where: Record<string, unknown> = { creator_id: creatorId };
  // lang filter not implemented — Bounty model has no language field
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
