import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { ValidationError } from '../shared/errors';
import * as service from './service';

export async function subscriptionRoutes(app: FastifyInstance) {
  app.get('/plans', {
    schema: { tags: ['Subscription'] },
  }, async () => {
    return {
      success: true,
      data: [
        { id: 'free', name: 'Free', price: 0, billing_cycle: 'monthly', features: ['5 genes/month', 'Basic analytics'] },
        { id: 'pro', name: 'Pro', price: 1000, billing_cycle: 'monthly', features: ['50 genes/month', 'Advanced analytics', 'Priority support'] },
        { id: 'team', name: 'Team', price: 3000, billing_cycle: 'monthly', features: ['Unlimited genes', 'Team collaboration', 'API access', 'Custom integrations'] },
        { id: 'enterprise', name: 'Enterprise', price: 10000, billing_cycle: 'monthly', features: ['Everything in Team', 'Dedicated support', 'SLA guarantee', 'Custom contracts'] },
      ],
    };
  });

  app.get('/:nodeId', {
    schema: { tags: ['Subscription'] },
  }, async (request) => {
    const params = request.params as { nodeId: string };
    const subscription = await service.getSubscription(params.nodeId);
    return { success: true, data: subscription };
  });

  app.get('/:nodeId/invoices', {
    schema: { tags: ['Subscription'] },
  }, async (request) => {
    const params = request.params as { nodeId: string };
    const query = request.query as { limit?: string; offset?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;
    const result = await service.listInvoices(params.nodeId, limit, offset);
    return { success: true, data: { items: result.items, total: result.total } };
  });

  app.post('/', {
    schema: { tags: ['Subscription'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      plan?: string;
      billing_cycle?: string;
      auto_renew?: boolean;
    };

    const plan = body.plan ?? 'free';
    const billingCycle = body.billing_cycle ?? 'monthly';
    const autoRenew = body.auto_renew ?? true;

    const validPlans = ['free', 'pro', 'team', 'enterprise'];
    if (!validPlans.includes(plan)) {
      throw new ValidationError('Invalid plan. Must be one of: ' + validPlans.join(', '));
    }

    const validCycles = ['monthly', 'yearly'];
    if (!validCycles.includes(billingCycle)) {
      throw new ValidationError('Invalid billing_cycle. Must be monthly or yearly');
    }

    const subscription = await service.createOrUpdateSubscription(
      auth.node_id,
      plan,
      billingCycle,
      autoRenew,
    );

    void reply.status(201);
    return { success: true, data: subscription };
  });

  app.delete('/:nodeId', {
    schema: { tags: ['Subscription'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { nodeId: string };

    if (auth.node_id !== params.nodeId) {
      throw new ValidationError('Cannot cancel subscription for another node');
    }

    await service.cancelSubscription(params.nodeId);
    return { success: true, data: { message: 'Subscription cancelled' } };
  });
}
