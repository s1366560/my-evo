import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { resolveAuthorizedNodeId } from '../shared/node-access';
import * as service from './service';
import { normalizeBillingCycle, normalizePlanId } from './contracts';
import { getPlan } from './plans';
import { ValidationError } from '../shared/errors';

function formatSubscriptionStatusResponse(
  subscription: Awaited<ReturnType<typeof service.getSubscriptionStatus>>,
) {
  if (!subscription) {
    return {
      success: true,
      subscription: null,
      data: null,
    };
  }

  const plan = getPlan(subscription.plan as Parameters<typeof getPlan>[0]);
  const carbonTaxMultiplier = plan?.features.find(
    (feature) => feature.key === 'carbon_tax_multiplier',
  )?.value;
  const features = plan?.limits ? {
    api_rate_limit_per_min: plan.limits.api_calls_per_minute,
    max_swarm_nodes: plan.limits.max_swarm_nodes,
    concurrent_sandboxes: plan.limits.concurrent_sandboxes,
    carbon_tax_multiplier: carbonTaxMultiplier,
  } : undefined;
  const nextCharge = getSubscriptionCharge(subscription.plan, subscription.billing_cycle);

  return {
    success: true,
    subscription: {
      subscription_id: subscription.subscription_id,
      plan: subscription.plan,
      status: subscription.status,
      billing_cycle: subscription.billing_cycle,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      auto_renew: subscription.auto_renew,
      next_charge: nextCharge,
      features,
    },
    data: subscription,
  };
}

function formatCancellationResponse(
  subscription: Awaited<ReturnType<typeof service.getSubscriptionStatus>>,
) {
  if (!subscription) {
    return {
      success: true,
      status: 'ok',
      message: 'Subscription cancelled',
      grace_period_until: null,
      downgrade_to: null,
      refund_amount: 0,
      note: 'No active subscription remains for this node.',
      data: null,
    };
  }

  if (subscription.status === 'active' || subscription.status === 'grace_period') {
    return {
      success: true,
      status: 'ok',
      message: `Subscription cancelled. Access continues until ${subscription.current_period_end}`,
      grace_period_until: subscription.current_period_end,
      downgrade_to: 'free',
      refund_amount: 0,
      note: 'No refund for remaining period. Features remain available until period end.',
      data: subscription,
    };
  }

  if (subscription.status === 'paused') {
    return {
      success: true,
      status: 'ok',
      message: 'Auto-renew disabled while the subscription remains paused.',
      grace_period_until: null,
      downgrade_to: null,
      refund_amount: 0,
      note: 'Resume is still required to regain active access before any future billing.',
      data: subscription,
    };
  }

  if (subscription.status === 'expired') {
    return {
      success: true,
      status: 'ok',
      message: 'Subscription remains expired and will not auto-renew.',
      grace_period_until: null,
      downgrade_to: 'free',
      refund_amount: 0,
      note: 'No further charges will be created for this expired subscription.',
      data: subscription,
    };
  }

  return {
    success: true,
    status: 'ok',
    message: 'Subscription was already cancelled.',
    grace_period_until: null,
    downgrade_to: 'free',
    refund_amount: 0,
    note: 'No further action was required.',
    data: subscription,
  };
}

function getSubscriptionCharge(plan: string, billingCycle: string): number {
  if (plan === 'premium') {
    return billingCycle === 'annual' ? 19200 : 2000;
  }
  if (plan === 'ultra') {
    return billingCycle === 'annual' ? 96000 : 10000;
  }

  return 0;
}

function getSubscriptionPlanLabel(plan: string): string {
  if (plan === 'ultra') {
    return 'Ultra';
  }
  if (plan === 'premium') {
    return 'Premium';
  }

  return 'Free';
}

function parsePositiveInteger(value: string | undefined, field: string, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (!/^\d+$/.test(value)) {
    throw new ValidationError(`${field} must be a non-negative integer`);
  }

  const parsed = Number(value);
  return parsed;
}

export async function subscriptionPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', {
    schema: { tags: ['Subscription'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { node_id } = request.query as { node_id?: string };
    const nodeId = await resolveAuthorizedNodeId(app, auth, {
      requestedNodeId: node_id,
      missingNodeMessage: 'No accessible node found for current credentials',
      unauthorizedMessage: 'Cannot access subscription for another node',
    });
    const subscription = await service.getSubscriptionStatus(nodeId);
    return reply.send(formatSubscriptionStatusResponse(subscription));
  });

  app.get('/invoices', {
    schema: { tags: ['Subscription'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const query = request.query as {
      node_id?: string;
      limit?: string;
      offset?: string;
    };
    const nodeId = await resolveAuthorizedNodeId(app, auth, {
      requestedNodeId: query.node_id,
      missingNodeMessage: 'No accessible node found for current credentials',
      unauthorizedMessage: 'Cannot access subscription invoices for another node',
    });
    const limit = parsePositiveInteger(query.limit, 'limit', 20);
    const offset = parsePositiveInteger(query.offset, 'offset', 0);
    const result = await service.listInvoices(nodeId, limit, offset);

    return reply.send({
      success: true,
      invoices: result.items,
      total: result.total,
      data: { items: result.items, total: result.total },
    });
  });

  app.post('/change', {
    schema: { tags: ['Subscription'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = (request.body as {
      node_id?: string;
      plan?: string;
      billing_cycle?: string;
      auto_renew?: boolean;
    } | undefined) ?? {};
    const nodeId = await resolveAuthorizedNodeId(app, auth, {
      requestedNodeId: body.node_id,
      missingNodeMessage: 'No accessible node found for current credentials',
      unauthorizedMessage: 'Cannot manage subscription for another node',
    });
    const previousSubscription = await service.getSubscriptionStatus(nodeId);

    const subscription = await service.createOrUpdateSubscription(
      nodeId,
      normalizePlanId(body.plan),
      normalizeBillingCycle(body.billing_cycle),
      body.auto_renew ?? true,
    );

    const planLabel = getSubscriptionPlanLabel(subscription.plan);
    const amountCharged = Math.max(
      0,
      subscription.total_paid - (previousSubscription?.total_paid ?? 0),
    );

    return reply.send({
      success: true,
      status: 'ok',
      message: `Subscription upgraded to ${planLabel} (${subscription.billing_cycle})`,
      subscription_id: subscription.subscription_id,
      amount_charged: amountCharged,
      new_period_end: subscription.current_period_end,
      prorated_credit: 0,
      effective_immediately: true,
      data: subscription,
    });
  });

  app.post('/cancel', {
    schema: { tags: ['Subscription'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = (request.body as { node_id?: string } | undefined) ?? {};
    const nodeId = await resolveAuthorizedNodeId(app, auth, {
      requestedNodeId: body.node_id,
      missingNodeMessage: 'No accessible node found for current credentials',
      unauthorizedMessage: 'Cannot cancel subscription for another node',
    });
    await service.cancelSubscription(nodeId);
    const subscription = await service.getSubscriptionStatus(nodeId);
    return reply.send(formatCancellationResponse(subscription));
  });
}
