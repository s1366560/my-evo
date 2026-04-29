import { describe, it, expect, beforeEach } from '@jest/globals';
import * as subscriptionService from './service';
import { SUBSCRIPTION_PLANS } from './types';

describe('Subscription Service', () => {
  beforeEach(() => {
    subscriptionService._resetTestState();
  });

  describe('getAvailablePlans', () => {
    it('should return all subscription plans', () => {
      const plans = subscriptionService.getAvailablePlans();
      expect(plans).toHaveLength(3);
      expect(plans.map(p => p.id)).toEqual(['free', 'premium', 'ultra']);
    });

    it('should include correct plan details', () => {
      const plans = subscriptionService.getAvailablePlans();
      const freePlan = plans.find(p => p.id === 'free');
      expect(freePlan?.price_monthly).toBe(0);
      expect(freePlan?.limits.maps).toBe(3);
      
      const premiumPlan = plans.find(p => p.id === 'premium');
      expect(premiumPlan?.price_monthly).toBe(2900);
      expect(premiumPlan?.limits.maps).toBe(-1); // unlimited
    });
  });

  describe('getPlan', () => {
    it('should return a specific plan by ID', () => {
      const plan = subscriptionService.getPlan('premium');
      expect(plan).not.toBeNull();
      expect(plan?.name).toBe('Premium');
    });

    it('should return null for invalid plan', () => {
      const plan = subscriptionService.getPlan('invalid' as 'free' | 'premium' | 'ultra');
      expect(plan).toBeNull();
    });
  });

  describe('createSubscription', () => {
    it('should create a free subscription', () => {
      const sub = subscriptionService.createSubscription('node_123', 'free', 'monthly');
      expect(sub.node_id).toBe('node_123');
      expect(sub.plan).toBe('free');
      expect(sub.billing_cycle).toBe('monthly');
      expect(sub.status).toBe('active');
      expect(sub.total_paid).toBe(0);
    });

    it('should create a premium subscription with initial invoice', () => {
      const sub = subscriptionService.createSubscription('node_456', 'premium', 'monthly');
      expect(sub.plan).toBe('premium');
      expect(sub.total_paid).toBe(2900); // $29.00
    });

    it('should create yearly subscription with correct price', () => {
      const sub = subscriptionService.createSubscription('node_789', 'ultra', 'yearly');
      expect(sub.billing_cycle).toBe('yearly');
      expect(sub.total_paid).toBe(99000); // $990.00
    });

    it('should throw for invalid plan', () => {
      expect(() => {
        subscriptionService.createSubscription('node_123', 'invalid' as 'free' | 'premium' | 'ultra', 'monthly');
      }).toThrow();
    });

    it('should throw for existing subscription', () => {
      subscriptionService.createSubscription('node_123', 'free', 'monthly');
      expect(() => {
        subscriptionService.createSubscription('node_123', 'premium', 'monthly');
      }).toThrow();
    });
  });

  describe('getSubscription', () => {
    it('should get existing subscription', () => {
      subscriptionService.createSubscription('node_123', 'premium', 'monthly');
      const sub = subscriptionService.getSubscription('node_123');
      expect(sub).not.toBeNull();
      expect(sub?.plan).toBe('premium');
    });

    it('should return null for non-existent subscription', () => {
      const sub = subscriptionService.getSubscription('nonexistent');
      expect(sub).toBeNull();
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription plan', () => {
      subscriptionService.createSubscription('node_123', 'free', 'monthly');
      const updated = subscriptionService.updateSubscription('node_123', { plan: 'premium' });
      expect(updated?.plan).toBe('premium');
    });

    it('should update billing cycle', () => {
      subscriptionService.createSubscription('node_123', 'free', 'monthly');
      const updated = subscriptionService.updateSubscription('node_123', { billing_cycle: 'yearly' });
      expect(updated?.billing_cycle).toBe('yearly');
    });

    it('should update auto_renew', () => {
      subscriptionService.createSubscription('node_123', 'free', 'monthly');
      const updated = subscriptionService.updateSubscription('node_123', { auto_renew: false });
      expect(updated?.auto_renew).toBe(false);
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription and downgrade to free', () => {
      subscriptionService.createSubscription('node_123', 'premium', 'monthly');
      const cancelled = subscriptionService.cancelSubscription('node_123');
      expect(cancelled?.status).toBe('cancelled');
      expect(cancelled?.plan).toBe('free');
      expect(cancelled?.auto_renew).toBe(false);
    });
  });

  describe('pauseSubscription', () => {
    it('should pause subscription', () => {
      subscriptionService.createSubscription('node_123', 'premium', 'monthly');
      const paused = subscriptionService.pauseSubscription('node_123');
      expect(paused?.status).toBe('paused');
    });
  });

  describe('resumeSubscription', () => {
    it('should resume paused subscription', () => {
      subscriptionService.createSubscription('node_123', 'premium', 'monthly');
      subscriptionService.pauseSubscription('node_123');
      const resumed = subscriptionService.resumeSubscription('node_123');
      expect(resumed?.status).toBe('active');
    });

    it('should throw for non-paused subscription', () => {
      subscriptionService.createSubscription('node_123', 'free', 'monthly');
      expect(() => {
        subscriptionService.resumeSubscription('node_123');
      }).toThrow();
    });
  });

  describe('checkPlanLimit', () => {
    it('should allow free plan for basic limits', () => {
      const check = subscriptionService.checkPlanLimit('free', 'maps');
      expect(check.allowed).toBe(true);
      expect(check.limit).toBe(3);
    });

    it('should allow unlimited for premium on maps', () => {
      const check = subscriptionService.checkPlanLimit('premium', 'maps');
      expect(check.allowed).toBe(true);
      expect(check.limit).toBe(-1); // unlimited
    });
  });

  describe('getSubscriptionInvoices', () => {
    it('should return invoices for subscription', () => {
      const sub = subscriptionService.createSubscription('node_123', 'premium', 'monthly');
      const invoices = subscriptionService.getSubscriptionInvoices(sub.subscription_id);
      expect(invoices).toHaveLength(1);
      const firstInvoice = invoices[0];
      expect(firstInvoice).toBeDefined();
      expect(firstInvoice!.plan).toBe('premium');
      expect(firstInvoice!.amount).toBe(2900);
    });

    it('should return empty for non-existent subscription', () => {
      const invoices = subscriptionService.getSubscriptionInvoices('nonexistent');
      expect(invoices).toHaveLength(0);
    });
  });

  describe('getOrCreateSubscription', () => {
    it('should return existing subscription', () => {
      subscriptionService.createSubscription('node_123', 'premium', 'monthly');
      const sub = subscriptionService.getOrCreateSubscription('node_123');
      expect(sub.plan).toBe('premium');
    });

    it('should create free subscription for new node', () => {
      const sub = subscriptionService.getOrCreateSubscription('new_node');
      expect(sub.plan).toBe('free');
      expect(sub.node_id).toBe('new_node');
    });
  });
});
