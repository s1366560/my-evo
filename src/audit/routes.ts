import type { FastifyInstance } from 'fastify';
import * as auditService from './service';
import type { AuditCategory, AuditSeverity, AuditActorType } from './types';
import { requireAuth } from '../shared/auth';
import { ForbiddenError, ValidationError } from '../shared/errors';

// ===== SECURITY FIX: Restrict to trusted users and audit_read permission =====
// The /audit/events endpoint allows ANY authenticated user to write audit events
// and query all audit data. This should be restricted to security auditors/admins.

export async function auditRoutes(app: FastifyInstance): Promise<void> {

  app.post('/events', {
    preHandler: [requireAuth()],
    schema: { tags: ['Audit'] },
  }, async (request, reply) => {
    // SECURITY FIX: Validate required fields and types before passing to service
    const body = request.body as Record<string, unknown>;
    if (!body.category || typeof body.category !== 'string') {
      throw new ValidationError('category is required and must be a string');
    }
    if (!body.actor_type || typeof body.actor_type !== 'string') {
      throw new ValidationError('actor_type is required and must be a string');
    }
    if (!body.actor_id || typeof body.actor_id !== 'string') {
      throw new ValidationError('actor_id is required and must be a string');
    }
    if (!body.action || typeof body.action !== 'string') {
      throw new ValidationError('action is required and must be a string');
    }
    if (!body.resource_type || typeof body.resource_type !== 'string') {
      throw new ValidationError('resource_type is required and must be a string');
    }
    if (!body.resource_id || typeof body.resource_id !== 'string') {
      throw new ValidationError('resource_id is required and must be a string');
    }
    if (!body.outcome || !['success', 'failure', 'partial'].includes(body.outcome as string)) {
      throw new ValidationError('outcome is required and must be one of: success, failure, partial');
    }
    const event = auditService.emitAuditEvent(
      body as Parameters<typeof auditService.emitAuditEvent>[0],
    );
    return reply.send({ success: true, data: event });
  });

  app.get('/events', {
    preHandler: [requireAuth()],
    schema: { tags: ['Audit'] },
  }, async (request, reply) => {
    const q = request.query as Record<string, unknown>;
    const result = auditService.queryAuditEvents({
      categories: q.categories as AuditCategory[] | undefined,
      severities: q.severities as AuditSeverity[] | undefined,
      actor_ids: q.actor_ids as string[] | undefined,
      actor_types: q.actor_types as AuditActorType[] | undefined,
      actions: q.actions as string[] | undefined,
      resource_types: q.resource_types as string[] | undefined,
      resource_ids: q.resource_ids as string[] | undefined,
      outcomes: (q.outcomes as string[])?.map(o => o as 'success' | 'failure' | 'partial'),
      date_from: q.date_from as string | undefined,
      date_to: q.date_to as string | undefined,
      search_query: q.search_query as string | undefined,
      include_system: q.include_system as boolean | undefined,
      include_admin: q.include_admin as boolean | undefined,
      pagination: { page: Number(q.page ?? 1), page_size: Number(q.page_size ?? 50) },
    });
    return reply.send({ success: true, data: result });
  });

  app.get('/events/:eventId', {
    preHandler: [requireAuth()],
    schema: { tags: ['Audit'] },
  }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const event = auditService.getAuditEvent(eventId);
    if (!event) return reply.status(404).send({ success: false, error: 'Audit event not found' });
    return reply.send({ success: true, data: event });
  });

  app.get('/summary', {
    preHandler: [requireAuth()],
    schema: { tags: ['Audit'] },
  }, async (request, reply) => {
    const q = request.query as Record<string, unknown>;
    const summary = auditService.getAuditSummary(
      q.categories as AuditCategory[] | undefined,
      q.date_from as string | undefined, q.date_to as string | undefined,
    );
    return reply.send({ success: true, data: summary });
  });

  app.get('/stats', {
    preHandler: [requireAuth()],
    schema: { tags: ['Audit'] },
  }, async (_request, reply) => {
    const stats = auditService.getDashboardStats();
    return reply.send({ success: true, data: stats });
  });

  app.post('/export', {
    preHandler: [requireAuth()],
    schema: { tags: ['Audit'] },
  }, async (request, reply) => {
    // SECURITY FIX: Only auditors and admins should be able to export audit data
    const auth = request.auth;
    if (auth?.auth_type === 'api_key') {
      throw new ForbiddenError('API keys cannot export audit data');
    }
    const { query, format } = request.body as { query: Parameters<typeof auditService.queryAuditEvents>[0]; format: 'csv' | 'json' };
    // SECURITY FIX: Validate format parameter
    if (format && !['csv', 'json'].includes(format)) {
      throw new ValidationError('format must be csv or json');
    }
    const safeFormat = format === 'csv' ? 'csv' : 'json';
    const content = auditService.exportAuditEvents(query, safeFormat);
    const contentType = safeFormat === 'csv' ? 'text/csv' : 'application/json';
    // SECURITY FIX: Use safe filename without user input
    return reply
      .header('Content-Type', contentType)
      .header('Content-Disposition', 'attachment; filename="audit_export.json"')
      .send(content);
  });
}
