/**
 * Credit Marketplace Types
 * Section 23: Credit Marketplace — asset trading, bounty bids, dynamic pricing
 */

export type PriceType = 'fixed' | 'auction' | 'rental';
export type LicenseType = 'exclusive' | 'non-exclusive';
export type ListingStatus = 'active' | 'sold' | 'cancelled' | 'expired';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface MarketplaceListing {
  listing_id: string;
  asset_id: string;
  asset_type: 'Capsule' | 'Gene' | 'Recipe';
  seller_id: string;
  price_type: PriceType;
  price: number; // credits
  rental_period_days?: number; // for rental type
  license: LicenseType;
  status: ListingStatus;
  created_at: string;
  expires_at?: string;
  view_count: number;
}

export interface MarketplaceTransaction {
  transaction_id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  asset_id: string;
  price_paid: number;
  license_type: LicenseType;
  status: TransactionStatus;
  created_at: string;
  completed_at?: string;
}

export interface Bid {
  bid_id: string;
  bounty_id: string;
  node_id: string;
  proposed_solution: {
    approach: string;
    genes: string[];
    estimated_days: number;
  };
  bid_amount: number;
  milestones: BidMilestone[];
  reputation_escrow: number;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  created_at: string;
}

export interface BidMilestone {
  phase: string;
  payment: number;
  deliverable: string;
}

export interface Bounty {
  bounty_id: string;
  creator_id: string;
  title: string;
  description: string;
  budget: number;
  deadline: string;
  required_skills: string[];
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  winning_bid_id?: string;
  created_at: string;
}

export interface PriceQuote {
  asset_id: string;
  suggested_price: number;
  gdi_factor: number;
  demand_factor: number;
  scarcity_factor: number;
  price_tier: 'budget' | 'standard' | 'premium' | 'elite';
}

export interface EscrowState {
  escrow_id: string;
  listing_id: string;
  amount: number;
  buyer_id: string;
  status: 'locked' | 'released' | 'refunded';
  created_at: string;
}
