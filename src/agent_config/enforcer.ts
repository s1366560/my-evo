import type {
  PermissionScope,
  Constraint,
  Preference,
  AgentConfig,
  ValidationResult,
  AuditLog,
  Permission,
} from './schemas';
import {
  ValidationError,
  NotFoundError,
} from '../shared/errors';

// ===== In-memory store (replace with DB in production) =====
const agentConfigs = new Map<string, AgentConfig>();
const auditLogs: AuditLog[] = [];
const actionWindows = new Map<string, number[]>();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ===== Permission Registry =====
const permissionRegistry = new Map<string, { name: string; scope: PermissionScope; description: string }>();

export function definePermission(permission: {
  name: string;
  scope: PermissionScope;
  description: string;
}): Permission {
  const id = generateId();
  const record: Permission = {
    id,
    name: permission.name,
    scope: permission.scope,
    description: permission.description,
    created_at: new Date().toISOString(),
  };
  permissionRegistry.set(permission.scope, { name: permission.name, scope: permission.scope, description: permission.description });
  return record;
}

// ===== Constraint Registry =====
const constraintRegistry = new Map<string, { name: string; type: string; params: Record<string, unknown>; description: string }>();

export function defineConstraint(constraint: {
  name: string;
  type: string;
  params: Record<string, unknown>;
  description: string;
}): Constraint {
  const id = generateId();
  const record: Constraint = {
    id,
    name: constraint.name,
    type: constraint.type as Constraint['type'],
    params: constraint.params,
    description: constraint.description,
    created_at: new Date().toISOString(),
  };
  constraintRegistry.set(constraint.name, { name: constraint.name, type: constraint.type, params: constraint.params, description: constraint.description });
  return record;
}

// ===== Preference Registry =====
const preferenceRegistry = new Map<string, { name: string; type: string; value: unknown; description: string }>();

export function definePreference(preference: {
  name: string;
  type: string;
  value: unknown;
  description: string;
}): Preference {
  const id = generateId();
  const record: Preference = {
    id,
    name: preference.name,
    type: preference.type as Preference['type'],
    value: preference.value,
    description: preference.description,
    created_at: new Date().toISOString(),
  };
  preferenceRegistry.set(preference.name, { name: preference.name, type: preference.type, value: preference.value, description: preference.description });
  return record;
}

// ===== Default Config Builder =====
export function getDefaultConfig(agentId: string): AgentConfig {
  return {
    agent_id: agentId,
    permissions: {
      permissions: ['read'],
      denied_permissions: [],
      conditional_permissions: [],
    },
    constraints: {
      constraints: [],
      max_rate_per_minute: 5,
      max_rate_per_hour: 100,
      max_rate_per_day: 1000,
      max_content_length: 50000,
      allowed_time_windows: [{ start: '00:00', end: '23:59' }],
      min_trust_level: 'unverified',
    },
    preferences: {
      preferences: [],
      default_model: 'gpt-4',
      timeout_ms: 30000,
      max_retries: 3,
      cache_enabled: true,
      notification_enabled: true,
      privacy_mode: false,
    },
    version: 1,
    updated_at: new Date().toISOString(),
  };
}

// ===== Config Validation =====
export function validateConfig(config: unknown): ValidationResult {
  const errors: ValidationResult['errors'] = [];
  const warnings: ValidationResult['warnings'] = [];

  if (!config || typeof config !== 'object') {
    errors.push({ field: 'config', code: 'INVALID_TYPE', message: 'Config must be an object' });
    return { valid: false, errors, warnings };
  }

  const c = config as Record<string, unknown>;

  // Check agent_id
  if (!c.agent_id || typeof c.agent_id !== 'string') {
    errors.push({ field: 'agent_id', code: 'MISSING_FIELD', message: 'agent_id is required and must be a string' });
  }

  // Check permissions
  if (!c.permissions || typeof c.permissions !== 'object') {
    errors.push({ field: 'permissions', code: 'MISSING_FIELD', message: 'permissions object is required' });
  } else {
    const perms = c.permissions as Record<string, unknown>;
    if (!Array.isArray(perms.permissions)) {
      errors.push({ field: 'permissions.permissions', code: 'INVALID_TYPE', message: 'permissions must be an array' });
    }
  }

  // Check constraints
  if (!c.constraints || typeof c.constraints !== 'object') {
    errors.push({ field: 'constraints', code: 'MISSING_FIELD', message: 'constraints object is required' });
  } else {
    const cons = c.constraints as Record<string, unknown>;
    if (typeof cons.max_rate_per_minute !== 'number' || cons.max_rate_per_minute <= 0) {
      errors.push({ field: 'constraints.max_rate_per_minute', code: 'INVALID_VALUE', message: 'max_rate_per_minute must be a positive number' });
    }
    if (typeof cons.max_content_length !== 'number' || cons.max_content_length <= 0) {
      errors.push({ field: 'constraints.max_content_length', code: 'INVALID_VALUE', message: 'max_content_length must be a positive number' });
    }
    if (cons.max_content_length && (cons.max_content_length as number) > 500000) {
      warnings.push({ field: 'constraints.max_content_length', code: 'LARGE_LIMIT', message: 'max_content_length exceeds recommended maximum of 500000' });
    }
  }

  // Check preferences
  if (!c.preferences || typeof c.preferences !== 'object') {
    errors.push({ field: 'preferences', code: 'MISSING_FIELD', message: 'preferences object is required' });
  } else {
    const prefs = c.preferences as Record<string, unknown>;
    if (typeof prefs.timeout_ms !== 'number' || prefs.timeout_ms <= 0) {
      errors.push({ field: 'preferences.timeout_ms', code: 'INVALID_VALUE', message: 'timeout_ms must be a positive number' });
    }
    if (prefs.timeout_ms && (prefs.timeout_ms as number) > 300000) {
      warnings.push({ field: 'preferences.timeout_ms', code: 'LARGE_TIMEOUT', message: 'timeout_ms exceeds recommended maximum of 300000ms' });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ===== Enforcer: Check Permission =====
export function checkPermission(agentId: string, action: PermissionScope): boolean {
  const config = agentConfigs.get(agentId);
  if (!config) return false;

  const { permissions: perms } = config;

  // Check denied list first
  if (perms.denied_permissions.includes(action)) return false;

  // Check explicit allow list
  if (perms.permissions.includes(action)) return true;

  // Check conditional permissions (simplified condition eval)
  const conditional = perms.conditional_permissions.find(c => c.scope === action);
  if (conditional) {
    // In production: evaluate condition against context store
    return false; // Deny by default if condition not met
  }

  return false;
}

// ===== Enforcer: Enforce Constraint =====
export function enforceConstraint(
  agentId: string,
  action: string,
  context?: Record<string, unknown>,
): { allowed: boolean; violated_constraint?: string; message?: string } {
  const config = agentConfigs.get(agentId);
  if (!config) {
    return { allowed: false, violated_constraint: 'config_missing', message: 'Agent config not found' };
  }

  const { constraints } = config;

  const now = new Date();
  const nowMs = now.getTime();
  const windowKey = `${agentId}:${action}`;
  const retained = (actionWindows.get(windowKey) ?? [])
    .filter((timestamp) => nowMs - timestamp < 24 * 60 * 60 * 1000);
  const minuteCount = retained.filter((timestamp) => nowMs - timestamp < 60 * 1000).length;
  const hourCount = retained.filter((timestamp) => nowMs - timestamp < 60 * 60 * 1000).length;
  const dayCount = retained.length;

  if (minuteCount >= constraints.max_rate_per_minute) {
    const log = createAuditLog(agentId, 'constraint_enforce', {
      action,
      constraint: 'rate_limit_per_minute',
      current: minuteCount,
      limit: constraints.max_rate_per_minute,
      context,
    }, 'denied');
    auditLogs.push(log);
    return {
      allowed: false,
      violated_constraint: 'rate_limit_per_minute',
      message: `Rate limit exceeded: ${minuteCount}/${constraints.max_rate_per_minute} per minute`,
    };
  }

  if (hourCount >= constraints.max_rate_per_hour) {
    const log = createAuditLog(agentId, 'constraint_enforce', {
      action,
      constraint: 'rate_limit_per_hour',
      current: hourCount,
      limit: constraints.max_rate_per_hour,
      context,
    }, 'denied');
    auditLogs.push(log);
    return {
      allowed: false,
      violated_constraint: 'rate_limit_per_hour',
      message: `Rate limit exceeded: ${hourCount}/${constraints.max_rate_per_hour} per hour`,
    };
  }

  if (dayCount >= constraints.max_rate_per_day) {
    const log = createAuditLog(agentId, 'constraint_enforce', {
      action,
      constraint: 'rate_limit_per_day',
      current: dayCount,
      limit: constraints.max_rate_per_day,
      context,
    }, 'denied');
    auditLogs.push(log);
    return {
      allowed: false,
      violated_constraint: 'rate_limit_per_day',
      message: `Rate limit exceeded: ${dayCount}/${constraints.max_rate_per_day} per day`,
    };
  }

  // Check content length
  const contentLength = (context?.content_length as number) ?? 0;
  if (contentLength > constraints.max_content_length) {
    const log = createAuditLog(agentId, 'constraint_enforce', {
      action,
      constraint: 'max_content_length',
      content_length: contentLength,
      limit: constraints.max_content_length,
      context,
    }, 'denied');
    auditLogs.push(log);
    return {
      allowed: false,
      violated_constraint: 'max_content_length',
      message: `Content length ${contentLength} exceeds maximum ${constraints.max_content_length}`,
    };
  }

  // Check time window
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const inWindow = constraints.allowed_time_windows.some(
    w => currentTime >= w.start && currentTime <= w.end,
  );
  if (!inWindow) {
    const log = createAuditLog(agentId, 'constraint_enforce', {
      action,
      constraint: 'time_window',
      current_time: currentTime,
      allowed_windows: constraints.allowed_time_windows,
      context,
    }, 'warning');
    auditLogs.push(log);
    return {
      allowed: false,
      violated_constraint: 'time_window',
      message: `Current time ${currentTime} is outside allowed windows`,
    };
  }

  const trustOrder: Record<AgentConfig['constraints']['min_trust_level'], number> = {
    unverified: 0,
    verified: 1,
    trusted: 2,
  };
  const rawTrust = context?.trust_level;
  const currentTrust: AgentConfig['constraints']['min_trust_level'] =
    rawTrust === 'verified' || rawTrust === 'trusted' || rawTrust === 'unverified'
      ? rawTrust
      : 'unverified';
  if (trustOrder[currentTrust] < trustOrder[constraints.min_trust_level]) {
    const log = createAuditLog(agentId, 'constraint_enforce', {
      action,
      constraint: 'min_trust_level',
      current_trust_level: currentTrust,
      required_trust_level: constraints.min_trust_level,
      context,
    }, 'denied');
    auditLogs.push(log);
    return {
      allowed: false,
      violated_constraint: 'min_trust_level',
      message: `Trust level ${currentTrust} is below required ${constraints.min_trust_level}`,
    };
  }

  retained.push(nowMs);
  actionWindows.set(windowKey, retained);

  return { allowed: true };
}

// ===== Enforcer: Apply Preference =====
export function applyPreference(
  agentId: string,
  context?: Record<string, unknown>,
): Record<string, unknown> {
  const config = agentConfigs.get(agentId);
  if (!config) {
    return {};
  }

  const { preferences } = config;

  return {
    model: preferences.default_model,
    timeout_ms: preferences.timeout_ms,
    max_retries: preferences.max_retries,
    cache_enabled: preferences.cache_enabled,
    notification_enabled: preferences.notification_enabled,
    privacy_mode: preferences.privacy_mode,
    // Merge context preferences
    ...(context ?? {}),
  };
}

// ===== Audit =====
function createAuditLog(
  agentId: string,
  action: AuditLog['action'],
  details: Record<string, unknown>,
  result: AuditLog['result'],
): AuditLog {
  return {
    audit_id: generateId(),
    agent_id: agentId,
    action,
    details,
    result,
    timestamp: new Date().toISOString(),
  };
}

export function auditAction(
  agentId: string,
  action: AuditLog['action'],
  details?: Record<string, unknown>,
): AuditLog {
  const log = createAuditLog(agentId, action, details ?? {}, 'allowed');
  auditLogs.push(log);
  return log;
}

export function getAuditLogs(
  agentId?: string,
  limit = 100,
): AuditLog[] {
  let logs = [...auditLogs];
  if (agentId) {
    logs = logs.filter(l => l.agent_id === agentId);
  }
  return logs.slice(-limit);
}

// ===== Config Management =====
export function saveAgentConfig(config: AgentConfig): AgentConfig {
  const validated = validateConfig(config);
  if (!validated.valid) {
    const err = validated.errors[0]!;
    throw new ValidationError(`${err.field}: ${err.message}`);
  }
  const updated: AgentConfig = {
    ...config,
    version: (config.version ?? 0) + 1,
    updated_at: new Date().toISOString(),
  };
  agentConfigs.set(config.agent_id, updated);
  return updated;
}

export function getAgentConfig(agentId: string): AgentConfig {
  const config = agentConfigs.get(agentId);
  if (!config) {
    throw new NotFoundError('Agent config', agentId);
  }
  return config;
}

export function upsertAgentConfig(agentId: string): AgentConfig {
  const existing = agentConfigs.get(agentId);
  if (existing) return existing;
  const def = getDefaultConfig(agentId);
  agentConfigs.set(agentId, def);
  return def;
}

export function deleteAgentConfig(agentId: string): void {
  if (!agentConfigs.has(agentId)) {
    throw new NotFoundError('Agent config', agentId);
  }
  agentConfigs.delete(agentId);
}

// ===== Test support =====
export function _resetTestState(): void {
  agentConfigs.clear();
  auditLogs.length = 0;
  actionWindows.clear();
}
