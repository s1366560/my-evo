import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { resolveAuthorizedNodeId } from '../shared/node-access';
import * as service from './service';
import { normalizeBillingCycle, normalizePlanId, serializePlan } from './contracts';

export async function subscriptionRoutes(app: FastifyInstance) {
  app.get('/plans', {
    schema: { tags: ['Subscription'] },
  }, async () => {
    return {
      success: true,
      data: service.getPlans().map(serializePlan),
    };
  });

  app.get('/:nodeId', {
    schema: { tags: ['Subscription'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { nodeId: string };
    const nodeId = await resolveAuthorizedNodeId(app, auth, {
      requestedNodeId: params.nodeId,
      unauthorizedMessage: 'Cannot access subscription for another node',
    });
    const subscription = await service.getSubscription(nodeId);
    return { success: true, data: subscription };
  });

  app.get('/:nodeId/invoices', {
    schema: { tags: ['Subscription'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { nodeId: string };
    const query = request.query as { limit?: string; offset?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;
    const nodeId = await resolveAuthorizedNodeId(app, auth, {
      requestedNodeId: params.nodeId,
      unauthorizedMessage: 'Cannot access subscription invoices for another node',
    });
    const result = await service.listInvoices(nodeId, limit, offset);
    return { success: true, data: { items: result.items, total: result.total } };
  });

  app.post('/', {
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

    const plan = normalizePlanId(body.plan);
    const billingCycle = normalizeBillingCycle(body.billing_cycle);
    const autoRenew = body.auto_renew ?? true;

    const subscription = await service.createOrUpdateSubscription(
      nodeId,
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
    const nodeId = await resolveAuthorizedNodeId(app, auth, {
      requestedNodeId: params.nodeId,
      unauthorizedMessage: 'Cannot cancel subscription for another node',
    });

    await service.cancelSubscription(nodeId);
    return { success: true, data: { message: 'Subscription cancelled' } };
  });
}
