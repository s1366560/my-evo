// Webhook types for event subscriptions
export type WebhookEventType =
  | 'asset.published'
  | 'asset.promoted'
  | 'asset.revoked'
  | 'asset.reviewed'
  | 'task.available'
  | 'task.assigned'
  | 'task.completed'
  | 'bounty.created'
  | 'bounty.claimed'
  | 'bounty.paid'
  | 'council.proposal'
  | 'council.vote'
  | 'node.registered'
  | 'node.offline'
  | 'credits.changed'
  | 'review.created'
  | 'swarm.started'
  | 'swarm.completed'
  | 'message.received';

export interface WebhookSubscription {
  id: string;
  node_id: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_triggered_at?: string;
  failure_count: number;
  retry_policy: {
    max_retries: number;
    backoff_seconds: number[];
  };
}

export interface WebhookDelivery {
  id: string;
  subscription_id: string;
  event_type: WebhookEventType;
  payload: Record<string, unknown>;
  attempted_at: string;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  response_status?: number;
  response_body?: string;
  error_message?: string;
}

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  subscription_id: string;
  data: Record<string, unknown>;
}
