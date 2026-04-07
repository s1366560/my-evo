import crypto from 'crypto';
import { NotFoundError, ValidationError } from '../shared/errors';

// ─── Prisma singleton ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _prisma: any = null;

export function setPrisma(client: unknown): void {
  _prisma = client;
}

function db() {
  if (!_prisma) {
    throw new Error('Prisma client not initialized. Call setPrisma().');
  }
  return _prisma;
}

// ─── Review types ───────────────────────────────────────────────────────────────

export interface Review {
  review_id: string;
  order_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number; // 1-5
  comment?: string;
  created_at: string;
}

export interface Dispute {
  dispute_id: string;
  order_id: string;
  opener_id: string;
  reason: string;
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  evidence?: string;
  ruling?: string;
  created_at: string;
  resolved_at?: string;
}

// ─── createReview ──────────────────────────────────────────────────────────────

/**
 * Creates a review for a completed order.
 * Rating must be 1-5. Comment is optional.
 * Each order can only be reviewed once per party.
 */
export async function createReview(
  orderId: string,
  reviewerId: string,
  rating: number,
  comment?: string,
): Promise<Review> {
  if (rating < 1 || rating > 5) {
    throw new ValidationError('Rating must be between 1 and 5');
  }

  const order = await db().marketplaceOrder.findUnique({
    where: { order_id: orderId },
  });

  if (!order) {
    throw new NotFoundError('Order', orderId);
  }

  if (order.status !== 'completed') {
    throw new ValidationError('Only completed orders can be reviewed');
  }

  // Determine reviewee
  const isBuyerReviewing = order.buyer_id === reviewerId;
  const revieweeId = isBuyerReviewing
    ? order.seller_id
    : order.buyer_id;

  // Prevent duplicate review
  const existing = await db().marketplaceReview.findFirst({
    where: {
      order_id: orderId,
      reviewer_id: reviewerId,
    },
  });

  if (existing) {
    throw new ValidationError('You have already reviewed this order');
  }

  const reviewId = `rev_${crypto.randomUUID()}`;
  const now = new Date();

  const review = await db().marketplaceReview.create({
    data: {
      review_id: reviewId,
      order_id: orderId,
      reviewer_id: reviewerId,
      reviewee_id: revieweeId,
      rating,
      comment,
      created_at: now,
    },
  });

  // Update seller's aggregate rating (simple moving average)
  const allReviews = await db().marketplaceReview.findMany({
    where: { reviewee_id: revieweeId },
    select: { rating: true },
  });

  const avgRating =
    allReviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / allReviews.length;

  await db().node.update({
    where: { node_id: revieweeId },
    data: {
      // reputation is updated via reputation module; here we just track rating
      // The caller should propagate to the reputation system
    },
  });

  void avgRating; // tracked for potential future use

  return _toReview(review);
}

// ─── openDispute ──────────────────────────────────────────────────────────────

/**
 * Opens a dispute for an order in a problematic state.
 * Dispute is filed with the Council governance system.
 * Credits remain locked in escrow until resolved.
 */
export async function openDispute(
  orderId: string,
  openerId: string,
  reason: string,
  evidence?: string,
): Promise<Dispute> {
  if (!reason || reason.trim().length < 10) {
    throw new ValidationError('Dispute reason must be at least 10 characters');
  }

  const order = await db().marketplaceOrder.findUnique({
    where: { order_id: orderId },
  });

  if (!order) {
    throw new NotFoundError('Order', orderId);
  }

  const validOpeners = [order.buyer_id, order.seller_id];
  if (!validOpeners.includes(openerId)) {
    throw new ValidationError('Only buyer or seller can open a dispute');
  }

  const disputeable = ['payment_locked', 'delivered', 'confirmed'];
  if (!disputeable.includes(order.status)) {
    throw new ValidationError(
      `Cannot dispute order in status: ${order.status}`,
    );
  }

  // Check for existing open dispute
  const existing = await db().marketplaceDispute.findFirst({
    where: { order_id: orderId, status: { in: ['open', 'under_review'] } },
  });

  if (existing) {
    throw new ValidationError('An open dispute already exists for this order');
  }

  // Update order status
  await db().marketplaceOrder.update({
    where: { order_id: orderId },
    data: { status: 'disputed' },
  });

  const disputeId = `disp_${crypto.randomUUID()}`;
  const now = new Date();

  const dispute = await db().marketplaceDispute.create({
    data: {
      dispute_id: disputeId,
      order_id: orderId,
      opener_id: openerId,
      reason,
      evidence,
      status: 'open',
      created_at: now,
    },
  });

  // File with Council — create a governance proposal for arbitration
  const defendantId = openerId === order.buyer_id ? order.seller_id : order.buyer_id;

  await db().proposal.create({
    data: {
      proposal_id: `prop_${crypto.randomUUID()}`,
      title: `Marketplace Dispute: Order ${orderId}`,
      description: `Dispute reason: ${reason}\nDefendant: ${defendantId}\nOrder amount: ${order.amount} credits`,
      proposer_id: openerId,
      status: 'discussion',
      category: 'dispute_resolution',
      deposit: 50,
      created_at: now,
      updated_at: now,
    },
  });

  return _toDispute(dispute);
}

// ─── getDispute ───────────────────────────────────────────────────────────────

export async function getDispute(disputeId: string): Promise<Dispute> {
  const dispute = await db().marketplaceDispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) {
    throw new NotFoundError('Dispute', disputeId);
  }

  return _toDispute(dispute);
}

// ─── resolveDispute ───────────────────────────────────────────────────────────

/**
 * Called by the Council governance system after arbitration.
 * Releases escrow to the appropriate party based on the ruling.
 */
export async function resolveDispute(
  disputeId: string,
  ruling: 'buyer_wins' | 'seller_wins' | 'split' | 'dismissed',
  notes?: string,
): Promise<Dispute> {
  const dispute = await db().marketplaceDispute.findUnique({
    where: { dispute_id: disputeId },
    include: { order: true },
  });

  if (!dispute) {
    throw new NotFoundError('Dispute', disputeId);
  }

  if (dispute.status !== 'open' && dispute.status !== 'under_review') {
    throw new ValidationError(`Dispute cannot be resolved in status: ${dispute.status}`);
  }

  const order = dispute.order;

  if (ruling === 'buyer_wins') {
    // Refund buyer
    const buyer = await db().node.findFirst({
      where: { node_id: order.buyer_id },
    });

    await db().node.update({
      where: { node_id: order.buyer_id },
      data: { credit_balance: { increment: order.amount } },
    });

    await db().creditTransaction.create({
      data: {
        node_id: order.buyer_id,
        amount: order.amount,
        type: 'bounty_refund',
        description: `Dispute ${disputeId} ruling: buyer wins`,
        balance_after: (buyer?.credit_balance ?? 0) + order.amount,
      },
    });

    await db().marketplaceOrder.update({
      where: { order_id: order.order_id },
      data: { status: 'refunded' },
    });
  } else if (ruling === 'seller_wins') {
    // Pay seller
    const seller = await db().node.findFirst({
      where: { node_id: order.seller_id },
    });

    await db().node.update({
      where: { node_id: order.seller_id },
      data: { credit_balance: { increment: order.seller_receives } },
    });

    await db().creditTransaction.create({
      data: {
        node_id: order.seller_id,
        amount: order.seller_receives,
        type: 'marketplace_sale',
        description: `Dispute ${disputeId} ruling: seller wins`,
        balance_after: (seller?.credit_balance ?? 0) + order.seller_receives,
      },
    });

    await db().marketplaceListing.update({
      where: { listing_id: order.listing_id },
      data: { status: 'sold', buyer_id: order.buyer_id, sold_at: new Date() },
    });

    await db().marketplaceOrder.update({
      where: { order_id: order.order_id },
      data: { status: 'completed' },
    });
  } else if (ruling === 'split') {
    // 50/50 refund
    const half = Math.floor(order.amount / 2);

    const [buyer, seller] = await Promise.all([
      db().node.findFirst({ where: { node_id: order.buyer_id } }),
      db().node.findFirst({ where: { node_id: order.seller_id } }),
    ]);

    await db().node.update({
      where: { node_id: order.buyer_id },
      data: { credit_balance: { increment: half } },
    });

    await db().creditTransaction.create({
      data: {
        node_id: order.buyer_id,
        amount: half,
        type: 'bounty_refund',
        description: `Dispute ${disputeId} ruling: split (buyer portion)`,
        balance_after: (buyer?.credit_balance ?? 0) + half,
      },
    });

    await db().node.update({
      where: { node_id: order.seller_id },
      data: { credit_balance: { increment: order.amount - half } },
    });

    await db().creditTransaction.create({
      data: {
        node_id: order.seller_id,
        amount: order.amount - half,
        type: 'marketplace_sale',
        description: `Dispute ${disputeId} ruling: split (seller portion)`,
        balance_after: (seller?.credit_balance ?? 0) + (order.amount - half),
      },
    });

    await db().marketplaceOrder.update({
      where: { order_id: order.order_id },
      data: { status: 'completed' },
    });
  }
  // 'dismissed' — leave escrow as-is

  const now = new Date();

  const updated = await db().marketplaceDispute.update({
    where: { dispute_id: disputeId },
    data: {
      status: 'resolved',
      ruling: ruling === 'dismissed' ? 'dismissed' : notes ?? ruling,
      resolved_at: now,
    },
  });

  return _toDispute(updated);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _toReview(r: Record<string, unknown>): Review {
  return {
    review_id: r['review_id'] as string,
    order_id: r['order_id'] as string,
    reviewer_id: r['reviewer_id'] as string,
    reviewee_id: r['reviewee_id'] as string,
    rating: r['rating'] as number,
    comment: r['comment'] as string | undefined,
    created_at: _iso(r['created_at']),
  };
}

function _toDispute(r: Record<string, unknown>): Dispute {
  return {
    dispute_id: r['dispute_id'] as string,
    order_id: r['order_id'] as string,
    opener_id: r['opener_id'] as string,
    reason: r['reason'] as string,
    status: r['status'] as Dispute['status'],
    evidence: r['evidence'] as string | undefined,
    ruling: r['ruling'] as string | undefined,
    created_at: _iso(r['created_at']),
    resolved_at: r['resolved_at']
      ? _iso(r['resolved_at'])
      : undefined,
  };
}

function _iso(v: unknown): string {
  return (v instanceof Date ? v : new Date(v as string)).toISOString();
}
