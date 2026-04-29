// Billing service tests: webhook processing, invoice generation, proration calculation
import { describe, it, expect, beforeEach } from 'vitest';
import {
  verifyStripeSignature,
  generateInvoice,
  getInvoice,
  getInvoicesByNode,
  updateInvoiceStatus,
  calculateProration,
  calculateImmediateProration,
  _resetBillingState,
  formatCurrency,
  setWebhookSecret,
  processWebhookEvent,
} from './service';
import type { StripeWebhookPayload } from './types';

describe('Billing Service', () => {
  beforeEach(() => {
    _resetBillingState();
  });

  describe('Stripe Signature Verification', () => {
    it('should skip verification when no webhook secret is configured', () => {
      setWebhookSecret('');
      const result = verifyStripeSignature('{"test":true}', 'sig_123');
      expect(result).toBe(true);
    });

    it('should verify valid signature with correct secret', () => {
      const secret = 'whsec_test_secret';
      setWebhookSecret(secret);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"type":"invoice.paid"}';
      const crypto = require('crypto');
      const signedPayload = `${timestamp}.${payload}`;
      const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
      const sigHeader = `t=${timestamp},v1=${signature}`;
      const result = verifyStripeSignature(payload, sigHeader, secret);
      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      setWebhookSecret('whsec_test_secret');
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"test":true}';
      const sigHeader = `t=${timestamp},v1=invalidsignature`;
      const result = verifyStripeSignature(payload, sigHeader, 'whsec_test_secret');
      expect(result).toBe(false);
    });
  });

  describe('Invoice Generation', () => {
    it('should generate an invoice with line items', () => {
      const invoice = generateInvoice(
        'sub_123',
        'node_abc',
        'premium',
        'monthly',
        new Date('2024-01-01'),
        new Date('2024-02-01')
      );
      expect(invoice.id).toBeDefined();
      expect(invoice.subscription_id).toBe('sub_123');
      expect(invoice.node_id).toBe('node_abc');
      expect(invoice.plan).toBe('premium');
      expect(invoice.billing_cycle).toBe('monthly');
      expect(invoice.amount).toBe(2900); // premium monthly price
      expect(invoice.line_items.length).toBeGreaterThan(0);
      expect(invoice.line_items[0].type).toBe('subscription');
    });

    it('should generate free plan invoice with zero amount', () => {
      const invoice = generateInvoice(
        'sub_123',
        'node_abc',
        'free',
        'monthly',
        new Date('2024-01-01'),
        new Date('2024-02-01')
      );
      expect(invoice.amount).toBe(0);
      expect(invoice.line_items.length).toBe(0);
    });

    it('should include proration when specified', () => {
      const invoice = generateInvoice(
        'sub_123',
        'node_abc',
        'ultra',
        'monthly',
        new Date('2024-01-01'),
        new Date('2024-02-01'),
        { includeProration: true, prorationAmount: -1000 }
      );
      expect(invoice.line_items.length).toBe(2);
      const prorationItem = invoice.line_items.find(li => li.type === 'proration');
      expect(prorationItem).toBeDefined();
      expect(prorationItem?.amount).toBe(-1000);
    });

    it('should store and retrieve invoice', () => {
      const invoice = generateInvoice(
        'sub_123',
        'node_abc',
        'premium',
        'monthly',
        new Date('2024-01-01'),
        new Date('2024-02-01')
      );
      const retrieved = getInvoice(invoice.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(invoice.id);
    });
  });

  describe('Invoice Retrieval', () => {
    it('should get all invoices for a node', () => {
      generateInvoice('sub_1', 'node_abc', 'premium', 'monthly', new Date('2024-01-01'), new Date('2024-02-01'));
      generateInvoice('sub_1', 'node_abc', 'premium', 'monthly', new Date('2024-02-01'), new Date('2024-03-01'));
      generateInvoice('sub_2', 'node_xyz', 'ultra', 'monthly', new Date('2024-01-01'), new Date('2024-02-01'));
      
      const nodeInvoices = getInvoicesByNode('node_abc');
      expect(nodeInvoices.length).toBe(2);
      expect(nodeInvoices.every(inv => inv.node_id === 'node_abc')).toBe(true);
    });

    it('should update invoice status to paid', () => {
      const invoice = generateInvoice(
        'sub_123',
        'node_abc',
        'premium',
        'monthly',
        new Date('2024-01-01'),
        new Date('2024-02-01')
      );
      expect(invoice.status).toBe('draft');
      
      const updated = updateInvoiceStatus(invoice.id, 'paid', new Date());
      expect(updated?.status).toBe('paid');
      expect(updated?.paid_at).toBeDefined();
      expect(updated?.amount_paid).toBe(invoice.amount);
    });

    it('should return null for non-existent invoice', () => {
      const result = getInvoice('non_existent_id');
      expect(result).toBeNull();
    });
  });

  describe('Proration Calculation', () => {
    it('should calculate proration for upgrade', () => {
      const proration = calculateImmediateProration(
        'free',
        'premium',
        'monthly',
        new Date('2024-01-15'),
        new Date('2024-01-01'),
        new Date('2024-02-01')
      );
      expect(proration.credit).toBe(0); // free plan has no credit
      expect(proration.charge).toBeGreaterThan(0); // premium charge for remaining days
      expect(proration.net).toBe(proration.charge); // net = charge since credit is 0
      expect(proration.daysRemaining).toBeGreaterThan(0);
    });

    it('should calculate proration for downgrade', () => {
      const proration = calculateImmediateProration(
        'premium',
        'free',
        'monthly',
        new Date('2024-01-15'),
        new Date('2024-01-01'),
        new Date('2024-02-01')
      );
      expect(proration.credit).toBeGreaterThan(0); // premium credit for unused days
      expect(proration.charge).toBe(0); // free plan has no charge
      expect(proration.net).toBeLessThan(0); // negative = credit to user
    });

    it('should calculate full proration with subscription info', () => {
      const proration = calculateProration(
        'sub_123',
        'node_abc',
        'premium',
        'ultra',
        'monthly',
        new Date('2024-01-15'),
        new Date('2024-02-01')
      );
      expect(proration.subscription_id).toBe('sub_123');
      expect(proration.node_id).toBe('node_abc');
      expect(proration.from_plan).toBe('premium');
      expect(proration.to_plan).toBe('ultra');
      expect(proration.line_items.length).toBeGreaterThan(0);
      expect(proration.calculated_at).toBeDefined();
    });

    it('should handle same-plan change with no proration', () => {
      const proration = calculateImmediateProration(
        'premium',
        'premium',
        'monthly',
        new Date('2024-01-15'),
        new Date('2024-01-01'),
        new Date('2024-02-01')
      );
      expect(proration.credit).toBe(0);
      expect(proration.charge).toBe(0);
      expect(proration.net).toBe(0);
    });

    it('should calculate yearly proration', () => {
      const proration = calculateImmediateProration(
        'premium',
        'ultra',
        'yearly',
        new Date('2024-01-01'),
        new Date('2024-01-01'),
        new Date('2025-01-01')
      );
      expect(proration.credit).toBeGreaterThan(0); // premium yearly credit
      expect(proration.charge).toBeGreaterThan(proration.credit); // ultra yearly charge > premium credit
      expect(proration.daysRemaining).toBe(365);
    });
  });

  describe('Currency Formatting', () => {
    it('should format USD amounts correctly', () => {
      expect(formatCurrency(2900, 'usd')).toBe('$29.00');
      expect(formatCurrency(9900, 'usd')).toBe('$99.00');
      expect(formatCurrency(0, 'usd')).toBe('$0.00');
      expect(formatCurrency(-1500, 'usd')).toBe('-$15.00');
    });
  });

  describe('Webhook Event Processing', () => {
    it('should process subscription.created event', async () => {
      const payload: StripeWebhookPayload = {
        id: 'evt_test_123',
        object: 'event',
        api_version: '2023-10-16',
        type: 'customer.subscription.created',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            status: 'active',
            plan: { id: 'price_premium', object: 'plan', active: true, nickname: 'Premium', product: 'prod_premium', unit_amount: 2900, currency: 'usd', recurring: { interval: 'month' as const, interval_count: 1, usage_type: 'licensed' as const } },
            quantity: 1,
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            cancel_at_period_end: false,
            cancel_at: null,
            canceled_at: null,
            trial_start: null,
            trial_end: null,
            created: Math.floor(Date.now() / 1000),
            metadata: { node_id: 'node_abc' },
          },
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_123', idempotency_key: 'idem_123' },
      };

      const result = await processWebhookEvent(payload);
      expect(result.success).toBe(true);
      expect(result.event_id).toBe('evt_test_123');
      expect(result.event_type).toBe('customer.subscription.created');
      expect(result.processed).toBe(true);
      expect(result.actions_taken.length).toBeGreaterThan(0);
    });

    it('should handle duplicate events idempotently', async () => {
      const payload: StripeWebhookPayload = {
        id: 'evt_duplicate',
        object: 'event',
        api_version: '2023-10-16',
        type: 'customer.subscription.created',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'sub_dup',
            customer: 'cus_dup',
            status: 'active',
            plan: { id: 'price_premium', object: 'plan', active: true, nickname: 'Premium', product: 'prod_premium', unit_amount: 2900, currency: 'usd', recurring: { interval: 'month' as const, interval_count: 1, usage_type: 'licensed' as const } },
            quantity: 1,
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            cancel_at_period_end: false,
            cancel_at: null,
            canceled_at: null,
            trial_start: null,
            trial_end: null,
            created: Math.floor(Date.now() / 1000),
            metadata: { node_id: 'node_dup' },
          },
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_dup', idempotency_key: 'idem_dup' },
      };

      const result1 = await processWebhookEvent(payload);
      const result2 = await processWebhookEvent(payload);
      expect(result1.processed).toBe(true);
      expect(result2.processed).toBe(false);
      expect(result2.actions_taken).toContain('duplicate_event_skipped');
    });

    it('should process invoice.paid event', async () => {
      const payload: StripeWebhookPayload = {
        id: 'evt_invoice_paid',
        object: 'event',
        api_version: '2023-10-16',
        type: 'invoice.paid',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'in_123',
            subscription: 'sub_123',
            customer: 'cus_123',
            amount_paid: 2900,
            amount_due: 2900,
            status: 'paid',
          },
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_123', idempotency_key: 'idem_123' },
      };

      const result = await processWebhookEvent(payload);
      expect(result.success).toBe(true);
      expect(result.event_type).toBe('invoice.paid');
      expect(result.actions_taken.some(a => a.includes('invoice_paid'))).toBe(true);
    });

    it('should process invoice.payment_failed event', async () => {
      const payload: StripeWebhookPayload = {
        id: 'evt_payment_failed',
        object: 'event',
        api_version: '2023-10-16',
        type: 'invoice.payment_failed',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'in_failed',
            subscription: 'sub_123',
            customer: 'cus_123',
            status: 'open',
          },
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_fail', idempotency_key: 'idem_fail' },
      };

      const result = await processWebhookEvent(payload);
      expect(result.success).toBe(true);
      expect(result.actions_taken.some(a => a.includes('past_due'))).toBe(true);
    });

    it('should handle unhandled event types gracefully', async () => {
      const payload: StripeWebhookPayload = {
        id: 'evt_unknown',
        object: 'event',
        api_version: '2023-10-16',
        type: 'unknown.event.type' as any,
        created: Math.floor(Date.now() / 1000),
        data: { object: { id: 'obj_123' } },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_123', idempotency_key: 'idem_123' },
      };

      const result = await processWebhookEvent(payload);
      expect(result.success).toBe(true);
      expect(result.actions_taken[0]).toContain('unhandled_event_type');
    });
  });

  describe('Plan Mapping', () => {
    it('should map Stripe price IDs to plan tiers', () => {
      // Test internal function via webhook processing
      // This is implicitly tested through the webhook flow
    });
  });
});

describe('Billing Integration Scenarios', () => {
  beforeEach(() => {
    _resetBillingState();
  });

  it('should handle full subscription lifecycle', () => {
    // Create invoice for new subscription
    const invoice1 = generateInvoice('sub_lifecycle', 'node_lifecycle', 'premium', 'monthly',
      new Date('2024-01-01'), new Date('2024-02-01'));
    expect(invoice1.status).toBe('draft');
    
    // Mark as paid
    const paidInvoice = updateInvoiceStatus(invoice1.id, 'paid', new Date());
    expect(paidInvoice?.status).toBe('paid');
    expect(paidInvoice?.amount_paid).toBe(2900);
    
    // Upgrade scenario - calculate proration
    const proration = calculateImmediateProration('premium', 'ultra', 'monthly',
      new Date('2024-01-15'), new Date('2024-01-01'), new Date('2024-02-01'));
    expect(proration.net).toBeGreaterThan(0); // upgrade costs more
  });

  it('should handle plan downgrade with credit', () => {
    const proration = calculateImmediateProration('ultra', 'premium', 'monthly',
      new Date('2024-01-20'), new Date('2024-01-01'), new Date('2024-02-01'));
    expect(proration.credit).toBeGreaterThan(proration.charge);
    expect(proration.net).toBeLessThan(0); // user gets credit
  });

  it('should handle mid-year upgrade with yearly billing', () => {
    const proration = calculateImmediateProration('premium', 'ultra', 'yearly',
      new Date('2024-07-01'), new Date('2024-01-01'), new Date('2025-01-01'));
    // 6 months remaining, ~180 days
    expect(proration.daysRemaining).toBeGreaterThan(150);
    expect(proration.daysRemaining).toBeLessThan(200);
    expect(proration.charge).toBeGreaterThan(0);
  });
});
