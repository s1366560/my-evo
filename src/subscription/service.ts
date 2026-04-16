import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../shared/errors';
import * as plans from './plans';
import * as status from './status';
import * as usageLimits from './usage-limits';
import * as paymentGateway from './payment-gateway';

export type { Plan, PlanId, PlanFeature, BillingCycle } from './plans';
export type { CheckoutSession, PaymentEvent, PaymentResult, RefundResult } from './payment-gateway';
export type { SubscriptionInfo, SubscriptionStatus } from './status';
export type { UsageRecord, UsageStats, ResourceType } from './usage-limits';
export interface SandboxEntitlement {
  plan: 'free' | 'premium' | 'ultra';
  enabled: boolean;
  concurrent_sandboxes: number;
  hard_isolated_mode: boolean;
}

export * from './plans';
export * from './payment-gateway';
export * from './status';
export * from './usage-limits';

// Re-export plan helpers
export { getPlans, getPlan, getPlanFeatures, createPlan, updatePlan } from './plans';

// Re-export status helpers
export {
  activateSubscription,
  pauseSubscription,
  renewSubscription,
  getSubscriptionStatus,
  checkGracePeriod,
} from './status';

// Re-export usage helpers
export { checkLimit, incrementUsage, resetMonthlyUsage, getUsageStats } from './usage-limits';

// Re-export payment helpers
export { createCheckoutSession, processWebhook, verifyPayment, refundPayment } from './payment-gateway';

let prisma = new PrismaClient();

function normalizeSandboxPlan(plan?: string | null): 'free' | 'premium' | 'ultra' {
  if (plan === 'premium' || plan === 'ultra') {
    return plan;
  }

  return 'free';
}

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
  plans.setPrisma(client);
  status.setPrisma(client);
  usageLimits.setPrisma(client);
}

// --- Original service functions (backward compatibility wrappers) ---

export async function getSubscription(nodeId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { node_id: nodeId },
  });
  return subscription;
}

export async function createOrUpdateSubscription(
  nodeId: string,
  plan: string,
  billingCycle: string,
  autoRenew: boolean,
) {
  return status.activateSubscription(nodeId, plan, billingCycle, autoRenew);
}

export async function cancelSubscription(nodeId: string) {
  return status.cancelSubscription(nodeId);
}

export async function getSandboxEntitlement(nodeId: string): Promise<SandboxEntitlement> {
  const subscription = await status.getSubscriptionStatus(nodeId);
  const activePlan = subscription
    && (subscription.status === 'active' || subscription.status === 'grace_period')
    ? normalizeSandboxPlan(subscription.plan)
    : 'free';
  const plan = plans.getPlan(activePlan);
  const hardIsolation = plan?.features.find((feature: { key: string }) => feature.key === 'hard_isolated_mode')?.value === true;

  return {
    plan: activePlan,
    enabled: activePlan !== 'free',
    concurrent_sandboxes: activePlan === 'free' ? 0 : plan?.limits.concurrent_sandboxes ?? 0,
    hard_isolated_mode: activePlan !== 'free' && hardIsolation,
  };
}

export async function listInvoices(nodeId: string, limit = 20, offset = 0) {
  const subscription = await prisma.subscription.findUnique({
    where: { node_id: nodeId },
  });

  if (!subscription) {
    throw new NotFoundError('Subscription', nodeId);
  }

  const [items, total] = await Promise.all([
    prisma.subscriptionInvoice.findMany({
      where: { subscription_id: subscription.subscription_id },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.subscriptionInvoice.count({
      where: { subscription_id: subscription.subscription_id },
    }),
  ]);

  return { items, total };
}
