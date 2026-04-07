import {
  definePermission,
  defineConstraint,
  definePreference,
  validateConfig,
  getDefaultConfig,
  checkPermission,
  enforceConstraint,
  applyPreference,
  auditAction,
  getAuditLogs,
  saveAgentConfig,
  getAgentConfig,
  upsertAgentConfig,
  deleteAgentConfig,
  _resetTestState,
} from './enforcer';
import type {
  Permission,
  Constraint,
  Preference,
  AgentConfig,
  ValidationResult,
  AuditLog,
  PermissionScope,
} from './schemas';

export {
  // Schema functions
  definePermission,
  defineConstraint,
  definePreference,
  validateConfig,
  getDefaultConfig,
  // Enforcer functions
  checkPermission,
  enforceConstraint,
  applyPreference,
  auditAction,
  getAuditLogs,
  // Config management
  saveAgentConfig,
  getAgentConfig,
  upsertAgentConfig,
  deleteAgentConfig,
  _resetTestState,
};

// Re-export types
export type {
  Permission,
  Constraint,
  Preference,
  AgentConfig,
  ValidationResult,
  AuditLog,
  PermissionScope,
};

// ===== High-level service functions =====

export function initAgentDefaults(agentId: string): AgentConfig {
  return upsertAgentConfig(agentId);
}

export function updateAgentPermissions(
  agentId: string,
  permissions: PermissionScope[],
  denied: PermissionScope[] = [],
): AgentConfig {
  const config = getAgentConfig(agentId);
  return saveAgentConfig({
    ...config,
    permissions: {
      ...config.permissions,
      permissions,
      denied_permissions: denied,
    },
  });
}

export function updateAgentConstraints(
  agentId: string,
  overrides: Partial<AgentConfig['constraints']>,
): AgentConfig {
  const config = getAgentConfig(agentId);
  return saveAgentConfig({
    ...config,
    constraints: {
      ...config.constraints,
      ...overrides,
    },
  });
}

export function updateAgentPreferences(
  agentId: string,
  overrides: Partial<AgentConfig['preferences']>,
): AgentConfig {
  const config = getAgentConfig(agentId);
  return saveAgentConfig({
    ...config,
    preferences: {
      ...config.preferences,
      ...overrides,
    },
  });
}

export function canAgentPerform(agentId: string, action: PermissionScope): boolean {
  return checkPermission(agentId, action);
}

export function checkAgentConstraints(
  agentId: string,
  action: string,
  context?: Record<string, unknown>,
): boolean {
  const result = enforceConstraint(agentId, action, context);
  return result.allowed;
}
