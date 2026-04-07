import type { FastifyInstance } from 'fastify';
import {
  implementRBAC,
  roleHasPermission,
  assignRoleToNode,
  getNodeRole,
  checkNodePermission,
  checkRateLimit,
  checkRateLimitByRole,
  logSecurityEvent,
  getSecurityEvents,
  resolveSecurityEvent,
  detectAnomaly,
  detectAnomalyFromHistory,
  getAnomalyHistory,
  clearRateLimit,
  ROLE_PERMISSIONS,
  DEFAULT_RATE_LIMITS,
} from './service';
import type { SecurityEventType, AnomalySignal } from './schemas';
import { ValidationError } from '../shared/errors';

export async function securityRoutes(app: FastifyInstance): Promise<void> {
  // ===== RBAC =====

  // GET /security/roles — list all roles and permissions
  app.get('/security/roles', {
    schema: { tags: ['Security'] },
  }, async (_request, reply) => {
    return reply.send({
      success: true,
      data: ROLE_PERMISSIONS.map(r => ({
        ...r,
        rate_limit: DEFAULT_RATE_LIMITS[r.role],
      })),
    });
  });

  // POST /security/rbac/check — check permission for role
  app.post('/security/rbac/check', {
    schema: { tags: ['Security'] },
  }, async (request, reply) => {
    const body = request.body as { role: string; permission: string };
    if (!body.role || !body.permission) {
      throw new ValidationError('role and permission are required');
    }
    const result = implementRBAC(body.role as Parameters<typeof implementRBAC>[0], body.permission);
    logSecurityEvent({
      type: 'permission_denied',
      identifier: body.role,
      details: { role: body.role, permission: body.permission, result: result.allowed },
      severity: result.allowed ? 'info' : 'warning',
    });
    return reply.send({ success: true, ...result });
  });

  // POST /security/rbac/assign — assign role to node
  app.post('/security/rbac/assign', {
    schema: { tags: ['Security'] },
  }, async (request, reply) => {
    const body = request.body as { node_id: string; role: string };
    if (!body.node_id || !body.role) {
      throw new ValidationError('node_id and role are required');
    }
    assignRoleToNode(body.node_id, body.role as Parameters<typeof assignRoleToNode>[1]);
    logSecurityEvent({
      type: 'config_changed',
      identifier: body.node_id,
      details: { action: 'role_assigned', role: body.role },
      severity: 'info',
    });
    return reply.send({ success: true, data: { node_id: body.node_id, role: body.role } });
  });

  // GET /security/rbac/node/:nodeId — get node's assigned role
  app.get('/security/rbac/node/:nodeId', {
    schema: { tags: ['Security'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const role = getNodeRole(nodeId);
    return reply.send({ success: true, data: { node_id: nodeId, role: role ?? null } });
  });

  // POST /security/rbac/node/:nodeId/check — check node has permission
  app.post('/security/rbac/node/:nodeId/check', {
    schema: { tags: ['Security'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const body = request.body as { permission: string };
    if (!body.permission) {
      throw new ValidationError('permission is required');
    }
    const allowed = checkNodePermission(nodeId, body.permission);
    return reply.send({ success: true, allowed, node_id: nodeId, permission: body.permission });
  });

  // ===== Rate Limiting =====

  // POST /security/rate-limit/check — check rate limit
  app.post('/security/rate-limit/check', {
    schema: { tags: ['Security'] },
  }, async (request, reply) => {
    const body = request.body as { identifier: string; max_requests?: number };
    if (!body.identifier) {
      throw new ValidationError('identifier is required');
    }
    const result = checkRateLimit(body.identifier, body.max_requests);
    if (!result.allowed) {
      logSecurityEvent({
        type: 'rate_limit_exceeded',
        identifier: body.identifier,
        details: { max_requests: body.max_requests },
        severity: 'warning',
      });
      return reply.status(429).send({
        success: false,
        allowed: false,
        remaining: result.remaining,
        reset_in_ms: result.resetInMs,
      });
    }
    return reply.send({ success: true, ...result });
  });

  // POST /security/rate-limit/check-by-role — check rate limit by role
  app.post('/security/rate-limit/check-by-role', {
    schema: { tags: ['Security'] },
  }, async (request, reply) => {
    const body = request.body as { identifier: string; role: string };
    if (!body.identifier || !body.role) {
      throw new ValidationError('identifier and role are required');
    }
    const result = checkRateLimitByRole(body.identifier, body.role as Parameters<typeof checkRateLimitByRole>[1]);
    if (!result.allowed) {
      return reply.status(429).send({
        success: false,
        allowed: false,
        remaining: result.remaining,
        reset_in_ms: result.resetInMs,
      });
    }
    return reply.send({ success: true, ...result });
  });

  // DELETE /security/rate-limit/:identifier — clear rate limit counter
  app.delete('/security/rate-limit/:identifier', {
    schema: { tags: ['Security'] },
  }, async (request, reply) => {
    const { identifier } = request.params as { identifier: string };
    clearRateLimit(identifier);
    return reply.send({ success: true, message: 'Rate limit cleared' });
  });

  // ===== Security Events =====

  // POST /security/events — log a security event
  app.post('/security/events', {
    schema: { tags: ['Security'] },
  }, async (request, reply) => {
    const body = request.body as {
      type: SecurityEventType;
      identifier: string;
      details?: Record<string, unknown>;
      severity?: 'info' | 'warning' | 'error' | 'critical';
    };
    if (!body.type || !body.identifier) {
      throw new ValidationError('type and identifier are required');
    }
    const event = logSecurityEvent(body);
    return reply.status(201).send({ success: true, data: event });
  });

  // GET /security/events — list security events
  app.get('/security/events', {
    schema: { tags: ['Security'] },
  }, async (request, reply) => {
    const { identifier, type, severity, limit } = request.query as {
      identifier?: string;
      type?: string;
      severity?: string;
      limit?: string;
    };
    const events = getSecurityEvents({
      identifier,
      type: type as SecurityEventType | undefined,
      severity,
      limit: limit ? parseInt(limit, 10) : 100,
    });
    return reply.send({ success: true, data: events });
  });

  // PATCH /security/events/:eventId/resolve — resolve an event
  app.patch('/security/events/:eventId/resolve', {
    schema: { tags: ['Security'] },
  }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const resolved = resolveSecurityEvent(eventId);
    if (!resolved) {
      throw new ValidationError('Security event not found');
    }
    return reply.send({ success: true, data: resolved });
  });

  // ===== Anomaly Detection =====

  // POST /security/anomaly — detect anomaly with provided signals
  app.post('/security/anomaly', {
    schema: { tags: ['Security'] },
  }, async (request, reply) => {
    const body = request.body as {
      node_id: string;
      signals?: Array<{
        signal_type: AnomalySignal['signal_type'];
        score: number;
        description: string;
      }>;
    };
    if (!body.node_id) {
      throw new ValidationError('node_id is required');
    }
    const report = detectAnomaly(body.node_id, body.signals);
    return reply.send({ success: true, data: report });
  });

  // POST /security/anomaly/from-history — detect anomaly from event history
  app.post('/security/anomaly/from-history', {
    schema: { tags: ['Security'] },
  }, async (request, reply) => {
    const body = request.body as { node_id: string; window_hours?: number };
    if (!body.node_id) {
      throw new ValidationError('node_id is required');
    }
    const windowMs = (body.window_hours ?? 1) * 60 * 60 * 1000;
    const cutoff = Date.now() - windowMs;
    const recentEvents = getSecurityEvents({ identifier: body.node_id, limit: 1000 })
      .filter(e => Date.now() - new Date(e.timestamp).getTime() < windowMs);
    const report = detectAnomalyFromHistory(body.node_id, recentEvents);
    return reply.send({ success: true, data: report });
  });

  // GET /security/anomaly/:nodeId/history — get anomaly history
  app.get('/security/anomaly/:nodeId/history', {
    schema: { tags: ['Security'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const history = getAnomalyHistory(nodeId);
    return reply.send({ success: true, data: history });
  });
}
