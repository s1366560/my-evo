// Audit logging module types
export type AuditCategory =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'asset_management'
  | 'node_management'
  | 'credit_transaction'
  | 'reputation_change'
  | 'admin_action'
  | 'system_event'
  | 'api_usage'
  | 'export'
  | 'batch'
  | 'integration'
  | 'security';

export type AuditSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';
export type AuditActorType = 'user' | 'node' | 'api_key' | 'system' | 'admin' | 'service';

export interface AuditEvent {
  event_id: string;
  category: AuditCategory;
  severity: AuditSeverity;
  timestamp: string;
  actor_type: AuditActorType;
  actor_id: string;
  actor_name?: string;
  actor_ip?: string;
  actor_user_agent?: string;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_name?: string;
  outcome: 'success' | 'failure' | 'partial';
  error_code?: string;
  error_message?: string;
  metadata: Record<string, unknown>;
  diff?: Record<string, { before: unknown; after: unknown }>;
  session_id?: string;
  api_key_id?: string;
  node_id?: string;
  request_id?: string;
  correlation_id?: string;
  duration_ms?: number;
}

export interface AuditQuery {
  categories?: AuditCategory[];
  severities?: AuditSeverity[];
  actor_ids?: string[];
  actor_types?: AuditActorType[];
  actions?: string[];
  resource_types?: string[];
  resource_ids?: string[];
  outcomes?: ('success' | 'failure' | 'partial')[];
  date_from?: string;
  date_to?: string;
  search_query?: string;
  include_system?: boolean;
  include_admin?: boolean;
  pagination: AuditPagination;
}

export interface AuditPagination {
  page: number;
  page_size: number;
  use_cursor?: boolean;
  cursor?: string;
}

export interface AuditQueryResult {
  events: AuditEvent[];
  total: number;
  page: number;
  page_size: number;
  query_time_ms: number;
  next_cursor?: string;
}

export interface AuditSummary {
  category: AuditCategory;
  total_events: number;
  success_count: number;
  failure_count: number;
  unique_actors: number;
  unique_resources: number;
  top_actions: { action: string; count: number }[];
  top_actors: { actor_id: string; count: number }[];
  top_resources: { resource_id: string; count: number }[];
}

export interface AuditRetentionPolicy {
  category: AuditCategory;
  retention_days: 30 | 60 | 90 | 180 | 365;
  archive_before_delete: boolean;
  compress_on_archive: boolean;
}

export interface AuditExport {
  export_id: string;
  user_id: string;
  query: AuditQuery;
  format: 'csv' | 'json' | 'xlsx';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  record_count: number;
  file_path?: string;
  download_url?: string;
  created_at: string;
  completed_at?: string;
  expires_at?: string;
}

export interface AuditAlert {
  alert_id: string;
  name: string;
  description: string;
  condition: AuditAlertCondition;
  severity: AuditSeverity;
  is_enabled: boolean;
  notification_channels: string[];
  last_triggered_at?: string;
  trigger_count: number;
  created_by: string;
  created_at: string;
}

export interface AuditAlertCondition {
  type: 'threshold' | 'pattern' | 'anomaly' | 'rate';
  threshold_value?: number;
  window_seconds?: number;
  pattern?: string;
  actions?: string[];
  resource_types?: string[];
  severity_minimum?: AuditSeverity;
}

export interface ComplianceFinding {
  finding_id: string;
  severity: AuditSeverity;
  category: AuditCategory;
  description: string;
  affected_records: number;
  remediation: string;
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
  detected_at: string;
  resolved_at?: string;
}

export interface AuditDashboardStats {
  total_events_24h: number;
  total_events_7d: number;
  critical_events_24h: number;
  events_by_category: Record<AuditCategory, number>;
  events_by_severity: Record<AuditSeverity, number>;
  top_active_actors: { actor_id: string; count: number }[];
  recent_critical_events: AuditEvent[];
}
