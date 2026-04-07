import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../shared/errors';

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'grace_period' | 'paused';

export interface SubscriptionInfo {
  subscription_id: string;
  node_id: string;
  plan: string;
  billing_cycle: string;
  status: SubscriptionStatus;
  started_at: string;
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
  total_paid: number;
  grace_period_end?: string;
}

const GRACE_PERIOD_DAYS = 7;

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export async function activateSubscription(
  nodeId: string,
  planId: string,
  billingCycle = 'monthly',
  autoRenew = true,
): Promise<SubscriptionInfo> {
  if (!nodeId) throw new ValidationError('nodeId is required');
  if (!['free', 'premium', 'ultra'].includes(planId)) {
    throw new ValidationError('Invalid planId. Must be free, premium, or ultra');
  }
  if (!['monthly', 'annual'].includes(billingCycle)) {
    throw new ValidationError('Invalid billingCycle. Must be monthly or annual');
  }

  const now = new Date();
  const periodEnd = new Date(now);
  if (billingCycle === 'annual') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const existing = await prisma.subscription.findUnique({
    where: { node_id: nodeId },
  });

  let subscription: Awaited<ReturnType<typeof prisma.subscription.upsert>>;

  if (existing) {
    subscription = await prisma.subscription.update({
      where: { node_id: nodeId },
      data: {
        plan: planId,
        billing_cycle: billingCycle,
        status: 'active',
        started_at: existing.started_at ?? now,
        current_period_start: now,
        current_period_end: periodEnd,
        auto_renew: autoRenew,
      },
    });
  } else {
    subscription = await prisma.subscription.create({
      data: {
        subscription_id: crypto.randomUUID(),
        node_id: nodeId,
        plan: planId,
        billing_cycle: billingCycle,
        status: 'active',
        started_at: now,
        current_period_start: now,
        current_period_end: periodEnd,
        auto_renew: autoRenew,
        total_paid: 0,
      },
    });
  }

  return mapToInfo(subscription);
}

export async function cancelSubscription(nodeId: string): Promise<void> {
  if (!nodeId) throw new ValidationError('nodeId is required');

  const subscription = await prisma.subscription.findUnique({
    where: { node_id: nodeId },
  });

  if (!subscription) {
    throw new NotFoundError('Subscription', nodeId);
  }

  await prisma.subscription.update({
    where: { node_id: nodeId },
    data: {
      status: 'cancelled',
      auto_renew: false,
    },
  });
}

export async function pauseSubscription(nodeId: string): Promise<void> {
  if (!nodeId) throw new ValidationError('nodeId is required');

  const subscription = await prisma.subscription.findUnique({
    where: { node_id: nodeId },
  });

  if (!subscription) {
    throw new NotFoundError('Subscription', nodeId);
  }

  if (subscription.status === 'cancelled') {
    throw new ValidationError('Cannot pause a cancelled subscription');
  }

  await prisma.subscription.update({
    where: { node_id: nodeId },
    data: { status: 'paused' },
  });
}

export async function renewSubscription(
  nodeId: string,
  billingCycle?: string,
): Promise<SubscriptionInfo> {
  if (!nodeId) throw new ValidationError('nodeId is required');

  const subscription = await prisma.subscription.findUnique({
    where: { node_id: nodeId },
  });

  if (!subscription) {
    throw new NotFoundError('Subscription', nodeId);
  }

  const cycle = billingCycle ?? subscription.billing_cycle;
  const now = new Date();
  const periodEnd = new Date(now);

  if (cycle === 'annual') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const planPrices: Record<string, number> = {
    premium: cycle === 'annual' ? 19200 : 2000,
    ultra: cycle === 'annual' ? 96000 : 10000,
  };
  const amount = planPrices[subscription.plan] ?? 0;

  const updated = await prisma.subscription.update({
    where: { node_id: nodeId },
    data: {
      status: 'active',
      billing_cycle: cycle,
      current_period_start: now,
      current_period_end: periodEnd,
      auto_renew: true,
      total_paid: subscription.total_paid + amount,
    },
  });

  // Create invoice record
  await prisma.subscriptionInvoice.create({
    data: {
      invoice_id: crypto.randomUUID(),
      subscription_id: subscription.subscription_id,
      node_id: nodeId,
      plan: subscription.plan,
      amount,
      billing_cycle: cycle,
      period_start: now,
      period_end: periodEnd,
      status: 'paid',
      paid_at: now,
    },
  });

  return mapToInfo(updated);
}

export async function getSubscriptionStatus(nodeId: string): Promise<SubscriptionInfo | null> {
  if (!nodeId) throw new ValidationError('nodeId is required');

  const subscription = await prisma.subscription.findUnique({
    where: { node_id: nodeId },
  });

  if (!subscription) return null;

  return mapToInfo(subscription);
}

export async function checkGracePeriod(nodeId: string): Promise<boolean> {
  if (!nodeId) return false;

  const subscription = await prisma.subscription.findUnique({
    where: { node_id: nodeId },
  });

  if (!subscription) return false;

  if (subscription.status === 'grace_period') {
    const graceEnd = new Date(subscription.current_period_end);
    graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);
    if (new Date() > graceEnd) {
      await prisma.subscription.update({
        where: { node_id: nodeId },
        data: { status: 'expired' },
      });
      return false;
    }
    return true;
  }

  if (subscription.status === 'active' && !subscription.auto_renew) {
    const periodEnd = new Date(subscription.current_period_end);
    const now = new Date();
    if (now >= periodEnd) {
      await prisma.subscription.update({
        where: { node_id: nodeId },
        data: { status: 'grace_period' },
      });
      return true;
    }
  }

  return false;
}

function mapToInfo(
  s: {
    subscription_id: string;
    node_id: string;
    plan: string;
    billing_cycle: string;
    status: string;
    started_at: Date;
    current_period_start: Date;
    current_period_end: Date;
    auto_renew: boolean;
    total_paid: number;
  },
): SubscriptionInfo {
  return {
    subscription_id: s.subscription_id,
    node_id: s.node_id,
    plan: s.plan,
    billing_cycle: s.billing_cycle,
    status: s.status as SubscriptionStatus,
    started_at: s.started_at.toISOString(),
    current_period_start: s.current_period_start.toISOString(),
    current_period_end: s.current_period_end.toISOString(),
    auto_renew: s.auto_renew,
    total_paid: s.total_paid,
  };
}
