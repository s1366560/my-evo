import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, InsufficientCreditsError } from '../shared/errors';
import { getPlan } from './plans';

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'grace_period' | 'paused';

export interface SubscriptionInfo {
  subscription_id: string;
  node_id: string;
  plan: string;
  billing_cycle: string;
  scheduled_plan?: string;
  scheduled_billing_cycle?: string;
  scheduled_change_at?: string;
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

async function chargeNodeCredits(
  tx: Prisma.TransactionClient,
  nodeId: string,
  amount: number,
): Promise<number | null> {
  if (amount <= 0) {
    return null;
  }

  const debit = await tx.node.updateMany({
    where: {
      node_id: nodeId,
      credit_balance: { gte: amount },
    },
    data: {
      credit_balance: { decrement: amount },
    },
  });

  if (debit.count === 0) {
    const currentNode = await tx.node.findUnique({
      where: { node_id: nodeId },
    });

    if (!currentNode) {
      throw new NotFoundError('Node', nodeId);
    }

    throw new InsufficientCreditsError(amount, currentNode.credit_balance);
  }

  const debitedNode = await tx.node.findUnique({
    where: { node_id: nodeId },
  });

  if (!debitedNode) {
    throw new NotFoundError('Node', nodeId);
  }

  return debitedNode.credit_balance;
}

function isMatchingActiveSubscription(
  subscription: {
    plan: string;
    billing_cycle: string;
    status: string;
    current_period_end: Date;
    auto_renew: boolean;
  },
  planId: string,
  billingCycle: string,
  autoRenew: boolean,
  now: Date,
): boolean {
  return subscription.plan === planId
    && subscription.billing_cycle === billingCycle
    && subscription.status === 'active'
    && new Date(subscription.current_period_end) > now
    && subscription.auto_renew === autoRenew;
}

function isMatchingRenewedSubscription(
  subscription: {
    billing_cycle: string;
    status: string;
    current_period_end: Date;
    auto_renew: boolean;
    total_paid: number;
  },
  previousSubscription: {
    current_period_end: Date;
    total_paid: number;
  },
  billingCycle: string,
  amount: number,
  now: Date,
): boolean {
  return subscription.billing_cycle === billingCycle
    && subscription.status === 'active'
    && subscription.auto_renew
    && subscription.total_paid === previousSubscription.total_paid + amount
    && new Date(subscription.current_period_end) > now
    && new Date(subscription.current_period_end) > new Date(previousSubscription.current_period_end);
}

function getPlanCharge(planId: string, billingCycle: string): number {
  const plan = getPlan(planId as Parameters<typeof getPlan>[0]);
  if (!plan) {
    throw new ValidationError('Invalid planId. Must be free, premium, or ultra');
  }

  return billingCycle === 'annual'
    ? plan.price_annual_credits
    : plan.price_monthly_credits;
}

function getPlanRank(planId: string): number {
  if (planId === 'ultra') return 2;
  if (planId === 'premium') return 1;
  return 0;
}

function getNextPeriodEnd(start: Date, billingCycle: string): Date {
  const periodEnd = new Date(start);
  if (billingCycle === 'annual') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }
  return periodEnd;
}

async function applyScheduledDowngradeIfDue(
  subscription: {
    node_id: string;
    plan: string;
    billing_cycle: string;
    current_period_end: Date;
    scheduled_plan?: string | null;
    scheduled_billing_cycle?: string | null;
    scheduled_change_at?: Date | null;
  },
): Promise<void> {
  if (!subscription.scheduled_plan || !subscription.scheduled_change_at) {
    return;
  }

  const now = new Date();
  if (now < new Date(subscription.scheduled_change_at)) {
    return;
  }

  const nextCycle = subscription.scheduled_billing_cycle ?? subscription.billing_cycle;
  const nextPeriodStart = new Date(subscription.current_period_end);
  const nextPeriodEnd = getNextPeriodEnd(nextPeriodStart, nextCycle);

  await prisma.subscription.update({
    where: { node_id: subscription.node_id },
    data: {
      plan: subscription.scheduled_plan,
      billing_cycle: nextCycle,
      current_period_start: nextPeriodStart,
      current_period_end: nextPeriodEnd,
      scheduled_plan: null,
      scheduled_billing_cycle: null,
      scheduled_change_at: null,
    } as Prisma.SubscriptionUpdateInput,
  });
}

async function normalizeSubscriptionLifecycle(
  subscription: {
    node_id: string;
    plan: string;
    billing_cycle: string;
    current_period_end: Date;
    scheduled_plan?: string | null;
    scheduled_billing_cycle?: string | null;
    scheduled_change_at?: Date | null;
    status: string;
    auto_renew: boolean;
  },
) {
  await applyScheduledDowngradeIfDue(subscription);

  let refreshed = await prisma.subscription.findUnique({
    where: { node_id: subscription.node_id },
  });

  if (!refreshed) {
    return null;
  }

  const now = new Date();

  if (refreshed.status === 'grace_period') {
    const graceEnd = new Date(refreshed.current_period_end);
    graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);
    if (now > graceEnd) {
      await prisma.subscription.update({
        where: { node_id: subscription.node_id },
        data: { status: 'expired' },
      });
      refreshed = await prisma.subscription.findUnique({
        where: { node_id: subscription.node_id },
      });
    }
    return refreshed;
  }

  if (refreshed.status === 'active' && !refreshed.auto_renew) {
    const periodEnd = new Date(refreshed.current_period_end);
    if (now >= periodEnd) {
      await prisma.subscription.update({
        where: { node_id: subscription.node_id },
        data: { status: 'grace_period' },
      });
      refreshed = await prisma.subscription.findUnique({
        where: { node_id: subscription.node_id },
      });
    }
  }

  return refreshed;
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
  const periodEnd = getNextPeriodEnd(now, billingCycle);

  const amount = getPlanCharge(planId, billingCycle);
  const subscription = await prisma.$transaction(async (tx) => {
    const [existing, node] = await Promise.all([
      tx.subscription.findUnique({
        where: { node_id: nodeId },
      }),
      tx.node.findUnique({
        where: { node_id: nodeId },
      }),
    ]);

    if (!node) {
      throw new NotFoundError('Node', nodeId);
    }
    if (existing && isMatchingActiveSubscription(existing, planId, billingCycle, autoRenew, now)) {
      return existing;
    }

    if (
      existing
      && existing.plan === planId
      && existing.billing_cycle === billingCycle
      && existing.status === 'active'
      && new Date(existing.current_period_end) > now
    ) {
      return tx.subscription.update({
        where: { node_id: nodeId },
        data: {
          auto_renew: autoRenew,
          scheduled_plan: null,
          scheduled_billing_cycle: null,
          scheduled_change_at: null,
        } as Prisma.SubscriptionUpdateInput,
      });
    }

    if (
      existing
      && existing.status === 'active'
      && new Date(existing.current_period_end) > now
      && getPlanRank(planId) < getPlanRank(existing.plan)
    ) {
      return tx.subscription.update({
        where: { node_id: nodeId },
        data: {
          auto_renew: autoRenew,
          scheduled_plan: planId,
          scheduled_billing_cycle: billingCycle,
          scheduled_change_at: existing.current_period_end,
        } as Prisma.SubscriptionUpdateInput,
      });
    }

    let shouldCharge = amount > 0;

    const nextSubscription = existing
      ? await (async () => {
        const transition = await tx.subscription.updateMany({
          where: {
            node_id: nodeId,
            plan: existing.plan,
            billing_cycle: existing.billing_cycle,
            status: existing.status,
            current_period_end: existing.current_period_end,
            auto_renew: existing.auto_renew,
            total_paid: existing.total_paid,
          },
          data: {
            plan: planId,
            billing_cycle: billingCycle,
            status: 'active',
            started_at: existing.started_at ?? now,
            current_period_start: now,
            current_period_end: periodEnd,
            auto_renew: autoRenew,
            scheduled_plan: null,
            scheduled_billing_cycle: null,
            scheduled_change_at: null,
            ...(amount > 0 ? { total_paid: { increment: amount } } : {}),
          } as Prisma.SubscriptionUpdateManyMutationInput,
        });

        if (transition.count === 0) {
          const latest = await tx.subscription.findUnique({
            where: { node_id: nodeId },
          });

          if (latest && isMatchingActiveSubscription(latest, planId, billingCycle, autoRenew, now)) {
            shouldCharge = false;
            return latest;
          }

          throw new ValidationError('Subscription changed concurrently. Please retry.');
        }

        const updatedSubscription = await tx.subscription.findUnique({
          where: { node_id: nodeId },
        });

        if (!updatedSubscription) {
          throw new NotFoundError('Subscription', nodeId);
        }

        return updatedSubscription;
      })()
      : await tx.subscription.create({
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
          scheduled_plan: null,
          scheduled_billing_cycle: null,
          scheduled_change_at: null,
          total_paid: amount,
        } as Prisma.SubscriptionCreateInput,
      });

    if (shouldCharge) {
      const balanceAfterCharge = await chargeNodeCredits(tx, nodeId, amount);

      await tx.creditTransaction.create({
        data: {
          node_id: nodeId,
          amount: -amount,
          type: 'subscription_payment',
          description: `Subscription change to ${planId} (${billingCycle})`,
          balance_after: balanceAfterCharge!,
        },
      });

      await tx.subscriptionInvoice.create({
        data: {
          invoice_id: crypto.randomUUID(),
          subscription_id: nextSubscription.subscription_id,
          node_id: nodeId,
          plan: planId,
          amount,
          billing_cycle: billingCycle,
          period_start: now,
          period_end: periodEnd,
          status: 'paid',
          paid_at: now,
        },
      });
    }

    return nextSubscription;
  });

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
      status: subscription.status,
      auto_renew: false,
      scheduled_plan: null,
      scheduled_billing_cycle: null,
      scheduled_change_at: null,
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

  const updated = await prisma.$transaction(async (tx) => {
    const [subscription, node] = await Promise.all([
      tx.subscription.findUnique({
        where: { node_id: nodeId },
      }),
      tx.node.findUnique({
        where: { node_id: nodeId },
      }),
    ]);

    if (!subscription) {
      throw new NotFoundError('Subscription', nodeId);
    }

    const cycle = billingCycle ?? subscription.billing_cycle;
    if (!['monthly', 'annual'].includes(cycle)) {
      throw new ValidationError('Invalid billingCycle. Must be monthly or annual');
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (cycle === 'annual') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const amount = getPlanCharge(subscription.plan, cycle);

    if (!node) {
      throw new NotFoundError('Node', nodeId);
    }

    let shouldCharge = amount > 0;
    const transition = await tx.subscription.updateMany({
      where: {
        node_id: nodeId,
        billing_cycle: subscription.billing_cycle,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        auto_renew: subscription.auto_renew,
        total_paid: subscription.total_paid,
      },
      data: {
        status: 'active',
        billing_cycle: cycle,
        current_period_start: now,
        current_period_end: periodEnd,
        auto_renew: true,
        ...(amount > 0 ? { total_paid: { increment: amount } } : {}),
      },
    });

    const nextSubscription = await tx.subscription.findUnique({
      where: { node_id: nodeId },
    });

    if (transition.count === 0) {
      if (
        nextSubscription
        && isMatchingRenewedSubscription(nextSubscription, subscription, cycle, amount, now)
      ) {
        shouldCharge = false;
      } else {
        throw new ValidationError('Subscription changed concurrently. Please retry.');
      }
    }

    if (!nextSubscription) {
      throw new NotFoundError('Subscription', nodeId);
    }

    if (shouldCharge) {
      const balanceAfterCharge = await chargeNodeCredits(tx, nodeId, amount);

      await tx.creditTransaction.create({
        data: {
          node_id: nodeId,
          amount: -amount,
          type: 'subscription_payment',
          description: `Subscription renewal for ${subscription.plan} (${cycle})`,
          balance_after: balanceAfterCharge!,
        },
      });

      await tx.subscriptionInvoice.create({
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
    }

    return nextSubscription;
  });

  return mapToInfo(updated);
}

export async function getSubscriptionStatus(nodeId: string): Promise<SubscriptionInfo | null> {
  if (!nodeId) throw new ValidationError('nodeId is required');

  const subscription = await prisma.subscription.findUnique({
    where: { node_id: nodeId },
  });

  if (!subscription) return null;

  const refreshed = await normalizeSubscriptionLifecycle(subscription);

  if (!refreshed) return null;

  return mapToInfo(refreshed);
}

export async function checkGracePeriod(nodeId: string): Promise<boolean> {
  if (!nodeId) return false;

  const subscription = await prisma.subscription.findUnique({
    where: { node_id: nodeId },
  });

  if (!subscription) return false;

  const refreshed = await normalizeSubscriptionLifecycle(subscription);

  if (!refreshed) return false;
  return refreshed.status === 'grace_period';
}

function mapToInfo(
  s: {
    subscription_id: string;
    node_id: string;
    plan: string;
    billing_cycle: string;
    scheduled_plan?: string | null;
    scheduled_billing_cycle?: string | null;
    scheduled_change_at?: Date | null;
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
    ...(s.scheduled_plan ? { scheduled_plan: s.scheduled_plan } : {}),
    ...(s.scheduled_billing_cycle ? { scheduled_billing_cycle: s.scheduled_billing_cycle } : {}),
    ...(s.scheduled_change_at ? { scheduled_change_at: s.scheduled_change_at.toISOString() } : {}),
    status: s.status as SubscriptionStatus,
    started_at: s.started_at.toISOString(),
    current_period_start: s.current_period_start.toISOString(),
    current_period_end: s.current_period_end.toISOString(),
    auto_renew: s.auto_renew,
    total_paid: s.total_paid,
  };
}
