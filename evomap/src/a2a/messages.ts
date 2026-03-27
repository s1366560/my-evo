/**
 * EvoMap GEP Protocol - A2A Message Types
 * Based on evomap-architecture-v5.md Chapter 3
 */

import { MESSAGE_TYPES, PROTOCOL_NAME, type MessageType } from '../core/constants.js';

// Protocol envelope for all A2A messages
export interface ProtocolEnvelope<T = unknown> {
  protocol: typeof PROTOCOL_NAME;
  version: string;
  message_id: string;
  message_type: MessageType;
  sender_id: string;
  timestamp: string;
  payload: T;
}

// ============ Hello Message ============
// Node registration handshake

export interface HelloPayload {
  capabilities: string[];
  env_fingerprint: string;
  model?: string;
  gene_count?: number;
  capsule_count?: number;
  heartbeat_interval?: number; // in seconds
  rotate_secret?: boolean;
}

export interface HelloResponse {
  node_id: string;
  node_secret: string;
  claim_code?: string;
  claim_url?: string;
  registered_at: string;
}

// ============ Heartbeat Message ============
// Node keepalive

export interface HeartbeatPayload {
  status: 'alive' | 'dead' | 'offline';
  pending_events?: number; // Count of pending events
  available_work?: boolean;
  commitment_updates?: Record<string, number>;
  peers?: string[];
  overdue_tasks?: string[];
}

export interface HeartbeatResponse {
  acked: boolean;
  pending_events?: Array<{
    event_id: string;
    event_type: string;
    data: Record<string, unknown>;
  }>;
  new_tasks?: Array<{
    task_id: string;
    bounty: number;
    deadline?: string;
  }>;
}

// ============ Publish Message ============
// Publish assets (Bundle)

export interface PublishPayload {
  assets: Array<Record<string, unknown>>; // Gene, Capsule, EvolutionEvent
}

export interface PublishResponse {
  bundle_id: string;
  asset_ids: string[];
  status: 'published' | 'pending_validation' | 'rejected';
  validation_results?: Array<{
    asset_id: string;
    status: 'accepted' | 'rejected';
    reason?: string;
  }>;
}

// ============ Fetch Message ============
// Retrieve assets

export interface FetchPayload {
  query?: {
    signals?: string[];
    type?: string;
    gdi_min?: number;
  };
  asset_ids?: string[];
  search_only?: boolean; // If true, only returns metadata
}

export interface FetchResponse {
  assets?: Array<{
    asset_id: string;
    type: string;
    summary?: string;
    content?: Record<string, unknown>; // Only if search_only=false
    fetch_cost?: number;
  }>;
  total_count: number;
  search_only: boolean;
}

// ============ Report Message ============
// Validation report

export interface ReportPayload {
  validation_report: {
    asset_id: string;
    validated: boolean;
    confidence: number;
    notes?: string;
  };
}

export interface ReportResponse {
  acknowledged: boolean;
  reputation_delta?: number;
}

// ============ Revoke Message ============
// Revoke assets

export interface RevokePayload {
  asset_id: string;
  reason: string;
}

export interface RevokeResponse {
  revoked: boolean;
  asset_id: string;
}

// ============ Validate Message ============
// Dry-run validation before publish

export interface ValidatePayload {
  assets: Array<Record<string, unknown>>;
}

export interface ValidateResponse {
  valid: boolean;
  asset_ids: string[];
  warnings?: Array<{
    asset_id: string;
    warning: string;
  }>;
  errors?: Array<{
    asset_id: string;
    error: string;
  }>;
}

// ============ Utility functions ============

let messageCounter = 0;

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  messageCounter++;
  const timestamp = Date.now();
  return `msg_${timestamp}_${messageCounter}`;
}

/**
 * Create a protocol envelope
 */
export function createEnvelope<T>(
  messageType: MessageType,
  senderId: string,
  payload: T
): ProtocolEnvelope<T> {
  return {
    protocol: PROTOCOL_NAME,
    version: '1.0',
    message_id: generateMessageId(),
    message_type: messageType,
    sender_id: senderId,
    timestamp: new Date().toISOString(),
    payload,
  };
}

/**
 * Validate a protocol envelope
 */
export function validateEnvelope(envelope: unknown): { valid: boolean; error?: string } {
  if (!envelope || typeof envelope !== 'object') {
    return { valid: false, error: 'Envelope must be an object' };
  }

  const env = envelope as Record<string, unknown>;

  if (env.protocol !== PROTOCOL_NAME) {
    return { valid: false, error: `Invalid protocol: expected '${PROTOCOL_NAME}'` };
  }

  if (!env.message_type) {
    return { valid: false, error: 'Missing message_type' };
  }

  if (!env.sender_id) {
    return { valid: false, error: 'Missing sender_id' };
  }

  return { valid: true };
}

/**
 * Validate message_type matches endpoint
 */
export function validateMessageTypeEndpoint(
  messageType: MessageType,
  endpoint: string
): boolean {
  const validations: Record<string, MessageType[]> = {
    '/a2a/hello': [MESSAGE_TYPES.HELLO],
    '/a2a/heartbeat': [MESSAGE_TYPES.HEARTBEAT],
    '/a2a/publish': [MESSAGE_TYPES.PUBLISH],
    '/a2a/fetch': [MESSAGE_TYPES.FETCH],
    '/a2a/report': [MESSAGE_TYPES.REPORT],
    '/a2a/revoke': [MESSAGE_TYPES.REVOKE],
    '/a2a/validate': [MESSAGE_TYPES.PUBLISH], // validate uses publish message type
  };

  const validTypes = validations[endpoint];
  if (!validTypes) {
    return true; // Unknown endpoint, skip validation
  }

  return validTypes.includes(messageType);
}
