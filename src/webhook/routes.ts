import type { FastifyInstance } from 'fastify';
import { requireNodeSecretAuth } from '../shared/auth';
import { ValidationError } from '../shared/errors';
import * as webhookService from './service';
import type { WebhookEventType } from './types';

function ensureNodeSecretAuth(
  auth: NonNullable<import('fastify').FastifyRequest['auth']>,
): void {
  if (auth.auth_type !== 'node_secret') {
    throw new ValidationError('Node secret credentials are required for webhook management');
  }
  if (!auth.node_id) {
    throw new ValidationError('Node ID not found in authentication context');
  }
}

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // Create a webhook subscription
  app.post('/subscriptions', {
    schema: { tags: ['Webhook'] },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const { url, events } = request.body as { url: string; events: WebhookEventType[] };

    const subscription = await webhookService.createSubscription({
      node_id: auth.node_id!,
      url,
      events,
    });

    void reply.status(201).send({
      success: true,
      data: {
        subscription,
        // Return the secret only on creation
        secret: subscription.secret,
      },
    });
  });

  // List webhook subscriptions
  app.get('/subscriptions', {
    schema: { tags: ['Webhook'] },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const subscriptions = webhookService.getNodeSubscriptions(auth.node_id!);

    void reply.send({
      success: true,
      data: {
        subscriptions,
        total: subscriptions.length,
      },
    });
  });

  // Get a specific subscription
  app.get('/subscriptions/:subscriptionId', {
    schema: { tags: ['Webhook'] },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const { subscriptionId } = request.params as { subscriptionId: string };
    const subscription = webhookService.getSubscription(subscriptionId);

    if (!subscription || subscription.node_id !== auth.node_id) {
      void reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: 'Subscription not found',
      });
      return;
    }

    void reply.send({
      success: true,
      data: subscription,
    });
  });

  // Update a subscription
  app.patch('/subscriptions/:subscriptionId', {
    schema: { tags: ['Webhook'] },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const { subscriptionId } = request.params as { subscriptionId: string };
    const { url, events, enabled } = request.body as {
      url?: string;
      events?: WebhookEventType[];
      enabled?: boolean;
    };

    const subscription = webhookService.getSubscription(subscriptionId);
    if (!subscription || subscription.node_id !== auth.node_id) {
      void reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: 'Subscription not found',
      });
      return;
    }

    const updated = webhookService.updateSubscription(subscriptionId, {
      url,
      events,
      enabled,
    });

    void reply.send({
      success: true,
      data: updated,
    });
  });

  // Delete a subscription
  app.delete('/subscriptions/:subscriptionId', {
    schema: { tags: ['Webhook'] },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const { subscriptionId } = request.params as { subscriptionId: string };
    const subscription = webhookService.getSubscription(subscriptionId);

    if (!subscription || subscription.node_id !== auth.node_id) {
      void reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: 'Subscription not found',
      });
      return;
    }

    webhookService.deleteSubscription(subscriptionId);

    void reply.send({
      success: true,
      message: 'Subscription deleted',
    });
  });

  // Get subscription secret (regenerate)
  app.post('/subscriptions/:subscriptionId/rotate-secret', {
    schema: { tags: ['Webhook'] },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const { subscriptionId } = request.params as { subscriptionId: string };
    const subscription = webhookService.getSubscription(subscriptionId);

    if (!subscription || subscription.node_id !== auth.node_id) {
      void reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: 'Subscription not found',
      });
      return;
    }

    // Delete and recreate with new secret
    webhookService.deleteSubscription(subscriptionId);
    const newSubscription = await webhookService.createSubscription({
      node_id: auth.node_id!,
      url: subscription.url,
      events: subscription.events,
    });

    void reply.send({
      success: true,
      data: {
        subscription: newSubscription,
        secret: newSubscription.secret,
      },
    });
  });

  // Get subscription deliveries
  app.get('/subscriptions/:subscriptionId/deliveries', {
    schema: { tags: ['Webhook'] },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const { subscriptionId } = request.params as { subscriptionId: string };
    const { limit } = request.query as { limit?: string };

    const subscription = webhookService.getSubscription(subscriptionId);
    if (!subscription || subscription.node_id !== auth.node_id) {
      void reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: 'Subscription not found',
      });
      return;
    }

    const deliveries = webhookService.getSubscriptionDeliveries(
      subscriptionId,
      limit ? parseInt(limit, 10) : 50
    );

    void reply.send({
      success: true,
      data: {
        deliveries,
        total: deliveries.length,
      },
    });
  });

  // Get a specific delivery
  app.get('/deliveries/:deliveryId', {
    schema: { tags: ['Webhook'] },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const { deliveryId } = request.params as { deliveryId: string };
    const delivery = webhookService.getDelivery(deliveryId);

    if (!delivery) {
      void reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: 'Delivery not found',
      });
      return;
    }

    const subscription = webhookService.getSubscription(delivery.subscription_id);
    if (!subscription || subscription.node_id !== auth.node_id) {
      void reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: 'Delivery not found',
      });
      return;
    }

    void reply.send({
      success: true,
      data: delivery,
    });
  });

  // Retry a failed delivery
  app.post('/deliveries/:deliveryId/retry', {
    schema: { tags: ['Webhook'] },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const { deliveryId } = request.params as { deliveryId: string };
    const delivery = webhookService.getDelivery(deliveryId);

    if (!delivery) {
      void reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: 'Delivery not found',
      });
      return;
    }

    const subscription = webhookService.getSubscription(delivery.subscription_id);
    if (!subscription || subscription.node_id !== auth.node_id) {
      void reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: 'Delivery not found',
      });
      return;
    }

    if (delivery.status === 'delivered') {
      void reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Cannot retry a successful delivery',
      });
      return;
    }

    // Retry the delivery
    const result = await webhookService.deliverWebhook(
      delivery.subscription_id,
      delivery.event_type,
      (delivery.payload as { data: Record<string, unknown> }).data
    );

    void reply.send({
      success: true,
      data: result,
    });
  });

  // List available event types
  app.get('/event-types', {
    schema: { tags: ['Webhook'] },
  }, async (_request, reply) => {
    const eventTypes: WebhookEventType[] = [
      'asset.published',
      'asset.promoted',
      'asset.revoked',
      'asset.reviewed',
      'task.available',
      'task.assigned',
      'task.completed',
      'bounty.created',
      'bounty.claimed',
      'bounty.paid',
      'council.proposal',
      'council.vote',
      'node.registered',
      'node.offline',
      'credits.changed',
      'review.created',
      'swarm.started',
      'swarm.completed',
      'message.received',
    ];

    void reply.send({
      success: true,
      data: {
        event_types: eventTypes,
        total: eventTypes.length,
      },
    });
  });
}
