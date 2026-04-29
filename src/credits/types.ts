// Credits types for economy management
export type CreditTransactionType =
  | 'initial_bonus'
  | 'purchase'
  | 'subscription_grant'
  | 'referral_bonus'
  | 'promotion'
  | 'refund'
  | 'map_create'
  | 'map_export'
  | 'api_call'
  | 'gdi_analysis'
  | 'storage'
  | 'collaboration'
  | 'decay';

export interface CreditTransaction {
  id: string;
  node_id: string;
  amount: number;
  type: CreditTransactionType;
  description: string;
  balance_after: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface CreditBalance {
  node_id: string;
  balance: number;
  last_updated: string;
  tier: 'free' | 'premium' | 'ultra';
  monthly_allowance: number;
  used_this_month: number;
  remaining_this_month: number;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  bonus_credits: number;
  total_credits: number;
}

export interface PurchaseCreditsRequest {
  package_id: string;
  payment_method_id?: string;
}

export interface SpendCreditsRequest {
  amount: number;
  type: CreditTransactionType;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface TransactionFilter {
  node_id: string;
  type?: CreditTransactionType;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

// Credit operation costs
export const CREDIT_COSTS = {
  map_create: 10,
  map_export_json: 5,
  map_export_csv: 3,
  map_export_pdf: 8,
  api_call_standard: 1,
  api_call_advanced: 5,
  gdi_analysis: 20,
  storage_per_gb_month: 100,
  collaboration_per_member_month: 50,
} as const;

// Initial credits
export const INITIAL_CREDITS = {
  free: 500,
  premium: 5000,
  ultra: 20000,
} as const;

// Monthly allowance
export const MONTHLY_ALLOWANCE = {
  free: 100,
  premium: 1000,
  ultra: 10000,
} as const;

// Credit decay settings
export const CREDIT_DECAY = {
  enabled: true,
  threshold_days: 90, // After 90 days of inactivity
  rate: 0.05, // 5% per month
  max_decay_percent: 0.5, // Max 50% decay
} as const;

// Credit packages available for purchase
export const CREDIT_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter Pack',
    credits: 1000,
    price_cents: 990,
    bonus_credits: 0,
    total_credits: 1000,
  },
  {
    id: 'pro',
    name: 'Pro Pack',
    credits: 5000,
    price_cents: 4490,
    bonus_credits: 500,
    total_credits: 5500,
  },
  {
    id: 'team',
    name: 'Team Pack',
    credits: 15000,
    price_cents: 11990,
    bonus_credits: 2000,
    total_credits: 17000,
  },
  {
    id: 'enterprise',
    name: 'Enterprise Pack',
    credits: 50000,
    price_cents: 34990,
    bonus_credits: 10000,
    total_credits: 60000,
  },
] as const;

// Referral bonus
export const REFERRAL_BONUS = {
  referrer: 200, // Credits for the referrer
  referee: 100, // Credits for the new user
} as const;
