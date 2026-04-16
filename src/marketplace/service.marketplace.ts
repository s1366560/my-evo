import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
  ForbiddenError,
} from '../shared/errors';
import { classifyPriceTier } from './pricing';

let prisma = new PrismaClient();

const SERVICE_REVIEW_TAG = 'service_review';
const SERVICE_LISTING_STATUSES = [
  'active',
  'paused',
  'archived',
  'cancelled',
  'sold',
  'expired',
] as const;
const SERVICE_PRICE_TYPES = [
  'free',
  'per_use',
  'subscription',
  'one_time',
  'fixed',
  'auction',
  'rental',
] as const;
const SERVICE_LICENSE_TYPES = [
  'open_source',
  'proprietary',
  'custom',
  'exclusive',
  'non-exclusive',
] as const;
const SERVICE_LISTING_FEE_CREDITS = 5;

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function getPrismaClient(prismaClient?: PrismaClient): PrismaClient {
  return prismaClient ?? prisma;
}

export interface ServiceListingInput {
  title: string;
  description: string;
  category: string;
  tags: string[];
  price_type: typeof SERVICE_PRICE_TYPES[number];
  price_credits?: number;
  license_type: typeof SERVICE_LICENSE_TYPES[number];
}

export interface ServiceListing {
  listing_id: string;
  seller_id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price_type: string;
  price_credits: number;
  license_type: string;
  status: string;
  created_at: string;
}

export interface ServiceListingDetail extends ServiceListing {
  stats: {
    views: number;
    purchases: number;
    rating: number;
    rating_count: number;
  };
  updated_at: string;
  expires_at?: string;
}

export interface ServicePurchase {
  purchase_id: string;
  transaction_id?: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  price_paid: number;
  amount?: number;
  status: string;
  escrow?: {
    escrow_id: string;
    amount: number;
    status: 'locked' | 'released' | 'refunded';
    locked_at: string;
    released_at?: string;
  };
  purchased_at: string;
  confirmed_at?: string;
  disputed_at?: string;
}

export interface ServiceTransaction {
  transaction_id: string;
  purchase_id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  price_paid: number;
  amount?: number;
  fee: number;
  platform_fee?: number;
  seller_revenue?: number;
  status?: 'pending' | 'completed' | 'failed' | 'refunded' | 'disputed';
  escrow?: {
    escrow_id: string;
    amount: number;
    status: 'locked' | 'released' | 'refunded';
    locked_at: string;
    released_at?: string;
  };
  created_at?: string;
  completed_at?: string;
}

export interface ServiceReview {
  review_id: string;
  listing_id: string;
  buyer_id: string;
  rating: number;
  review?: string;
  created_at: string;
  updated_at?: string;
}

export interface MarketStats {
  total_listings: number;
  active_listings: number;
  total_transactions: number;
  total_volume: number;
  total_volume_credits?: number;
  average_price?: number;
  price_tiers?: Record<'budget' | 'standard' | 'premium' | 'elite', number>;
  top_categories?: Array<{ category: string; count: number }>;
  bounties?: {
    total: number;
    open: number;
    completed: number;
    cancelled: number;
  };
  categories: Record<string, number>;
}

export interface Balance {
  node_id: string;
  credit_balance: number;
  total_earned: number;
  total_spent: number;
}

function toServiceListing(listing: {
  listing_id: string;
  seller_id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price_type: string;
  price_credits: number;
  license_type: string;
  status: string;
  created_at: Date;
}): ServiceListing {
  return {
    listing_id: listing.listing_id,
    seller_id: listing.seller_id,
    title: listing.title,
    description: listing.description,
    category: listing.category,
    tags: listing.tags,
    price_type: listing.price_type,
    price_credits: listing.price_credits,
    license_type: listing.license_type,
    status: listing.status,
    created_at: listing.created_at.toISOString(),
  };
}

function buildEscrowStatus(
  transaction: {
    escrow_id?: string | null;
    price_paid: number;
    status?: string | null;
    locked_at?: Date | null;
    released_at?: Date | null;
  },
): ServiceTransaction['escrow'] | undefined {
  if (!transaction.escrow_id || !transaction.locked_at) {
    return undefined;
  }

  return {
    escrow_id: transaction.escrow_id,
    amount: transaction.price_paid,
    status: transaction.status === 'refunded'
      ? 'refunded'
      : transaction.released_at
        ? 'released'
        : 'locked',
    locked_at: transaction.locked_at.toISOString(),
    ...(transaction.released_at ? { released_at: transaction.released_at.toISOString() } : {}),
  };
}

function getServiceReviewFilter(listingId: string): { tags: { hasEvery: string[] } } {
  return {
    tags: {
      hasEvery: [SERVICE_REVIEW_TAG, `service:${listingId}`],
    },
  };
}

function getServiceReviewRatingTag(rating: number): string {
  return `rating:${rating}`;
}

function normalizeServiceRating(rating: number): number {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError('rating must be an integer between 1 and 5');
  }
  return rating;
}

function normalizeServiceStatus(status: string): typeof SERVICE_LISTING_STATUSES[number] {
  if (!SERVICE_LISTING_STATUSES.includes(status as typeof SERVICE_LISTING_STATUSES[number])) {
    throw new ValidationError('status must be one of active, paused, archived, cancelled, sold, expired');
  }
  return status as typeof SERVICE_LISTING_STATUSES[number];
}

function normalizeServicePriceType(priceType: string): typeof SERVICE_PRICE_TYPES[number] {
  if (!SERVICE_PRICE_TYPES.includes(priceType as typeof SERVICE_PRICE_TYPES[number])) {
    throw new ValidationError('price_type must be one of free, per_use, subscription, one_time, fixed, auction, rental');
  }
  return priceType as typeof SERVICE_PRICE_TYPES[number];
}

function normalizeServiceLicenseType(licenseType: string): typeof SERVICE_LICENSE_TYPES[number] {
  if (!SERVICE_LICENSE_TYPES.includes(licenseType as typeof SERVICE_LICENSE_TYPES[number])) {
    throw new ValidationError('license_type must be one of open_source, proprietary, custom, exclusive, non-exclusive');
  }
  return licenseType as typeof SERVICE_LICENSE_TYPES[number];
}

function getServiceReviewId(listingId: string, buyerId: string): string {
  const digest = crypto
    .createHash('sha256')
    .update(`${listingId}:${buyerId}`)
    .digest('hex')
    .slice(0, 24);
  return `srvrev-${digest}`;
}

export async function searchServiceListings(params: {
  query?: string;
  category?: string;
  limit?: number;
  offset?: number;
  include_inactive?: boolean;
}, prismaClient?: PrismaClient): Promise<{ items: ServiceListing[]; total: number }> {
  const client = getPrismaClient(prismaClient);
  const limit = Math.max(1, Math.min(params.limit ?? 20, 100));
  const offset = Math.max(0, params.offset ?? 0);
  const query = params.query?.trim();
  const where: Record<string, unknown> = {};

  if (!params.include_inactive) {
    where['status'] = 'active';
  }

  if (params.category?.trim()) {
    where['category'] = params.category.trim();
  }

  if (query) {
    where['OR'] = [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { category: { contains: query, mode: 'insensitive' } },
      { tags: { has: query } },
    ];
  }

  const [items, total] = await Promise.all([
    client.serviceListing.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { created_at: 'desc' },
    }),
    client.serviceListing.count({ where }),
  ]);

  return {
    items: items.map((item) => toServiceListing(item)),
    total,
  };
}

export async function createServiceListing(
  sellerId: string,
  input: ServiceListingInput,
  prismaClient?: PrismaClient,
): Promise<ServiceListing> {
  const client = getPrismaClient(prismaClient);
  const normalizedPriceType = normalizeServicePriceType(input.price_type);
  const normalizedLicenseType = normalizeServiceLicenseType(input.license_type);
  if (!input.title || input.title.trim().length === 0) {
    throw new ValidationError('Title is required');
  }
  if (!input.description || input.description.trim().length === 0) {
    throw new ValidationError('Description is required');
  }
  if (!input.category || input.category.trim().length === 0) {
    throw new ValidationError('Category is required');
  }
  if (normalizedPriceType !== 'free' && (input.price_credits === undefined || input.price_credits <= 0)) {
    throw new ValidationError('price_credits is required for non-free listings');
  }

  const seller = await client.node.findFirst({
    where: { node_id: sellerId },
  });
  if (!seller) {
    throw new NotFoundError('Seller node', sellerId);
  }
  if (seller.credit_balance < SERVICE_LISTING_FEE_CREDITS) {
    throw new InsufficientCreditsError(SERVICE_LISTING_FEE_CREDITS, seller.credit_balance);
  }

  const listingId = `listing_${crypto.randomUUID()}`;
  const listing = await client.$transaction(async (tx) => {
    const updatedSeller = await tx.node.update({
      where: { node_id: sellerId },
      data: {
        credit_balance: { decrement: SERVICE_LISTING_FEE_CREDITS },
      },
    });

    await tx.creditTransaction.create({
      data: {
        node_id: sellerId,
        amount: -SERVICE_LISTING_FEE_CREDITS,
        type: 'service_listing_fee',
        description: `Service listing fee: ${input.title.trim()}`,
        balance_after: updatedSeller.credit_balance,
      },
    });

    return tx.serviceListing.create({
      data: {
        listing_id: listingId,
        seller_id: sellerId,
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category,
        tags: input.tags ?? [],
        price_type: normalizedPriceType,
        price_credits: input.price_credits ?? 0,
        license_type: normalizedLicenseType,
        status: 'active',
      },
    });
  });

  return toServiceListing(listing);
}

export async function purchaseService(
  buyerId: string,
  listingId: string,
  prismaClient?: PrismaClient,
): Promise<ServicePurchase> {
  const client = getPrismaClient(prismaClient);
  const listing = await client.serviceListing.findFirst({
    where: { listing_id: listingId },
  });

  if (!listing) {
    throw new NotFoundError('ServiceListing', listingId);
  }
  if (listing.status !== 'active') {
    throw new ValidationError('Listing is not active');
  }
  if (listing.seller_id === buyerId) {
    throw new ValidationError('Cannot purchase your own listing');
  }

  const priceCredits = listing.price_credits;
  const priceType = listing.price_type;
  const purchaseId = `pur-${crypto.randomUUID()}`;
  const transactionId = priceType !== 'free' && priceCredits > 0 ? `stx-${crypto.randomUUID()}` : undefined;
  const fee = priceType !== 'free' && priceCredits > 0 ? Math.ceil(priceCredits * 0.05) : 0;

  const purchase = await client.$transaction(async (tx) => {
    if (priceType !== 'free' && priceCredits > 0) {
      const buyer = await tx.node.findFirst({ where: { node_id: buyerId } });
      if (!buyer) {
        throw new NotFoundError('Buyer node', buyerId);
      }
      if (buyer.credit_balance < priceCredits) {
        throw new InsufficientCreditsError(priceCredits, buyer.credit_balance);
      }

      const updatedBuyer = await tx.node.update({
        where: { node_id: buyerId },
        data: { credit_balance: { decrement: priceCredits } },
      });

      await tx.creditTransaction.create({
        data: {
          node_id: buyerId,
          amount: -priceCredits,
          type: 'service_purchase',
          description: `Purchased service ${listingId}`,
          balance_after: updatedBuyer.credit_balance,
        },
      });
    }

    const createdPurchase = await tx.servicePurchase.create({
      data: {
        purchase_id: purchaseId,
        listing_id: listingId,
        buyer_id: buyerId,
        seller_id: listing.seller_id,
        price_paid: priceCredits,
        status: 'pending',
      },
    });

    if (transactionId) {
      await tx.serviceTransaction.create({
        data: {
          transaction_id: transactionId,
          purchase_id: purchaseId,
          listing_id: listingId,
          buyer_id: buyerId,
          seller_id: listing.seller_id,
          price_paid: priceCredits,
          fee,
          status: 'pending',
          escrow_id: `escrow_${purchaseId}`,
          locked_at: createdPurchase.purchased_at,
          completed_at: null,
        },
      });
    }

    if (listing.license_type === 'exclusive') {
      await tx.serviceListing.update({
        where: { listing_id: listingId },
        data: { status: 'sold' },
      });
    }

    return createdPurchase;
  });

  return {
    purchase_id: purchase.purchase_id,
    ...(transactionId ? { transaction_id: transactionId } : {}),
    listing_id: purchase.listing_id,
    buyer_id: purchase.buyer_id,
    seller_id: purchase.seller_id,
    price_paid: purchase.price_paid,
    amount: purchase.price_paid,
    status: purchase.status,
    ...(transactionId ? {
      escrow: {
        escrow_id: `escrow_${purchase.purchase_id}`,
        amount: purchase.price_paid,
        status: 'locked' as const,
        locked_at: purchase.purchased_at.toISOString(),
      },
    } : {}),
    purchased_at: purchase.purchased_at.toISOString(),
  };
}

export async function getMyPurchases(
  buyerId: string,
  limit = 20,
  offset = 0,
  prismaClient?: PrismaClient,
): Promise<{ items: ServicePurchase[]; total: number }> {
  const client = getPrismaClient(prismaClient);
  const [items, total] = await Promise.all([
    client.servicePurchase.findMany({
      where: { buyer_id: buyerId },
      take: limit,
      skip: offset,
      orderBy: { purchased_at: 'desc' },
    }),
    client.servicePurchase.count({ where: { buyer_id: buyerId } }),
  ]);

  return {
    items: items.map((p) => ({
      purchase_id: p.purchase_id,
      listing_id: p.listing_id,
      buyer_id: p.buyer_id,
      seller_id: p.seller_id,
      price_paid: p.price_paid,
      status: p.status,
      purchased_at: p.purchased_at.toISOString(),
      confirmed_at: p.confirmed_at ? p.confirmed_at.toISOString() : undefined,
      disputed_at: p.disputed_at ? p.disputed_at.toISOString() : undefined,
    })),
    total,
  };
}

async function buildServiceListingStats(
  client: PrismaClient,
  listingId: string,
): Promise<ServiceListingDetail['stats']> {
  const [purchases, reviews] = await Promise.all([
    client.servicePurchase.count({ where: { listing_id: listingId } }),
    client.question.findMany({
      where: getServiceReviewFilter(listingId),
      select: { tags: true },
    }),
  ]);

  const ratings = reviews.flatMap((review) =>
    review.tags
      .filter((tag) => tag.startsWith('rating:'))
      .map((tag) => Number(tag.slice('rating:'.length)))
      .filter((value) => Number.isFinite(value)),
  );

  const ratingCount = ratings.length;
  const rating = ratingCount > 0
    ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratingCount).toFixed(2))
    : 0;

  return {
    views: 0,
    purchases,
    rating,
    rating_count: ratingCount,
  };
}

export async function getServiceListing(
  listingId: string,
  prismaClient?: PrismaClient,
): Promise<ServiceListingDetail> {
  const client = getPrismaClient(prismaClient);
  const listing = await client.serviceListing.findFirst({
    where: { listing_id: listingId },
  });

  if (!listing) {
    throw new NotFoundError('ServiceListing', listingId);
  }

  return {
    ...toServiceListing(listing),
    stats: await buildServiceListingStats(client, listingId),
    updated_at: listing.created_at.toISOString(),
  };
}

export async function updateServiceListing(
  sellerId: string,
  listingId: string,
  updates: {
    title?: string;
    description?: string;
    category?: string;
    tags?: string[];
    price_credits?: number;
    price_type?: typeof SERVICE_PRICE_TYPES[number];
    status?: string;
    license_type?: typeof SERVICE_LICENSE_TYPES[number];
  },
  prismaClient?: PrismaClient,
): Promise<ServiceListing> {
  const client = getPrismaClient(prismaClient);
  const listing = await client.serviceListing.findFirst({
    where: { listing_id: listingId },
  });

  if (!listing) {
    throw new NotFoundError('ServiceListing', listingId);
  }
  if (listing.seller_id !== sellerId) {
    throw new ForbiddenError('Only the seller can update this listing');
  }

  if (updates.title !== undefined && updates.title.trim().length === 0) {
    throw new ValidationError('Title cannot be empty');
  }
  if (updates.description !== undefined && updates.description.trim().length === 0) {
    throw new ValidationError('Description cannot be empty');
  }
  if (updates.category !== undefined && updates.category.trim().length === 0) {
    throw new ValidationError('Category cannot be empty');
  }
  if (updates.price_credits !== undefined && updates.price_credits < 0) {
    throw new ValidationError('price_credits cannot be negative');
  }
  if (updates.price_type !== undefined && updates.price_type.trim().length === 0) {
    throw new ValidationError('price_type cannot be empty');
  }
  if (updates.status !== undefined && updates.status.trim().length === 0) {
    throw new ValidationError('status cannot be empty');
  }
  const normalizedPriceType = updates.price_type !== undefined
    ? normalizeServicePriceType(updates.price_type.trim())
    : undefined;
  const normalizedStatus = updates.status !== undefined
    ? normalizeServiceStatus(updates.status.trim())
    : undefined;
  const normalizedLicenseType = updates.license_type !== undefined
    ? normalizeServiceLicenseType(updates.license_type)
    : undefined;

  const nextPrice = updates.price_credits ?? listing.price_credits;
  const requestedPriceType = normalizedPriceType ?? (nextPrice > 0
    ? (listing.price_type === 'free' ? 'fixed' : listing.price_type)
    : 'free');
  const nextPriceType = nextPrice > 0
    ? requestedPriceType
    : 'free';

  const updated = await client.serviceListing.update({
    where: { listing_id: listingId },
    data: {
      ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
      ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
      ...(updates.category !== undefined ? { category: updates.category.trim() } : {}),
      ...(updates.tags !== undefined ? { tags: updates.tags } : {}),
      ...(updates.price_credits !== undefined ? { price_credits: nextPrice, price_type: nextPriceType } : {}),
      ...(updates.price_credits === undefined && normalizedPriceType !== undefined ? { price_type: nextPriceType } : {}),
      ...(normalizedStatus !== undefined ? { status: normalizedStatus } : {}),
      ...(normalizedLicenseType !== undefined ? { license_type: normalizedLicenseType } : {}),
    },
  });

  return toServiceListing(updated);
}

export async function cancelServiceListing(
  sellerId: string,
  listingId: string,
  prismaClient?: PrismaClient,
): Promise<ServiceListing> {
  return updateServiceListing(sellerId, listingId, { status: 'cancelled' }, prismaClient);
}

export async function rateService(
  buyerId: string,
  listingId: string,
  rating: number,
  review?: string,
  prismaClient?: PrismaClient,
): Promise<ServiceReview> {
  const client = getPrismaClient(prismaClient);
  const normalizedRating = normalizeServiceRating(rating);
  const [listing, purchase] = await Promise.all([
    client.serviceListing.findFirst({
      where: { listing_id: listingId },
    }),
    client.servicePurchase.findFirst({
      where: { listing_id: listingId, buyer_id: buyerId, status: 'confirmed' },
    }),
  ]);

  if (!listing) {
    throw new NotFoundError('ServiceListing', listingId);
  }
  if (!purchase) {
    throw new ForbiddenError('Only buyers with a confirmed purchase can rate this service');
  }

  const reviewId = getServiceReviewId(listingId, buyerId);
  const tags = [
    SERVICE_REVIEW_TAG,
    `service:${listingId}`,
    getServiceReviewRatingTag(normalizedRating),
  ];
  const body = review?.trim() || `Rating ${normalizedRating}/5`;
  const title = `Review for ${listing.title}`;
  const existingReview = await client.question.findFirst({
    where: {
      author: buyerId,
      ...getServiceReviewFilter(listingId),
    },
  });

  if (existingReview) {
    const updated = await client.question.update({
      where: { question_id: existingReview.question_id },
      data: {
        title,
        body,
        tags,
      },
    });

    return {
      review_id: updated.question_id,
      listing_id: listingId,
      buyer_id: buyerId,
      rating: normalizedRating,
      review: updated.body,
      created_at: updated.created_at.toISOString(),
      updated_at: updated.updated_at.toISOString(),
    };
  }

  const created = await client.question.upsert({
    where: { question_id: reviewId },
    create: {
      question_id: reviewId,
      title,
      body,
      tags,
      author: buyerId,
    },
    update: {
      title,
      body,
      tags,
    },
  });

  return {
    review_id: created.question_id,
    listing_id: listingId,
    buyer_id: buyerId,
    rating: normalizedRating,
    review: created.body,
    created_at: created.created_at.toISOString(),
    updated_at: created.updated_at.toISOString(),
  };
}

export async function confirmPurchase(
  buyerId: string,
  purchaseId: string,
  prismaClient?: PrismaClient,
): Promise<ServicePurchase> {
  const client = getPrismaClient(prismaClient);
  const purchase = await client.servicePurchase.findFirst({
    where: { purchase_id: purchaseId },
  });

  if (!purchase) {
    throw new NotFoundError('ServicePurchase', purchaseId);
  }
  if (purchase.buyer_id !== buyerId) {
    throw new ForbiddenError('Only the buyer can confirm a purchase');
  }
  if (purchase.status !== 'pending') {
    throw new ValidationError('Only pending purchases can be confirmed');
  }

  const result = await client.$transaction(async (tx) => {
    const confirmedAt = new Date();
    const transaction = await tx.serviceTransaction.findFirst({
      where: { purchase_id: purchaseId },
    });

    if (purchase.price_paid > 0) {
      if (!transaction) {
        throw new NotFoundError('ServiceTransaction', purchaseId);
      }

      const seller = await tx.node.findFirst({ where: { node_id: purchase.seller_id } });
      if (!seller) {
        throw new NotFoundError('Seller node', purchase.seller_id);
      }

      const sellerRevenue = purchase.price_paid - transaction.fee;
      const updatedSeller = await tx.node.update({
        where: { node_id: purchase.seller_id },
        data: { credit_balance: { increment: sellerRevenue } },
      });

      await tx.creditTransaction.create({
        data: {
          node_id: purchase.seller_id,
          amount: sellerRevenue,
          type: 'service_sale_payout',
          description: `Escrow released for service purchase ${purchaseId}`,
          balance_after: updatedSeller.credit_balance,
        },
      });

      await tx.serviceTransaction.update({
        where: { transaction_id: transaction.transaction_id },
        data: {
          status: 'completed',
          released_at: confirmedAt,
          completed_at: confirmedAt,
        },
      });
    }

    const updatedPurchase = await tx.servicePurchase.update({
      where: { purchase_id: purchaseId },
      data: { status: 'confirmed', confirmed_at: confirmedAt },
    });

    return {
      purchase: updatedPurchase,
      transaction_id: transaction?.transaction_id,
    };
  });

  return {
    purchase_id: result.purchase.purchase_id,
    ...(result.transaction_id ? { transaction_id: result.transaction_id } : {}),
    listing_id: result.purchase.listing_id,
    buyer_id: result.purchase.buyer_id,
    seller_id: result.purchase.seller_id,
    price_paid: result.purchase.price_paid,
    amount: result.purchase.price_paid,
    status: result.purchase.status,
    escrow: {
      escrow_id: `escrow_${result.purchase.purchase_id}`,
      amount: result.purchase.price_paid,
      status: 'released',
      locked_at: result.purchase.purchased_at.toISOString(),
      released_at: result.purchase.confirmed_at?.toISOString(),
    },
    purchased_at: result.purchase.purchased_at.toISOString(),
    confirmed_at: result.purchase.confirmed_at ? result.purchase.confirmed_at.toISOString() : undefined,
  };
}

export async function disputePurchase(
  buyerId: string,
  purchaseId: string,
  reason: string,
  prismaClient?: PrismaClient,
): Promise<{
  dispute_id: string;
  purchase_id: string;
  transaction_id?: string;
  amount: number;
  status: string;
  escrow: {
    escrow_id: string;
    amount: number;
    status: 'locked' | 'released' | 'refunded';
    locked_at: string;
    released_at?: string;
  };
}> {
  const client = getPrismaClient(prismaClient);
  const purchase = await client.servicePurchase.findFirst({
    where: { purchase_id: purchaseId },
  });

  if (!purchase) {
    throw new NotFoundError('ServicePurchase', purchaseId);
  }
  if (purchase.buyer_id !== buyerId) {
    throw new ForbiddenError('Only the buyer can dispute a purchase');
  }
  if (purchase.status === 'disputed' || purchase.status === 'confirmed') {
    throw new ValidationError(`Cannot dispute a ${purchase.status} purchase`);
  }

  const transaction = purchase.price_paid > 0
    ? await client.serviceTransaction.findFirst({ where: { purchase_id: purchaseId } })
    : null;

  const disputeId = `dis-${crypto.randomUUID()}`;
  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await client.$transaction(async (tx) => {
    await tx.dispute.create({
      data: {
        dispute_id: disputeId,
        type: 'service_purchase',
        plaintiff_id: buyerId,
        defendant_id: purchase.seller_id,
        title: `Service dispute: ${purchaseId}`,
        description: reason,
        related_transaction_id: transaction?.transaction_id ?? purchaseId,
        filing_fee: 50,
        deadline,
        status: 'filed',
      },
    });

    await tx.servicePurchase.update({
      where: { purchase_id: purchaseId },
      data: { status: 'disputed', disputed_at: new Date() },
    });

    if (transaction) {
      await tx.serviceTransaction.update({
        where: { transaction_id: transaction.transaction_id },
        data: { status: 'disputed' },
      });
    }
  });

  return {
    dispute_id: disputeId,
    purchase_id: purchaseId,
    ...(transaction ? { transaction_id: transaction.transaction_id } : {}),
    amount: purchase.price_paid,
    status: 'disputed',
    escrow: {
      escrow_id: `escrow_${purchase.purchase_id}`,
      amount: purchase.price_paid,
      status: 'locked' as const,
      locked_at: purchase.purchased_at.toISOString(),
    },
  };
}

export async function getTransactionHistory(
  nodeId: string,
  limit = 20,
  offset = 0,
  prismaClient?: PrismaClient,
): Promise<ServiceTransaction[]> {
  const client = getPrismaClient(prismaClient);
  const transactions = await client.serviceTransaction.findMany({
    where: { OR: [{ buyer_id: nodeId }, { seller_id: nodeId }] },
    take: limit,
    skip: offset,
    orderBy: { completed_at: 'desc' },
  });

  return transactions.map((t) => ({
    transaction_id: t.transaction_id,
    purchase_id: t.purchase_id,
    buyer_id: t.buyer_id,
    seller_id: t.seller_id,
    listing_id: t.listing_id,
    price_paid: t.price_paid,
    amount: t.price_paid,
    fee: t.fee,
    platform_fee: t.fee,
    seller_revenue: t.price_paid - t.fee,
    status: (t.status as ServiceTransaction['status']) ?? 'pending',
    ...(buildEscrowStatus(t) ? {
      escrow: buildEscrowStatus(t),
      created_at: t.locked_at.toISOString(),
    } : {}),
    ...(t.completed_at ? { completed_at: t.completed_at.toISOString() } : {}),
  }));
}

export async function getTransaction(
  nodeId: string,
  transactionId: string,
  prismaClient?: PrismaClient,
): Promise<ServiceTransaction> {
  const client = getPrismaClient(prismaClient);
  const t = await client.serviceTransaction.findFirst({
    where: { transaction_id: transactionId },
  });

  if (!t) {
    throw new NotFoundError('ServiceTransaction', transactionId);
  }
  if (t.buyer_id !== nodeId && t.seller_id !== nodeId) {
    throw new ForbiddenError('You are not a party to this transaction');
  }

  return {
    transaction_id: t.transaction_id,
    purchase_id: t.purchase_id,
    buyer_id: t.buyer_id,
    seller_id: t.seller_id,
    listing_id: t.listing_id,
    price_paid: t.price_paid,
    amount: t.price_paid,
    fee: t.fee,
    platform_fee: t.fee,
    seller_revenue: t.price_paid - t.fee,
    status: (t.status as ServiceTransaction['status']) ?? 'pending',
    ...(buildEscrowStatus(t) ? {
      escrow: buildEscrowStatus(t),
      created_at: t.locked_at.toISOString(),
    } : {}),
    ...(t.completed_at ? { completed_at: t.completed_at.toISOString() } : {}),
  };
}

export async function getMarketStats(prismaClient?: PrismaClient): Promise<MarketStats> {
  const client = getPrismaClient(prismaClient);
  const [totalListings, activeListings, totalTransactions, volumeResult, activeListingRows, listingRows, bountyCounts] =
    await Promise.all([
      client.serviceListing.count(),
      client.serviceListing.count({ where: { status: 'active' } }),
      client.serviceTransaction.count(),
      client.serviceTransaction.aggregate({ _sum: { price_paid: true } }),
      client.serviceListing.findMany({
        where: { status: 'active' },
        select: { price_credits: true },
      }),
      client.serviceListing.findMany({
        select: { category: true },
      }),
      Promise.all([
        client.bounty.count(),
        client.bounty.count({ where: { status: { in: ['open', 'claimed', 'submitted'] } } }),
        client.bounty.count({ where: { status: { in: ['accepted', 'resolved'] } } }),
        client.bounty.count({ where: { status: 'cancelled' } }),
      ]),
    ]);

  const tierCounts: Record<'budget' | 'standard' | 'premium' | 'elite', number> = {
    budget: 0,
    standard: 0,
    premium: 0,
    elite: 0,
  };
  let totalPrice = 0;
  for (const listing of activeListingRows) {
    const price = listing.price_credits ?? 0;
    totalPrice += price;
    tierCounts[classifyPriceTier(price)] += 1;
  }

  const categoryCounts = listingRows.reduce<Record<string, number>>((acc, listing) => {
    const category = listing.category?.trim();
    if (category) {
      acc[category] = (acc[category] ?? 0) + 1;
    }
    return acc;
  }, {});

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([category, count]) => ({ category, count }));

  const [totalBounties, openBounties, completedBounties, cancelledBounties] = bountyCounts;
  const totalVolumeCredits = volumeResult._sum.price_paid ?? 0;

  return {
    total_listings: totalListings,
    active_listings: activeListings,
    total_transactions: totalTransactions,
    total_volume: totalVolumeCredits,
    total_volume_credits: totalVolumeCredits,
    average_price: activeListings > 0 ? Number((totalPrice / activeListings).toFixed(2)) : 0,
    price_tiers: tierCounts,
    top_categories: topCategories,
    bounties: {
      total: totalBounties,
      open: openBounties,
      completed: completedBounties,
      cancelled: cancelledBounties,
    },
    categories: categoryCounts,
  };
}

export async function getBalance(nodeId: string, prismaClient?: PrismaClient): Promise<Balance> {
  const client = getPrismaClient(prismaClient);
  const node = await client.node.findFirst({ where: { node_id: nodeId } });
  if (!node) {
    throw new NotFoundError('Node', nodeId);
  }

  const [earned, spent] = await Promise.all([
    client.serviceTransaction.aggregate({
      _sum: { price_paid: true },
      where: { seller_id: nodeId },
    }),
    client.serviceTransaction.aggregate({
      _sum: { price_paid: true },
      where: { buyer_id: nodeId },
    }),
  ]);

  return {
    node_id: nodeId,
    credit_balance: node.credit_balance,
    total_earned: earned._sum.price_paid ?? 0,
    total_spent: spent._sum.price_paid ?? 0,
  };
}
