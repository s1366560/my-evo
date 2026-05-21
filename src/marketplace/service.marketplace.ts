// Marketplace service module - full implementation for service marketplace operations
import type { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export interface ServiceListing {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price_type: 'free' | 'per_use' | 'subscription' | 'one_time' | 'fixed' | 'auction' | 'rental';
  price_credits: number;
  license_type: 'open_source' | 'proprietary' | 'custom' | 'exclusive' | 'non-exclusive';
  status: 'active' | 'paused' | 'archived' | 'cancelled' | 'sold' | 'expired';
  created_at: string;
  updated_at: string;
}

export interface ServicePurchase {
  purchase_id: string;
  transaction_id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  price_paid: number;
  escrow: number;
  status: 'pending' | 'completed' | 'disputed' | 'refunded';
  created_at: string;
}

export interface MarketplaceTransaction {
  transaction_id: string;
  purchase_id?: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  price_paid?: number;
  escrow?: number;
  status: 'pending' | 'completed' | 'disputed' | 'refunded';
  created_at: string;
}

export interface MarketStats {
  total_listings: number;
  total_purchases: number;
  total_volume: number;
  categories: Record<string, number>;
}

// In-memory storage
const serviceListings = new Map<string, ServiceListing>();
const servicePurchases = new Map<string, ServicePurchase>();
const marketplaceTransactions = new Map<string, MarketplaceTransaction>();

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

export function __resetTestState(): void {
  serviceListings.clear();
  servicePurchases.clear();
  marketplaceTransactions.clear();
}

export interface SearchServiceListingsParams {
  query?: string;
  category?: string;
  include_inactive?: boolean;
  limit?: number;
  offset?: number;
}

export async function searchServiceListings(
  params: SearchServiceListingsParams,
  _prisma: PrismaClient
): Promise<{ items: ServiceListing[]; total: number }> {
  let items = Array.from(serviceListings.values());

  // Filter by status
  if (!params.include_inactive) {
    items = items.filter(l => l.status === 'active');
  }

  // Filter by category
  if (params.category) {
    items = items.filter(l => l.category === params.category);
  }

  // Filter by search query
  if (params.query) {
    const q = params.query.toLowerCase();
    items = items.filter(l =>
      l.title.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q) ||
      l.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  const total = items.length;
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;

  return {
    items: items.slice(offset, offset + limit),
    total,
  };
}

export async function createServiceListing(
  sellerId: string,
  params: {
    title: string;
    description: string;
    category: string;
    tags?: string[];
    price_type: 'free' | 'per_use' | 'subscription' | 'one_time' | 'fixed' | 'auction' | 'rental';
    price_credits?: number;
    license_type: 'open_source' | 'proprietary' | 'custom' | 'exclusive' | 'non-exclusive';
  },
  _prisma: PrismaClient
): Promise<ServiceListing> {
  const listing: ServiceListing = {
    id: generateId('svc'),
    seller_id: sellerId,
    title: params.title,
    description: params.description,
    category: params.category,
    tags: params.tags ?? [],
    price_type: params.price_type,
    price_credits: params.price_credits ?? 0,
    license_type: params.license_type,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  serviceListings.set(listing.id, listing);
  return listing;
}

export async function getServiceListing(
  listingId: string,
  _prisma: PrismaClient
): Promise<ServiceListing | null> {
  return serviceListings.get(listingId) ?? null;
}

export async function updateServiceListing(
  sellerId: string,
  listingId: string,
  updates: Partial<{
    title: string;
    description: string;
    category: string;
    tags: string[];
    price_type: 'free' | 'per_use' | 'subscription' | 'one_time' | 'fixed' | 'auction' | 'rental';
    price_credits: number;
    license_type: 'open_source' | 'proprietary' | 'custom' | 'exclusive' | 'non-exclusive';
    status: 'active' | 'paused' | 'archived' | 'cancelled' | 'sold' | 'expired';
  }>,
  _prisma: PrismaClient
): Promise<ServiceListing | null> {
  const listing = serviceListings.get(listingId);
  if (!listing) return null;
  if (listing.seller_id !== sellerId) return null;

  const updated: ServiceListing = {
    ...listing,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  serviceListings.set(listingId, updated);
  return updated;
}

export async function cancelServiceListing(
  sellerId: string,
  listingId: string,
  _prisma: PrismaClient
): Promise<ServiceListing | null> {
  const listing = serviceListings.get(listingId);
  if (!listing) return null;
  if (listing.seller_id !== sellerId) return null;

  const updated: ServiceListing = {
    ...listing,
    status: 'cancelled',
    updated_at: new Date().toISOString(),
  };

  serviceListings.set(listingId, updated);
  return updated;
}

export async function purchaseService(
  buyerId: string,
  listingId: string,
  _prisma: PrismaClient
): Promise<ServicePurchase & { listing_id: string; transaction_id: string }> {
  const listing = serviceListings.get(listingId);
  if (!listing) {
    throw new Error('Listing not found');
  }
  if (listing.status !== 'active') {
    throw new Error('Listing is not available');
  }
  if (listing.seller_id === buyerId) {
    throw new Error('Cannot purchase your own listing');
  }

  const purchaseId = generateId('pur');
  const transactionId = generateId('txn');

  const purchase: ServicePurchase = {
    purchase_id: purchaseId,
    transaction_id: transactionId,
    listing_id: listingId,
    buyer_id: buyerId,
    seller_id: listing.seller_id,
    amount: listing.price_credits,
    price_paid: listing.price_credits,
    escrow: listing.price_credits,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  servicePurchases.set(purchaseId, purchase);

  // Create marketplace transaction
  const transaction: MarketplaceTransaction = {
    transaction_id: transactionId,
    purchase_id: purchaseId,
    listing_id: listingId,
    buyer_id: buyerId,
    seller_id: listing.seller_id,
    amount: listing.price_credits,
    price_paid: listing.price_credits,
    escrow: listing.price_credits,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  marketplaceTransactions.set(transactionId, transaction);

  return {
    ...purchase,
    listing_id: listingId,
    transaction_id: transactionId,
  };
}

export async function getMyPurchases(
  buyerId: string,
  limit = 20,
  offset = 0,
  _prisma?: PrismaClient
): Promise<{ items: ServicePurchase[]; total: number }> {
  const items = Array.from(servicePurchases.values())
    .filter(p => p.buyer_id === buyerId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const total = items.length;
  return {
    items: items.slice(offset, offset + limit),
    total,
  };
}

export async function confirmPurchase(
  buyerId: string,
  purchaseId: string,
  _prisma: PrismaClient
): Promise<MarketplaceTransaction> {
  const purchase = servicePurchases.get(purchaseId);
  if (!purchase) {
    throw new Error('Purchase not found');
  }
  if (purchase.buyer_id !== buyerId) {
    throw new Error('Not authorized');
  }

  // Update purchase status
  purchase.status = 'completed';
  servicePurchases.set(purchaseId, purchase);

  // Update transaction status
  const transaction = marketplaceTransactions.get(purchase.transaction_id);
  if (transaction) {
    transaction.status = 'completed';
    marketplaceTransactions.set(transaction.transaction_id, transaction);
    return transaction;
  }

  // Return purchase as transaction if no transaction found
  return {
    transaction_id: purchase.transaction_id,
    purchase_id: purchase.purchase_id,
    listing_id: purchase.listing_id,
    buyer_id: purchase.buyer_id,
    seller_id: purchase.seller_id,
    amount: purchase.amount,
    price_paid: purchase.price_paid,
    escrow: 0,
    status: 'completed',
    created_at: purchase.created_at,
  };
}

export async function disputePurchase(
  buyerId: string,
  purchaseId: string,
  reason: string,
  _prisma: PrismaClient
): Promise<MarketplaceTransaction> {
  const purchase = servicePurchases.get(purchaseId);
  if (!purchase) {
    throw new Error('Purchase not found');
  }
  if (purchase.buyer_id !== buyerId) {
    throw new Error('Not authorized');
  }

  // Update purchase status
  purchase.status = 'disputed';
  servicePurchases.set(purchaseId, purchase);

  // Update transaction status
  const transaction = marketplaceTransactions.get(purchase.transaction_id);
  if (transaction) {
    transaction.status = 'disputed';
    marketplaceTransactions.set(transaction.transaction_id, transaction);
    return {
      ...transaction,
    };
  }

  // Return purchase as transaction if no transaction found
  return {
    transaction_id: purchase.transaction_id,
    purchase_id: purchase.purchase_id,
    listing_id: purchase.listing_id,
    buyer_id: purchase.buyer_id,
    seller_id: purchase.seller_id,
    amount: purchase.amount,
    price_paid: purchase.price_paid,
    escrow: purchase.escrow,
    status: 'disputed',
    created_at: purchase.created_at,
  };
}

export async function getTransactionHistory(
  nodeId: string,
  limit = 20,
  offset = 0,
  _prisma?: PrismaClient
): Promise<{ items: MarketplaceTransaction[]; total: number }> {
  const items = Array.from(marketplaceTransactions.values())
    .filter(t => t.buyer_id === nodeId || t.seller_id === nodeId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const total = items.length;
  return {
    items: items.slice(offset, offset + limit),
    total,
  };
}

export async function getTransaction(
  nodeId: string,
  transactionId: string,
  _prisma?: PrismaClient
): Promise<MarketplaceTransaction | null> {
  const transaction = marketplaceTransactions.get(transactionId);
  if (!transaction) return null;
  if (transaction.buyer_id !== nodeId && transaction.seller_id !== nodeId) {
    return null;
  }
  return transaction;
}

export async function getMarketStats(
  _prisma: PrismaClient
): Promise<MarketStats> {
  const listings = Array.from(serviceListings.values());
  const purchases = Array.from(servicePurchases.values());

  const categories: Record<string, number> = {};
  for (const listing of listings) {
    categories[listing.category] = (categories[listing.category] ?? 0) + 1;
  }

  const totalVolume = purchases.reduce((sum, p) => sum + (p.price_paid ?? 0), 0);

  return {
    total_listings: listings.length,
    total_purchases: purchases.length,
    total_volume: totalVolume,
    categories,
  };
}

export async function getBalance(
  nodeId: string,
  _prisma: PrismaClient
): Promise<{ available: number; escrow: number; total: number }> {
  // Simulate balance calculation
  // In production, this would query the database for actual balances
  const purchases = Array.from(servicePurchases.values()).filter(p => p.buyer_id === nodeId);
  const sales = Array.from(servicePurchases.values()).filter(p => p.seller_id === nodeId);

  const spent = purchases.reduce((sum, p) => sum + (p.price_paid ?? 0), 0);
  const earned = sales.reduce((sum, p) => sum + (p.price_paid ?? 0), 0);
  const inEscrow = sales
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + (p.escrow ?? 0), 0);

  return {
    available: Math.max(0, earned - spent - inEscrow),
    escrow: inEscrow,
    total: earned - spent,
  };
}
