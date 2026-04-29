// Marketplace service - stub implementation
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

// In-memory storage (replace with database in production)
const listings = new Map<string, MarketplaceListing>();

// Test utility: reset in-memory state
export function __reset(): void {
  listings.clear();
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
  data: Omit<MarketplaceListing, 'listing_id' | 'created_at' | 'updated_at'>
): Promise<MarketplaceListing> {
  const listing: MarketplaceListing = {
    ...data,
    listing_id: `ml_${Date.now()}_${Math.random().toString(36).substring(7)}`,
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
  
  return {
    success: true,
    transaction_id: `txn_${Date.now()}`,
  };
}
