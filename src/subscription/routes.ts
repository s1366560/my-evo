import type { FastifyInstance } from 'fastify';
import { requireNodeSecretAuth } from '../shared/auth';
import { ValidationError } from '../shared/errors';
import * as subscriptionService from './service';
import { SUBSCRIPTION_PLANS, CREDIT_PACKAGES } from './types';
import type { PlanTier, BillingCycle } from './types';

// Helper to ensure node secret auth
function ensureNodeSecretAuth(
  auth: NonNullable<import('fastify').FastifyRequest['auth']>,
): void {
  if (auth.auth_type !== 'node_secret') {
    throw new ValidationError('Node secret credentials are required for subscription management');
  }
  if (!auth.node_id) {
    throw new ValidationError('Node ID not found in authentication context');
  }
}

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================
  // Public Routes (no authentication required)
  // ============================================================

  // Get all available subscription plans
  app.get('/plans', {
    schema: { tags: ['Subscription'] },
  }, async (_request, reply) => {
    const plans = subscriptionService.getAvailablePlans();
    void reply.send({
      success: true,
      data: {
        plans,
        currency: 'USD',
      },
    });
  });

  // Get a specific plan
  app.get<{ Params: { planId: string } }>('/plans/:planId', {
    schema: {
      tags: ['Subscription'],
      params: {
        type: 'object',
        properties: {
          planId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { planId } = request.params;
    const plan = subscriptionService.getPlan(planId as PlanTier);

    if (!plan) {
      void reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: `Plan '${planId}' not found`,
      });
      return;
    }

    void reply.send({
      success: true,
      data: plan,
    });
  });

  // Get credit packages
  app.get('/credit-packages', {
    schema: { tags: ['Subscription'] },
  }, async (_request, reply) => {
    void reply.send({
      success: true,
      data: {
        packages: CREDIT_PACKAGES,
        currency: 'USD',
      },
    });
  });

  // ============================================================
  // Authenticated Routes (require node secret)
  // ============================================================

  // Get current subscription for authenticated node
  app.get('/me', {
    schema: { tags: ['Subscription'] },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const subscription = subscriptionService.getOrCreateSubscription(auth.node_id!);
    const response = subscriptionService.toSubscriptionResponse(subscription);

    void reply.send({
      success: true,
      data: response,
    });
  });

  // Get subscription by ID
  app.get<{ Params: { subscriptionId: string } }>('/:subscriptionId', {
    schema: {
      tags: ['Subscription'],
      params: {
        type: 'object',
        properties: {
          subscriptionId: { type: 'string' },
        },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const { subscriptionId } = request.params;
    const subscription = subscriptionService.getSubscriptionById(subscriptionId);

    if (!subscription) {
      void reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: 'Subscription not found',
      });
      return;
    }

    // Verify ownership
    if (subscription.node_id !== auth.node_id) {
      void reply.status(403).send({
        success: false,
        error: 'FORBIDDEN',
        message: 'You do not have access to this subscription',
      });
      return;
    }

    void reply.send({
      success: true,
      data: subscriptionService.toSubscriptionResponse(subscription),
    });
  });

  // Create subscription
  app.post('/', {
    schema: {
      tags: ['Subscription'],
      body: {
        type: 'object',
        required: ['plan', 'billing_cycle'],
        properties: {
          plan: { type: 'string', enum: ['free', 'premium', 'ultra'] },
          billing_cycle: { type: 'string', enum: ['monthly', 'yearly'] },
          payment_method_id: { type: 'string' },
        },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const { plan, billing_cycle } = request.body as {
      plan: PlanTier;
      billing_cycle: BillingCycle;
    };

    try {
      const subscription = subscriptionService.createSubscription(
        auth.node_id!,
        plan,
        billing_cycle
      );

      void reply.status(201).send({
        success: true,
        data: subscriptionService.toSubscriptionResponse(subscription),
        message: plan === 'free'
          ? 'Free subscription created successfully'
          : 'Subscription created. Invoice generated and marked as paid.',
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        void reply.status(400).send({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.message,
        });
        return;
      }
      throw error;
    }
  });

  // Update subscription
  app.patch('/', {
    schema: {
      tags: ['Subscription'],
      body: {
        type: 'object',
        properties: {
          plan: { type: 'string', enum: ['free', 'premium', 'ultra'] },
          billing_cycle: { type: 'string', enum: ['monthly', 'yearly'] },
          auto_renew: { type: 'boolean' },
        },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const { plan, billing_cycle, auto_renew } = request.body as {
      plan?: PlanTier;
      billing_cycle?: BillingCycle;
      auto_renew?: boolean;
    };

    try {
      const subscription = subscriptionService.updateSubscription(auth.node_id!, {
        plan,
        billing_cycle,
        auto_renew,
      });

      if (!subscription) {
        void reply.status(404).send({
          success: false,
          error: 'NOT_FOUND',
          message: 'Subscription not found',
        });
        return;
      }

      void reply.send({
        success: true,
        data: subscriptionService.toSubscriptionResponse(subscription),
        message: 'Subscription updated successfully',
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        void reply.status(400).send({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.message,
        });
        return;
      }
      throw error;
    }
  });

  // Cancel subscription (downgrade to free)
  app.delete('/', {
    schema: { tags: ['Subscription'] },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const subscription = subscriptionService.cancelSubscription(auth.node_id!);

    if (!subscription) {
      void reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: 'Subscription not found',
      });
      return;
    }

    void reply.send({
      success: true,
      data: subscriptionService.toSubscriptionResponse(subscription),
      message: 'Subscription cancelled and downgraded to Free plan',
    });
  });

  // Pause subscription
  app.post('/pause', {
    schema: { tags: ['Subscription'] },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const subscription = subscriptionService.pauseSubscription(auth.node_id!);

    if (!subscription) {
      void reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: 'Subscription not found',
      });
      return;
    }

    void reply.send({
      success: true,
      data: subscriptionService.toSubscriptionResponse(subscription),
      message: 'Subscription paused. You can resume anytime.',
    });
  });

  // Resume subscription
  app.post('/resume', {
    schema: { tags: ['Subscription'] },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    try {
      const subscription = subscriptionService.resumeSubscription(auth.node_id!);

      if (!subscription) {
        void reply.status(404).send({
          success: false,
          error: 'NOT_FOUND',
          message: 'Subscription not found',
        });
        return;
      }

      void reply.send({
        success: true,
        data: subscriptionService.toSubscriptionResponse(subscription),
        message: 'Subscription resumed successfully',
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        void reply.status(400).send({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.message,
        });
        return;
      }
      throw error;
    }
  });

  // Get invoices
  app.get('/invoices', {
    schema: { tags: ['Subscription'] },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const subscription = subscriptionService.getSubscription(auth.node_id!);

    if (!subscription) {
      void reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: 'Subscription not found',
      });
      return;
    }

    const invoices = subscriptionService.getSubscriptionInvoices(subscription.subscription_id);

    void reply.send({
      success: true,
      data: {
        invoices: invoices.map(subscriptionService.toInvoiceResponse),
        total: invoices.length,
      },
    });
  });

  // Get all invoices for node
  app.get<{ Params: { nodeId: string } }>('/invoices/node/:nodeId', {
    schema: {
      tags: ['Subscription'],
      params: {
        type: 'object',
        properties: {
          nodeId: { type: 'string' },
        },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    // Only allow accessing own invoices
    if (request.params.nodeId !== auth.node_id) {
      void reply.status(403).send({
        success: false,
        error: 'FORBIDDEN',
        message: 'You can only access your own invoices',
      });
      return;
    }

    const invoices = subscriptionService.getNodeInvoices(auth.node_id!);

    void reply.send({
      success: true,
      data: {
        invoices: invoices.map(subscriptionService.toInvoiceResponse),
        total: invoices.length,
      },
    });
  });

  // Check plan limits
  app.get<{ Params: { limitType: string } }>('/limits/:limitType', {
    schema: {
      tags: ['Subscription'],
      params: {
        type: 'object',
        properties: {
          limitType: { type: 'string' },
        },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const { limitType } = request.params;
    const subscription = subscriptionService.getSubscription(auth.node_id!);

    if (!subscription) {
      void reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: 'Subscription not found',
      });
      return;
    }

    const validLimitTypes = [
      'maps', 'nodes_per_map', 'collaborators',
      'api_calls_per_month', 'storage_gb', 'gdi_analyses_per_month',
      'priority_support', 'custom_branding', 'advanced_export'
    ] as const;

    if (!validLimitTypes.includes(limitType as typeof validLimitTypes[number])) {
      void reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: `Invalid limit type. Valid types: ${validLimitTypes.join(', ')}`,
      });
      return;
    }

    const check = subscriptionService.checkPlanLimit(
      subscription.plan,
      limitType as 'maps' | 'nodes_per_map' | 'collaborators' | 'api_calls_per_month' | 'storage_gb' | 'gdi_analyses_per_month' | 'priority_support' | 'custom_branding' | 'advanced_export'
    );

    void reply.send({
      success: true,
      data: {
        plan: subscription.plan,
        limit_type: limitType,
        ...check,
      },
    });
  });

  // Renew subscription (admin/internal use)
  app.post('/renew', {
    schema: { tags: ['Subscription'] },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const subscription = subscriptionService.renewSubscription(auth.node_id!);

    if (!subscription) {
      void reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: 'Subscription not found',
      });
      return;
    }

    void reply.send({
      success: true,
      data: subscriptionService.toSubscriptionResponse(subscription),
      message: 'Subscription renewed successfully',
    });
  });
}
