// ===== RBAC =====
export type Role = 'admin' | 'developer' | 'user' | 'guest' | 'validator' | 'council_member';

export interface RolePermissions {
  role: Role;
  permissions: string[];
  description: string;
}

export const ROLE_PERMISSIONS: RolePermissions[] = [
  {
    role: 'admin',
    permissions: ['*'],
    description: 'Full system access',
  },
  {
    role: 'developer',
    permissions: [
      'read', 'write', 'publish', 'delete',
      'kg_read', 'kg_write',
      'assets_read', 'assets_write',
      'bounty_read', 'bounty_write',
      'swarm_read', 'swarm_write',
      'analytics_read',
      'search_read',
    ],
    description: 'Standard developer access',
  },
  {
    role: 'user',
    permissions: [
      'read',
      'kg_read',
      'assets_read',
      'bounty_read',
      'swarm_read',
      'search_read',
    ],
    description: 'Basic user read access',
  },
  {
    role: 'guest',
    permissions: ['read'],
    description: 'Guest read-only access',
  },
  {
    role: 'validator',
    permissions: [
      'read', 'write',
      'kg_read', 'kg_write',
      'assets_read',
      'council_read', 'council_write',
    ],
    description: 'Validator with trust verification rights',
  },
  {
    role: 'council_member',
    permissions: [
      'read', 'write',
      'kg_read', 'kg_write',
      'assets_read',
      'council_read', 'council_write',
      'council_propose', 'council_vote',
    ],
    description: 'Council governance participant',
  },
];

// ===== Rate Limiting =====
export interface RateLimitConfig {
  window_ms: number;
  max_requests: number;
}

export const DEFAULT_RATE_LIMITS: Record<Role, RateLimitConfig> = {
  admin:    { window_ms: 60_000, max_requests: 1000 },
  developer: { window_ms: 60_000, max_requests: 200 },
  user:     { window_ms: 60_000, max_requests: 100 },
  guest:    { window_ms: 60_000, max_requests: 20 },
  validator: { window_ms: 60_000, max_requests: 200 },
  council_member: { window_ms: 60_000, max_requests: 200 },
};

// ===== Security Event =====
export type SecurityEventType =
  | 'auth_success'
  | 'auth_failure'
  | 'permission_denied'
  | 'rate_limit_exceeded'
  | 'constraint_violation'
  | 'anomaly_detected'
  | 'config_changed'
  | 'tier_changed'
  | 'quarantine_triggered';

export interface SecurityEvent {
  event_id: string;
  type: SecurityEventType;
  identifier: string;
  details: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: string;
  resolved: boolean;
}

// ===== Anomaly Detection =====
export interface AnomalySignal {
  node_id: string;
  signal_type: 'unusual_volume' | 'unusual_time' | 'unusual_pattern' | 'intent_drift' | 'capability_mismatch';
  score: number; // 0-1
  description: string;
  detected_at: string;
}

export interface AnomalyReport {
  node_id: string;
  signals: AnomalySignal[];
  overall_score: number;
  status: 'normal' | 'suspicious' | 'critical';
  recommendations: string[];
}
