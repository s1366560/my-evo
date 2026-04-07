import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
} from '../shared/errors';
import * as service from './service';
import * as plans from './plans';
import * as status from './status';
import * as paymentGateway from './payment-gateway';
import * as usageLimits from './usage-limits';

const {
  getPlans,
  getPlan,
  getPlanFeatures,
  createPlan,
  updatePlan,
  activateSubscription,
  cancelSubscription,
  pauseSubscription,
  renewSubscription,
  getSubscriptionStatus,
  checkLimit,
  incrementUsage,
  resetMonthlyUsage,
  getUsageStats,
  createCheckoutSession,
  processWebhook,
  verifyPayment,
  refundPayment,
  getSubscription,
  createOrUpdateSubscription,
  listInvoices,
  checkGracePeriod,
} = service;

const mockPrisma = {
  node: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  subscription: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  subscriptionInvoice: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
} as any;

// Helper to set subscription plan in mocks
const mockSubscription = (plan = 'free') => ({
  subscription_id: 'sub_123',
  node_id: 'node-1',
  plan,
  billing_cycle: 'monthly',
  status: 'active',
  started_at: new Date(),
  current_period_start: new Date(),
  current_period_end: new Date(),
  auto_renew: true,
  total_paid: 0,
});

describe('Subscription Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
    status.setPrisma(mockPrisma as unknown as PrismaClient);
    usageLimits.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =====================
  // Plans Module Tests
  // =====================

  describe('getPlans', () => {
    it('should return all available plans', () => {
      const plansResult = getPlans();
      expect(plansResult).toHaveLength(3);
      expect(plansResult.map((p) => p.id)).toEqual(['free', 'premium', 'ultra']);
    });

    it('should include free plan with correct limits', () => {
      const plansResult = getPlans();
      const free = plansResult.find((p) => p.id === 'free');
      expect(free).toBeDefined();
      expect(free?.price_monthly_credits).toBe(0);
      expect(free?.limits['api_calls_per_minute']).toBe(10);
      expect(free?.limits['max_swarm_nodes']).toBe(5);
    });

    it('should include premium plan with correct pricing', () => {
      const plansResult = getPlans();
      const premium = plansResult.find((p) => p.id === 'premium');
      expect(premium).toBeDefined();
      expect(premium?.price_monthly_credits).toBe(2000);
      expect(premium?.price_annual_credits).toBe(19200);
      expect(premium?.limits['api_calls_per_minute']).toBe(30);
    });

    it('should include ultra plan with unlimited features', () => {
      const plansResult = getPlans();
      const ultra = plansResult.find((p) => p.id === 'ultra');
      expect(ultra).toBeDefined();
      expect(ultra?.price_monthly_credits).toBe(10000);
      expect(ultra?.limits['publish_per_day']).toBe(-1);
      expect(ultra?.limits['arena_battles_per_day']).toBe(-1);
    });
  });

  describe('getPlan', () => {
    it('should return plan by id', () => {
      const plan = getPlan('premium');
      expect(plan).toBeDefined();
      expect(plan?.name).toBe('Premium');
    });

    it('should return undefined for unknown plan', () => {
      const plan = getPlan('enterprise' as any);
      expect(plan).toBeUndefined();
    });
  });

  describe('getPlanFeatures', () => {
    it('should return features for a valid plan', () => {
      const features = getPlanFeatures('premium');
      expect(features.length).toBeGreaterThan(0);
      expect(features.some((f) => f.key === 'api_calls_per_minute')).toBe(true);
    });

    it('should return empty array for unknown plan', () => {
      const features = getPlanFeatures('unknown' as any);
      expect(features).toEqual([]);
    });
  });

  describe('createPlan', () => {
    it('should create a custom plan', async () => {
      const customPlan = await createPlan({
        name: 'Custom Plan',
        description: 'A custom plan',
        price_monthly: 0,
        price_annual: 0,
        price_monthly_credits: 5000,
        price_annual_credits: 50000,
        features: [{ key: 'custom_feature', value: true }],
        limits: { api_calls_per_minute: 100 },
        available: true,
      });
      expect(customPlan.name).toBe('Custom Plan');
      expect(customPlan.price_monthly_credits).toBe(5000);
    });
  });

  describe('updatePlan', () => {
    it('should update an existing plan', async () => {
      const updated = await updatePlan('free', { description: 'Updated description' });
      expect(updated.id).toBe('free');
      expect(updated.description).toBe('Updated description');
    });

    it('should throw for unknown plan', async () => {
      await expect(updatePlan('unknown' as any, {})).rejects.toThrow('Plan not found');
    });
  });

  // =====================
  // Status Module Tests
  // =====================

  describe('activateSubscription', () => {
    it('should activate subscription for existing node', async () => {
      const mockSub = {
        subscription_id: 'sub_123',
        node_id: 'node-1',
        plan: 'free',
        billing_cycle: 'monthly',
        status: 'active',
        started_at: new Date(),
        current_period_start: new Date(),
        current_period_end: new Date(),
        auto_renew: true,
        total_paid: 0,
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSub);
      mockPrisma.subscription.update.mockResolvedValue({
        ...mockSub,
        plan: 'premium',
      });

      const result = await activateSubscription('node-1', 'premium');
      expect(result.plan).toBe('premium');
      expect(result.status).toBe('active');
      expect(mockPrisma.subscription.update).toHaveBeenCalled();
    });

    it('should create subscription if not exists', async () => {
      const newSub = {
        subscription_id: 'sub_new',
        node_id: 'node-2',
        plan: 'premium',
        billing_cycle: 'monthly',
        status: 'active',
        started_at: new Date(),
        current_period_start: new Date(),
        current_period_end: new Date(),
        auto_renew: true,
        total_paid: 0,
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue(newSub);

      const result = await activateSubscription('node-2', 'premium', 'monthly', true);
      expect(result.plan).toBe('premium');
      expect(mockPrisma.subscription.create).toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid planId', async () => {
      await expect(activateSubscription('node-1', 'invalid' as any)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid billingCycle', async () => {
      await expect(activateSubscription('node-1', 'premium', 'weekly' as any)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty nodeId', async () => {
      await expect(activateSubscription('', 'premium')).rejects.toThrow(ValidationError);
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel active subscription', async () => {
      const mockSub = {
        subscription_id: 'sub_123',
        node_id: 'node-1',
        plan: 'premium',
        status: 'active',
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSub);
      mockPrisma.subscription.update.mockResolvedValue({
        ...mockSub,
        status: 'cancelled',
        auto_renew: false,
      });

      await cancelSubscription('node-1');
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'cancelled', auto_renew: false }),
        }),
      );
    });

    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      await expect(cancelSubscription('unknown')).rejects.toThrow(NotFoundError);
    });
  });

  describe('pauseSubscription', () => {
    it('should pause active subscription', async () => {
      const mockSub = {
        subscription_id: 'sub_123',
        node_id: 'node-1',
        status: 'active',
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSub);
      mockPrisma.subscription.update.mockResolvedValue({
        ...mockSub,
        status: 'paused',
      });

      await pauseSubscription('node-1');
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'paused' }),
        }),
      );
    });

    it('should throw ValidationError when pausing cancelled subscription', async () => {
      const mockSub = {
        subscription_id: 'sub_123',
        node_id: 'node-1',
        status: 'cancelled',
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSub);
      await expect(pauseSubscription('node-1')).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      await expect(pauseSubscription('unknown')).rejects.toThrow(NotFoundError);
    });
  });

  describe('renewSubscription', () => {
    it('should renew subscription and create invoice', async () => {
      const mockSub = {
        subscription_id: 'sub_123',
        node_id: 'node-1',
        plan: 'premium',
        billing_cycle: 'monthly',
        status: 'active',
        started_at: new Date(),
        current_period_start: new Date(),
        current_period_end: new Date(),
        auto_renew: true,
        total_paid: 2000,
      };

      const updatedSub = { ...mockSub, total_paid: 4000 };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSub);
      mockPrisma.subscription.update.mockResolvedValue(updatedSub);
      mockPrisma.subscriptionInvoice.create.mockResolvedValue({});

      const result = await renewSubscription('node-1');
      expect(result.total_paid).toBe(4000);
      expect(mockPrisma.subscriptionInvoice.create).toHaveBeenCalled();
    });

    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      await expect(renewSubscription('unknown')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getSubscriptionStatus', () => {
    it('should return subscription info for active node', async () => {
      const mockSub = {
        subscription_id: 'sub_123',
        node_id: 'node-1',
        plan: 'premium',
        billing_cycle: 'monthly',
        status: 'active',
        started_at: new Date(),
        current_period_start: new Date(),
        current_period_end: new Date(),
        auto_renew: true,
        total_paid: 2000,
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSub);

      const result = await getSubscriptionStatus('node-1');
      expect(result).toBeDefined();
      expect(result?.plan).toBe('premium');
      expect(result?.status).toBe('active');
    });

    it('should return null for unknown node', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      const result = await getSubscriptionStatus('unknown');
      expect(result).toBeNull();
    });
  });

  describe('checkGracePeriod', () => {
    it('should return false for unknown node', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      const result = await checkGracePeriod('unknown');
      expect(result).toBe(false);
    });

    it('should return false for active subscription with auto_renew', async () => {
      const mockSub = {
        subscription_id: 'sub_123',
        node_id: 'node-1',
        status: 'active',
        auto_renew: true,
        current_period_end: new Date(),
      };
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSub);
      const result = await checkGracePeriod('node-1');
      expect(result).toBe(false);
    });
  });

  // =====================
  // Payment Gateway Tests
  // =====================

  describe('createCheckoutSession', () => {
    it('should create a valid checkout session', () => {
      const session = createCheckoutSession('node-1', 'premium', 'monthly', 2000);
      expect(session.session_id).toBeDefined();
      expect(session.user_id).toBe('node-1');
      expect(session.plan_id).toBe('premium');
      expect(session.billing_cycle).toBe('monthly');
      expect(session.amount_credits).toBe(2000);
      expect(session.status).toBe('pending');
      expect(session.expires_at).toBeDefined();
    });

    it('should throw ValidationError for invalid planId', () => {
      expect(() => createCheckoutSession('node-1', 'invalid' as any, 'monthly', 2000)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid billingCycle', () => {
      expect(() => createCheckoutSession('node-1', 'premium', 'weekly' as any, 2000)).toThrow(ValidationError);
    });

    it('should throw ValidationError for negative amount', () => {
      expect(() => createCheckoutSession('node-1', 'premium', 'monthly', -100)).toThrow(ValidationError);
    });

    it('should throw ValidationError for empty userId', () => {
      expect(() => createCheckoutSession('', 'premium', 'monthly', 2000)).toThrow(ValidationError);
    });
  });

  describe('processWebhook', () => {
    it('should handle payment.succeeded event', async () => {
      const event: paymentGateway.PaymentEvent = {
        event_id: 'evt_1',
        event_type: 'payment.succeeded',
        payment_id: 'pay_1',
        user_id: 'node-1',
        amount: 2000,
        status: 'succeeded',
        timestamp: new Date().toISOString(),
      };

      const result = await processWebhook(event);
      expect(result.payment_id).toBe('pay_1');
      expect(result.status).toBe('succeeded');
      expect(result.credits_deducted).toBe(true);
      expect(result.subscription_activated).toBe(true);
    });

    it('should handle payment.failed event', async () => {
      const event: paymentGateway.PaymentEvent = {
        event_id: 'evt_2',
        event_type: 'payment.failed',
        payment_id: 'pay_2',
        user_id: 'node-1',
        amount: 2000,
        status: 'failed',
        timestamp: new Date().toISOString(),
      };

      const result = await processWebhook(event);
      expect(result.status).toBe('failed');
      expect(result.credits_deducted).toBe(false);
    });

    it('should handle payment.refunded event', async () => {
      const event: paymentGateway.PaymentEvent = {
        event_id: 'evt_3',
        event_type: 'payment.refunded',
        payment_id: 'pay_3',
        user_id: 'node-1',
        amount: 2000,
        status: 'refunded',
        timestamp: new Date().toISOString(),
      };

      const result = await processWebhook(event);
      expect(result.status).toBe('refunded');
    });

    it('should handle subscription.renewed event', async () => {
      const event: paymentGateway.PaymentEvent = {
        event_id: 'evt_4',
        event_type: 'subscription.renewed',
        payment_id: 'pay_4',
        user_id: 'node-1',
        amount: 2000,
        status: 'succeeded',
        timestamp: new Date().toISOString(),
      };

      const result = await processWebhook(event);
      expect(result.status).toBe('succeeded');
      expect(result.credits_deducted).toBe(true);
    });

    it('should return pending for unknown event type', async () => {
      const event: paymentGateway.PaymentEvent = {
        event_id: 'evt_5',
        event_type: 'unknown.event',
        payment_id: 'pay_5',
        user_id: 'node-1',
        amount: 2000,
        status: 'pending',
        timestamp: new Date().toISOString(),
      };

      const result = await processWebhook(event);
      expect(result.status).toBe('pending');
    });

    it('should throw ValidationError for missing event_id', async () => {
      const event = {
        event_type: 'payment.succeeded',
        payment_id: 'pay_1',
        user_id: 'node-1',
        amount: 2000,
        status: 'succeeded',
        timestamp: new Date().toISOString(),
      } as any;
      await expect(processWebhook(event)).rejects.toThrow(ValidationError);
    });
  });

  describe('verifyPayment', () => {
    it('should return succeeded for valid paymentId', () => {
      const result = verifyPayment('pay_123');
      expect(result.payment_id).toBe('pay_123');
      expect(result.status).toBe('succeeded');
    });

    it('should throw ValidationError for empty paymentId', () => {
      expect(() => verifyPayment('')).toThrow(ValidationError);
    });
  });

  describe('refundPayment', () => {
    it('should return refund result', () => {
      const result = refundPayment('pay_123', 'Customer requested refund');
      expect(result.payment_id).toBe('pay_123');
      expect(result.refund_id).toBeDefined();
      expect(result.status).toBe('succeeded');
      expect(result.reason).toBe('Customer requested refund');
    });

    it('should throw ValidationError for empty paymentId', () => {
      expect(() => refundPayment('', 'reason')).toThrow(ValidationError);
    });

    it('should throw ValidationError for empty reason', () => {
      expect(() => refundPayment('pay_123', '')).toThrow(ValidationError);
    });
  });

  // =====================
  // Usage Limits Tests
  // =====================

  describe('checkLimit', () => {
    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.node.findUnique.mockResolvedValue(null);
      await expect(checkLimit('unknown', 'api_calls')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for empty nodeId', async () => {
      await expect(checkLimit('', 'api_calls')).rejects.toThrow(ValidationError);
    });

    it('should return unlimited for ultra plan api_calls', async () => {
      mockPrisma.node.findUnique.mockResolvedValue({ node_id: 'node-1' });
      mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'ultra' });
      const result = await checkLimit('node-1', 'api_calls');
      expect(result.unlimited).toBe(true);
      expect(result.allowed).toBe(true);
    });

    it('should return limit info for free plan', async () => {
      mockPrisma.node.findUnique.mockResolvedValue({ node_id: 'node-1' });
      mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'free' });
      const result = await checkLimit('node-1', 'api_calls');
      expect(result.unlimited).toBe(false);
      expect(result.limit).toBe(50000);
    });
  });

  describe('incrementUsage', () => {
    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.node.findUnique.mockResolvedValue(null);
      await expect(incrementUsage('unknown', 'api_calls')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for empty nodeId', async () => {
      await expect(incrementUsage('', 'api_calls')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for non-positive amount', async () => {
      await expect(incrementUsage('node-1', 'api_calls', 0)).rejects.toThrow(ValidationError);
      await expect(incrementUsage('node-1', 'api_calls', -1)).rejects.toThrow(ValidationError);
    });

    it('should return unlimited record for ultra plan publish', async () => {
      mockPrisma.node.findUnique.mockResolvedValue({ node_id: 'node-1' });
      mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'ultra' });
      const result = await incrementUsage('node-1', 'publish');
      expect(result.unlimited).toBe(true);
    });
  });

  describe('resetMonthlyUsage', () => {
    it('should throw ValidationError for empty nodeId', async () => {
      await expect(resetMonthlyUsage('')).rejects.toThrow(ValidationError);
    });

    it('should resolve without error for valid nodeId', async () => {
      await expect(resetMonthlyUsage('node-1')).resolves.toBeUndefined();
    });
  });

  describe('getUsageStats', () => {
    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.node.findUnique.mockResolvedValue(null);
      await expect(getUsageStats('unknown')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for empty nodeId', async () => {
      await expect(getUsageStats('')).rejects.toThrow(ValidationError);
    });

    it('should return usage stats with correct plan limits', async () => {
      mockPrisma.node.findUnique.mockResolvedValue({ node_id: 'node-1' });
      mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'premium' });
      const result = await getUsageStats('node-1');
      expect(result.node_id).toBe('node-1');
      expect(result.records.length).toBe(8);
      const apiRecord = result.records.find((r) => r.resource === 'api_calls');
      expect(apiRecord?.limit).toBe(100000);
      expect(apiRecord?.unlimited).toBe(false);
    });

    it('should set unlimited flag for ultra plan resources', async () => {
      mockPrisma.node.findUnique.mockResolvedValue({ node_id: 'node-1' });
      mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'ultra' });
      const result = await getUsageStats('node-1');
      const publishRecord = result.records.find((r) => r.resource === 'publish');
      expect(publishRecord?.unlimited).toBe(true);
      expect(publishRecord?.limit).toBe(-1);
    });
  });

  // =====================
  // Backward Compatibility Tests
  // =====================

  describe('getSubscription (backward compat)', () => {
    it('should return subscription for existing node', async () => {
      const mockSub = {
        subscription_id: 'sub_123',
        node_id: 'node-1',
        plan: 'premium',
      };
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSub);
      const result = await getSubscription('node-1');
      expect(result?.plan).toBe('premium');
    });

    it('should return null for unknown node', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      const result = await getSubscription('unknown');
      expect(result).toBeNull();
    });
  });

  describe('listInvoices (backward compat)', () => {
    it('should return paginated invoices', async () => {
      const mockSub = { subscription_id: 'sub_123', node_id: 'node-1' };
      const mockInvoices = [
        { id: '1', invoice_id: 'inv_1', amount: 2000 },
        { id: '2', invoice_id: 'inv_2', amount: 2000 },
      ];

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSub);
      mockPrisma.subscriptionInvoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.subscriptionInvoice.count.mockResolvedValue(2);

      const result = await listInvoices('node-1', 10, 0);
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      await expect(listInvoices('unknown')).rejects.toThrow(NotFoundError);
    });
  });
});
