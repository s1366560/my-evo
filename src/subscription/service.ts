import type { PrismaClient } from '@prisma/client';
import type {
  PlanTier,
  BillingCycle,
  SubscriptionStatus,
  SubscriptionPlan,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
} from './types';
import { SUBSCRIPTION_PLANS, type SubscriptionResponse, type InvoiceResponse } from './types';
import { ValidationError, NotFoundError } from '../shared/errors';

// In-memory subscription store (in production, this would use Prisma)
const subscriptions = new Map<string, {
  subscription_id: string;
  node_id: string;
  plan: PlanTier;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  started_at: Date;
  current_period_start: Date;
  current_period_end: Date;
  auto_renew: boolean;
  total_paid: number;
  created_at: Date;
  updated_at: Date;
}>();

const invoices = new Map<string, {
  invoice_id: string;
  subscription_id: string;
  node_id: string;
  plan: PlanTier;
  amount: number;
  billing_cycle: BillingCycle;
  period_start: Date;
  period_end: Date;
  status: string;
  paid_at: Date | null;
  created_at: Date;
}>();

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function calculatePeriodEnd(start: Date, billingCycle: BillingCycle): Date {
  const end = new Date(start);
  if (billingCycle === 'monthly') {
    end.setMonth(end.getMonth() + 1);
  } else {
    end.setFullYear(end.getFullYear() + 1);
  }
  return end;
}

export function setPrisma(_client: PrismaClient): void {
  // Service uses in-memory storage for flexibility
  // In production, this would sync with Prisma models
}

// Public API: Get all available plans
export function getAvailablePlans(): SubscriptionPlan[] {
  return Object.values(SUBSCRIPTION_PLANS);
}

// Public API: Get a specific plan
export function getPlan(planId: PlanTier): SubscriptionPlan | null {
  return SUBSCRIPTION_PLANS[planId] ?? null;
}

// Public API: Check if a node can perform an action based on plan limits
export function checkPlanLimit(
  plan: PlanTier,
  limitType: keyof SubscriptionPlan['limits']
): { allowed: boolean; current?: number; limit?: number | boolean } {
  const planLimits = SUBSCRIPTION_PLANS[plan]?.limits;
  if (!planLimits) {
    return { allowed: false };
  }

  const limit = planLimits[limitType];
  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, limit: -1 };
  }

  return { allowed: true, limit };
}

// Create or get subscription for a node
export function getOrCreateSubscription(nodeId: string): {
  subscription_id: string;
  node_id: string;
  plan: PlanTier;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  started_at: Date;
  current_period_start: Date;
  current_period_end: Date;
  auto_renew: boolean;
  total_paid: number;
  created_at: Date;
  updated_at: Date;
} {
  // Check if subscription exists
  for (const sub of subscriptions.values()) {
    if (sub.node_id === nodeId) {
      return sub;
    }
  }

  // Create free subscription by default
  return createSubscription(nodeId, 'free', 'monthly');
}

// Create a new subscription
export function createSubscription(
  nodeId: string,
  plan: PlanTier,
  billingCycle: BillingCycle = 'monthly'
): {
  subscription_id: string;
  node_id: string;
  plan: PlanTier;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  started_at: Date;
  current_period_start: Date;
  current_period_end: Date;
  auto_renew: boolean;
  total_paid: number;
  created_at: Date;
  updated_at: Date;
} {
  // Validate plan
  if (!SUBSCRIPTION_PLANS[plan]) {
    throw new ValidationError(`Invalid plan: ${plan}. Valid plans are: free, premium, ultra`);
  }

  // Check for existing subscription
  for (const sub of subscriptions.values()) {
    if (sub.node_id === nodeId) {
      throw new ValidationError(`Node ${nodeId} already has a subscription`);
    }
  }

  const now = new Date();
  const periodEnd = calculatePeriodEnd(now, billingCycle);

  const subscription = {
    subscription_id: generateId('sub'),
    node_id: nodeId,
    plan,
    billing_cycle: billingCycle,
    status: 'active' as SubscriptionStatus,
    started_at: now,
    current_period_start: now,
    current_period_end: periodEnd,
    auto_renew: true,
    total_paid: 0,
    created_at: now,
    updated_at: now,
  };

  subscriptions.set(subscription.subscription_id, subscription);

  // Create initial invoice for paid plans
  if (plan !== 'free') {
    const planDetails = SUBSCRIPTION_PLANS[plan];
    const price = billingCycle === 'monthly' ? planDetails.price_monthly : planDetails.price_yearly;
    
    const invoice = {
      invoice_id: generateId('inv'),
      subscription_id: subscription.subscription_id,
      node_id: nodeId,
      plan,
      amount: price,
      billing_cycle: billingCycle,
      period_start: now,
      period_end: periodEnd,
      status: 'paid',
      paid_at: now,
      created_at: now,
    };
    
    invoices.set(invoice.invoice_id, invoice);
    
    // Update total paid
    subscription.total_paid = price;
  }

  return subscription;
}

// Get subscription status (alias for getSubscription - used by sandbox)
export async function getSubscriptionStatus(nodeId: string): Promise<{
  plan: string;
  status: string;
} | null> {
  const sub = getSubscription(nodeId);
  if (!sub) return null;
  return {
    plan: sub.plan,
    status: sub.status,
  };
}

// Get subscription by node ID
export function getSubscription(nodeId: string): {
  subscription_id: string;
  node_id: string;
  plan: PlanTier;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  started_at: Date;
  current_period_start: Date;
  current_period_end: Date;
  auto_renew: boolean;
  total_paid: number;
  created_at: Date;
  updated_at: Date;
} | null {
  for (const sub of subscriptions.values()) {
    if (sub.node_id === nodeId) {
      return sub;
    }
  }
  return null;
}

// Get subscription by subscription ID
export function getSubscriptionById(subscriptionId: string): {
  subscription_id: string;
  node_id: string;
  plan: PlanTier;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  started_at: Date;
  current_period_start: Date;
  current_period_end: Date;
  auto_renew: boolean;
  total_paid: number;
  created_at: Date;
  updated_at: Date;
} | null {
  return subscriptions.get(subscriptionId) ?? null;
}

// Update subscription
export function updateSubscription(
  nodeId: string,
  updates: UpdateSubscriptionRequest
): {
  subscription_id: string;
  node_id: string;
  plan: PlanTier;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  started_at: Date;
  current_period_start: Date;
  current_period_end: Date;
  auto_renew: boolean;
  total_paid: number;
  created_at: Date;
  updated_at: Date;
} | null {
  const sub = getSubscription(nodeId);
  if (!sub) return null;

  if (updates.plan) {
    if (!SUBSCRIPTION_PLANS[updates.plan]) {
      throw new ValidationError(`Invalid plan: ${updates.plan}`);
    }
    sub.plan = updates.plan;
  }

  if (updates.billing_cycle) {
    sub.billing_cycle = updates.billing_cycle;
    // Recalculate period end
    sub.current_period_end = calculatePeriodEnd(sub.current_period_start, updates.billing_cycle);
  }

  if (updates.auto_renew !== undefined) {
    sub.auto_renew = updates.auto_renew;
  }

  sub.updated_at = new Date();
  subscriptions.set(sub.subscription_id, sub);

  return sub;
}

// Cancel subscription (downgrade to free)
export function cancelSubscription(nodeId: string): {
  subscription_id: string;
  node_id: string;
  plan: PlanTier;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  started_at: Date;
  current_period_start: Date;
  current_period_end: Date;
  auto_renew: boolean;
  total_paid: number;
  created_at: Date;
  updated_at: Date;
} | null {
  const sub = getSubscription(nodeId);
  if (!sub) return null;

  sub.status = 'cancelled';
  sub.plan = 'free';
  sub.auto_renew = false;
  sub.updated_at = new Date();

  subscriptions.set(sub.subscription_id, sub);
  return sub;
}

// Pause subscription
export function pauseSubscription(nodeId: string): {
  subscription_id: string;
  node_id: string;
  plan: PlanTier;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  started_at: Date;
  current_period_start: Date;
  current_period_end: Date;
  auto_renew: boolean;
  total_paid: number;
  created_at: Date;
  updated_at: Date;
} | null {
  const sub = getSubscription(nodeId);
  if (!sub) return null;

  sub.status = 'paused';
  sub.updated_at = new Date();

  subscriptions.set(sub.subscription_id, sub);
  return sub;
}

// Resume paused subscription
export function resumeSubscription(nodeId: string): {
  subscription_id: string;
  node_id: string;
  plan: PlanTier;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  started_at: Date;
  current_period_start: Date;
  current_period_end: Date;
  auto_renew: boolean;
  total_paid: number;
  created_at: Date;
  updated_at: Date;
} | null {
  const sub = getSubscription(nodeId);
  if (!sub) return null;

  if (sub.status !== 'paused') {
    throw new ValidationError('Can only resume paused subscriptions');
  }

  sub.status = 'active';
  sub.current_period_start = new Date();
  sub.current_period_end = calculatePeriodEnd(sub.current_period_start, sub.billing_cycle);
  sub.updated_at = new Date();

  subscriptions.set(sub.subscription_id, sub);
  return sub;
}

// Get invoices for a subscription
export function getSubscriptionInvoices(subscriptionId: string): Array<{
  invoice_id: string;
  subscription_id: string;
  node_id: string;
  plan: PlanTier;
  amount: number;
  billing_cycle: BillingCycle;
  period_start: Date;
  period_end: Date;
  status: string;
  paid_at: Date | null;
  created_at: Date;
}> {
  return Array.from(invoices.values())
    .filter(inv => inv.subscription_id === subscriptionId)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

// Get all invoices for a node
export function getNodeInvoices(nodeId: string): Array<{
  invoice_id: string;
  subscription_id: string;
  node_id: string;
  plan: PlanTier;
  amount: number;
  billing_cycle: BillingCycle;
  period_start: Date;
  period_end: Date;
  status: string;
  paid_at: Date | null;
  created_at: Date;
}> {
  return Array.from(invoices.values())
    .filter(inv => inv.node_id === nodeId)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

// Renew subscription (simulate billing)
export function renewSubscription(nodeId: string): {
  subscription_id: string;
  node_id: string;
  plan: PlanTier;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  started_at: Date;
  current_period_start: Date;
  current_period_end: Date;
  auto_renew: boolean;
  total_paid: number;
  created_at: Date;
  updated_at: Date;
} | null {
  const sub = getSubscription(nodeId);
  if (!sub) return null;

  if (sub.plan === 'free' || !sub.auto_renew) {
    return sub;
  }

  const now = new Date();
  const previousPeriodEnd = sub.current_period_end;
  const newPeriodEnd = calculatePeriodEnd(now, sub.billing_cycle);

  // Create renewal invoice
  const planDetails = SUBSCRIPTION_PLANS[sub.plan];
  const price = sub.billing_cycle === 'monthly' ? planDetails.price_monthly : planDetails.price_yearly;

  const invoice = {
    invoice_id: generateId('inv'),
    subscription_id: sub.subscription_id,
    node_id: nodeId,
    plan: sub.plan,
    amount: price,
    billing_cycle: sub.billing_cycle,
    period_start: previousPeriodEnd,
    period_end: newPeriodEnd,
    status: 'paid',
    paid_at: now,
    created_at: now,
  };

  invoices.set(invoice.invoice_id, invoice);

  // Update subscription
  sub.current_period_start = previousPeriodEnd;
  sub.current_period_end = newPeriodEnd;
  sub.status = 'active';
  sub.total_paid += price;
  sub.updated_at = now;

  subscriptions.set(sub.subscription_id, sub);
  return sub;
}

// Reset test state
export function _resetTestState(): void {
  subscriptions.clear();
  invoices.clear();
}

// Serialize subscription to API response format
export function toSubscriptionResponse(sub: ReturnType<typeof getSubscription>): SubscriptionResponse | null {
  if (!sub) return null;
  return {
    subscription_id: sub.subscription_id,
    node_id: sub.node_id,
    plan: sub.plan,
    billing_cycle: sub.billing_cycle,
    status: sub.status,
    started_at: sub.started_at.toISOString(),
    current_period_start: sub.current_period_start.toISOString(),
    current_period_end: sub.current_period_end.toISOString(),
    auto_renew: sub.auto_renew,
    total_paid: sub.total_paid,
  };
}

// Serialize invoice to API response format
export function toInvoiceResponse(inv: ReturnType<typeof getSubscriptionInvoices>[number]): InvoiceResponse {
  return {
    invoice_id: inv.invoice_id,
    subscription_id: inv.subscription_id,
    node_id: inv.node_id,
    plan: inv.plan,
    amount: inv.amount,
    billing_cycle: inv.billing_cycle,
    period_start: inv.period_start.toISOString(),
    period_end: inv.period_end.toISOString(),
    status: inv.status,
    paid_at: inv.paid_at?.toISOString() ?? null,
    created_at: inv.created_at.toISOString(),
  };
}
