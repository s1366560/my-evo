// Billing types for subscription management, invoice generation, and proration
import type { PlanTier, BillingCycle } from '../subscription/types';

// ============================
// Stripe Event Types
// ============================

export type StripeEventType =
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.created'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'invoice.finalized'
  | 'invoice.updated'
  | 'invoice.deleted'
  | 'invoiceitem.created'
  | 'invoiceitem.updated'
  | 'invoiceitem.deleted'
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'checkout.session.completed'
  | 'customer.subscription.trial_will_end';

// ============================
// Stripe Webhook Payload
// ============================

export interface StripeWebhookPayload {
  id: string;
  object: string;
  api_version: string;
  type: StripeEventType;
  created: number;
  data: {
    object: StripeEventData;
  };
  livemode: boolean;
  pending_webhooks: number;
  request: {
    id: string;
    idempotency_key: string;
  };
}

export interface StripeEventData {
  id: string;
  object: string;
  [key: string]: unknown;
}

// ============================
// Subscription Data from Stripe
// ============================

export interface StripeSubscription {
  id: string;
  customer: string;
  status: StripeSubscriptionStatus;
  plan: StripePlan;
  quantity: number;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  canceled_at: number | null;
  trial_start: number | null;
  trial_end: number | null;
  created: number;
  metadata: Record<string, string>;
}

export type StripeSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'
  | 'incomplete'
  | 'incomplete_expired'
  | 'not_started';

export interface StripePlan {
  id: string;
  object: string;
  active: boolean;
  nickname: string | null;
  product: string;
  unit_amount: number | null;
  currency: string;
  recurring: {
    interval: 'month' | 'year';
    interval_count: number;
    usage_type: 'licensed' | 'metered';
  };
}

// ============================
// Invoice Types
// ============================

export interface InvoiceLineItem {
  id: string;
  description: string;
  amount: number;
  currency: string;
  quantity: number;
  unit_amount: number;
  period: {
    start: Date;
    end: Date;
  };
  type: 'subscription' | 'proration' | 'one_time' | 'tax' | 'discount';
  metadata: Record<string, string>;
}

export interface Invoice {
  id: string;
  invoice_id: string;
  subscription_id: string;
  node_id: string;
  stripe_invoice_id?: string;
  plan: PlanTier;
  billing_cycle: BillingCycle;
  amount: number;
  amount_paid: number;
  amount_due: number;
  amount_remaining: number;
  currency: string;
  status: InvoiceStatus;
  period_start: Date;
  period_end: Date;
  due_date?: Date;
  paid_at?: Date;
  created_at: Date;
  updated_at: Date;
  line_items: InvoiceLineItem[];
  metadata: Record<string, string>;
}

export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'uncollectible'
  | 'void'
  | 'payment_failed';

// ============================
// Proration Types
// ============================

export interface ProrationPreview {
  subscription_id: string;
  node_id: string;
  from_plan: PlanTier;
  to_plan: PlanTier;
  billing_cycle: BillingCycle;
  effective_date: Date;
  credit_amount: number; // Credit for unused time on old plan
  charge_amount: number; // Charge for new plan
  net_amount: number; // net_amount = charge_amount - credit_amount
  line_items: ProrationLineItem[];
  calculated_at: Date;
}

export interface ProrationLineItem {
  description: string;
  type: 'credit' | 'charge';
  amount: number;
  period_days_used: number;
  total_period_days: number;
  daily_rate: number;
  plan_name: string;
}

// ============================
// Billing Webhook Event
// ============================

export interface BillingWebhookEvent {
  id: string;
  type: StripeEventType;
  processed_at: Date;
  subscription_id?: string;
  invoice_id?: string;
  node_id?: string;
  status: 'success' | 'failed';
  error_message?: string;
  payload: StripeWebhookPayload;
}

// ============================
// Webhook Processing Result
// ============================

export interface WebhookProcessingResult {
  success: boolean;
  event_id: string;
  event_type: StripeEventType;
  processed: boolean;
  actions_taken: string[];
  error?: string;
}

// ============================
// Billing Configuration
// ============================

export interface BillingConfig {
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
  stripe_price_pro?: string;
  stripe_price_team?: string;
  stripe_price_enterprise?: string;
  default_currency: string;
  tax_rate: number;
  enable_proration: boolean;
}

// Plan ID mapping
export const PLAN_PRICE_MAP: Record<PlanTier, string> = {
  free: '',
  premium: process.env.STRIPE_PRICE_PRO || 'price_premium',
  ultra: process.env.STRIPE_PRICE_TEAM || 'price_ultra',
};

// ============================
// Stripe API Response Types
// ============================

export interface StripeInvoice {
  id: string;
  object: 'invoice';
  subscription: string | null;
  customer: string;
  status: string;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  currency: string;
  period_start: number;
  period_end: number;
  due_date: number | null;
  paid: boolean;
  paid_out_of_band: boolean;
  lines: {
    data: StripeInvoiceLine[];
    has_more: boolean;
    total_count: number;
    url: string;
  };
  metadata: Record<string, string>;
  created: number;
}

export interface StripeInvoiceLine {
  id: string;
  object: 'line_item';
  description: string | null;
  amount: number;
  currency: string;
  quantity: number | null;
  unit_amount: number | null;
  period: {
    start: number;
    end: number;
  };
  type: string;
  metadata: Record<string, string>;
}
