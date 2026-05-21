// Billing service: Stripe webhook handlers, invoice generation, and proration calculation
import crypto from 'crypto';
import type {
  StripeWebhookPayload,
  StripeSubscription,
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
  ProrationPreview,
  ProrationLineItem,
  WebhookProcessingResult,
  BillingWebhookEvent,
  StripeEventType,
  StripePlan,
} from './types';
import { SUBSCRIPTION_PLANS } from '../subscription/types';
import type { PlanTier, BillingCycle } from '../subscription/types';

// In-memory stores for demo (in production, use Prisma)
const webhookEvents = new Map<string, BillingWebhookEvent>();
const invoices = new Map<string, Invoice>();
const processedEvents = new Set<string>();

// Webhook secret for signature verification
let webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

// ============================
// Configuration
// ============================

export function setWebhookSecret(secret: string): void {
  webhookSecret = secret;
}

export function getWebhookSecret(): string {
  return webhookSecret;
}

// ============================
// Stripe Signature Verification
// ============================

export function verifyStripeSignature(
  payload: string,
  signature: string,
  secret?: string
): boolean {
  const webhookSecretKey = secret || webhookSecret;
  if (!webhookSecretKey) {
    console.warn('[Billing] No webhook secret configured, skipping signature verification');
    return true;
  }

  try {
    const elements = signature.split(',');
    const signatureMap: Record<string, string> = {};
    
    for (const element of elements) {
      const parts = element.split('=');
      const key = parts[0];
      const value = parts.slice(1).join('=');
      if (key) signatureMap[key] = value;
    }

    const timestamp = signatureMap['t'];
    const v1Signature = signatureMap['v1'];

    if (!timestamp || !v1Signature) {
      return false;
    }

    // Check timestamp (reject if older than 5 minutes)
    const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (timestampAge > 300) {
      console.error('[Billing] Webhook timestamp too old');
      return false;
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecretKey)
      .update(signedPayload)
      .digest('hex');

    // Compare signatures
    return crypto.timingSafeEqual(
      Buffer.from(v1Signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// ============================
// Node ID Resolution
// ============================

export function extractNodeIdFromMetadata(
  metadata: Record<string, string>
): string | null {
  return metadata.node_id || null;
}

// ============================
// Webhook Event Processing
// ============================

export async function processWebhookEvent(
  payload: StripeWebhookPayload
): Promise<WebhookProcessingResult> {
  const { id, type, data } = payload;
  const actionsTaken: string[] = [];

  // Idempotency check
  if (processedEvents.has(id)) {
    return {
      success: true,
      event_id: id,
      event_type: type,
      processed: false,
      actions_taken: ['duplicate_event_skipped'],
    };
  }

  try {
    switch (type) {
      case 'customer.subscription.created':
        actionsTaken.push(...await handleSubscriptionCreated(data.object as unknown as StripeSubscription));
        break;
      case 'customer.subscription.updated':
        actionsTaken.push(...await handleSubscriptionUpdated(data.object as unknown as StripeSubscription));
        break;
      case 'customer.subscription.deleted':
        actionsTaken.push(...await handleSubscriptionDeleted(data.object as unknown as StripeSubscription));
        break;
      case 'invoice.paid':
        actionsTaken.push(...await handleInvoicePaid(data.object));
        break;
      case 'invoice.payment_failed':
        actionsTaken.push(...await handleInvoicePaymentFailed(data.object));
        break;
      case 'invoice.finalized':
        actionsTaken.push(...await handleInvoiceFinalized(data.object));
        break;
      case 'checkout.session.completed':
        actionsTaken.push(...await handleCheckoutCompleted(data.object));
        break;
      case 'customer.subscription.trial_will_end':
        actionsTaken.push(...await handleTrialWillEnd(data.object as unknown as StripeSubscription));
        break;
      default:
        actionsTaken.push(`unhandled_event_type:${type}`);
    }

    // Mark event as processed
    processedEvents.add(id);
    
    // Record webhook event
    const event: BillingWebhookEvent = {
      id,
      type,
      processed_at: new Date(),
      status: 'success',
      payload,
    };
    webhookEvents.set(id, event);

    return {
      success: true,
      event_id: id,
      event_type: type,
      processed: true,
      actions_taken: actionsTaken,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    const event: BillingWebhookEvent = {
      id,
      type,
      processed_at: new Date(),
      status: 'failed',
      error_message: errorMessage,
      payload,
    };
    webhookEvents.set(id, event);

    return {
      success: false,
      event_id: id,
      event_type: type,
      processed: false,
      actions_taken: actionsTaken,
      error: errorMessage,
    };
  }
}

// ============================
// Subscription Event Handlers
// ============================

async function handleSubscriptionCreated(
  subscription: StripeSubscription
): Promise<string[]> {
  const actions: string[] = [];
  const nodeId = extractNodeIdFromMetadata(subscription.metadata);

  if (!nodeId) {
    console.warn('[Billing] No node_id in subscription metadata:', subscription.id);
    return actions;
  }

  const plan = mapStripePlanToTier(subscription.plan);
  const billingCycle = subscription.plan.recurring?.interval === 'year' ? 'yearly' : 'monthly';

  actions.push(`subscription_created:${subscription.id}`);
  actions.push(`node:${nodeId},plan:${plan},billing_cycle:${billingCycle}`);
  actions.push('subscription_status:pending_prisma_sync');

  console.log('[Billing] Subscription created:', {
    subscriptionId: subscription.id,
    nodeId,
    plan,
    status: subscription.status,
  });

  return actions;
}

async function handleSubscriptionUpdated(
  subscription: StripeSubscription
): Promise<string[]> {
  const actions: string[] = [];
  const nodeId = extractNodeIdFromMetadata(subscription.metadata);

  actions.push(`subscription_updated:${subscription.id}`);

  if (nodeId) {
    actions.push(`node:${nodeId}`);
  }

  const plan = mapStripePlanToTier(subscription.plan);
  actions.push(`plan:${plan}`);
  actions.push(`status:${subscription.status}`);

  if (subscription.cancel_at_period_end) {
    actions.push('cancel_at_period_end:true');
  }

  console.log('[Billing] Subscription updated:', {
    subscriptionId: subscription.id,
    nodeId,
    plan,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  return actions;
}

async function handleSubscriptionDeleted(
  subscription: StripeSubscription
): Promise<string[]> {
  const actions: string[] = [];
  const nodeId = extractNodeIdFromMetadata(subscription.metadata);

  actions.push(`subscription_deleted:${subscription.id}`);

  if (nodeId) {
    actions.push(`node:${nodeId}`);
    actions.push('plan:downgraded_to_free');
  }

  console.log('[Billing] Subscription deleted:', {
    subscriptionId: subscription.id,
    nodeId,
  });

  return actions;
}

// ============================
// Invoice Event Handlers
// ============================

async function handleInvoicePaid(invoiceData: Record<string, unknown>): Promise<string[]> {
  const actions: string[] = [];
  
  const invoiceId = invoiceData.id as string;
  const subscriptionId = invoiceData.subscription as string;
  
  actions.push(`invoice_paid:${invoiceId}`);
  actions.push(`subscription:${subscriptionId}`);

  const lines = 'lines' in invoiceData ? invoiceData.lines as { data: Array<{ type: string; metadata?: Record<string, string> }> } : null;
  if (lines) {
    const hasProration = lines.data.some(line => line.type === 'subscription' && line.metadata?.proration === 'true');
    if (hasProration) {
      actions.push('contains_proration:true');
    }
  }

  console.log('[Billing] Invoice paid:', {
    invoiceId,
    subscriptionId,
    amount: invoiceData.amount_paid || invoiceData.amount_due,
  });

  return actions;
}

async function handleInvoicePaymentFailed(invoiceData: Record<string, unknown>): Promise<string[]> {
  const actions: string[] = [];
  
  const invoiceId = invoiceData.id as string;
  const subscriptionId = invoiceData.subscription as string;

  actions.push(`invoice_payment_failed:${invoiceId}`);
  actions.push(`subscription:${subscriptionId}`);
  actions.push('subscription_status:set_to_past_due');

  console.log('[Billing] Invoice payment failed:', {
    invoiceId,
    subscriptionId,
  });

  return actions;
}

async function handleInvoiceFinalized(invoiceData: Record<string, unknown>): Promise<string[]> {
  const actions: string[] = [];
  
  const invoiceId = invoiceData.id as string;
  actions.push(`invoice_finalized:${invoiceId}`);

  console.log('[Billing] Invoice finalized:', {
    invoiceId,
    amount: invoiceData.amount_due,
  });

  return actions;
}

async function handleCheckoutCompleted(checkoutData: Record<string, unknown>): Promise<string[]> {
  const actions: string[] = [];
  
  const sessionId = checkoutData.id as string;
  const customerId = checkoutData.customer as string;
  
  actions.push(`checkout_completed:${sessionId}`);
  actions.push(`customer:${customerId}`);

  const metadata = 'metadata' in checkoutData ? checkoutData.metadata as Record<string, string> : {};
  const nodeId = metadata.node_id;
  const plan = metadata.plan as PlanTier | undefined;

  if (nodeId) {
    actions.push(`node:${nodeId}`);
  }
  if (plan) {
    actions.push(`plan:${plan}`);
  }

  console.log('[Billing] Checkout completed:', {
    sessionId,
    customerId,
    nodeId,
    plan,
  });

  return actions;
}

async function handleTrialWillEnd(subscription: StripeSubscription): Promise<string[]> {
  const actions: string[] = [];
  
  const subscriptionId = subscription.id;
  const nodeId = extractNodeIdFromMetadata(subscription.metadata);
  const trialEnd = subscription.trial_end;

  actions.push(`trial_will_end:${subscriptionId}`);
  
  if (nodeId) {
    actions.push(`node:${nodeId}`);
  }
  if (trialEnd) {
    actions.push(`trial_ends:${new Date(trialEnd * 1000).toISOString()}`);
    actions.push('action:send_reminder_notification');
  }

  console.log('[Billing] Trial will end:', {
    subscriptionId,
    nodeId,
    trialEnd: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
  });

  return actions;
}

// ============================
// Plan Mapping
// ============================

function mapStripePlanToTier(plan: StripePlan | string): PlanTier {
  if (typeof plan === 'string') {
    // It's a price ID
    const priceId = plan;
    if (priceId === process.env.STRIPE_PRICE_PRO || priceId.includes('premium')) {
      return 'premium';
    }
    if (priceId === process.env.STRIPE_PRICE_TEAM || priceId.includes('ultra')) {
      return 'ultra';
    }
    return 'free';
  }

  // Extract from Stripe plan product name
  const productName = (plan.product as string)?.toLowerCase() || '';
  if (productName.includes('premium') || productName.includes('pro')) {
    return 'premium';
  }
  if (productName.includes('ultra') || productName.includes('enterprise') || productName.includes('team')) {
    return 'ultra';
  }
  return 'free';
}

export { mapStripePlanToTier };


// ============================
// Invoice Generation
// ============================

export function generateInvoice(
  subscriptionId: string,
  nodeId: string,
  plan: PlanTier,
  billingCycle: BillingCycle,
  periodStart: Date,
  periodEnd: Date,
  options?: {
    stripeInvoiceId?: string;
    includeProration?: boolean;
    prorationAmount?: number;
    taxRate?: number;
  }
): Invoice {
  const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const planDetails = SUBSCRIPTION_PLANS[plan];
  const basePrice = billingCycle === 'monthly' 
    ? planDetails.price_monthly 
    : planDetails.price_yearly;

  const lineItems: InvoiceLineItem[] = [];

  // Subscription line item
  if (plan !== 'free' && basePrice > 0) {
    lineItems.push({
      id: `li_sub_${Date.now()}`,
      description: `${planDetails.name} Plan - ${billingCycle === 'monthly' ? 'Monthly' : 'Annual'} subscription`,
      amount: basePrice,
      currency: 'usd',
      quantity: 1,
      unit_amount: basePrice,
      period: { start: periodStart, end: periodEnd },
      type: 'subscription',
      metadata: { plan, billing_cycle: billingCycle },
    });
  }

  // Proration line item (if applicable)
  if (options?.includeProration && options.prorationAmount !== undefined) {
    const absAmount = Math.abs(options.prorationAmount);
    const isCredit = options.prorationAmount < 0;
    
    lineItems.push({
      id: `li_prop_${Date.now()}`,
      description: `Proration adjustment for plan change`,
      amount: isCredit ? -absAmount : absAmount,
      currency: 'usd',
      quantity: 1,
      unit_amount: isCredit ? -absAmount : absAmount,
      period: { start: periodStart, end: periodEnd },
      type: 'proration',
      metadata: { proration: 'true', is_credit: String(isCredit) },
    });
  }

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxRate = options?.taxRate ?? 0;
  const taxAmount = Math.round(subtotal * taxRate);
  const total = subtotal + taxAmount;

  const invoice: Invoice = {
    id: invoiceId,
    invoice_id: invoiceId,
    subscription_id: subscriptionId,
    node_id: nodeId,
    stripe_invoice_id: options?.stripeInvoiceId,
    plan,
    billing_cycle: billingCycle,
    amount: total,
    amount_paid: 0,
    amount_due: total,
    amount_remaining: total,
    currency: 'usd',
    status: 'draft',
    period_start: periodStart,
    period_end: periodEnd,
    created_at: new Date(),
    updated_at: new Date(),
    line_items: lineItems,
    metadata: {
      generated_by: 'billing_service',
      stripe_invoice_id: options?.stripeInvoiceId || '',
    },
  };

  invoices.set(invoiceId, invoice);
  return invoice;
}

export function getInvoice(invoiceId: string): Invoice | null {
  return invoices.get(invoiceId) || null;
}

export function getInvoicesByNode(nodeId: string): Invoice[] {
  return Array.from(invoices.values())
    .filter(inv => inv.node_id === nodeId)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

export function getInvoicesBySubscription(subscriptionId: string): Invoice[] {
  return Array.from(invoices.values())
    .filter(inv => inv.subscription_id === subscriptionId)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

export function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
  paidAt?: Date
): Invoice | null {
  const invoice = invoices.get(invoiceId);
  if (!invoice) return null;

  invoice.status = status;
  invoice.updated_at = new Date();
  
  if (paidAt) {
    invoice.paid_at = paidAt;
    invoice.amount_paid = invoice.amount_due;
    invoice.amount_remaining = 0;
  }

  invoices.set(invoiceId, invoice);
  return invoice;
}

// ============================
// Proration Calculation
// ============================

export function calculateProration(
  subscriptionId: string,
  nodeId: string,
  fromPlan: PlanTier,
  toPlan: PlanTier,
  billingCycle: BillingCycle,
  effectiveDate: Date,
  currentPeriodEnd: Date
): ProrationPreview {
  const lineItems: ProrationLineItem[] = [];

  // Get plan details
  const fromPlanDetails = SUBSCRIPTION_PLANS[fromPlan];
  const toPlanDetails = SUBSCRIPTION_PLANS[toPlan];

  // Calculate prices
  const fromPrice = billingCycle === 'monthly'
    ? fromPlanDetails.price_monthly
    : fromPlanDetails.price_yearly;
  const toPrice = billingCycle === 'monthly'
    ? toPlanDetails.price_monthly
    : toPlanDetails.price_yearly;

  // Calculate period information
  const periodEnd = currentPeriodEnd;
  const totalPeriodDays = Math.ceil(
    (periodEnd.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysRemaining = Math.max(1, totalPeriodDays);

  // Daily rates
  const daysInPeriod = billingCycle === 'monthly' ? 30 : 365;
  const fromDailyRate = fromPrice / daysInPeriod;
  const toDailyRate = toPrice / daysInPeriod;

  // Credit for unused time on old plan (downgrade credit)
  if (fromPrice > toPrice && fromDailyRate > 0) {
    const creditAmount = Math.round(fromDailyRate * daysRemaining);
    if (creditAmount > 0) {
      lineItems.push({
        description: `Credit for unused ${fromPlanDetails.name} plan (${daysRemaining} days remaining)`,
        type: 'credit',
        amount: creditAmount,
        period_days_used: daysInPeriod - daysRemaining,
        total_period_days: daysInPeriod,
        daily_rate: fromDailyRate,
        plan_name: fromPlanDetails.name,
      });
    }
  }

  // Charge for new plan (upgrade charge)
  if (toPrice > fromPrice && toDailyRate > 0) {
    const chargeAmount = Math.round(toDailyRate * daysRemaining);
    if (chargeAmount > 0) {
      lineItems.push({
        description: `Charge for ${toPlanDetails.name} plan (${daysRemaining} days remaining)`,
        type: 'charge',
        amount: chargeAmount,
        period_days_used: daysInPeriod - daysRemaining,
        total_period_days: daysInPeriod,
        daily_rate: toDailyRate,
        plan_name: toPlanDetails.name,
      });
    }
  }

  // Calculate totals
  const creditAmount = lineItems
    .filter(item => item.type === 'credit')
    .reduce((sum, item) => sum + item.amount, 0);
  
  const chargeAmount = lineItems
    .filter(item => item.type === 'charge')
    .reduce((sum, item) => sum + item.amount, 0);
  
  const netAmount = chargeAmount - creditAmount;

  return {
    subscription_id: subscriptionId,
    node_id: nodeId,
    from_plan: fromPlan,
    to_plan: toPlan,
    billing_cycle: billingCycle,
    effective_date: effectiveDate,
    credit_amount: creditAmount,
    charge_amount: chargeAmount,
    net_amount: netAmount,
    line_items: lineItems,
    calculated_at: new Date(),
  };
}

/**
 * Calculate proration for immediate plan change
 * This calculates what the user owes/credit when switching plans mid-cycle
 */
export function calculateImmediateProration(
  fromPlan: PlanTier,
  toPlan: PlanTier,
  billingCycle: BillingCycle,
  changeDate: Date,
  periodStart: Date,
  periodEnd: Date
): {
  credit: number;
  charge: number;
  net: number;
  daysUsed: number;
  daysRemaining: number;
  description: string;
} {
  // Handle same-plan change - no proration needed
  if (fromPlan === toPlan) {
    return {
      credit: 0,
      charge: 0,
      net: 0,
      daysUsed: 0,
      daysRemaining: 0,
      description: `No change: staying on ${SUBSCRIPTION_PLANS[fromPlan].name} plan`,
    };
  }

  const fromPlanDetails = SUBSCRIPTION_PLANS[fromPlan];
  const toPlanDetails = SUBSCRIPTION_PLANS[toPlan];

  const fromPrice = billingCycle === 'monthly'
    ? fromPlanDetails.price_monthly
    : fromPlanDetails.price_yearly;
  const toPrice = billingCycle === 'monthly'
    ? toPlanDetails.price_monthly
    : toPlanDetails.price_yearly;

  const daysInPeriod = billingCycle === 'monthly' ? 30 : 365;
  
  // Calculate days used and remaining
  const daysUsed = Math.ceil(
    (changeDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysRemaining = Math.max(1, daysInPeriod - daysUsed);

  // Daily rates
  const fromDailyRate = fromPrice / daysInPeriod;
  const toDailyRate = toPrice / daysInPeriod;

  // Credit for unused portion of old plan
  const credit = Math.round(fromDailyRate * daysRemaining);

  // Charge for remaining days on new plan
  const charge = Math.round(toDailyRate * daysRemaining);

  // Net amount (positive = user owes, negative = user gets credit)
  const net = charge - credit;

  let description = '';
  if (net > 0) {
    description = `Upgrade from ${fromPlanDetails.name} to ${toPlanDetails.name}: charge $${(net / 100).toFixed(2)} for ${daysRemaining} days`;
  } else if (net < 0) {
    description = `Downgrade from ${fromPlanDetails.name} to ${toPlanDetails.name}: credit $${(Math.abs(net) / 100).toFixed(2)} for ${daysRemaining} days`;
  } else {
    description = `Plan change from ${fromPlanDetails.name} to ${toPlanDetails.name}: no net charge`;
  }

  return {
    credit,
    charge,
    net,
    daysUsed,
    daysRemaining,
    description,
  };
}

// ============================
// Webhook Event Access
// ============================

export function getWebhookEvent(eventId: string): BillingWebhookEvent | null {
  return webhookEvents.get(eventId) || null;
}

export function getRecentWebhookEvents(limit = 50): BillingWebhookEvent[] {
  return Array.from(webhookEvents.values())
    .sort((a, b) => b.processed_at.getTime() - a.processed_at.getTime())
    .slice(0, limit);
}

export function getWebhookEventsByType(type: StripeEventType): BillingWebhookEvent[] {
  return Array.from(webhookEvents.values())
    .filter(event => event.type === type);
}

// ============================
// Utility Functions
// ============================

export function getNextBillingDate(currentPeriodEnd: Date, billingCycle: BillingCycle): Date {
  const next = new Date(currentPeriodEnd);
  if (billingCycle === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}

export function formatCurrency(amount: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

// ============================
// Reset for Testing
// ============================

export function _resetBillingState(): void {
  webhookEvents.clear();
  invoices.clear();
  processedEvents.clear();
}
