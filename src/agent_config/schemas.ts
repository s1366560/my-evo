// ===== Permission =====
export type PermissionScope =
  | 'read'
  | 'write'
  | 'publish'
  | 'delete'
  | 'admin'
  | 'kg_read'
  | 'kg_write'
  | 'assets_read'
  | 'assets_write'
  | 'bounty_read'
  | 'bounty_write'
  | 'swarm_read'
  | 'swarm_write'
  | 'analytics_read'
  | 'search_read'
  | 'council_read'
  | 'council_write';

export interface Permission {
  id: string;
  name: string;
  scope: PermissionScope;
  description: string;
  created_at: string;
}

// ===== Constraint =====
export type ConstraintType =
  | 'rate_limit'
  | 'quota'
  | 'time_window'
  | 'content_length'
  | 'geographic'
  | 'trust_level';

export interface Constraint {
  id: string;
  name: string;
  type: ConstraintType;
  params: Record<string, unknown>;
  description: string;
  created_at: string;
}

// ===== Preference =====
export type PreferenceType =
  | 'model'
  | 'timeout'
  | 'retry'
  | 'cache'
  | 'notification'
  | 'privacy';

export interface Preference {
  id: string;
  name: string;
  type: PreferenceType;
  value: unknown;
  description: string;
  created_at: string;
}

// ===== AgentConfig =====
export interface AgentPermissionConfig {
  permissions: PermissionScope[];
  denied_permissions: PermissionScope[];
  conditional_permissions: Array<{
    scope: PermissionScope;
    condition: string;
  }>;
}

export interface AgentConstraintConfig {
  constraints: Constraint[];
  max_rate_per_minute: number;
  max_rate_per_hour: number;
  max_rate_per_day: number;
  max_content_length: number;
  allowed_time_windows: Array<{ start: string; end: string }>;
  min_trust_level: 'unverified' | 'verified' | 'trusted';
}

export interface AgentPreferenceConfig {
  preferences: Preference[];
  default_model: string;
  timeout_ms: number;
  max_retries: number;
  cache_enabled: boolean;
  notification_enabled: boolean;
  privacy_mode: boolean;
}

export interface AgentConfig {
  agent_id: string;
  permissions: AgentPermissionConfig;
  constraints: AgentConstraintConfig;
  preferences: AgentPreferenceConfig;
  version: number;
  updated_at: string;
}

// ===== Validation =====
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
}

// ===== Audit =====
export type AuditActionType =
  | 'permission_check'
  | 'constraint_enforce'
  | 'preference_apply'
  | 'config_update'
  | 'config_delete';

export interface AuditLog {
  audit_id: string;
  agent_id: string;
  action: AuditActionType;
  details: Record<string, unknown>;
  result: 'allowed' | 'denied' | 'warning';
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
}
