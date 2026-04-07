import type { FastifyInstance } from 'fastify';
import {
  definePermission,
  defineConstraint,
  definePreference,
  validateConfig,
  getDefaultConfig,
  getAgentConfig,
  upsertAgentConfig,
  deleteAgentConfig,
  updateAgentPermissions,
  updateAgentConstraints,
  updateAgentPreferences,
  auditAction,
  getAuditLogs,
  canAgentPerform,
  checkAgentConstraints,
  saveAgentConfig,
} from './service';
import { ValidationError } from '../shared/errors';

export async function agentConfigRoutes(app: FastifyInstance): Promise<void> {
  // ===== Permission Registry =====

  app.post('/agent-config/permissions', {
    schema: { tags: ['AgentConfig'] },
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      scope: string;
      description: string;
    };
    if (!body.name || !body.scope || !body.description) {
      throw new ValidationError('name, scope, and description are required');
    }
    const permission = definePermission({
      name: body.name,
      scope: body.scope as Parameters<typeof definePermission>[0]['scope'],
      description: body.description,
    });
    return reply.status(201).send({ success: true, data: permission });
  });

  // ===== Constraint Registry =====

  app.post('/agent-config/constraints', {
    schema: { tags: ['AgentConfig'] },
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      type: string;
      params: Record<string, unknown>;
      description: string;
    };
    if (!body.name || !body.type || !body.description) {
      throw new ValidationError('name, type, and description are required');
    }
    const constraint = defineConstraint({
      name: body.name,
      type: body.type,
      params: body.params ?? {},
      description: body.description,
    });
    return reply.status(201).send({ success: true, data: constraint });
  });

  // ===== Preference Registry =====

  app.post('/agent-config/preferences', {
    schema: { tags: ['AgentConfig'] },
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      type: string;
      value: unknown;
      description: string;
    };
    if (!body.name || !body.type || body.value === undefined || !body.description) {
      throw new ValidationError('name, type, value, and description are required');
    }
    const preference = definePreference({
      name: body.name,
      type: body.type,
      value: body.value,
      description: body.description,
    });
    return reply.status(201).send({ success: true, data: preference });
  });

  // ===== Config CRUD =====

  app.post('/agent-config', {
    schema: { tags: ['AgentConfig'] },
  }, async (request, reply) => {
    const body = request.body as { agent_id: string };
    if (!body.agent_id) {
      throw new ValidationError('agent_id is required');
    }
    upsertAgentConfig(body.agent_id);
    const config = getAgentConfig(body.agent_id);
    return reply.status(201).send({ success: true, data: config });
  });

  app.get('/agent-config/:agentId', {
    schema: { tags: ['AgentConfig'] },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const config = getAgentConfig(agentId);
    return reply.send({ success: true, data: config });
  });

  app.get('/agent-config/:agentId/default', {
    schema: { tags: ['AgentConfig'] },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const config = getDefaultConfig(agentId);
    return reply.send({ success: true, data: config });
  });

  app.put('/agent-config/:agentId', {
    schema: { tags: ['AgentConfig'] },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const body = request.body as Record<string, unknown>;
    const fullConfig = { ...body, agent_id: agentId } as Parameters<typeof validateConfig>[0];
    const validated = validateConfig(fullConfig);
    if (!validated.valid) {
      return reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        errors: validated.errors,
        warnings: validated.warnings,
      });
    }
    const updated = saveAgentConfig(fullConfig as Parameters<typeof saveAgentConfig>[0]);
    return reply.send({ success: true, data: updated, warnings: validated.warnings });
  });

  app.delete('/agent-config/:agentId', {
    schema: { tags: ['AgentConfig'] },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    deleteAgentConfig(agentId);
    return reply.send({ success: true, message: 'Agent config deleted' });
  });

  // ===== Permission Update =====

  app.put('/agent-config/:agentId/permissions', {
    schema: { tags: ['AgentConfig'] },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const body = request.body as {
      permissions: string[];
      denied_permissions?: string[];
    };
    if (!body.permissions) {
      throw new ValidationError('permissions array is required');
    }
    const updated = updateAgentPermissions(
      agentId,
      body.permissions as Parameters<typeof updateAgentPermissions>[1],
      (body.denied_permissions ?? []) as Parameters<typeof updateAgentPermissions>[2],
    );
    return reply.send({ success: true, data: updated });
  });

  // ===== Constraint Update =====

  app.put('/agent-config/:agentId/constraints', {
    schema: { tags: ['AgentConfig'] },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const body = request.body as Record<string, unknown>;
    const updated = updateAgentConstraints(agentId, body as Parameters<typeof updateAgentConstraints>[1]);
    return reply.send({ success: true, data: updated });
  });

  // ===== Preference Update =====

  app.put('/agent-config/:agentId/preferences', {
    schema: { tags: ['AgentConfig'] },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const body = request.body as Record<string, unknown>;
    const updated = updateAgentPreferences(agentId, body as Parameters<typeof updateAgentPreferences>[1]);
    return reply.send({ success: true, data: updated });
  });

  // ===== Permission Check =====

  app.post('/agent-config/:agentId/check', {
    schema: { tags: ['AgentConfig'] },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const body = request.body as { action: string; context?: Record<string, unknown> };
    if (!body.action) {
      throw new ValidationError('action is required');
    }

    const permitted = canAgentPerform(agentId, body.action as Parameters<typeof canAgentPerform>[1]);
    if (!permitted) {
      auditAction(agentId, 'permission_check', { action: body.action });
      return reply.status(403).send({
        success: false,
        allowed: false,
        action: body.action,
      });
    }

    const constraintResult = checkAgentConstraints(agentId, body.action, body.context);
    if (!constraintResult) {
      return reply.status(429).send({
        success: false,
        allowed: false,
        reason: 'constraint_violation',
        action: body.action,
      });
    }

    auditAction(agentId, 'permission_check', { action: body.action });
    return reply.send({ success: true, allowed: true, action: body.action });
  });

  // ===== Audit Logs =====

  app.get('/agent-config/:agentId/audit', {
    schema: { tags: ['AgentConfig'] },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const { limit } = request.query as { limit?: string };
    const logs = getAuditLogs(agentId, limit ? parseInt(limit, 10) : 100);
    return reply.send({ success: true, data: logs });
  });

  app.get('/agent-config/audit', {
    schema: { tags: ['AgentConfig'] },
  }, async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const logs = getAuditLogs(undefined, limit ? parseInt(limit, 10) : 100);
    return reply.send({ success: true, data: logs });
  });
}
