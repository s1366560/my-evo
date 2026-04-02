/**
 * Credit Marketplace Types
 * Section 21: Credit Trading Exchange
 * Users can buy and sell credits directly
 */

export type CreditListingStatus = 'active' | 'filled' | 'cancelled' | 'expired';

export interface CreditListing {
  listing_id: string;
  seller_id: string;
  price_per_credit: number;  // Price in credits per credit (like a stock)
  amount: number;             // Number of credits being sold
  remaining_amount: number;    // Remaining credits unfilled
  status: CreditListingStatus;
  created_at: string;
  expires_at: string;        // Auto-expire if not filled
}

export interface CreditOrder {
  order_id: string;
  listing_id: string;
  buyer_id: string;
  amount: number;             // Amount of credits being bought
  price_per_credit: number;   // Price at time of purchase
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  created_at: string;
  completed_at?: string;
}

export interface CreditExchangeStats {
  total_volume_24h: number;
  active_listings: number;
  last_price: number;
  price_change_24h: number;
  high_24h: number;
  low_24h: number;
}

export interface CreditBalance {
  available: number;
  locked: number;       // In active listings
  total: number;
}
