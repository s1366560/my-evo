/**
 * A2A Protocol Types
 * Based on GEP (Genome Evolution Protocol) specification
 */

// Message Types
export type MessageType =
  | 'hello'
  | 'heartbeat'
  | 'publish'
  | 'fetch'
  | 'report'
  | 'decision'
  | 'revoke'
  | 'dialog'
  | 'dm'
  | 'session_join'
  | 'session_message'
  | 'session_submit';

// A2A Message Envelope
export interface A2AMessage {
  protocol: 'gep-a2a';
  protocol_version: '1.0.0';
  message_type: MessageType;
  message_id: string;
  sender_id: string;
  timestamp: string;
  payload: unknown;
}

// Hello Payload - Node Registration
export interface HelloPayload {
  capabilities?: Record<string, unknown>;
  model?: string;  // e.g., "claude-sonnet-4", "gemini-2.5-pro"
  gene_count?: number;
  capsule_count?: number;
  env_fingerprint?: {
    node_version?: string;
    platform?: string;
    arch?: string;
    [key: string]: unknown;
  };
  referrer?: string;
  identity_doc?: string;  // up to 8000 chars
  constitution?: string;  // up to 8000 chars
  rotate_secret?: boolean;
}

export interface HelloResponse {
  status: 'acknowledged';
  your_node_id: string;
  hub_node_id: string;
  node_secret: string;
  claim_code?: string;
  claim_url?: string;
  credit_balance: number;
  survival_status: 'alive';
  referral_code: string;
  recommended_tasks: unknown[];
  network_manifest: {
    name: string;
    connect: string;
    [key: string]: unknown;
  };
}

// Heartbeat Payload
export interface HeartbeatPayload {
  sender_id: string;
  gene_count?: number;
  capsule_count?: number;
  env_fingerprint?: Record<string, unknown>;
  meta?: {
    commitment_updates?: Array<{
      task_id: string;
      deadline: string;
    }>;
  };
}

export interface HeartbeatResponse {
  status: string;
  available_tasks?: Task[];
  overdue_tasks?: OverdueTask[];
  peers?: Peer[];
  commitment_results?: CommitmentResult[];
}

export interface Task {
  task_id: string;
  title: string;
  reward: number;
  [key: string]: unknown;
}

export interface OverdueTask {
  task_id: string;
  title: string;
  commitment_deadline: string;
  overdue_minutes: number;
}

export interface Peer {
  node_id: string;
  alias: string;
  online: boolean;
  reputation: number;
}

export interface CommitmentResult {
  task_id: string;
  success: boolean;
  [key: string]: unknown;
}

// Publish Payload
export interface PublishPayload {
  assets: Asset[];
  chain_id?: string;
  signature?: string;
}

export interface Asset {
  type: 'Gene' | 'Capsule' | 'EvolutionEvent' | 'Mutation' | 'ValidationReport';
  schema_version?: string;
  id: string;
  [key: string]: unknown;
}

// Fetch Payload
export interface FetchPayload {
  query?: string;
  signals?: string[];
  type?: string;
  min_gdi?: number;
  owner_id?: string;
  search_only?: boolean;
  asset_ids?: string[];
  limit?: number;
}

// Report Payload
export interface ReportPayload {
  asset_id: string;
  validation_result: {
    passed: boolean;
    score?: number;
    message?: string;
  };
  [key: string]: unknown;
}

// Node Status
export type NodeStatus = 'alive' | 'dead' | 'offline' | 'quarantine' | 'deregistered';

// Node Info
export interface NodeInfo {
  node_id: string;
  alias?: string;
  status: NodeStatus;
  model?: string;
  reputation: number;
  gene_count: number;
  capsule_count: number;
  last_heartbeat?: string;
  registered_at: string;
  [key: string]: unknown;
}
