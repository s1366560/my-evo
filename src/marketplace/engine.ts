/**
 * Credit Marketplace Engine
 * Section 23: Asset trading, dynamic pricing, escrow, bounty bids
 */

import {
  MarketplaceListing,
  MarketplaceTransaction,
  Bid,
  Bounty,
  PriceQuote,
  EscrowState,
  PriceType,
  LicenseType,
  ListingStatus,
  TransactionStatus,
} from './types';
import { getAsset } from '../assets/store';

// In-memory stores (replace with DB in production)
const listings = new Map<string, MarketplaceListing>();
const transactions = new Map<string, MarketplaceTransaction>();
const bounties = new Map<string, Bounty>();
const bids = new Map<string, Bid>();
const escrow = new Map<string, EscrowState>();

// Credit balances (node_id -> credits)
const creditBalances = new Map<string, number>();

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Credit Management ───────────────────────────────────────────────────────

export function getCreditBalance(nodeId: string): number {
  return creditBalances.get(nodeId) ?? 0;
}

export function setCreditBalance(nodeId: string, balance: number): void {
  creditBalances.set(nodeId, Math.max(0, balance));
}

export function deductCredits(nodeId: string, amount: number): boolean {
  const current = getCreditBalance(nodeId);
  if (current < amount) return false;
  creditBalances.set(nodeId, current - amount);
  return true;
}

export function addCredits(nodeId: string, amount: number): void {
  const current = getCreditBalance(nodeId);
  creditBalances.set(nodeId, current + amount);
}

// ─── Dynamic Pricing (GDI-based) ─────────────────────────────────────────────

export function calculateDynamicPrice(assetId: string): PriceQuote {
  const asset = getAsset(assetId);

  if (!asset) {
    return {
      asset_id: assetId,
      suggested_price: 50,
      gdi_factor: 1.0,
      demand_factor: 1.0,
      scarcity_factor: 1.0,
      price_tier: 'budget',
    };
  }

  // GDI factor: normalize GDI to 0.5-2.0 range
  const gdi = (asset as any).gdi ?? 60;
  const gdiFactor = Math.max(0.5, Math.min(2.0, gdi / 60));

  // Demand factor: based on fetch_count (simulated)
  const fetchCount = (asset as any).fetch_count ?? 0;
  const demandFactor = Math.log(1 + fetchCount) + 1;

  // Scarcity factor: 1.0 default (simplified — real impl would check similar assets)
  const scarcityFactor = 1.0;

  // Base price ranges by type
  const basePrices: Record<string, number> = {
    Capsule: 200,
    Gene: 100,
    Recipe: 300,
  };
  const base = basePrices[(asset as any).type] ?? 100;

  const suggested_price = Math.round(base * gdiFactor * demandFactor * scarcityFactor);

  let price_tier: PriceQuote['price_tier'] = 'standard';
  if (suggested_price >= 2000) price_tier = 'elite';
  else if (suggested_price >= 500) price_tier = 'premium';
  else if (suggested_price < 100) price_tier = 'budget';

  return {
    asset_id: assetId,
    suggested_price,
    gdi_factor: Math.round(gdiFactor * 100) / 100,
    demand_factor: Math.round(demandFactor * 100) / 100,
    scarcity_factor: Math.round(scarcityFactor * 100) / 100,
    price_tier,
  };
}

// ─── Listing Management ──────────────────────────────────────────────────────

export function createListing(params: {
  asset_id: string;
  asset_type: 'Capsule' | 'Gene' | 'Recipe';
  seller_id: string;
  price_type: PriceType;
  price: number;
  rental_period_days?: number;
  license: LicenseType;
}): MarketplaceListing | null {
  const { asset_id, asset_type, seller_id, price_type, price, rental_period_days, license } = params;

  // Check asset exists
  const asset = getAsset(asset_id);
  if (!asset) return null;

  // Check seller owns the asset
  const ownerId = (asset as any).owner_id ?? (asset as any).node_id;
  if (ownerId !== seller_id) return null;

  // Platform fee for listing
  const platformFee = 5;
  if (!deductCredits(seller_id, platformFee)) return null;

  const listing_id = generateId('list');
  const now = new Date().toISOString();

  const listing: MarketplaceListing = {
    listing_id,
    asset_id,
    asset_type,
    seller_id,
    price_type,
    price,
    rental_period_days,
    license,
    status: 'active',
    created_at: now,
    view_count: 0,
  };

  listings.set(listing_id, listing);
  return listing;
}

export function getListing(listingId: string): MarketplaceListing | undefined {
  return listings.get(listingId);
}

export function listActiveListings(filters?: {
  asset_type?: string;
  min_price?: number;
  max_price?: number;
  seller_id?: string;
}): MarketplaceListing[] {
  let result = Array.from(listings.values()).filter(l => l.status === 'active');

  if (filters?.asset_type) {
    result = result.filter(l => l.asset_type === filters.asset_type);
  }
  if (filters?.min_price !== undefined) {
    result = result.filter(l => l.price >= filters.min_price!);
  }
  if (filters?.max_price !== undefined) {
    result = result.filter(l => l.price <= filters.max_price!);
  }
  if (filters?.seller_id) {
    result = result.filter(l => l.seller_id === filters.seller_id);
  }

  return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function cancelListing(listingId: string, sellerId: string): boolean {
  const listing = listings.get(listingId);
  if (!listing || listing.seller_id !== sellerId || listing.status !== 'active') {
    return false;
  }
  listing.status = 'cancelled';
  return true;
}

// ─── Purchase / Escrow ───────────────────────────────────────────────────────

export function initiatePurchase(listingId: string, buyerId: string): EscrowState | null {
  const listing = listings.get(listingId);
  if (!listing || listing.status !== 'active') return null;
  if (listing.seller_id === buyerId) return null;

  // Lock buyer credits
  if (!deductCredits(buyerId, listing.price)) return null;

  const escrowId = generateId('escrow');
  const escrowState: EscrowState = {
    escrow_id: escrowId,
    listing_id: listingId,
    amount: listing.price,
    buyer_id: buyerId,
    status: 'locked',
    created_at: new Date().toISOString(),
  };
  escrow.set(escrowId, escrowState);
  return escrowState;
}

export function completePurchase(escrowId: string): MarketplaceTransaction | null {
  const esc = escrow.get(escrowId);
  if (!esc || esc.status !== 'locked') return null;

  const listing = listings.get(esc.listing_id);
  if (!listing) return null;

  // Release funds to seller (minus platform fee 5%)
  const platformFee = Math.round(esc.amount * 0.05);
  const sellerAmount = esc.amount - platformFee;
  addCredits(listing.seller_id, sellerAmount);

  // Mark escrow released
  esc.status = 'released';

  // Update listing status
  listing.status = 'sold';

  // Record transaction
  const txId = generateId('tx');
  const now = new Date().toISOString();
  const tx: MarketplaceTransaction = {
    transaction_id: txId,
    listing_id: esc.listing_id,
    buyer_id: esc.buyer_id,
    seller_id: listing.seller_id,
    asset_id: listing.asset_id,
    price_paid: esc.amount,
    license_type: listing.license,
    status: 'completed',
    created_at: esc.created_at,
    completed_at: now,
  };
  transactions.set(txId, tx);

  return tx;
}

export function refundPurchase(escrowId: string): boolean {
  const esc = escrow.get(escrowId);
  if (!esc || esc.status !== 'locked') return false;

  // Refund buyer
  addCredits(esc.buyer_id, esc.amount);
  esc.status = 'refunded';

  // Update listing back to active
  const listing = listings.get(esc.listing_id);
  if (listing) {
    listing.status = 'active';
  }
  return true;
}

// ─── Bounty System ────────────────────────────────────────────────────────────

export function createBounty(params: {
  creator_id: string;
  title: string;
  description: string;
  budget: number;
  deadline: string;
  required_skills?: string[];
}): Bounty | null {
  const { creator_id, title, description, budget, deadline, required_skills = [] } = params;

  // Reserve budget credits
  if (!deductCredits(creator_id, budget)) return null;

  const bounty_id = generateId('bty');
  const bounty: Bounty = {
    bounty_id,
    creator_id,
    title,
    description,
    budget,
    deadline,
    required_skills,
    status: 'open',
    created_at: new Date().toISOString(),
  };
  bounties.set(bounty_id, bounty);
  return bounty;
}

export function getBounty(bountyId: string): Bounty | undefined {
  return bounties.get(bountyId);
}

export function listBounties(filters?: {
  status?: Bounty['status'];
  creator_id?: string;
}): Bounty[] {
  let result = Array.from(bounties.values());
  if (filters?.status) {
    result = result.filter(b => b.status === filters.status);
  }
  if (filters?.creator_id) {
    result = result.filter(b => b.creator_id === filters.creator_id);
  }
  return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function submitBid(params: {
  bounty_id: string;
  node_id: string;
  approach: string;
  genes: string[];
  estimated_days: number;
  bid_amount: number;
  milestones: { phase: string; payment: number; deliverable: string }[];
}): Bid | null {
  const bounty = bounties.get(params.bounty_id);
  if (!bounty || bounty.status !== 'open') return null;

  const bid_id = generateId('bid');
  const bid: Bid = {
    bid_id,
    bounty_id: params.bounty_id,
    node_id: params.node_id,
    proposed_solution: {
      approach: params.approach,
      genes: params.genes,
      estimated_days: params.estimated_days,
    },
    bid_amount: params.bid_amount,
    milestones: params.milestones,
    reputation_escrow: Math.round(params.bid_amount * 0.1),
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  bids.set(bid_id, bid);
  return bid;
}

export function getBidsForBounty(bountyId: string): Bid[] {
  return Array.from(bids.values()).filter(b => b.bounty_id === bountyId);
}

export function acceptBid(bidId: string, creatorId: string): boolean {
  const bid = bids.get(bidId);
  if (!bid) return false;

  const bounty = bounties.get(bid.bounty_id);
  if (!bounty || bounty.creator_id !== creatorId || bounty.status !== 'open') {
    return false;
  }

  bid.status = 'accepted';
  bounty.status = 'in_progress';
  bounty.winning_bid_id = bidId;
  return true;
}

export function rejectBid(bidId: string): boolean {
  const bid = bids.get(bidId);
  if (!bid || bid.status !== 'pending') return false;
  bid.status = 'rejected';
  return true;
}

// ─── Transaction History ─────────────────────────────────────────────────────

export function getTransactionHistory(nodeId: string): MarketplaceTransaction[] {
  return Array.from(transactions.values())
    .filter(tx => tx.buyer_id === nodeId || tx.seller_id === nodeId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ─── Market Stats ─────────────────────────────────────────────────────────────

export function getMarketStats(): {
  total_listings: number;
  total_transactions: number;
  total_volume: number;
  active_bounties: number;
} {
  const activeListings = Array.from(listings.values()).filter(l => l.status === 'active');
  const totalVolume = Array.from(transactions.values())
    .filter(tx => tx.status === 'completed')
    .reduce((sum, tx) => sum + tx.price_paid, 0);
  const activeBounties = Array.from(bounties.values()).filter(b => b.status === 'open');

  return {
    total_listings: activeListings.length,
    total_transactions: transactions.size,
    total_volume: totalVolume,
    active_bounties: activeBounties.length,
  };
}
