/**
 * Credit Marketplace Engine
 * Section 21: Credit Trading Exchange
 * Users can buy and sell credits directly at market price
 */

import { randomUUID } from 'crypto';
import { creditBalances } from '../reputation/engine';
import { CreditBalance } from '../reputation/types';
import {
  CreditListing,
  CreditOrder,
  CreditExchangeStats,
  CreditListingStatus,
} from './credit_types';

// In-memory stores
const creditListings = new Map<string, CreditListing>();
const creditOrders = new Map<string, CreditOrder>();

// Default credit exchange settings
const CREDIT_EXCHANGE_FEE = 0.01; // 1% fee on all trades
const LISTING_EXPIRY_HOURS = 24;

function genId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

/** Get credit balance for a node */
export function getCreditBalanceForExchange(nodeId: string): { available: number; locked: number; total: number } {
  const balance = creditBalances.get(nodeId);
  const balanceValue = balance?.balance ?? 0;
  
  // Calculate locked amount in active listings
  let locked = 0;
  for (const listing of creditListings.values()) {
    if (listing.seller_id === nodeId && listing.status === 'active') {
      locked += listing.remaining_amount;
    }
  }
  
  return {
    available: balanceValue - locked,
    locked,
    total: balanceValue,
  };
}

/** Lock credits for a listing */
export function lockCreditsForListing(nodeId: string, amount: number): { success: boolean; error?: string } {
  const balance = creditBalances.get(nodeId);
  const balanceValue = balance?.balance ?? 0;
  
  // Calculate current locked
  let locked = 0;
  for (const listing of creditListings.values()) {
    if (listing.seller_id === nodeId && listing.status === 'active') {
      locked += listing.remaining_amount;
    }
  }
  
  const available = balanceValue - locked;
  
  if (available < amount) {
    return { success: false, error: `Insufficient credits. Available: ${available}, Required: ${amount}` };
  }
  
  return { success: true };
}

/** Create a credit listing (sell credits) */
export function createCreditListing(
  sellerId: string,
  pricePerCredit: number,
  amount: number,
  expiresInHours: number = LISTING_EXPIRY_HOURS
): { success: boolean; listing?: CreditListing; error?: string } {
  // Validate price
  if (pricePerCredit < 0.01 || pricePerCredit > 100) {
    return { success: false, error: 'Price per credit must be between 0.01 and 100' };
  }
  
  // Validate amount
  if (amount < 1 || amount > 10000) {
    return { success: false, error: 'Amount must be between 1 and 10000 credits' };
  }
  
  // Lock credits
  const lockResult = lockCreditsForListing(sellerId, amount);
  if (!lockResult.success) {
    return { success: false, error: lockResult.error };
  }
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);
  
  const listing: CreditListing = {
    listing_id: genId('cl'),
    seller_id: sellerId,
    price_per_credit: pricePerCredit,
    amount,
    remaining_amount: amount,
    status: 'active',
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };
  
  creditListings.set(listing.listing_id, listing);
  
  return { success: true, listing };
}

/** List all active credit listings */
export function listCreditListings(limit: number = 50, offset: number = 0): {
  listings: CreditListing[];
  total: number;
} {
  const now = new Date();
  const active = Array.from(creditListings.values())
    .filter(l => l.status === 'active' && new Date(l.expires_at) > now)
    .sort((a, b) => b.price_per_credit - a.price_per_credit);
  
  return {
    listings: active.slice(offset, offset + limit),
    total: active.length,
  };
}

/** Buy credits from a listing */
export function buyCredits(
  buyerId: string,
  listingId: string,
  amount: number
): { success: boolean; order?: CreditOrder; error?: string } {
  const listing = creditListings.get(listingId);
  if (!listing) {
    return { success: false, error: 'Listing not found' };
  }
  
  if (listing.status !== 'active') {
    return { success: false, error: 'Listing is not active' };
  }
  
  if (new Date(listing.expires_at) < new Date()) {
    listing.status = 'expired';
    return { success: false, error: 'Listing has expired' };
  }
  
  if (listing.remaining_amount < amount) {
    return { success: false, error: `Not enough credits. Available: ${listing.remaining_amount}` };
  }
  
  if (listing.seller_id === buyerId) {
    return { success: false, error: 'Cannot buy your own listing' };
  }
  
  const totalCost = amount * listing.price_per_credit;
  const fee = totalCost * CREDIT_EXCHANGE_FEE;
  const totalWithFee = totalCost + fee;
  
  // Check buyer has enough credits
  const buyerBalance = creditBalances.get(buyerId);
  const buyerAvailable = (buyerBalance?.balance ?? 0);
  
  if (buyerAvailable < totalWithFee) {
    return { success: false, error: `Insufficient credits. Need: ${totalWithFee}, Available: ${buyerAvailable}` };
  }
  
  // Execute the trade - deduct from buyer
  if (buyerBalance) {
    buyerBalance.balance -= totalWithFee;
  }
  
  // Add to seller (minus fee)
  const sellerProceeds = totalCost - fee;
  const sellerBalance = creditBalances.get(listing.seller_id);
  if (sellerBalance) {
    sellerBalance.balance += sellerProceeds;
  } else {
    creditBalances.set(listing.seller_id, {
      node_id: listing.seller_id,
      balance: sellerProceeds,
      last_updated: new Date().toISOString(),
      transactions: [],
    });
  }
  
  // Update listing
  listing.remaining_amount -= amount;
  if (listing.remaining_amount <= 0) {
    listing.status = 'filled';
  }
  
  // Create order
  const now = new Date();
  const order: CreditOrder = {
    order_id: genId('co'),
    listing_id: listingId,
    buyer_id: buyerId,
    amount,
    price_per_credit: listing.price_per_credit,
    status: 'completed',
    created_at: now.toISOString(),
    completed_at: now.toISOString(),
  };
  
  creditOrders.set(order.order_id, order);
  
  return { success: true, order };
}

/** Cancel a credit listing */
export function cancelCreditListing(
  listingId: string,
  nodeId: string
): { success: boolean; error?: string } {
  const listing = creditListings.get(listingId);
  if (!listing) {
    return { success: false, error: 'Listing not found' };
  }
  
  if (listing.seller_id !== nodeId) {
    return { success: false, error: 'Not authorized' };
  }
  
  if (listing.status !== 'active') {
    return { success: false, error: 'Listing is not active' };
  }
  
  // Return locked credits to seller balance
  const sellerBalance = creditBalances.get(listing.seller_id);
  if (sellerBalance) {
    sellerBalance.balance += listing.remaining_amount;
  }
  
  listing.status = 'cancelled';
  
  return { success: true };
}

/** Get exchange statistics */
export function getCreditExchangeStats(): CreditExchangeStats {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Calculate 24h volume
  let totalVolume24h = 0;
  let high24h = 0;
  let low24h = Infinity;
  
  for (const order of creditOrders.values()) {
    if (order.status === 'completed' && new Date(order.created_at) >= oneDayAgo) {
      const volume = order.amount * order.price_per_credit;
      totalVolume24h += volume;
      
      if (order.price_per_credit > high24h) high24h = order.price_per_credit;
      if (order.price_per_credit < low24h) low24h = order.price_per_credit;
    }
  }
  
  // Active listings count
  const activeListings = Array.from(creditListings.values())
    .filter(l => l.status === 'active' && new Date(l.expires_at) > now).length;
  
  // Last price (most recent completed order)
  let lastPrice = 1.0; // Default price
  let mostRecentTime = new Date(0);
  for (const order of creditOrders.values()) {
    if (order.status === 'completed' && order.completed_at && new Date(order.completed_at) > mostRecentTime) {
      lastPrice = order.price_per_credit;
      mostRecentTime = new Date(order.completed_at);
    }
  }
  
  // Calculate price change (compare to price 24h ago)
  let oldPrice = lastPrice;
  let oldMostRecent = new Date(0);
  for (const order of creditOrders.values()) {
    const orderTime = new Date(order.created_at);
    if (order.status === 'completed' && orderTime < oneDayAgo && orderTime > oldMostRecent) {
      oldPrice = order.price_per_credit;
      oldMostRecent = orderTime;
    }
  }
  
  const priceChange24h = oldPrice > 0 ? ((lastPrice - oldPrice) / oldPrice) * 100 : 0;
  
  if (low24h === Infinity) low24h = lastPrice;
  
  return {
    total_volume_24h: Math.round(totalVolume24h),
    active_listings: activeListings,
    last_price: lastPrice,
    price_change_24h: Math.round(priceChange24h * 100) / 100,
    high_24h: high24h || lastPrice,
    low_24h: low24h === Infinity ? lastPrice : low24h,
  };
}

/** Get transaction history for a node */
export function getCreditTransactionHistory(
  nodeId: string,
  limit: number = 20
): { orders: CreditOrder[]; total: number } {
  const nodeOrders = Array.from(creditOrders.values())
    .filter(o => o.buyer_id === nodeId || creditListings.get(o.listing_id)?.seller_id === nodeId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  return {
    orders: nodeOrders.slice(0, limit),
    total: nodeOrders.length,
  };
}
