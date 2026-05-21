import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type {
  WebhookSubscription,
  WebhookDelivery,
  WebhookPayload,
  WebhookEventType,
} from './types';
import { ValidationError } from '../shared/errors';

// In-memory storage for webhook subscriptions and deliveries
const subscriptions = new Map<string, WebhookSubscription>();
const deliveries = new Map<string, WebhookDelivery>();

// Default retry policy with exponential backoff
const DEFAULT_RETRY_POLICY = {
  max_retries: 3,
  backoff_seconds: [10, 60, 300], // 10s, 1m, 5m
};

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function setPrisma(_client: PrismaClient): void {
  // Webhook module uses in-memory storage, but this maintains DI consistency
}

export async function createSubscription(params: {
  node_id: string;
  url: string;
  events: WebhookEventType[];
  secret?: string;
}): Promise<WebhookSubscription> {
  // Validate URL
  if (!params.url || !params.url.startsWith('http')) {
    throw new ValidationError('Webhook URL must start with http:// or https://');
  }

  // Validate events
  if (!params.events || params.events.length === 0) {
    throw new ValidationError('At least one event type is required');
  }

  const subscription: WebhookSubscription = {
    id: generateId('whsub'),
    node_id: params.node_id,
    url: params.url,
    events: params.events,
    secret: params.secret ?? generateSecret(),
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    failure_count: 0,
    retry_policy: DEFAULT_RETRY_POLICY,
  };

  subscriptions.set(subscription.id, subscription);
  return subscription;
}

export function getSubscription(subscriptionId: string): WebhookSubscription | null {
  return subscriptions.get(subscriptionId) ?? null;
}

export function getNodeSubscriptions(nodeId: string): WebhookSubscription[] {
  return Array.from(subscriptions.values()).filter(s => s.node_id === nodeId);
}

export function listSubscriptions(filters?: {
  node_id?: string;
  event_type?: WebhookEventType;
}): WebhookSubscription[] {
  let result = Array.from(subscriptions.values());
  
  if (filters?.node_id) {
    result = result.filter(s => s.node_id === filters.node_id);
  }
  
  if (filters?.event_type) {
    result = result.filter(s => s.events.includes(filters.event_type!));
  }
  
  return result;
}

export function updateSubscription(
  subscriptionId: string,
  updates: Partial<Pick<WebhookSubscription, 'url' | 'events' | 'enabled'>>
): WebhookSubscription | null {
  const sub = subscriptions.get(subscriptionId);
  if (!sub) return null;

  const updated: WebhookSubscription = {
    ...sub,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  
  subscriptions.set(subscriptionId, updated);
  return updated;
}

export function deleteSubscription(subscriptionId: string): boolean {
  return subscriptions.delete(subscriptionId);
}

export function getSubscriptionSecret(subscriptionId: string): string | null {
  const sub = subscriptions.get(subscriptionId);
  return sub?.secret ?? null;
}

export async function deliverWebhook(
  subscriptionId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<WebhookDelivery> {
  const sub = subscriptions.get(subscriptionId);
  if (!sub) {
    throw new ValidationError(`Subscription not found: ${subscriptionId}`);
  }

  const payload: WebhookPayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    subscription_id: subscriptionId,
    data,
  };

  const delivery: WebhookDelivery = {
    id: generateId('whdel'),
    subscription_id: subscriptionId,
    event_type: eventType,
    payload: payload as unknown as Record<string, unknown>,
    attempted_at: new Date().toISOString(),
    status: 'pending',
  };

  deliveries.set(delivery.id, delivery);

  try {
    // Sign the payload for verification
    const payloadStr = JSON.stringify(payload);
    const signature = signPayload(payloadStr, sub.secret);

    // Note: In production, this would make an actual HTTP request
    // For now, we simulate successful delivery
    const response = await simulateWebhookDelivery(sub.url, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': eventType,
      },
      body: payloadStr,
    });

    delivery.status = 'delivered';
    delivery.response_status = response.status;
    delivery.response_body = response.body;
    
    // Reset failure count on success
    sub.failure_count = 0;
    sub.last_triggered_at = new Date().toISOString();
  } catch (error) {
    delivery.status = 'failed';
    delivery.error_message = error instanceof Error ? error.message : String(error);
    sub.failure_count += 1;
  }

  deliveries.set(delivery.id, delivery);
  return delivery;
}

async function simulateWebhookDelivery(
  _url: string,
  options: { headers: Record<string, string>; body: string }
): Promise<{ status: number; body: string }> {
  // In production, this would be an actual fetch call
  // For now, we simulate a successful delivery
  console.log(`[Webhook] Simulating delivery to webhook`, {
    headers: options.headers,
    bodyLength: options.body.length,
  });
  return { status: 200, body: 'OK' };
}

export function getDelivery(deliveryId: string): WebhookDelivery | null {
  return deliveries.get(deliveryId) ?? null;
}

export function getSubscriptionDeliveries(
  subscriptionId: string,
  limit = 50
): WebhookDelivery[] {
  return Array.from(deliveries.values())
    .filter(d => d.subscription_id === subscriptionId)
    .sort((a, b) => b.attempted_at.localeCompare(a.attempted_at))
    .slice(0, limit);
}

export function triggerEvent(
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  // Find all subscriptions that listen for this event type
  const matchingSubs = listSubscriptions({ event_type: eventType });
  
  // Deliver to all matching subscriptions in parallel
  const deliveries = matchingSubs.map(sub => 
    deliverWebhook(sub.id, eventType, data).catch(err => {
      console.error(`[Webhook] Failed to deliver ${eventType} to ${sub.id}:`, err);
    })
  );

  return Promise.all(deliveries).then(() => undefined);
}

export function _resetTestState(): void {
  subscriptions.clear();
  deliveries.clear();
}
