/**
 * A2A Protocol Types
 * Agent-to-Agent communication protocol types
 */

export type NodeStatus = 'registered' | 'active' | 'inactive' | 'quarantined';

export interface A2ANode {
  node_id: string;
  model: string;
  status: NodeStatus;
  trust_level: string;
  reputation: number;
  capabilities: string[];
  endpoint?: string;
  last_seen: Date;
  registered_at: Date;
}

export interface HelloRequest {
  node_id: string;
  model: string;
  capabilities?: string[];
  endpoint?: string;
}

export interface HelloResponse {
  success: boolean;
  node_id: string;
  protocol_version: string;
  server_time: string;
}

export interface HeartbeatRequest {
  node_id: string;
  timestamp?: string;
  load_metrics?: {
    cpu_usage?: number;
    memory_usage?: number;
    active_tasks?: number;
  };
}

export interface HeartbeatResponse {
  success: boolean;
  server_time: string;
  message?: string;
}

export interface PublishRequest {
  node_id: string;
  capabilities: string[];
  metadata?: Record<string, unknown>;
}

export interface PublishResponse {
  success: boolean;
  published_at: string;
  directory_version: number;
}

export interface FetchRequest {
  node_id: string;
  target_id: string;
  resource_type: 'node' | 'asset';
}

export interface FetchResponse {
  success: boolean;
  data?: A2ANode | unknown;
  cached: boolean;
  cache_age?: number;
}

export interface SearchRequest {
  node_id: string;
  query: string;
  filters?: {
    capability?: string;
    trust_level_min?: number;
    status?: NodeStatus;
  };
  limit?: number;
}

export interface SearchResponse {
  success: boolean;
  results: Array<{
    node_id: string;
    model: string;
    reputation: number;
    capabilities: string[];
    relevance_score: number;
  }>;
  total: number;
}

export interface ReportRequest {
  node_id: string;
  report_type: 'status' | 'metrics' | 'reputation';
  data: Record<string, unknown>;
}

export interface ReportResponse {
  success: boolean;
  report_id: string;
  acknowledged: boolean;
}

export interface DirectoryResponse {
  nodes: A2ANode[];
  total: number;
  version: number;
}

export interface NodeDetailResponse {
  node: A2ANode;
  recent_activity?: {
    last_heartbeat: string;
    task_completion_rate: number;
  };
}

export interface EarningsResponse {
  node_id: string;
  period: string;
  earnings: {
    total: number;
    breakdown: {
      task_execution: number;
      asset_publication: number;
      reputation_bonus: number;
    };
  };
}

export interface HelpResponse {
  protocol: string;
  version: string;
  endpoints: Array<{
    method: string;
    path: string;
    description: string;
    auth_required: boolean;
  }>;
}
