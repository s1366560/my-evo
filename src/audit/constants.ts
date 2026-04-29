// Audit module constants
export const AUDIT_MAX_EVENTS = 100_000;
export const AUDIT_RETENTION_DAYS = 90;
export const AUDIT_QUERY_DEFAULT_PAGE_SIZE = 50;
export const AUDIT_QUERY_MAX_PAGE_SIZE = 500;
export const AUDIT_EXPORT_MAX_RECORDS = 50_000;
export const AUDIT_EXPORT_TIMEOUT_MS = 60_000;

export const AUDIT_CATEGORIES = [
  'authentication', 'authorization', 'data_access', 'data_modification',
  'asset_management', 'node_management', 'credit_transaction', 'reputation_change',
  'admin_action', 'system_event', 'api_usage', 'export', 'batch',
  'integration', 'security',
] as const;

export const AUDIT_SEVERITIES = ['debug', 'info', 'warning', 'error', 'critical'] as const;

export const AUDIT_ACTOR_TYPES = ['user', 'node', 'api_key', 'system', 'admin', 'service'] as const;

export const AUDIT_RETENTION_POLICIES: Record<string, number> = {
  authentication: 365,
  authorization: 365,
  data_access: 180,
  data_modification: 365,
  asset_management: 90,
  node_management: 90,
  credit_transaction: 365,
  reputation_change: 180,
  admin_action: 365,
  system_event: 90,
  api_usage: 90,
  export: 90,
  batch: 90,
  integration: 90,
  security: 365,
};

export const AUDIT_ALERT_SEVERITY_THRESHOLDS: Record<string, number> = {
  debug: 0,
  info: 0.1,
  warning: 0.5,
  error: 0.8,
  critical: 1.0,
};
