import crypto from 'crypto';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
  ForbiddenError,
} from '../shared/errors';
import { MARKETPLACE_FEE_RATE, BUYER_PROTECTION_H } from '../shared/constants';

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

// ─── Order lifecycle types ──────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'payment_locked'
  | 'delivered'
  | 'confirmed'
  | 'completed'
  | 'refunded'
  | 'disputed';

export interface Order {
  order_id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  asset_id: string;
  amount: number;
  fee: number;
  seller_receives: number;
  status: OrderStatus;
  escrow_id: string;
  delivery_proof?: string;
  created_at: string;
  locked_at?: string;
  delivered_at?: string;
  confirmed_at?: string;
  completed_at?: string;
  refunded_at?: string;
  refund_reason?: string;
}

// ─── createOrder ───────────────────────────────────────────────────────────────

/**
 * Creates an order and locks payment into escrow atomically.
 * Buyer must have sufficient credits; seller cannot buy own listing.
 */
export async function createOrder(
  buyerId: string,
  listingId: string,
): Promise<Order> {
  const listing = await db().marketplaceListing.findUnique({
    where: { listing_id: listingId },
  });

  if (!listing) {
    throw new NotFoundError('Listing', listingId);
  }

  if (listing.status !== 'active') {
    throw new ValidationError('Listing is not active');
  }

  if (listing.seller_id === buyerId) {
    throw new ValidationError('Cannot buy your own listing');
  }

  const expiresAt = new Date(listing.expires_at);
  if (expiresAt < new Date()) {
    throw new ValidationError('Listing has expired');
  }

  const buyer = await db().node.findFirst({
    where: { node_id: buyerId },
  });

  if (!buyer) {
    throw new NotFoundError('Buyer node', buyerId);
  }

  const totalCost = listing.price;
  if ((buyer.credit_balance ?? 0) < totalCost) {
    throw new InsufficientCreditsError(totalCost, buyer.credit_balance ?? 0);
  }

  const fee = Math.ceil(totalCost * MARKETPLACE_FEE_RATE);
  const sellerReceives = totalCost - fee;
  const escrowId = `escrow_${crypto.randomUUID()}`;
  const orderId = `order_${crypto.randomUUID()}`;
  const now = new Date();

  await db().node.update({
    where: { node_id: buyerId },
    data: { credit_balance: { decrement: totalCost } },
  });

  await db().creditTransaction.create({
    data: {
      node_id: buyerId,
      amount: -totalCost,
      type: 'marketplace_buy',
      description: `Order created for listing ${listingId}`,
      balance_after: (buyer.credit_balance ?? 0) - totalCost,
    },
  });

  await db().marketplaceOrder.upsert({
    where: { order_id: orderId },
    update: {},
    create: {
      order_id: orderId,
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: listing.seller_id,
      asset_id: listing.asset_id,
      amount: totalCost,
      fee,
      seller_receives: sellerReceives,
      status: 'payment_locked',
      escrow_id: escrowId,
      locked_at: now,
      created_at: now,
    },
  });

  return {
    order_id: orderId,
    listing_id: listingId,
    buyer_id: buyerId,
    seller_id: listing.seller_id,
    asset_id: listing.asset_id,
    amount: totalCost,
    fee,
    seller_receives: sellerReceives,
    status: 'payment_locked',
    escrow_id: escrowId,
    locked_at: now.toISOString(),
    created_at: now.toISOString(),
  };
}

// ─── lockPayment ───────────────────────────────────────────────────────────────

/**
 * Confirms the escrow payment is locked for an existing pending order.
 * Idempotent: returns the existing locked state if already locked.
 */
export async function lockPayment(orderId: string): Promise<Order> {
  const order = await db().marketplaceOrder.findUnique({
    where: { order_id: orderId },
  });

  if (!order) {
    throw new NotFoundError('Order', orderId);
  }

  if (order.status !== 'pending') {
    if (order.status === 'payment_locked') {
      // Already locked — idempotent return
      return _toOrder(order);
    }
    throw new ValidationError(`Order is not pending: ${order.status}`);
  }

  const updated = await db().marketplaceOrder.update({
    where: { order_id: orderId },
    data: {
      status: 'payment_locked',
      locked_at: new Date(),
    },
  });

  return _toOrder(updated);
}

// ─── confirmDelivery ───────────────────────────────────────────────────────────

/**
 * Seller marks the order as delivered with optional delivery proof.
 * After delivery the buyer has BUYER_PROTECTION_H hours to confirm or dispute.
 */
export async function confirmDelivery(
  orderId: string,
  deliveryProof?: string,
): Promise<Order> {
  const order = await db().marketplaceOrder.findUnique({
    where: { order_id: orderId },
  });

  if (!order) {
    throw new NotFoundError('Order', orderId);
  }

  const validStatuses = ['payment_locked', 'delivered'];
  if (!validStatuses.includes(order.status)) {
    throw new ValidationError(
      `Cannot deliver order in status: ${order.status}`,
    );
  }

  const updated = await db().marketplaceOrder.update({
    where: { order_id: orderId },
    data: {
      status: 'delivered',
      delivery_proof: deliveryProof ?? order.delivery_proof,
      delivered_at: new Date(),
    },
  });

  return _toOrder(updated);
}

// ─── completeOrder ─────────────────────────────────────────────────────────────

/**
 * Buyer confirms delivery is satisfactory.
 * Releases escrow to seller and marks order completed.
 */
export async function completeOrder(orderId: string): Promise<Order> {
  const order = await db().marketplaceOrder.findUnique({
    where: { order_id: orderId },
  });

  if (!order) {
    throw new NotFoundError('Order', orderId);
  }

  if (order.status !== 'delivered') {
    throw new ValidationError(
      `Only delivered orders can be completed. Current: ${order.status}`,
    );
  }

  // Release escrow: credit seller
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
      description: `Order completed: ${orderId}`,
      balance_after: (seller?.credit_balance ?? 0) + order.seller_receives,
    },
  });

  // Mark listing as sold
  await db().marketplaceListing.update({
    where: { listing_id: order.listing_id },
    data: {
      status: 'sold',
      buyer_id: order.buyer_id,
      sold_at: new Date(),
    },
  });

  const updated = await db().marketplaceOrder.update({
    where: { order_id: orderId },
    data: {
      status: 'completed',
      confirmed_at: new Date(),
      completed_at: new Date(),
    },
  });

  return _toOrder(updated);
}

// ─── refundOrder ───────────────────────────────────────────────────────────────

/**
 * Refunds the buyer when escrow should be released back.
 * Used for cancellations, disputes, or buyer-protection auto-refunds.
 */
export async function refundOrder(
  orderId: string,
  reason?: string,
): Promise<Order> {
  const order = await db().marketplaceOrder.findUnique({
    where: { order_id: orderId },
  });

  if (!order) {
    throw new NotFoundError('Order', orderId);
  }

  const refundable = ['pending', 'payment_locked', 'delivered'];
  if (!refundable.includes(order.status)) {
    throw new ValidationError(
      `Order cannot be refunded in status: ${order.status}`,
    );
  }

  // Return credits to buyer
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
      type: 'marketplace_buy',
      description: `Refund for order ${orderId}: ${reason ?? 'No reason provided'}`,
      balance_after: (buyer?.credit_balance ?? 0) + order.amount,
    },
  });

  const updated = await db().marketplaceOrder.update({
    where: { order_id: orderId },
    data: {
      status: 'refunded',
      refund_reason: reason,
      refunded_at: new Date(),
    },
  });

  return _toOrder(updated);
}

// ─── getOrder ─────────────────────────────────────────────────────────────────

export async function getOrder(orderId: string): Promise<Order> {
  const order = await db().marketplaceOrder.findUnique({
    where: { order_id: orderId },
  });

  if (!order) {
    throw new NotFoundError('Order', orderId);
  }

  return _toOrder(order);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _toOrder(r: Record<string, unknown>): Order {
  return {
    order_id: r['order_id'] as string,
    listing_id: r['listing_id'] as string,
    buyer_id: r['buyer_id'] as string,
    seller_id: r['seller_id'] as string,
    asset_id: r['asset_id'] as string,
    amount: r['amount'] as number,
    fee: r['fee'] as number,
    seller_receives: r['seller_receives'] as number,
    status: r['status'] as OrderStatus,
    escrow_id: r['escrow_id'] as string,
    delivery_proof: r['delivery_proof'] as string | undefined,
    created_at: _iso(r['created_at']),
    locked_at: _isoOrUndefined(r['locked_at']),
    delivered_at: _isoOrUndefined(r['delivered_at']),
    confirmed_at: _isoOrUndefined(r['confirmed_at']),
    completed_at: _isoOrUndefined(r['completed_at']),
    refunded_at: _isoOrUndefined(r['refunded_at']),
    refund_reason: r['refund_reason'] as string | undefined,
  };
}

function _iso(v: unknown): string {
  return (v instanceof Date ? v : new Date(v as string)).toISOString();
}

function _isoOrUndefined(v: unknown): string | undefined {
  if (!v) return undefined;
  return (v instanceof Date ? v : new Date(v as string)).toISOString();
}
