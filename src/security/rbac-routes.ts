import type { FastifyInstance } from 'fastify';
import { requireAuth, requireTrustLevel } from '../shared/auth';
import * as rbac from './rbac';
import { ForbiddenError, ValidationError } from '../shared/errors';

// Ensure security admin auth
function ensureSecurityAdminAuth(
  auth: NonNullable<import('fastify').FastifyRequest['auth']>,
): void {
  if (auth.auth_type === 'api_key') {
    throw new ForbiddenError('API keys cannot mutate the security control plane');
  }
}

export async function rbacRoutes(app: FastifyInstance): Promise<void> {
  // ===== List All Roles =====
  // GET /security/rbac/roles
  app.get('/security/rbac/roles', {
    schema: { tags: ['Security', 'RBAC'] },
  }, async (_request, reply) => {
    const roles = rbac.listAllRoles();
    return reply.send({
      success: true,
      roles,
      total: roles.length,
      data: { roles, total: roles.length },
    });
  });

  // ===== Get Role Details =====
  // GET /security/rbac/roles/:role
  app.get('/security/rbac/roles/:role', {
    schema: {
      tags: ['Security', 'RBAC'],
      params: {
        type: 'object',
        properties: {
          role: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { role } = request.params as { role: string };
    const roleInfo = rbac.getRoleInfo(role as rbac.Role);

    if (!roleInfo) {
      throw new ValidationError(`Invalid role: ${role}`);
    }

    const allPermissions = rbac.getAllPermissionsForRole(role as rbac.Role);
    return reply.send({
      success: true,
      role: roleInfo.role,
      description: roleInfo.description,
      permissions: Array.from(allPermissions),
      trustLevelRequired: roleInfo.trustLevelRequired,
      data: { role: roleInfo, permissions: Array.from(allPermissions) },
    });
  });

  // ===== Check Permission =====
  // POST /security/rbac/check
  app.post('/security/rbac/check', {
    schema: {
      tags: ['Security', 'RBAC'],
      body: {
        type: 'object',
        required: ['role', 'permission'],
        properties: {
          role: { type: 'string' },
          permission: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { role: string; permission: string };

    if (!rbac.isValidRole(body.role)) {
      throw new ValidationError(`Invalid role: ${body.role}`);
    }

    if (!rbac.isValidPermission(body.permission)) {
      throw new ValidationError(`Invalid permission: ${body.permission}`);
    }

    const allowed = rbac.checkPermission(body.role as rbac.Role, body.permission as rbac.Permission);

    return reply.send({
      success: true,
      allowed,
      role: body.role,
      permission: body.permission,
      data: { allowed, role: body.role, permission: body.permission },
    });
  });

  // ===== Assign Role to Node =====
  // POST /security/rbac/assign
  app.post('/security/rbac/assign', {
    schema: {
      tags: ['Security', 'RBAC'],
      body: {
        type: 'object',
        required: ['node_id', 'role'],
        properties: {
          node_id: { type: 'string' },
          role: { type: 'string' },
        },
      },
    },
    preHandler: [requireTrustLevel('trusted')],
  }, async (request, reply) => {
    ensureSecurityAdminAuth(request.auth!);
    const body = request.body as { node_id: string; role: string };

    if (!rbac.isValidRole(body.role)) {
      throw new ValidationError(`Invalid role: ${body.role}`);
    }

    const actor = request.auth!.node_id;
    rbac.assignRole(body.node_id, body.role as rbac.Role, actor);

    return reply.send({
      success: true,
      node_id: body.node_id,
      role: body.role,
      message: `Role '${body.role}' assigned to node '${body.node_id}'`,
      data: { node_id: body.node_id, role: body.role },
    });
  });

  // ===== Remove Role from Node =====
  // DELETE /security/rbac/node/:nodeId/role
  app.delete('/security/rbac/node/:nodeId/role', {
    schema: {
      tags: ['Security', 'RBAC'],
      params: {
        type: 'object',
        properties: {
          nodeId: { type: 'string' },
        },
      },
    },
    preHandler: [requireTrustLevel('trusted')],
  }, async (request, reply) => {
    ensureSecurityAdminAuth(request.auth!);
    const { nodeId } = request.params as { nodeId: string };
    const actor = request.auth!.node_id;

    rbac.removeRole(nodeId, actor);

    return reply.send({
      success: true,
      node_id: nodeId,
      message: `Role removed from node '${nodeId}'`,
      data: { node_id: nodeId },
    });
  });

  // ===== Get Node's Role =====
  // GET /security/rbac/node/:nodeId
  app.get('/security/rbac/node/:nodeId', {
    schema: {
      tags: ['Security', 'RBAC'],
      params: {
        type: 'object',
        properties: {
          nodeId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const role = rbac.getNodeRole(nodeId);
    const roleInfo = role ? rbac.getRoleInfo(role) : undefined;

    return reply.send({
      success: true,
      node_id: nodeId,
      role: role ?? null,
      description: roleInfo?.description ?? null,
      data: { node_id: nodeId, role, description: roleInfo?.description },
    });
  });

  // ===== Check Node's Permission =====
  // POST /security/rbac/node/:nodeId/check
  app.post('/security/rbac/node/:nodeId/check', {
    schema: {
      tags: ['Security', 'RBAC'],
      params: {
        type: 'object',
        properties: {
          nodeId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['permission'],
        properties: {
          permission: { type: 'string' },
          context: {
            type: 'object',
            properties: {
              resourceOwner: { type: 'string' },
              isOwner: { type: 'boolean' },
              trustLevel: { type: 'string' },
              quarantineLevel: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const body = request.body as {
      permission: string;
      context?: {
        resourceOwner?: string;
        isOwner?: boolean;
        trustLevel?: string;
        quarantineLevel?: string;
      };
    };

    if (!rbac.isValidPermission(body.permission)) {
      throw new ValidationError(`Invalid permission: ${body.permission}`);
    }

    let result;
    if (body.context) {
      result = rbac.checkPermissionWithContext(
        nodeId,
        body.permission as rbac.Permission,
        {
          nodeId,
          ...body.context,
        },
      );
    } else {
      const allowed = rbac.hasPermission(nodeId, body.permission as rbac.Permission);
      result = { allowed };
    }

    return reply.send({
      success: true,
      ...result,
      node_id: nodeId,
      permission: body.permission,
      data: { ...result, node_id: nodeId, permission: body.permission },
    });
  });

  // ===== Bulk Assign Roles =====
  // POST /security/rbac/bulk-assign
  app.post('/security/rbac/bulk-assign', {
    schema: {
      tags: ['Security', 'RBAC'],
      body: {
        type: 'object',
        required: ['node_ids', 'role'],
        properties: {
          node_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 100,
          },
          role: { type: 'string' },
        },
      },
    },
    preHandler: [requireTrustLevel('trusted')],
  }, async (request, reply) => {
    ensureSecurityAdminAuth(request.auth!);
    const body = request.body as { node_ids: string[]; role: string };

    if (!rbac.isValidRole(body.role)) {
      throw new ValidationError(`Invalid role: ${body.role}`);
    }

    const actor = request.auth!.node_id;
    const result = rbac.assignRoleToMultiple(body.node_ids, body.role as rbac.Role, actor);

    return reply.send({
      success: true,
      assigned: result.assigned,
      failed: result.failed,
      errors: result.errors,
      data: result,
    });
  });

  // ===== Get Role History =====
  // GET /security/rbac/history
  app.get('/security/rbac/history', {
    schema: {
      tags: ['Security', 'RBAC'],
      querystring: {
        type: 'object',
        properties: {
          node_id: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 1000, default: 100 },
        },
      },
    },
  }, async (request, reply) => {
    const query = request.query as { node_id?: string; limit?: number };
    const history = rbac.getRoleHistory(query.node_id, query.limit);

    return reply.send({
      success: true,
      history,
      total: history.length,
      data: { history, total: history.length },
    });
  });

  // ===== Get Role Statistics =====
  // GET /security/rbac/stats
  app.get('/security/rbac/stats', {
    schema: { tags: ['Security', 'RBAC'] },
  }, async (_request, reply) => {
    const stats = rbac.getRoleStats();

    return reply.send({
      success: true,
      ...stats,
      data: stats,
    });
  });

  // ===== Validate Role or Permission =====
  // POST /security/rbac/validate
  app.post('/security/rbac/validate', {
    schema: {
      tags: ['Security', 'RBAC'],
      body: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          permission: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { role?: string; permission?: string };

    const result = {
      role_valid: body.role ? rbac.isValidRole(body.role) : null,
      permission_valid: body.permission ? rbac.isValidPermission(body.permission) : null,
    };

    return reply.send({
      success: true,
      ...result,
      data: result,
    });
  });
}

// Export permission list for convenience
export function getAllPermissions(): string[] {
  return [
    '*',
    'read', 'write', 'publish', 'delete',
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
}
