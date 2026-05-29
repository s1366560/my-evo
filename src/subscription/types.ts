// Subscription types for tier management (Free/Premium/Ultra)
export type PlanTier = 'free' | 'premium' | 'ultra';
export type BillingCycle = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing' | 'paused';

export interface SubscriptionPlan {
  id: PlanTier;
  name: string;
  description: string;
  price_monthly: number; // in cents/USD
  price_yearly: number;
  features: string[];
  limits: PlanLimits;
}

export interface PlanLimits {
  maps: number;
  nodes_per_map: number;
  collaborators: number;
  api_calls_per_month: number;
  storage_gb: number;
  gdi_analyses_per_month: number;
  priority_support: boolean;
  custom_branding: boolean;
  advanced_export: boolean;
}

export interface CreateSubscriptionRequest {
  plan: PlanTier;
  billing_cycle: BillingCycle;
  payment_method_id?: string;
}

export interface UpdateSubscriptionRequest {
  plan?: PlanTier;
  billing_cycle?: BillingCycle;
  auto_renew?: boolean;
}

export interface SubscriptionResponse {
  subscription_id: string;
  node_id: string;
  plan: PlanTier;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  started_at: string;
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
  total_paid: number;
}

export interface InvoiceResponse {
  invoice_id: string;
  subscription_id: string;
  node_id: string;
  plan: PlanTier;
  amount: number;
  billing_cycle: BillingCycle;
  period_start: string;
  period_end: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

// Plan definitions
export const SUBSCRIPTION_PLANS: Record<PlanTier, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Get started with basic mapping capabilities',
    price_monthly: 0,
    price_yearly: 0,
    features: [
      'Create up to 3 maps',
      'Up to 50 nodes per map',
      'Basic force-directed layout',
      'Public map sharing',
      'Community support',
    ],
    limits: {
      maps: 3,
      nodes_per_map: 50,
      collaborators: 1,
      api_calls_per_month: 100,
      storage_gb: 1,
      gdi_analyses_per_month: 5,
      priority_support: false,
      custom_branding: false,
      advanced_export: false,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Advanced features for power users and teams',
    price_monthly: 2900, // $29.00
    price_yearly: 29000, // $290.00 (save ~17%)
    features: [
      'Unlimited maps',
      'Up to 500 nodes per map',
      'All layout algorithms',
      'Private map sharing',
      'Up to 10 collaborators',
      'Priority email support',
      'Advanced export (JSON, CSV)',
      'API access (10,000 calls/month)',
    ],
    limits: {
      maps: -1, // unlimited
      nodes_per_map: 500,
      collaborators: 10,
      api_calls_per_month: 10000,
      storage_gb: 10,
      gdi_analyses_per_month: 50,
      priority_support: true,
      custom_branding: false,
      advanced_export: true,
    },
  },
  ultra: {
    id: 'ultra',
    name: 'Ultra',
    description: 'Enterprise-grade features for organizations',
    price_monthly: 9900, // $99.00
    price_yearly: 99000, // $990.00 (save ~17%)
    features: [
      'Unlimited everything',
      'Unlimited nodes per map',
      'All layout algorithms',
      'Private & encrypted maps',
      'Unlimited collaborators',
      '24/7 priority support',
      'Custom branding',
      'Full API access (100,000 calls/month)',
      'SSO & SAML support',
      'Dedicated account manager',
    ],
    limits: {
      maps: -1,
      nodes_per_map: -1,
      collaborators: -1,
      api_calls_per_month: 100000,
      storage_gb: 100,
      gdi_analyses_per_month: -1,
      priority_support: true,
      custom_branding: true,
      advanced_export: true,
    },
  },
};

// Credit packages for purchasing additional credits
export interface CreditPackage {
  id: string;
  credits: number;
  price_cents: number;
  bonus_credits: number;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'starter', credits: 1000, price_cents: 990, bonus_credits: 0 },
  { id: 'pro', credits: 5000, price_cents: 4490, bonus_credits: 500 },
  { id: 'team', credits: 15000, price_cents: 11990, bonus_credits: 2000 },
  { id: 'enterprise', credits: 50000, price_cents: 34990, bonus_credits: 10000 },
];
