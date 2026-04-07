import { NotFoundError, ValidationError } from '../shared/errors';

export interface CheckoutSession {
  session_id: string;
  user_id: string;
  plan_id: string;
  billing_cycle: string;
  amount_credits: number;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  checkout_url?: string;
  expires_at: string;
  created_at: string;
}

export interface PaymentEvent {
  event_id: string;
  event_type: string;
  payment_id: string;
  user_id: string;
  amount: number;
  status: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  payment_id: string;
  status: 'succeeded' | 'pending' | 'failed' | 'refunded';
  amount: number;
  credits_deducted: boolean;
  subscription_activated: boolean;
  timestamp: string;
}

export interface RefundResult {
  payment_id: string;
  refund_id: string;
  amount: number;
  status: 'succeeded' | 'failed';
  reason: string;
  timestamp: string;
}

// In-memory store for checkout sessions (in production, use Redis or DB)
const sessions = new Map<string, CheckoutSession>();

export function createCheckoutSession(
  userId: string,
  planId: string,
  billingCycle: string,
  amountCredits: number,
): CheckoutSession {
  if (!userId) throw new ValidationError('userId is required');
  if (!planId) throw new ValidationError('planId is required');
  if (!['free', 'premium', 'ultra'].includes(planId)) {
    throw new ValidationError('Invalid planId. Must be free, premium, or ultra');
  }
  if (!['monthly', 'annual'].includes(billingCycle)) {
    throw new ValidationError('Invalid billingCycle. Must be monthly or annual');
  }
  if (amountCredits < 0) {
    throw new ValidationError('amountCredits must be non-negative');
  }

  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes

  const session: CheckoutSession = {
    session_id: crypto.randomUUID(),
    user_id: userId,
    plan_id: planId,
    billing_cycle: billingCycle,
    amount_credits: amountCredits,
    status: 'pending',
    checkout_url: `https://api.evomap.ai/subscription/checkout/${crypto.randomUUID()}`,
    expires_at: expires.toISOString(),
    created_at: now.toISOString(),
  };

  sessions.set(session.session_id, session);
  return session;
}

export async function processWebhook(event: PaymentEvent): Promise<PaymentResult> {
  if (!event.event_id) throw new ValidationError('event_id is required');
  if (!event.payment_id) throw new ValidationError('payment_id is required');
  if (!event.user_id) throw new ValidationError('user_id is required');

  const validTypes = [
    'payment.succeeded',
    'payment.failed',
    'payment.refunded',
    'subscription.renewed',
    'subscription.cancelled',
  ];
  if (!validTypes.includes(event.event_type)) {
    return {
      payment_id: event.payment_id,
      status: 'pending',
      amount: event.amount,
      credits_deducted: false,
      subscription_activated: false,
      timestamp: new Date().toISOString(),
    };
  }

  switch (event.event_type) {
    case 'payment.succeeded':
      return {
        payment_id: event.payment_id,
        status: 'succeeded',
        amount: event.amount,
        credits_deducted: true,
        subscription_activated: true,
        timestamp: new Date().toISOString(),
      };
    case 'payment.failed':
      return {
        payment_id: event.payment_id,
        status: 'failed',
        amount: event.amount,
        credits_deducted: false,
        subscription_activated: false,
        timestamp: new Date().toISOString(),
      };
    case 'payment.refunded':
      return {
        payment_id: event.payment_id,
        status: 'refunded',
        amount: event.amount,
        credits_deducted: false,
        subscription_activated: false,
        timestamp: new Date().toISOString(),
      };
    case 'subscription.renewed':
      return {
        payment_id: event.payment_id,
        status: 'succeeded',
        amount: event.amount,
        credits_deducted: true,
        subscription_activated: true,
        timestamp: new Date().toISOString(),
      };
    case 'subscription.cancelled':
      return {
        payment_id: event.payment_id,
        status: 'failed',
        amount: 0,
        credits_deducted: false,
        subscription_activated: false,
        timestamp: new Date().toISOString(),
      };
    default:
      return {
        payment_id: event.payment_id,
        status: 'pending',
        amount: event.amount,
        credits_deducted: false,
        subscription_activated: false,
        timestamp: new Date().toISOString(),
      };
  }
}

export function verifyPayment(paymentId: string): PaymentResult {
  if (!paymentId) throw new ValidationError('paymentId is required');
  return {
    payment_id: paymentId,
    status: 'succeeded',
    amount: 0,
    credits_deducted: true,
    subscription_activated: true,
    timestamp: new Date().toISOString(),
  };
}

export function refundPayment(paymentId: string, reason: string): RefundResult {
  if (!paymentId) throw new ValidationError('paymentId is required');
  if (!reason) throw new ValidationError('reason is required');
  return {
    payment_id: paymentId,
    refund_id: crypto.randomUUID(),
    amount: 0,
    status: 'succeeded',
    reason,
    timestamp: new Date().toISOString(),
  };
}
