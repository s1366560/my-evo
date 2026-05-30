import type { PrismaClient } from '@prisma/client';
import { createUnconfiguredPrismaClient } from '../shared/prisma';
import { ForbiddenError, ValidationError } from '../shared/errors';

// ===== RBAC Types =====
export type Role =
  | 'admin'
  | 'developer'
  | 'user'
  | 'guest'
  | 'validator'
  | 'council_member'
  | 'moderator'
  | 'auditor';

export type Permission =
  | '*'
  | 'read'
  | 'write'
  | 'publish'
  | 'delete'
  | 'kg_read'
  | 'kg_write'
  | 'kg_delete'
  | 'assets_read'
  | 'assets_write'
  | 'assets_delete'
  | 'bounty_read'
  | 'bounty_write'
  | 'bounty_create'
  | 'bounty_complete'
  | 'swarm_read'
  | 'swarm_write'
  | 'swarm_create'
  | 'analytics_read'
  | 'analytics_write'
  | 'search_read'
  | 'search_write'
  | 'council_read'
  | 'council_write'
  | 'council_propose'
  | 'council_vote'
  | 'trust_read'
  | 'trust_write'
  | 'trust_attest'
  | 'credits_read'
  | 'credits_write'
  | 'credits_transfer'
  | 'session_read'
  | 'session_write'
  | 'session_create'
  | 'session_consensus'
  | 'user_read'
  | 'user_write'
  | 'user_delete'
  | 'role_assign'
  | 'role_read'
  | 'security_read'
  | 'security_write'
  | 'audit_read'
  | 'moderation_read'
  | 'moderation_write';

export interface RoleDefinition {
  role: Role;
  description: string;
  permissions: Permission[];
  inherits?: Role[];
  trustLevelRequired?: 'unverified' | 'verified' | 'trusted';
  maxApiKeys?: number;
  rateLimitMultiplier?: number;
}

export interface PermissionGrant {
  role: Role;
  permission: Permission;
  grantedAt: string;
  grantedBy?: string;
}

// ===== Role Definitions =====
export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: 'admin',
    description: 'Full system administrator with unrestricted access',
    permissions: ['*'],
    trustLevelRequired: 'trusted',
    rateLimitMultiplier: 10,
  },
  {
    role: 'developer',
    description: 'Standard developer access for building and publishing',
    permissions: [
      'read', 'write', 'publish', 'delete',
      'kg_read', 'kg_write',
      'assets_read', 'assets_write', 'assets_delete',
      'bounty_read', 'bounty_write',
      'swarm_read', 'swarm_write', 'swarm_create',
      'analytics_read',
      'search_read', 'search_write',
      'session_read', 'session_write', 'session_create',
    ],
    trustLevelRequired: 'verified',
    maxApiKeys: 10,
    rateLimitMultiplier: 2,
  },
  {
    role: 'user',
    description: 'Standard user with basic read and limited write access',
    permissions: [
      'read',
      'kg_read',
      'assets_read',
      'bounty_read',
      'swarm_read',
      'search_read',
      'session_read',
      'credits_read',
    ],
    trustLevelRequired: 'unverified',
    maxApiKeys: 5,
    rateLimitMultiplier: 1,
  },
  {
    role: 'guest',
    description: 'Guest access with read-only permissions',
    permissions: ['read'],
    rateLimitMultiplier: 0.5,
  },
  {
    role: 'validator',
    description: 'Validator with trust verification and attestation rights',
    permissions: [
      'read', 'write',
      'kg_read', 'kg_write',
      'assets_read',
      'council_read', 'council_write',
      'trust_read', 'trust_write', 'trust_attest',
      'moderation_read', 'moderation_write',
    ],
    trustLevelRequired: 'trusted',
    maxApiKeys: 3,
    rateLimitMultiplier: 1.5,
  },
  {
    role: 'council_member',
    description: 'Council governance participant with proposal and voting rights',
    permissions: [
      'read', 'write',
      'kg_read', 'kg_write',
      'assets_read',
      'council_read', 'council_write', 'council_propose', 'council_vote',
      'trust_read',
    ],
    trustLevelRequired: 'trusted',
    rateLimitMultiplier: 2,
  },
  {
    role: 'moderator',
    description: 'Content and community moderation capabilities',
    permissions: [
      'read',
      'kg_read',
      'assets_read',
      'bounty_read',
      'council_read',
      'moderation_read', 'moderation_write',
      'trust_read',
    ],
    trustLevelRequired: 'verified',
    rateLimitMultiplier: 1.5,
  },
  {
    role: 'auditor',
    description: 'Audit and compliance access to system logs and events',
    permissions: [
      'read',
      'kg_read',
      'assets_read',
      'audit_read',
      'security_read',
      'session_read',
      'trust_read',
    ],
    trustLevelRequired: 'trusted',
    rateLimitMultiplier: 1,
  },
];

// ===== Role Hierarchy =====
const ROLE_HIERARCHY: Record<Role, Role[]> = {
  admin: [],
  developer: ['user'],
  user: ['guest'],
  guest: [],
  validator: ['user'],
  council_member: ['validator', 'user'],
  moderator: ['user'],
  auditor: ['user'],
};

// ===== In-memory Role Assignment Store =====
const roleAssignments = new Map<string, Role>();
const roleHistory: Array<{
  nodeId: string;
  role: Role;
  action: 'assigned' | 'removed' | 'changed';
  timestamp: string;
  actor?: string;
}> = [];

// ===== Permission Resolution =====
function getRoleDefinition(role: Role): RoleDefinition | undefined {
  return ROLE_DEFINITIONS.find((r) => r.role === role);
}

export function getAllPermissionsForRole(role: Role): Set<Permission> {
  const permissions = new Set<Permission>();
  const visited = new Set<Role>();

  function collectPermissions(r: Role) {
    if (visited.has(r)) return;
    visited.add(r);

    const def = getRoleDefinition(r);
    if (!def) return;

    for (const perm of def.permissions) {
      permissions.add(perm);
    }

    // Inherit from parent roles
    const parents = ROLE_HIERARCHY[r] || [];
    for (const parent of parents) {
      collectPermissions(parent);
    }
  }

  collectPermissions(role);
  return permissions;
}

// ===== Core RBAC Functions =====

export function checkPermission(role: Role, permission: Permission): boolean {
  const permissions = getAllPermissionsForRole(role);

  // Wildcard permission grants everything
  if (permissions.has('*')) return true;

  return permissions.has(permission);
}

export function hasPermission(
  nodeId: string,
  permission: Permission,
): boolean {
  const role = roleAssignments.get(nodeId);
  if (!role) return false;
  return checkPermission(role, permission);
}

export function assignRole(
  nodeId: string,
  role: Role,
  actor?: string,
): void {
  const roleDef = getRoleDefinition(role);
  if (!roleDef) {
    throw new ValidationError(`Invalid role: ${role}`);
  }

  const previousRole = roleAssignments.get(nodeId);
  roleAssignments.set(nodeId, role);

  roleHistory.push({
    nodeId,
    role,
    action: previousRole ? 'changed' : 'assigned',
    timestamp: new Date().toISOString(),
    actor,
  });

  // Keep only last 10000 history entries
  if (roleHistory.length > 10000) {
    roleHistory.splice(0, roleHistory.length - 10000);
  }
}

export function removeRole(nodeId: string, actor?: string): void {
  const previousRole = roleAssignments.get(nodeId);
  if (previousRole) {
    roleHistory.push({
      nodeId,
      role: previousRole,
      action: 'removed',
      timestamp: new Date().toISOString(),
      actor,
    });
  }
  roleAssignments.delete(nodeId);
}

export function getNodeRole(nodeId: string): Role | undefined {
  return roleAssignments.get(nodeId);
}

export function getRoleInfo(role: Role): RoleDefinition | undefined {
  return getRoleDefinition(role);
}

export function listAllRoles(): RoleDefinition[] {
  return ROLE_DEFINITIONS.map((def) => ({
    ...def,
    permissions: Array.from(getAllPermissionsForRole(def.role)),
  }));
}

// ===== Permission Checking with Exceptions =====
export interface PermissionContext {
  nodeId: string;
  resourceOwner?: string;
  isOwner?: boolean;
  trustLevel?: string;
  quarantineLevel?: string;
}

export function checkPermissionWithContext(
  nodeId: string,
  permission: Permission,
  context?: PermissionContext,
): { allowed: boolean; reason?: string } {
  const role = roleAssignments.get(nodeId);
  if (!role) {
    return { allowed: false, reason: 'No role assigned to node' };
  }

  // Check quarantine
  if (context?.quarantineLevel) {
    return { allowed: false, reason: 'Node is in quarantine' };
  }

  // Owner bypass for owner-specific resources
  if (context?.isOwner && context?.resourceOwner === nodeId) {
    // Owner can do most things on their own resources
    const ownerBypassPermissions: Permission[] = [
      'read', 'write', 'delete',
      'kg_read', 'kg_write', 'kg_delete',
      'assets_read', 'assets_write', 'assets_delete',
    ];
    if (ownerBypassPermissions.includes(permission)) {
      return { allowed: true };
    }
  }

  // Check trust level requirement
  const roleDef = getRoleDefinition(role);
  if (roleDef?.trustLevelRequired && context?.trustLevel) {
    const trustOrder = { unverified: 0, verified: 1, trusted: 2 };
    const required = trustOrder[roleDef.trustLevelRequired as keyof typeof trustOrder] ?? 0;
    const current = trustOrder[context.trustLevel as keyof typeof trustOrder] ?? 0;
    if (current < required) {
      return {
        allowed: false,
        reason: `Trust level ${roleDef.trustLevelRequired} required, current: ${context.trustLevel}`,
      };
    }
  }

  if (checkPermission(role, permission)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Permission '${permission}' not granted to role '${role}'`,
  };
}

// ===== Role Audit Trail =====
export function getRoleHistory(
  nodeId?: string,
  limit: number = 100,
): Array<{
  nodeId: string;
  role: Role;
  action: 'assigned' | 'removed' | 'changed';
  timestamp: string;
  actor?: string;
}> {
  let history = roleHistory;

  if (nodeId) {
    history = history.filter((h) => h.nodeId === nodeId);
  }

  return history.slice(-limit).reverse();
}

// ===== Bulk Role Operations =====
export function assignRoleToMultiple(
  nodeIds: string[],
  role: Role,
  actor?: string,
): { assigned: number; failed: number; errors: string[] } {
  const errors: string[] = [];
  let assigned = 0;
  let failed = 0;

  for (const nodeId of nodeIds) {
    try {
      assignRole(nodeId, role, actor);
      assigned++;
    } catch (error) {
      failed++;
      errors.push(`${nodeId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { assigned, failed, errors };
}

// ===== Role Statistics =====
export function getRoleStats(): {
  totalAssigned: number;
  byRole: Record<Role, number>;
  recentlyAssigned: number;
  recentlyRevoked: number;
} {
  const byRole: Record<Role, number> = {
    admin: 0,
    developer: 0,
    user: 0,
    guest: 0,
    validator: 0,
    council_member: 0,
    moderator: 0,
    auditor: 0,
  };

  for (const role of roleAssignments.values()) {
    byRole[role]++;
  }

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  return {
    totalAssigned: roleAssignments.size,
    byRole,
    recentlyAssigned: roleHistory.filter(
      (h) => h.action === 'assigned' && new Date(h.timestamp).getTime() > oneDayAgo,
    ).length,
    recentlyRevoked: roleHistory.filter(
      (h) => h.action === 'removed' && new Date(h.timestamp).getTime() > oneDayAgo,
    ).length,
  };
}

// ===== Default Role Assignment =====
export function getDefaultRole(): Role {
  return 'guest';
}

// ===== Role Validation =====
export function isValidRole(role: string): role is Role {
  return ROLE_DEFINITIONS.some((r) => r.role === role);
}

export function isValidPermission(permission: string): permission is Permission {
  const validPermissions: Permission[] = [
    '*', 'read', 'write', 'publish', 'delete',
    'kg_read', 'kg_write', 'kg_delete',
    'assets_read', 'assets_write', 'assets_delete',
    'bounty_read', 'bounty_write', 'bounty_create', 'bounty_complete',
    'swarm_read', 'swarm_write', 'swarm_create',
    'analytics_read', 'analytics_write',
    'search_read', 'search_write',
    'council_read', 'council_write', 'council_propose', 'council_vote',
    'trust_read', 'trust_write', 'trust_attest',
    'credits_read', 'credits_write', 'credits_transfer',
    'session_read', 'session_write', 'session_create', 'session_consensus',
    'user_read', 'user_write', 'user_delete',
    'role_assign', 'role_read',
    'security_read', 'security_write',
    'audit_read',
    'moderation_read', 'moderation_write',
  ];
  return validPermissions.includes(permission as Permission);
}

// ===== Initialize Default Roles =====
export function initializeDefaultRoles(): void {
  // Assign default guest role to new nodes (this would be called on node registration)
  // In practice, this is done lazily when checking permissions
}
