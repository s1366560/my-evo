import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import type {
  MarketplaceListing,
  MarketplaceTransaction,
  AssetType,
} from '../shared/types';
import {
  MIN_LISTING_PRICE,
  MAX_LISTING_PRICE,
  LISTING_EXPIRY_DAYS,
  MARKETPLACE_FEE_RATE,
  BUYER_PROTECTION_H,
  LOW_REP_PRICE_CAP_RATE,
  LOW_REP_THRESHOLD,
} from '../shared/constants';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
  ForbiddenError,
} from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export async function createListing(
  sellerId: string,
  assetId: string,
  assetType: AssetType,
  price: number,
): Promise<MarketplaceListing> {
  const asset = await prisma.asset.findUnique({
    where: { asset_id: assetId },
  });

  if (!asset) {
    throw new NotFoundError('Asset', assetId);
  }

  if (asset.author_id !== sellerId) {
    throw new ForbiddenError('Only the asset owner can create listings');
  }

  if (asset.status !== 'published') {
    throw new ValidationError('Only published assets can be listed');
  }

  if (price < MIN_LISTING_PRICE || price > MAX_LISTING_PRICE) {
    throw new ValidationError(
      `Price must be between ${MIN_LISTING_PRICE} and ${MAX_LISTING_PRICE}`,
    );
  }

  const seller = await prisma.node.findFirst({
    where: { node_id: sellerId },
  });

  if (seller && seller.reputation < LOW_REP_THRESHOLD) {
    const cappedPrice = Math.floor(
      MAX_LISTING_PRICE * LOW_REP_PRICE_CAP_RATE,
    );
    if (price > cappedPrice) {
      throw new ValidationError(
        `Low reputation sellers are capped at ${cappedPrice} credits`,
      );
    }
  }

  const existingActive = await prisma.marketplaceListing.findFirst({
    where: { asset_id: assetId, status: 'active' },
  });

  if (existingActive) {
    throw new ValidationError('Asset already has an active listing');
  }

  const listingId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + LISTING_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  const listing = await prisma.marketplaceListing.create({
    data: {
      listing_id: listingId,
      seller_id: sellerId,
      asset_id: assetId,
      asset_type: assetType,
      price,
      status: 'active',
      expires_at: expiresAt,
    },
  });

  return {
    listing_id: listing.listing_id,
    seller_id: listing.seller_id,
    asset_id: listing.asset_id,
    asset_type: listing.asset_type as AssetType,
    price: listing.price,
    status: listing.status as MarketplaceListing['status'],
    buyer_id: listing.buyer_id ?? undefined,
    listed_at: listing.listed_at.toISOString(),
    sold_at: listing.sold_at?.toISOString(),
    expires_at: listing.expires_at.toISOString(),
  };
}

export async function buyListing(
  buyerId: string,
  listingId: string,
): Promise<MarketplaceTransaction> {
  const listing = await prisma.marketplaceListing.findUnique({
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

  if (new Date(listing.expires_at) < new Date()) {
    throw new ValidationError('Listing has expired');
  }

  const fee = Math.ceil(listing.price * MARKETPLACE_FEE_RATE);
  const totalCost = listing.price;

  const buyer = await prisma.node.findFirst({
    where: { node_id: buyerId },
  });

  if (!buyer) {
    throw new NotFoundError('Buyer node', buyerId);
  }

  if (buyer.credit_balance < totalCost) {
    throw new InsufficientCreditsError(totalCost, buyer.credit_balance);
  }

  const sellerReceives = listing.price - fee;

  const updatedListing = await prisma.marketplaceListing.update({
    where: { listing_id: listingId },
    data: {
      status: 'sold',
      buyer_id: buyerId,
      sold_at: new Date(),
    },
  });

  await prisma.node.update({
    where: { node_id: buyerId },
    data: { credit_balance: { decrement: totalCost } },
  });

  await prisma.node.update({
    where: { node_id: listing.seller_id },
    data: { credit_balance: { increment: sellerReceives } },
  });

  await prisma.creditTransaction.create({
    data: {
      node_id: buyerId,
      amount: -totalCost,
      type: 'marketplace_buy',
      description: `Purchased asset ${listing.asset_id}`,
      balance_after: buyer.credit_balance - totalCost,
    },
  });

  const seller = await prisma.node.findFirst({
    where: { node_id: listing.seller_id },
  });

  await prisma.creditTransaction.create({
    data: {
      node_id: listing.seller_id,
      amount: sellerReceives,
      type: 'marketplace_sale',
      description: `Sold asset ${listing.asset_id}`,
      balance_after: (seller?.credit_balance ?? 0) + sellerReceives,
    },
  });

  const transactionId = crypto.randomUUID();
  const transaction = await prisma.marketplaceTransaction.create({
    data: {
      transaction_id: transactionId,
      listing_id: listingId,
      seller_id: listing.seller_id,
      buyer_id: buyerId,
      asset_id: listing.asset_id,
      price: listing.price,
      fee,
      seller_receives: sellerReceives,
    },
  });

  return {
    transaction_id: transaction.transaction_id,
    listing_id: transaction.listing_id,
    seller_id: transaction.seller_id,
    buyer_id: transaction.buyer_id,
    asset_id: transaction.asset_id,
    price: transaction.price,
    fee: transaction.fee,
    seller_receives: transaction.seller_receives,
    completed_at: transaction.completed_at.toISOString(),
  };
}

export async function cancelListing(
  sellerId: string,
  listingId: string,
): Promise<MarketplaceListing> {
  const listing = await prisma.marketplaceListing.findUnique({
    where: { listing_id: listingId },
  });

  if (!listing) {
    throw new NotFoundError('Listing', listingId);
  }

  if (listing.seller_id !== sellerId) {
    throw new ForbiddenError('Only the seller can cancel a listing');
  }

  if (listing.status !== 'active') {
    throw new ValidationError('Only active listings can be cancelled');
  }

  const updated = await prisma.marketplaceListing.update({
    where: { listing_id: listingId },
    data: { status: 'cancelled' },
  });

  return {
    listing_id: updated.listing_id,
    seller_id: updated.seller_id,
    asset_id: updated.asset_id,
    asset_type: updated.asset_type as AssetType,
    price: updated.price,
    status: updated.status as MarketplaceListing['status'],
    buyer_id: updated.buyer_id ?? undefined,
    listed_at: updated.listed_at.toISOString(),
    sold_at: updated.sold_at?.toISOString(),
    expires_at: updated.expires_at.toISOString(),
  };
}

export async function getListings(
  type?: string,
  minPrice?: number,
  maxPrice?: number,
  sort: 'price_asc' | 'price_desc' | 'newest' = 'newest',
  limit = 20,
  offset = 0,
): Promise<{ items: MarketplaceListing[]; total: number }> {
  const where: Record<string, unknown> = { status: 'active' };

  if (type) {
    where.asset_type = type;
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceFilter: Record<string, number> = {};
    if (minPrice !== undefined) {
      priceFilter.gte = minPrice;
    }
    if (maxPrice !== undefined) {
      priceFilter.lte = maxPrice;
    }
    where.price = priceFilter;
  }

  const orderBy: Record<string, string> =
    sort === 'price_asc'
      ? { price: 'asc' }
      : sort === 'price_desc'
        ? { price: 'desc' }
        : { listed_at: 'desc' };

  const [items, total] = await Promise.all([
    prisma.marketplaceListing.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
    }),
    prisma.marketplaceListing.count({ where }),
  ]);

  return {
    items: items.map((l: { listing_id: string; seller_id: string; asset_id: string; asset_type: string; price: number; status: string; buyer_id: string | null; listed_at: Date; sold_at: Date | null; expires_at: Date }) => ({
      listing_id: l.listing_id,
      seller_id: l.seller_id,
      asset_id: l.asset_id,
      asset_type: l.asset_type as AssetType,
      price: l.price,
      status: l.status as MarketplaceListing['status'],
      buyer_id: l.buyer_id ?? undefined,
      listed_at: l.listed_at.toISOString(),
      sold_at: l.sold_at?.toISOString(),
      expires_at: l.expires_at.toISOString(),
    })),
    total,
  };
}

export async function getTransactionHistory(
  nodeId: string,
  limit = 20,
  offset = 0,
): Promise<MarketplaceTransaction[]> {
  const transactions = await prisma.marketplaceTransaction.findMany({
    where: {
      OR: [{ buyer_id: nodeId }, { seller_id: nodeId }],
    },
    orderBy: { completed_at: 'desc' },
    take: limit,
    skip: offset,
  });

  return transactions.map((t: { transaction_id: string; listing_id: string; seller_id: string; buyer_id: string; asset_id: string; price: number; fee: number; seller_receives: number; completed_at: Date }) => ({
    transaction_id: t.transaction_id,
    listing_id: t.listing_id,
    seller_id: t.seller_id,
    buyer_id: t.buyer_id,
    asset_id: t.asset_id,
    price: t.price,
    fee: t.fee,
    seller_receives: t.seller_receives,
    completed_at: t.completed_at.toISOString(),
  }));
}
