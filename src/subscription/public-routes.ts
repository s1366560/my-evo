import type { FastifyInstance } from 'fastify';
import * as subscriptionService from './service';
import { SUBSCRIPTION_PLANS, CREDIT_PACKAGES } from './types';

export async function subscriptionPublicRoutes(app: FastifyInstance): Promise<void> {
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

  // Get a specific plan by ID
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
    const plan = subscriptionService.getPlan(planId as 'free' | 'premium' | 'ultra');

    if (!plan) {
      void reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: `Plan '${planId}' not found. Valid plans are: free, premium, ultra`,
      });
      return;
    }

    void reply.send({
      success: true,
      data: plan,
    });
  });

  // Compare all plans
  app.get('/compare', {
    schema: { tags: ['Subscription'] },
  }, async (_request, reply) => {
    const plans = subscriptionService.getAvailablePlans();
    
    // Create comparison matrix
    const comparison = {
      plans,
      features: {
        maps: { free: 3, premium: -1, ultra: -1 },
        nodes_per_map: { free: 50, premium: 500, ultra: -1 },
        collaborators: { free: 1, premium: 10, ultra: -1 },
        api_calls_per_month: { free: 100, premium: 10000, ultra: 100000 },
        storage_gb: { free: 1, premium: 10, ultra: 100 },
        gdi_analyses_per_month: { free: 5, premium: 50, ultra: -1 },
        priority_support: { free: false, premium: true, ultra: true },
        custom_branding: { free: false, premium: false, ultra: true },
        advanced_export: { free: false, premium: true, ultra: true },
      },
      pricing: {
        monthly: {
          free: 0,
          premium: 29,
          ultra: 99,
        },
        yearly: {
          free: 0,
          premium: 290,
          ultra: 990,
        },
        savings_yearly: {
          free: 0,
          premium: 58, // 2 months free
          ultra: 198,
        },
      },
    };

    void reply.send({
      success: true,
      data: comparison,
    });
  });

  // Get credit packages
  app.get('/credits/packages', {
    schema: { tags: ['Subscription'] },
  }, async (_request, reply) => {
    void reply.send({
      success: true,
      data: {
        packages: CREDIT_PACKAGES,
        currency: 'USD',
        note: 'Bonus credits are added on top of base credits',
      },
    });
  });

  // Get credit pricing info
  app.get('/credits/pricing', {
    schema: { tags: ['Subscription'] },
  }, async (_request, reply) => {
    void reply.send({
      success: true,
      data: {
        price_per_credit: 0.001, // $0.001 per credit (bulk discount applies)
        bulk_discounts: [
          { credits: 1000, price_per_credit: 0.00099 },
          { credits: 5000, price_per_credit: 0.000898 },
          { credits: 15000, price_per_credit: 0.000799 },
          { credits: 50000, price_per_credit: 0.000699 },
        ],
        free_credits_per_month: {
          free: 100,
          premium: 1000,
          ultra: 10000,
        },
      },
    });
  });

  // Get subscription benefits comparison
  app.get('/benefits', {
    schema: { tags: ['Subscription'] },
  }, async (_request, reply) => {
    void reply.send({
      success: true,
      data: {
        plans: [
          {
            id: 'free',
            name: 'Free',
            tagline: 'Get started with basic mapping',
            price: { monthly: 0, yearly: 0 },
            cta: 'Get Started',
            features: [
              { text: '3 maps', included: true },
              { text: '50 nodes per map', included: true },
              { text: 'Basic layouts', included: true },
              { text: 'Public sharing', included: true },
              { text: 'API access', included: false },
              { text: 'Priority support', included: false },
              { text: 'Custom branding', included: false },
            ],
          },
          {
            id: 'premium',
            name: 'Premium',
            tagline: 'For power users and teams',
            price: { monthly: 29, yearly: 290 },
            cta: 'Start Free Trial',
            popular: true,
            features: [
              { text: 'Unlimited maps', included: true },
              { text: '500 nodes per map', included: true },
              { text: 'All layouts', included: true },
              { text: 'Private sharing', included: true },
              { text: '10K API calls/month', included: true },
              { text: 'Priority email support', included: true },
              { text: 'Custom branding', included: false },
            ],
          },
          {
            id: 'ultra',
            name: 'Ultra',
            tagline: 'Enterprise-grade for organizations',
            price: { monthly: 99, yearly: 990 },
            cta: 'Contact Sales',
            features: [
              { text: 'Unlimited everything', included: true },
              { text: 'Unlimited nodes', included: true },
              { text: 'All layouts', included: true },
              { text: 'Encrypted maps', included: true },
              { text: '100K API calls/month', included: true },
              { text: '24/7 support', included: true },
              { text: 'Custom branding', included: true },
            ],
          },
        ],
      },
    });
  });
}
