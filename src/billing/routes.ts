// Billing routes: webhook endpoint, invoice management, and proration preview
import type { FastifyInstance } from 'fastify';
import type { StripeWebhookPayload } from './types';
import {
  verifyStripeSignature,
  processWebhookEvent,
  generateInvoice,
  getInvoice,
  getInvoicesByNode,
  getInvoicesBySubscription,
  updateInvoiceStatus,
  calculateProration,
  calculateImmediateProration,
  getWebhookEvent,
  getRecentWebhookEvents,
  formatCurrency,
} from './service';
import { requireNodeSecretAuth } from '../shared/auth';
import type { PlanTier, BillingCycle } from '../subscription/types';
import { SUBSCRIPTION_PLANS } from '../subscription/types';

interface ProrationQuery {
  from_plan: PlanTier;
  to_plan: PlanTier;
  billing_cycle: BillingCycle;
  change_date?: string;
}

interface GenerateInvoiceBody {
  subscription_id: string;
  node_id: string;
  plan: PlanTier;
  billing_cycle: BillingCycle;
  period_start: string;
  period_end: string;
  include_proration?: boolean;
  proration_amount?: number;
}

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  // Webhook Endpoint
  app.post('/webhook', {
    schema: { tags: ['Billing'], description: 'Stripe webhook endpoint' },
  }, async (request, reply) => {
    const signature = request.headers['stripe-signature'] as string;
    const rawBody = JSON.stringify(request.body);
    if (!verifyStripeSignature(rawBody, signature)) {
      void reply.status(400).send({ success: false, error: 'INVALID_SIGNATURE' });
      return;
    }
    try {
      const payload = request.body as StripeWebhookPayload;
      const result = await processWebhookEvent(payload);
      void reply.status(200).send({
        success: true, received: true, event_id: result.event_id,
        event_type: result.event_type, processed: result.processed, actions_taken: result.actions_taken,
      });
    } catch (error) {
      void reply.status(200).send({ success: false, received: true, error: (error as Error).message });
    }
  });

  // Get Invoice
  app.get<{ Params: { invoiceId: string } }>('/invoices/:invoiceId', {
    schema: { tags: ['Billing'], params: { type: 'object', properties: { invoiceId: { type: 'string' } }, required: ['invoiceId'] } },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const invoice = getInvoice(request.params.invoiceId);
    if (!invoice) { void reply.status(404).send({ success: false, error: 'NOT_FOUND' }); return; }
    if (invoice.node_id !== auth.node_id) { void reply.status(403).send({ success: false, error: 'FORBIDDEN' }); return; }
    void reply.send({ success: true, data: { ...invoice, formatted_amount: formatCurrency(invoice.amount) } });
  });

  // Get Node Invoices
  app.get<{ Params: { nodeId: string } }>('/invoices/node/:nodeId', {
    schema: { tags: ['Billing'], params: { type: 'object', properties: { nodeId: { type: 'string' } }, required: ['nodeId'] } },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    if (request.params.nodeId !== auth.node_id) { void reply.status(403).send({ success: false, error: 'FORBIDDEN' }); return; }
    const invoices = getInvoicesByNode(auth.node_id!);
    void reply.send({ success: true, data: { invoices, total: invoices.length } });
  });

  // Get Subscription Invoices
  app.get<{ Params: { subscriptionId: string } }>('/subscriptions/:subscriptionId/invoices', {
    schema: { tags: ['Billing'], params: { type: 'object', properties: { subscriptionId: { type: 'string' } }, required: ['subscriptionId'] } },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const invoices = getInvoicesBySubscription(request.params.subscriptionId);
    void reply.send({ success: true, data: { invoices, total: invoices.length } });
  });

  // Generate Invoice
  app.post<{ Body: GenerateInvoiceBody }>('/invoices', {
    schema: {
      tags: ['Billing'],
      body: { type: 'object', required: ['subscription_id', 'node_id', 'plan', 'billing_cycle', 'period_start', 'period_end'],
        properties: { subscription_id: { type: 'string' }, node_id: { type: 'string' },
          plan: { type: 'string', enum: ['free', 'premium', 'ultra'] },
          billing_cycle: { type: 'string', enum: ['monthly', 'yearly'] },
          period_start: { type: 'string', format: 'date-time' }, period_end: { type: 'string', format: 'date-time' },
          include_proration: { type: 'boolean' }, proration_amount: { type: 'number' } } },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body;
    if (body.node_id !== auth.node_id) { void reply.status(403).send({ success: false, error: 'FORBIDDEN' }); return; }
    const invoice = generateInvoice(body.subscription_id, body.node_id, body.plan, body.billing_cycle,
      new Date(body.period_start), new Date(body.period_end), { includeProration: body.include_proration, prorationAmount: body.proration_amount });
    void reply.status(201).send({ success: true, data: { ...invoice, formatted_amount: formatCurrency(invoice.amount) } });
  });

  // Update Invoice Status
  app.patch<{ Params: { invoiceId: string }; Body: { status: string } }>('/invoices/:invoiceId/status', {
    schema: {
      tags: ['Billing'],
      params: { type: 'object', properties: { invoiceId: { type: 'string' } }, required: ['invoiceId'] },
      body: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['paid', 'void', 'uncollectible'] } } },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const invoice = getInvoice(request.params.invoiceId);
    if (!invoice) { void reply.status(404).send({ success: false, error: 'NOT_FOUND' }); return; }
    const updated = updateInvoiceStatus(request.params.invoiceId, request.body.status as 'paid' | 'void' | 'uncollectible',
      request.body.status === 'paid' ? new Date() : undefined);
    void reply.send({ success: true, data: { ...updated, formatted_amount: formatCurrency(updated!.amount) } });
  });

  // Proration Preview
  app.get<{ Querystring: ProrationQuery }>('/proration', {
    schema: {
      tags: ['Billing'],
      querystring: { type: 'object', required: ['from_plan', 'to_plan', 'billing_cycle'],
        properties: { from_plan: { type: 'string', enum: ['free', 'premium', 'ultra'] },
          to_plan: { type: 'string', enum: ['free', 'premium', 'ultra'] },
          billing_cycle: { type: 'string', enum: ['monthly', 'yearly'] },
          change_date: { type: 'string', format: 'date-time' } } },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const { from_plan, to_plan, billing_cycle, change_date } = request.query;
    if (from_plan === to_plan) { void reply.send({ success: true, data: { from_plan, to_plan, billing_cycle, credit_amount: 0, charge_amount: 0, net_amount: 0, description: 'No proration needed' } }); return; }
    const changeDate = change_date ? new Date(change_date) : new Date();
    const now = new Date();
    const periodEnd = new Date(now); periodEnd.setMonth(periodEnd.getMonth() + 1);
    const proration = calculateImmediateProration(from_plan, to_plan, billing_cycle, changeDate, now, periodEnd);
    void reply.send({ success: true, data: { from_plan, to_plan, billing_cycle, ...proration, formatted_net: formatCurrency(proration.net) } });
  });

  // Detailed Proration
  app.post('/proration/detailed', {
    schema: {
      tags: ['Billing'],
      body: { type: 'object', required: ['from_plan', 'to_plan', 'billing_cycle', 'effective_date', 'current_period_end', 'subscription_id'],
        properties: { from_plan: { type: 'string', enum: ['free', 'premium', 'ultra'] }, to_plan: { type: 'string', enum: ['free', 'premium', 'ultra'] },
          billing_cycle: { type: 'string', enum: ['monthly', 'yearly'] }, effective_date: { type: 'string', format: 'date-time' },
          current_period_end: { type: 'string', format: 'date-time' }, subscription_id: { type: 'string' } } },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { from_plan, to_plan, billing_cycle, effective_date, current_period_end, subscription_id } = request.body as {
      from_plan: PlanTier; to_plan: PlanTier; billing_cycle: BillingCycle; effective_date: string; current_period_end: string; subscription_id: string;
    };
    const proration = calculateProration(subscription_id, auth.node_id!, from_plan, to_plan, billing_cycle, new Date(effective_date), new Date(current_period_end));
    void reply.send({ success: true, data: { ...proration, formatted_net: formatCurrency(proration.net_amount) } });
  });

  // Webhook Events
  app.get('/webhooks', {
    schema: { tags: ['Billing'], querystring: { type: 'object', properties: { limit: { type: 'integer' }, type: { type: 'string' } } } },
  }, async (request, reply) => {
    const { limit = 50, type } = request.query as { limit?: number; type?: string };
    let events = getRecentWebhookEvents(limit);
    if (type) events = events.filter(e => e.type === type);
    void reply.send({ success: true, data: { events: events.map(e => ({ id: e.id, type: e.type, status: e.status })), total: events.length } });
  });

  app.get<{ Params: { eventId: string } }>('/webhooks/:eventId', {
    schema: { tags: ['Billing'], params: { type: 'object', properties: { eventId: { type: 'string' } }, required: ['eventId'] } },
  }, async (request, reply) => {
    const event = getWebhookEvent(request.params.eventId);
    if (!event) { void reply.status(404).send({ success: false, error: 'NOT_FOUND' }); return; }
    void reply.send({ success: true, data: { id: event.id, type: event.type, status: event.status } });
  });

  // Plans
  app.get('/plans', { schema: { tags: ['Billing'] } }, async (_request, reply) => {
    const plans = Object.values(SUBSCRIPTION_PLANS).map(plan => ({
      id: plan.id, name: plan.name, description: plan.description,
      price_monthly: plan.price_monthly, price_yearly: plan.price_yearly,
      formatted_price_monthly: plan.price_monthly > 0 ? formatCurrency(plan.price_monthly) : 'Free',
      formatted_price_yearly: plan.price_yearly > 0 ? formatCurrency(plan.price_yearly) : 'Free',
      features: plan.features, limits: plan.limits,
    }));
    void reply.send({ success: true, data: { plans, currency: 'USD' } });
  });

  // Checkout
  app.post('/checkout', {
    schema: { tags: ['Billing'], body: { type: 'object', required: ['plan', 'billing_cycle'],
      properties: { plan: { type: 'string', enum: ['free', 'premium', 'ultra'] }, billing_cycle: { type: 'string', enum: ['monthly', 'yearly'] } } } },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const { plan, billing_cycle } = request.body as { plan: PlanTier; billing_cycle: BillingCycle };
    const planDetails = SUBSCRIPTION_PLANS[plan];
    const price = billing_cycle === 'monthly' ? planDetails.price_monthly : planDetails.price_yearly;
    const sessionId = `cs_${Date.now()}`;
    void reply.status(201).send({ success: true, data: { session_id: sessionId, plan, billing_cycle, amount: price, formatted_amount: formatCurrency(price) } });
  });

  // Subscription Status
  app.get('/subscription/status', { schema: { tags: ['Billing'] }, preHandler: requireNodeSecretAuth() }, async (request, reply) => {
    const auth = request.auth!;
    void reply.send({ success: true, data: { node_id: auth.node_id, subscription_status: 'active', billing_status: 'current' } });
  });
}
