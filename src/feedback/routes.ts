import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as feedbackService from './service';
import type {
  FeedbackType,
  FeedbackStatus,
  FeedbackCategory,
  UxEventType,
} from './types';

function parseNonNegativeInteger(
  value: unknown,
  field: 'limit' | 'offset',
  fallback: number,
  max?: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  if (Array.isArray(value)) {
    throw new Error(`${field} must be specified once`);
  }

  if (typeof value !== 'string') {
    throw new Error(`${field} must be a non-negative integer`);
  }

  if (value.trim() === '') {
    throw new Error(`${field} must be a non-negative integer`);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }

  if (max !== undefined && parsed > max) {
    throw new Error(`${field} must be less than or equal to ${max}`);
  }

  return parsed;
}

export async function feedbackRoutes(app: FastifyInstance): Promise<void> {
  // ===== User Feedback =====

  // Submit feedback (public - no auth required for users)
  app.post('/feedback', {
    schema: { tags: ['Feedback'] },
  }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    const userId = request.auth?.userId ?? null;
    const nodeId = request.auth?.node_id ?? null;

    const result = await feedbackService.createFeedback(
      userId,
      nodeId,
      {
        type: body.type as FeedbackType,
        rating: body.rating as number | undefined,
        category: body.category as FeedbackCategory,
        title: body.title as string | undefined,
        content: body.content as string,
        metadata: body.metadata as Record<string, unknown>,
      },
      app.prisma,
    );

    return reply.status(201).send({
      success: true,
      feedback_id: result.feedback_id,
      created_at: result.created_at,
    });
  });

  // Get feedback by ID (admin only)
  app.get('/feedback/:feedbackId', {
    schema: { tags: ['Feedback'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { feedbackId } = request.params as { feedbackId: string };
    const result = await feedbackService.getFeedback(feedbackId, app.prisma);

    if (!result) {
      return reply.status(404).send({
        success: false,
        error: 'Feedback not found',
      });
    }

    return reply.send({
      success: true,
      feedback: result,
    });
  });

  // List feedback (admin only)
  app.get('/feedback', {
    schema: { tags: ['Feedback'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const { type, status, category, limit, offset } = query;

    const result = await feedbackService.listFeedback(
      {
        type: type as FeedbackType,
        status: status as FeedbackStatus,
        category: category as FeedbackCategory,
        limit: parseNonNegativeInteger(limit, 'limit', 20, 100),
        offset: parseNonNegativeInteger(offset, 'offset', 0),
      },
      app.prisma,
    );

    return reply.send({
      success: true,
      feedback: result.items,
      total: result.total,
    });
  });

  // Update feedback status (admin only)
  app.patch('/feedback/:feedbackId/status', {
    schema: { tags: ['Feedback'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { feedbackId } = request.params as { feedbackId: string };
    const body = request.body as { status: FeedbackStatus };

    const result = await feedbackService.updateFeedbackStatus(
      feedbackId,
      body.status,
      app.prisma,
    );

    return reply.send({
      success: true,
      feedback: result,
    });
  });

  // Get feedback stats (admin only)
  app.get('/feedback/stats', {
    schema: { tags: ['Feedback'] },
    preHandler: [requireAuth()],
  }, async (_request, reply) => {
    const result = await feedbackService.getFeedbackStats(app.prisma);

    return reply.send({
      success: true,
      stats: result,
    });
  });

  // ===== UX Event Tracking =====

  // Track user event (authenticated users)
  app.post('/events/track', {
    schema: { tags: ['Feedback'] },
  }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    const userId = request.auth?.userId ?? null;
    const nodeId = request.auth?.node_id ?? null;

    const result = await feedbackService.trackEvent(
      userId,
      nodeId,
      {
        event_type: body.event_type as UxEventType,
        page: body.page as string,
        component: body.component as string,
        action: body.action as string,
        duration: body.duration as number,
        metadata: body.metadata as Record<string, unknown>,
      },
      app.prisma,
    );

    return reply.status(201).send({
      success: true,
      event_id: result.event_id,
    });
  });

  // List UX events (admin only)
  app.get('/events', {
    schema: { tags: ['Feedback'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const { event_type, user_id, node_id, limit, offset } = query;

    const result = await feedbackService.listUxEvents(
      {
        event_type: event_type as UxEventType,
        user_id: user_id as string,
        node_id: node_id as string,
        limit: parseNonNegativeInteger(limit, 'limit', 100, 500),
        offset: parseNonNegativeInteger(offset, 'offset', 0),
      },
      app.prisma,
    );

    return reply.send({
      success: true,
      events: result.items,
      total: result.total,
    });
  });

  // Get UX analytics summary (admin only)
  app.get('/analytics/ux', {
    schema: { tags: ['Feedback'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const days = query.days
      ? parseNonNegativeInteger(query.days, 'limit', 7, 90)
      : 7;

    const result = await feedbackService.getUxAnalytics(days, app.prisma);

    return reply.send({
      success: true,
      analytics: result,
    });
  });

  // ===== Session Metrics =====

  // Start session metric
  app.post('/sessions/start', {
    schema: { tags: ['Feedback'] },
  }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    const userId = request.auth?.userId ?? null;
    const nodeId = request.auth?.node_id ?? null;

    const result = await feedbackService.startSessionMetric(
      {
        session_type: body.session_type as string,
        user_id: userId ?? (body.userId as string | undefined),
        node_id: nodeId ?? (body.nodeId as string | undefined),
        metadata: body.metadata as Record<string, unknown>,
      },
      app.prisma,
    );

    return reply.status(201).send({
      success: true,
      metric_id: result.metric_id,
      start_time: result.start_time,
    });
  });

  // Update session metric
  app.patch('/sessions/:metricId', {
    schema: { tags: ['Feedback'] },
  }, async (request, reply) => {
    const { metricId } = request.params as { metricId: string };
    const body = request.body as Record<string, unknown>;

    const result = await feedbackService.updateSessionMetric(
      metricId,
      {
        event_count_increment: body.event_count_increment as number,
        action_count_increment: body.action_count_increment as number,
        metadata: body.metadata as Record<string, unknown>,
      },
      app.prisma,
    );

    return reply.send({
      success: true,
      metric: result,
    });
  });

  // End session metric
  app.post('/sessions/:metricId/end', {
    schema: { tags: ['Feedback'] },
  }, async (request, reply) => {
    const { metricId } = request.params as { metricId: string };
    const body = request.body as Record<string, unknown>;

    const result = await feedbackService.endSessionMetric(
      metricId,
      {
        outcome: body.outcome as string | undefined,
        metadata: body.metadata as Record<string, unknown>,
      },
      app.prisma,
    );

    return reply.send({
      success: true,
      metric: result,
    });
  });

  // List session metrics (admin only)
  app.get('/sessions', {
    schema: { tags: ['Feedback'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const { session_type, user_id, node_id, outcome, limit, offset } = query;

    const result = await feedbackService.getSessionMetrics(
      {
        session_type: session_type as string,
        user_id: user_id as string,
        node_id: node_id as string,
        outcome: outcome as string,
        limit: parseNonNegativeInteger(limit, 'limit', 50, 200),
        offset: parseNonNegativeInteger(offset, 'offset', 0),
      },
      app.prisma,
    );

    return reply.send({
      success: true,
      sessions: result.items,
      total: result.total,
    });
  });
}
