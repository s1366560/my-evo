import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { resolveAuthorizedNodeId } from '../shared/node-access';
import * as service from './service';
import { normalizeBillingCycle, normalizePlanId } from './contracts';

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
    return reply.send({ success: true, data: subscription });
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

    const subscription = await service.createOrUpdateSubscription(
      nodeId,
      normalizePlanId(body.plan),
      normalizeBillingCycle(body.billing_cycle),
      body.auto_renew ?? true,
    );

    return reply.send({ success: true, data: subscription });
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
    return reply.send({
      success: true,
      data: { message: 'Subscription cancelled' },
    });
  });
}
