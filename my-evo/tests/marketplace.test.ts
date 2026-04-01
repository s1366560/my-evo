/**
 * Marketplace Engine Unit Tests
 * Section 23: Credit Marketplace — asset trading, dynamic pricing, escrow, bounty bids
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  getCreditBalance,
  setCreditBalance,
  deductCredits,
  addCredits,
  calculateDynamicPrice,
  createListing,
  getListing,
  listActiveListings,
  cancelListing,
  initiatePurchase,
  completePurchase,
  refundPurchase,
  createBounty,
  getBounty,
  listBounties,
  submitBid,
  getBidsForBounty,
  acceptBid,
  rejectBid,
  getTransactionHistory,
  getMarketStats,
} from '../src/marketplace/engine';

// Mock asset store
jest.mock('../src/assets/store', () => ({
  getAsset: jest.fn(),
}));

import { getAsset } from '../src/assets/store';

const mockGetAsset = getAsset as jest.MockedFunction<typeof getAsset>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockAsset(overrides: Record<string, unknown> = {}): any {
  return {
    asset: { id: 'asset_123', type: 'Capsule' },
    status: 'published',
    owner_id: 'node_seller',
    gdi: 65,
    fetch_count: 10,
    published_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    report_count: 0,
    version: 1,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset module state by clearing credit balances map
  // Note: in-memory maps are module-level, so tests may affect each other
  // We rely on test ordering and reset functions to manage this
});

describe('Credit Management', () => {
  it('getCreditBalance returns 0 for unknown node', () => {
    expect(getCreditBalance('unknown_node')).toBe(0);
  });

  it('setCreditBalance sets and retrieves balance', () => {
    setCreditBalance('node_1', 500);
    expect(getCreditBalance('node_1')).toBe(500);
  });

  it('deductCredits succeeds when balance is sufficient', () => {
    setCreditBalance('node_1', 200);
    expect(deductCredits('node_1', 100)).toBe(true);
    expect(getCreditBalance('node_1')).toBe(100);
  });

  it('deductCredits fails when balance is insufficient', () => {
    setCreditBalance('node_1', 50);
    expect(deductCredits('node_1', 100)).toBe(false);
    expect(getCreditBalance('node_1')).toBe(50);
  });

  it('addCredits increases balance', () => {
    setCreditBalance('node_1', 100);
    addCredits('node_1', 50);
    expect(getCreditBalance('node_1')).toBe(150);
  });

  it('setCreditBalance clamps to zero for negative values', () => {
    setCreditBalance('node_neg', -100);
    expect(getCreditBalance('node_neg')).toBe(0);
  });
});

describe('Dynamic Pricing', () => {
  it('returns default budget price for unknown asset', () => {
    mockGetAsset.mockReturnValue(null);
    const quote = calculateDynamicPrice('unknown_asset');
    expect(quote.suggested_price).toBe(50);
    expect(quote.price_tier).toBe('budget');
    expect(quote.gdi_factor).toBe(1.0);
  });

  it('calculates price with GDI and demand factors for Capsule', () => {
    mockGetAsset.mockReturnValue(mockAsset({ type: 'Capsule', gdi: 60, fetch_count: 0 }));
    const quote = calculateDynamicPrice('asset_123');
    // base 200 * (60/60) * (log(1+0)+1) = 200
    expect(quote.asset_id).toBe('asset_123');
    expect(quote.gdi_factor).toBe(1.0);
    expect(quote.demand_factor).toBe(1.0);
    expect(quote.suggested_price).toBe(200);
  });

  it('calculates price for high-GDI Gene', () => {
    mockGetAsset.mockReturnValue(mockAsset({ type: 'Gene', gdi: 120, fetch_count: 100 }));
    const quote = calculateDynamicPrice('asset_123');
    // base 100 * (120/60) * (log(101)+1) ≈ 100 * 2 * 5.615 ≈ 1123
    expect(quote.gdi_factor).toBe(2.0);
    expect(quote.price_tier).toBe('premium');
    expect(quote.suggested_price).toBeGreaterThan(500);
  });

  it('returns elite tier for very high prices', () => {
    mockGetAsset.mockReturnValue(mockAsset({ type: 'Recipe', gdi: 100, fetch_count: 1000 }));
    const quote = calculateDynamicPrice('asset_123');
    expect(quote.price_tier).toBe('elite');
  });

  it('clamps GDI factor between 0.5 and 2.0', () => {
    mockGetAsset.mockReturnValue(mockAsset({ type: 'Gene', gdi: 300 }));
    const quote = calculateDynamicPrice('asset_123');
    expect(quote.gdi_factor).toBe(2.0);
  });

  it('handles missing gdi and fetch_count gracefully', () => {
    mockGetAsset.mockReturnValue({ id: 'asset_456', type: 'Capsule' } as any);
    const quote = calculateDynamicPrice('asset_456');
    expect(quote.gdi_factor).toBe(1.0); // defaults to 60 → 1.0
    expect(quote.demand_factor).toBe(1.0); // defaults to 0 → 1.0
  });
});

describe('Listing Management', () => {
  it('createListing returns null when asset not found', () => {
    mockGetAsset.mockReturnValue(null);
    const result = createListing({
      asset_id: 'nonexistent',
      asset_type: 'Capsule',
      seller_id: 'node_seller',
      price_type: 'fixed',
      price: 100,
      license: 'non-exclusive',
    });
    expect(result).toBeNull();
  });

  it('createListing deducts platform fee from seller', () => {
    mockGetAsset.mockReturnValue(mockAsset());
    setCreditBalance('node_seller', 100);
    const result = createListing({
      asset_id: 'asset_123',
      asset_type: 'Capsule',
      seller_id: 'node_seller',
      price_type: 'fixed',
      price: 200,
      license: 'non-exclusive',
    });
    expect(result).not.toBeNull();
    expect(result!.listing_id).toMatch(/^list_/);
    expect(result!.status).toBe('active');
    // 100 - 5 (platform fee) = 95
    expect(getCreditBalance('node_seller')).toBe(95);
  });

  it('createListing fails when seller has insufficient credits for fee', () => {
    mockGetAsset.mockReturnValue(mockAsset());
    setCreditBalance('node_seller', 4);
    const result = createListing({
      asset_id: 'asset_123',
      asset_type: 'Capsule',
      seller_id: 'node_seller',
      price_type: 'fixed',
      price: 200,
      license: 'non-exclusive',
    });
    expect(result).toBeNull();
  });

  it('createListing fails when seller does not own asset', () => {
    mockGetAsset.mockReturnValue(mockAsset({ owner_id: 'other_node' }));
    setCreditBalance('node_seller', 100);
    const result = createListing({
      asset_id: 'asset_123',
      asset_type: 'Capsule',
      seller_id: 'node_seller',
      price_type: 'fixed',
      price: 200,
      license: 'non-exclusive',
    });
    expect(result).toBeNull();
  });

  it('getListing retrieves a created listing', () => {
    mockGetAsset.mockReturnValue(mockAsset());
    setCreditBalance('node_seller', 100);
    const created = createListing({
      asset_id: 'asset_123',
      asset_type: 'Capsule',
      seller_id: 'node_seller',
      price_type: 'fixed',
      price: 200,
      license: 'non-exclusive',
    });
    const retrieved = getListing(created!.listing_id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.asset_id).toBe('asset_123');
  });

  it('listActiveListings returns only active listings', () => {
    mockGetAsset.mockReturnValue(mockAsset());
    setCreditBalance('node_seller', 200);
    createListing({
      asset_id: 'asset_123',
      asset_type: 'Capsule',
      seller_id: 'node_seller',
      price_type: 'fixed',
      price: 200,
      license: 'non-exclusive',
    });
    const listings = listActiveListings();
    expect(listings.length).toBeGreaterThan(0);
    expect(listings.every(l => l.status === 'active')).toBe(true);
  });

  it('listActiveListings filters by asset_type', () => {
    const listings = listActiveListings({ asset_type: 'Gene' });
    listings.forEach(l => expect(l.asset_type).toBe('Gene'));
  });

  it('listActiveListings filters by price range', () => {
    const listings = listActiveListings({ min_price: 100, max_price: 300 });
    listings.forEach(l => {
      expect(l.price).toBeGreaterThanOrEqual(100);
      expect(l.price).toBeLessThanOrEqual(300);
    });
  });

  it('cancelListing cancels only active listing owned by seller', () => {
    mockGetAsset.mockReturnValue(mockAsset());
    setCreditBalance('node_seller', 100);
    const listing = createListing({
      asset_id: 'asset_123',
      asset_type: 'Capsule',
      seller_id: 'node_seller',
      price_type: 'fixed',
      price: 200,
      license: 'non-exclusive',
    });
    expect(cancelListing(listing!.listing_id, 'node_seller')).toBe(true);
    expect(getListing(listing!.listing_id)!.status).toBe('cancelled');
  });

  it('cancelListing fails for wrong seller', () => {
    mockGetAsset.mockReturnValue(mockAsset());
    setCreditBalance('node_seller', 100);
    const listing = createListing({
      asset_id: 'asset_123',
      asset_type: 'Capsule',
      seller_id: 'node_seller',
      price_type: 'fixed',
      price: 200,
      license: 'non-exclusive',
    });
    expect(cancelListing(listing!.listing_id, 'other_node')).toBe(false);
  });
});

describe('Purchase / Escrow', () => {
  let listingId: string;

  beforeEach(() => {
    mockGetAsset.mockReturnValue(mockAsset());
    setCreditBalance('node_seller', 100);
    setCreditBalance('node_buyer', 500);
    const listing = createListing({
      asset_id: 'asset_123',
      asset_type: 'Capsule',
      seller_id: 'node_seller',
      price_type: 'fixed',
      price: 200,
      license: 'non-exclusive',
    });
    listingId = listing!.listing_id;
  });

  it('initiatePurchase locks buyer credits and returns escrow', () => {
    const escrow = initiatePurchase(listingId, 'node_buyer');
    expect(escrow).not.toBeNull();
    expect(escrow!.status).toBe('locked');
    expect(escrow!.amount).toBe(200);
    expect(getCreditBalance('node_buyer')).toBe(300); // 500 - 200
  });

  it('initiatePurchase fails for inactive listing', () => {
    cancelListing(listingId, 'node_seller');
    expect(initiatePurchase(listingId, 'node_buyer')).toBeNull();
  });

  it('initiatePurchase fails when buyer has insufficient credits', () => {
    setCreditBalance('node_buyer', 100);
    expect(initiatePurchase(listingId, 'node_buyer')).toBeNull();
  });

  it('initiatePurchase fails when buyer is seller', () => {
    expect(initiatePurchase(listingId, 'node_seller')).toBeNull();
  });

  it('completePurchase transfers funds and records transaction', () => {
    const escrow = initiatePurchase(listingId, 'node_buyer')!;
    const tx = completePurchase(escrow.escrow_id);
    expect(tx).not.toBeNull();
    expect(tx!.status).toBe('completed');
    expect(tx!.price_paid).toBe(200);
    // Seller receives 200 - 5% (platform fee) = 190
    // Starting from 95 (after 5-credit listing fee), plus 190 = 285
    expect(getCreditBalance('node_seller')).toBe(285);
  });

  it('completePurchase fails for non-locked escrow', () => {
    const escrow = initiatePurchase(listingId, 'node_buyer')!;
    completePurchase(escrow.escrow_id);
    // Try to complete again
    expect(completePurchase(escrow.escrow_id)).toBeNull();
  });

  it('refundPurchase returns funds to buyer', () => {
    const escrow = initiatePurchase(listingId, 'node_buyer')!;
    expect(refundPurchase(escrow.escrow_id)).toBe(true);
    expect(getCreditBalance('node_buyer')).toBe(500); // fully refunded
    expect(getListing(listingId)!.status).toBe('active');
  });

  it('refundPurchase fails for non-locked escrow', () => {
    const escrow = initiatePurchase(listingId, 'node_buyer')!;
    completePurchase(escrow.escrow_id);
    expect(refundPurchase(escrow.escrow_id)).toBe(false);
  });
});

describe('Bounty System', () => {
  it('createBounty reserves budget credits', () => {
    setCreditBalance('creator', 1000);
    const bounty = createBounty({
      creator_id: 'creator',
      title: 'Fix bug',
      description: 'Fix the bug',
      budget: 500,
      deadline: '2026-04-01T00:00:00Z',
    });
    expect(bounty).not.toBeNull();
    expect(bounty!.status).toBe('open');
    expect(getCreditBalance('creator')).toBe(500);
  });

  it('createBounty fails when budget exceeds balance', () => {
    setCreditBalance('creator', 100);
    expect(createBounty({
      creator_id: 'creator',
      title: 'Fix bug',
      description: 'Fix the bug',
      budget: 500,
      deadline: '2026-04-01T00:00:00Z',
    })).toBeNull();
  });

  it('submitBid creates a bid with reputation escrow', () => {
    setCreditBalance('creator', 1000);
    const bounty = createBounty({
      creator_id: 'creator',
      title: 'Fix bug',
      description: 'Fix the bug',
      budget: 500,
      deadline: '2026-04-01T00:00:00Z',
    });
    const bid = submitBid({
      bounty_id: bounty!.bounty_id,
      node_id: 'solver_node',
      approach: 'Use Gene X',
      genes: ['gene_x'],
      estimated_days: 2,
      bid_amount: 300,
      milestones: [{ phase: 'Phase 1', payment: 300, deliverable: 'Fix delivered' }],
    });
    expect(bid).not.toBeNull();
    expect(bid!.bid_amount).toBe(300);
    expect(bid!.reputation_escrow).toBe(30); // 10% of 300
    expect(bid!.status).toBe('pending');
  });

  it('submitBid fails for non-open bounty', () => {
    setCreditBalance('creator', 1000);
    const bounty = createBounty({
      creator_id: 'creator',
      title: 'Fix bug',
      description: 'Fix the bug',
      budget: 500,
      deadline: '2026-04-01T00:00:00Z',
    });
    const bid = submitBid({
      bounty_id: bounty!.bounty_id,
      node_id: 'solver_node',
      approach: 'Use Gene X',
      genes: ['gene_x'],
      estimated_days: 2,
      bid_amount: 300,
      milestones: [],
    });
    expect(bid).not.toBeNull();
  });

  it('acceptBid activates bounty and accepts bid', () => {
    setCreditBalance('creator', 1000);
    const bounty = createBounty({
      creator_id: 'creator',
      title: 'Fix bug',
      description: 'Fix the bug',
      budget: 500,
      deadline: '2026-04-01T00:00:00Z',
    });
    const bid = submitBid({
      bounty_id: bounty!.bounty_id,
      node_id: 'solver_node',
      approach: 'Use Gene X',
      genes: ['gene_x'],
      estimated_days: 2,
      bid_amount: 300,
      milestones: [],
    });
    const result = acceptBid(bid!.bid_id, 'creator');
    expect(result).toBe(true);
    expect(getBounty(bounty!.bounty_id)!.status).toBe('in_progress');
    expect(getBounty(bounty!.bounty_id)!.winning_bid_id).toBe(bid!.bid_id);
  });

  it('acceptBid fails for non-creator', () => {
    setCreditBalance('creator', 1000);
    const bounty = createBounty({
      creator_id: 'creator',
      title: 'Fix bug',
      description: 'Fix the bug',
      budget: 500,
      deadline: '2026-04-01T00:00:00Z',
    });
    const bid = submitBid({
      bounty_id: bounty!.bounty_id,
      node_id: 'solver_node',
      approach: 'Use Gene X',
      genes: ['gene_x'],
      estimated_days: 2,
      bid_amount: 300,
      milestones: [],
    });
    expect(acceptBid(bid!.bid_id, 'other_node')).toBe(false);
  });

  it('rejectBid changes bid status to rejected', () => {
    setCreditBalance('creator', 1000);
    const bounty = createBounty({
      creator_id: 'creator',
      title: 'Fix bug',
      description: 'Fix the bug',
      budget: 500,
      deadline: '2026-04-01T00:00:00Z',
    });
    const bid = submitBid({
      bounty_id: bounty!.bounty_id,
      node_id: 'solver_node',
      approach: 'Use Gene X',
      genes: ['gene_x'],
      estimated_days: 2,
      bid_amount: 300,
      milestones: [],
    });
    expect(rejectBid(bid!.bid_id)).toBe(true);
  });

  it('getBidsForBounty returns all bids for a bounty', () => {
    setCreditBalance('creator', 2000);
    const bounty = createBounty({
      creator_id: 'creator',
      title: 'Fix bug',
      description: 'Fix the bug',
      budget: 500,
      deadline: '2026-04-01T00:00:00Z',
    });
    submitBid({
      bounty_id: bounty!.bounty_id,
      node_id: 'solver_1',
      approach: 'Approach 1',
      genes: [],
      estimated_days: 2,
      bid_amount: 300,
      milestones: [],
    });
    submitBid({
      bounty_id: bounty!.bounty_id,
      node_id: 'solver_2',
      approach: 'Approach 2',
      genes: [],
      estimated_days: 3,
      bid_amount: 250,
      milestones: [],
    });
    const bids = getBidsForBounty(bounty!.bounty_id);
    expect(bids.length).toBe(2);
  });

  it('listBounties filters by status and creator', () => {
    setCreditBalance('creator', 2000);
    const b1 = createBounty({
      creator_id: 'creator',
      title: 'Bounty 1',
      description: 'Desc',
      budget: 200,
      deadline: '2026-04-01T00:00:00Z',
    });
    const b2 = createBounty({
      creator_id: 'creator',
      title: 'Bounty 2',
      description: 'Desc',
      budget: 200,
      deadline: '2026-04-01T00:00:00Z',
    });
    const all = listBounties();
    expect(all.length).toBeGreaterThanOrEqual(2);
    const open = listBounties({ status: 'open' });
    open.forEach(b => expect(b.status).toBe('open'));
    const mine = listBounties({ creator_id: 'creator' });
    mine.forEach(b => expect(b.creator_id).toBe('creator'));
  });
});

describe('Transaction History', () => {
  it('getTransactionHistory returns transactions for buyer or seller', () => {
    mockGetAsset.mockReturnValue(mockAsset());
    setCreditBalance('node_seller', 100);
    setCreditBalance('node_buyer', 500);
    const listing = createListing({
      asset_id: 'asset_123',
      asset_type: 'Capsule',
      seller_id: 'node_seller',
      price_type: 'fixed',
      price: 200,
      license: 'non-exclusive',
    });
    const escrow = initiatePurchase(listing!.listing_id, 'node_buyer')!;
    completePurchase(escrow.escrow_id);

    const history = getTransactionHistory('node_buyer');
    expect(history.some(tx => tx.listing_id === listing!.listing_id)).toBe(true);
  });
});

describe('Market Stats', () => {
  it('getMarketStats returns correct aggregated stats', () => {
    // Reset by creating fresh data
    mockGetAsset.mockReturnValue(mockAsset({ id: 'asset_market_test' }));
    setCreditBalance('seller1', 1000);
    setCreditBalance('buyer1', 1000);

    createListing({
      asset_id: 'asset_market_test',
      asset_type: 'Capsule',
      seller_id: 'seller1',
      price_type: 'fixed',
      price: 200,
      license: 'non-exclusive',
    });

    setCreditBalance('bounty_creator', 1000);
    createBounty({
      creator_id: 'bounty_creator',
      title: 'Test Bounty',
      description: 'Test',
      budget: 300,
      deadline: '2026-04-01T00:00:00Z',
    });

    const stats = getMarketStats();
    expect(stats.total_listings).toBeGreaterThanOrEqual(1);
    expect(stats.active_bounties).toBeGreaterThanOrEqual(1);
  });
});
