// Marketplace service - full implementation with all required functions
import type { PrismaClient } from '@prisma/client';
import type { AssetType } from '../shared/types';

export interface MarketplaceListing {
  listing_id: string;
  asset_id: string;
  asset_type: string;
  name: string;
  description: string;
  price: number;
  seller_id: string;
  status: 'active' | 'sold' | 'removed';
  created_at: Date;
  updated_at: Date;
}

export interface TransactionRecord {
  transaction_id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  created_at: Date;
}

// In-memory storage (replace with database in production)
const listings = new Map<string, MarketplaceListing>();
const transactions = new Map<string, TransactionRecord>();

// Test utility: reset in-memory state
export function __reset(): void {
  listings.clear();
  transactions.clear();
}

export async function listListings(
  filters?: {
    asset_type?: string;
    status?: string;
    min_price?: number;
    max_price?: number;
  },
  limit = 20,
  offset = 0
): Promise<{ items: MarketplaceListing[]; total: number }> {
  let items = Array.from(listings.values());

  if (filters?.asset_type) {
    items = items.filter(l => l.asset_type === filters.asset_type);
  }
  if (filters?.status) {
    items = items.filter(l => l.status === filters.status);
  }
  if (filters?.min_price !== undefined) {
    items = items.filter(l => l.price >= filters.min_price!);
  }
  if (filters?.max_price !== undefined) {
    items = items.filter(l => l.price <= filters.max_price!);
  }

  const total = items.length;
  return { items: items.slice(offset, offset + limit), total };
}

export async function getListing(listingId: string): Promise<MarketplaceListing | null> {
  return listings.get(listingId) || null;
}

export async function createListing(
  nodeId: string,
  assetId: string,
  assetType: AssetType,
  price: number,
  _prisma: PrismaClient
): Promise<MarketplaceListing> {
  const listing: MarketplaceListing = {
    listing_id: `ml_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    asset_id: assetId,
    asset_type: assetType,
    name: `Asset ${assetId}`,
    description: `Marketplace listing for ${assetType}`,
    price,
    seller_id: nodeId,
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  };
  listings.set(listing.listing_id, listing);
  return listing;
}

export async function updateListing(
  listingId: string,
  updates: Partial<MarketplaceListing>
): Promise<MarketplaceListing | null> {
  const existing = listings.get(listingId);
  if (!existing) return null;

  const updated = { ...existing, ...updates, updated_at: new Date() };
  listings.set(listingId, updated);
  return updated;
}

export async function purchaseListing(
  listingId: string,
  buyerId: string
): Promise<{ success: boolean; transaction_id: string }> {
  const listing = listings.get(listingId);
  if (!listing || listing.status !== 'active') {
    throw new Error('Listing not available');
  }

  listing.status = 'sold';
  listing.updated_at = new Date();
  listings.set(listingId, listing);

  const transaction: TransactionRecord = {
    transaction_id: `txn_${Date.now()}`,
    listing_id: listingId,
    buyer_id: buyerId,
    seller_id: listing.seller_id,
    amount: listing.price,
    status: 'completed',
    created_at: new Date(),
  };
  transactions.set(transaction.transaction_id, transaction);

  return {
    success: true,
    transaction_id: transaction.transaction_id,
  };
}

// Missing functions required by routes.ts

export async function getListings(
  type?: string,
  minPrice?: number,
  maxPrice?: number,
  sort: 'price_asc' | 'price_desc' | 'newest' = 'newest',
  limit = 20,
  offset = 0,
  _prisma?: PrismaClient
): Promise<{ items: MarketplaceListing[]; total: number }> {
  let items = Array.from(listings.values()).filter(l => l.status === 'active');

  if (type) {
    items = items.filter(l => l.asset_type === type);
  }
  if (minPrice !== undefined) {
    items = items.filter(l => l.price >= minPrice);
  }
  if (maxPrice !== undefined) {
    items = items.filter(l => l.price <= maxPrice);
  }

  // Sort
  if (sort === 'price_asc') {
    items.sort((a, b) => a.price - b.price);
  } else if (sort === 'price_desc') {
    items.sort((a, b) => b.price - a.price);
  } else {
    items.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  const total = items.length;
  return { items: items.slice(offset, offset + limit), total };
}

export async function buyListing(
  nodeId: string,
  listingId: string,
  _prisma: PrismaClient
): Promise<{ success: boolean; transaction_id: string; message: string }> {
  const listing = listings.get(listingId);
  if (!listing) {
    throw new Error('Listing not found');
  }
  if (listing.status !== 'active') {
    throw new Error('Listing is not active');
  }
  if (listing.seller_id === nodeId) {
    throw new Error('Cannot buy your own listing');
  }

  listing.status = 'sold';
  listing.updated_at = new Date();
  listings.set(listingId, listing);

  const transaction: TransactionRecord = {
    transaction_id: `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    listing_id: listingId,
    buyer_id: nodeId,
    seller_id: listing.seller_id,
    amount: listing.price,
    status: 'completed',
    created_at: new Date(),
  };
  transactions.set(transaction.transaction_id, transaction);

  return {
    success: true,
    transaction_id: transaction.transaction_id,
    message: 'Purchase successful',
  };
}

export async function cancelListing(
  nodeId: string,
  listingId: string,
  _prisma: PrismaClient
): Promise<MarketplaceListing> {
  const listing = listings.get(listingId);
  if (!listing) {
    throw new Error('Listing not found');
  }
  if (listing.seller_id !== nodeId) {
    throw new Error('Not authorized to cancel this listing');
  }

  listing.status = 'removed';
  listing.updated_at = new Date();
  listings.set(listingId, listing);
  return listing;
}

export async function getTransactionHistory(
  nodeId: string,
  limit = 20,
  offset = 0,
  _prisma?: PrismaClient
): Promise<{ items: TransactionRecord[]; total: number }> {
  const items = Array.from(transactions.values()).filter(
    t => t.buyer_id === nodeId || t.seller_id === nodeId
  ).sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

  const total = items.length;
  return { items: items.slice(offset, offset + limit), total };
}

export async function getTransaction(
  nodeId: string,
  transactionId: string,
  _prisma?: PrismaClient
): Promise<TransactionRecord | null> {
  const transaction = transactions.get(transactionId);
  if (!transaction) return null;
  if (transaction.buyer_id !== nodeId && transaction.seller_id !== nodeId) {
    return null;
  }
  return transaction;
}
