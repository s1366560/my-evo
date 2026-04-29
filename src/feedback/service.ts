import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import {
  UserFeedback,
  CreateFeedbackInput,
  ListFeedbackInput,
  FeedbackMetadata,
  FeedbackStatus,
  UxEvent,
  UxAnalyticsSummary,
  UxEventType,
  TrackEventInput,
  SessionMetric,
  CreateSessionMetricInput,
  EndSessionMetricInput,
} from './types';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function getPrismaClient(prismaClient?: PrismaClient): PrismaClient {
  return prismaClient ?? prisma;
}

function toUserFeedback(record: Record<string, unknown>): UserFeedback {
  return {
    feedback_id: record.feedback_id as string,
    user_id: record.user_id as string | null,
    node_id: record.node_id as string | null,
    type: record.type as UserFeedback['type'],
    rating: record.rating as number | null,
    category: record.category as UserFeedback['category'],
    title: record.title as string | null,
    content: record.content as string,
    metadata: (record.metadata as FeedbackMetadata) ?? {},
    status: record.status as FeedbackStatus,
    resolved_at: record.resolved_at
      ? (record.resolved_at as Date).toISOString()
      : null,
    created_at: (record.created_at as Date).toISOString(),
  };
}

function toUxEvent(record: Record<string, unknown>): UxEvent {
  return {
    event_id: record.event_id as string,
    user_id: record.user_id as string | null,
    node_id: record.node_id as string | null,
    event_type: record.event_type as UxEventType,
    page: record.page as string | null,
    component: record.component as string | null,
    action: record.action as string | null,
    duration: record.duration as number | null,
    metadata: (record.metadata as Record<string, unknown>) ?? {},
    created_at: (record.created_at as Date).toISOString(),
  };
}

function toSessionMetric(record: Record<string, unknown>): SessionMetric {
  return {
    metric_id: record.metric_id as string,
    user_id: record.user_id as string | null,
    node_id: record.node_id as string | null,
    session_type: record.session_type as string,
    start_time: (record.start_time as Date).toISOString(),
    end_time: record.end_time
      ? (record.end_time as Date).toISOString()
      : null,
    duration: record.duration as number | null,
    event_count: record.event_count as number,
    action_count: record.action_count as number,
    outcome: record.outcome as string | null,
    metadata: (record.metadata as Record<string, unknown>) ?? {},
    created_at: (record.created_at as Date).toISOString(),
  };
}

// ===== Feedback Operations =====

export async function createFeedback(
  userId: string | null,
  nodeId: string | null,
  input: CreateFeedbackInput,
  prismaClient?: PrismaClient,
): Promise<UserFeedback> {
  const client = getPrismaClient(prismaClient);

  if (!input.content || input.content.trim().length === 0) {
    throw new ValidationError('Feedback content is required');
  }

  if (input.content.length > 5000) {
    throw new ValidationError('Feedback content must be 5000 characters or less');
  }

  if (input.rating !== undefined) {
    if (input.rating < 1 || input.rating > 5) {
      throw new ValidationError('Rating must be between 1 and 5');
    }
  }

  const feedbackId = crypto.randomUUID();

  const feedback = await client.userFeedback.create({
    data: {
      feedback_id: feedbackId,
      user_id: userId,
      node_id: nodeId,
      type: input.type ?? 'general',
      rating: input.rating,
      category: input.category,
      title: input.title,
      content: input.content.trim(),
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      status: 'pending',
    },
  });

  return toUserFeedback(feedback as unknown as Record<string, unknown>);
}

export async function getFeedback(
  feedbackId: string,
  prismaClient?: PrismaClient,
): Promise<UserFeedback | null> {
  const client = getPrismaClient(prismaClient);

  const feedback = await client.userFeedback.findUnique({
    where: { feedback_id: feedbackId },
  });

  if (!feedback) {
    return null;
  }

  return toUserFeedback(feedback as unknown as Record<string, unknown>);
}

export async function listFeedback(
  input: ListFeedbackInput,
  prismaClient?: PrismaClient,
): Promise<{ items: UserFeedback[]; total: number }> {
  const client = getPrismaClient(prismaClient);
  const { type, status, category, limit = 20, offset = 0 } = input;

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (status) where.status = status;
  if (category) where.category = category;

  const [items, total] = await Promise.all([
    client.userFeedback.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    client.userFeedback.count({ where }),
  ]);

  return {
    items: items.map((f) => toUserFeedback(f as unknown as Record<string, unknown>)),
    total,
  };
}

export async function updateFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus,
  prismaClient?: PrismaClient,
): Promise<UserFeedback> {
  const client = getPrismaClient(prismaClient);

  const existing = await client.userFeedback.findUnique({
    where: { feedback_id: feedbackId },
  });

  if (!existing) {
    throw new NotFoundError('Feedback', feedbackId);
  }

  const resolvedAt = ['resolved', 'dismissed'].includes(status)
    ? new Date()
    : null;

  const updated = await client.userFeedback.update({
    where: { feedback_id: feedbackId },
    data: {
      status,
      resolved_at: resolvedAt,
    },
  });

  return toUserFeedback(updated as unknown as Record<string, unknown>);
}

export async function getFeedbackStats(
  prismaClient?: PrismaClient,
): Promise<{
  total: number;
  pending: number;
  reviewed: number;
  resolved: number;
  avg_rating: number | null;
  by_type: Record<string, number>;
  by_category: Record<string, number>;
}> {
  const client = getPrismaClient(prismaClient);

  const [items, stats] = await Promise.all([
    client.userFeedback.findMany({
      select: { type: true, category: true, status: true, rating: true },
    }),
    client.userFeedback.aggregate({
      _count: true,
      _avg: { rating: true },
    }),
  ]);

  const byType: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let pending = 0;
  let reviewed = 0;
  let resolved = 0;

  for (const item of items) {
    byType[item.type] = (byType[item.type] ?? 0) + 1;
    if (item.category) {
      byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
    }
    if (item.status === 'pending') pending++;
    else if (item.status === 'reviewed') reviewed++;
    else if (item.status === 'resolved') resolved++;
  }

  return {
    total: stats._count ?? 0,
    pending,
    reviewed,
    resolved,
    avg_rating: stats._avg?.rating ?? null,
    by_type: byType,
    by_category: byCategory,
  };
}

// ===== UX Event Tracking =====

export async function trackEvent(
  userId: string | null,
  nodeId: string | null,
  input: TrackEventInput,
  prismaClient?: PrismaClient,
): Promise<UxEvent> {
  const client = getPrismaClient(prismaClient);

  if (!input.event_type) {
    throw new ValidationError('Event type is required');
  }

  const eventId = crypto.randomUUID();

  const event = await client.uxEvent.create({
    data: {
      event_id: eventId,
      user_id: userId,
      node_id: nodeId,
      event_type: input.event_type,
      page: input.page,
      component: input.component,
      action: input.action,
      duration: input.duration,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });

  return toUxEvent(event as unknown as Record<string, unknown>);
}

export async function listUxEvents(
  filters: {
    event_type?: UxEventType;
    user_id?: string;
    node_id?: string;
    limit?: number;
    offset?: number;
  },
  prismaClient?: PrismaClient,
): Promise<{ items: UxEvent[]; total: number }> {
  const client = getPrismaClient(prismaClient);
  const { event_type, user_id, node_id, limit = 100, offset = 0 } = filters;

  const where: Record<string, unknown> = {};
  if (event_type) where.event_type = event_type;
  if (user_id) where.user_id = user_id;
  if (node_id) where.node_id = node_id;

  const [items, total] = await Promise.all([
    client.uxEvent.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    client.uxEvent.count({ where }),
  ]);

  return {
    items: items.map((e) => toUxEvent(e as unknown as Record<string, unknown>)),
    total,
  };
}

export async function getUxAnalytics(
  periodDays: number = 7,
  prismaClient?: PrismaClient,
): Promise<UxAnalyticsSummary> {
  const client = getPrismaClient(prismaClient);
  const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const events = await client.uxEvent.findMany({
    where: { created_at: { gte: cutoff } },
  });

  const eventsByType: Record<UxEventType, number> = {
    page_view: 0,
    button_click: 0,
    form_submit: 0,
    search_query: 0,
    asset_publish: 0,
    asset_fork: 0,
    asset_download: 0,
    session_start: 0,
    session_end: 0,
    error_occurred: 0,
  };

  const eventsByPage: Record<string, number> = {};
  const uniqueUsers = new Set<string>();
  const uniqueNodes = new Set<string>();
  const actionCounts: Record<string, number> = {};

  for (const event of events) {
    const eventType = event.event_type as UxEventType;
    if (eventType in eventsByType) {
      eventsByType[eventType]++;
    }
    if (event.page) {
      eventsByPage[event.page] = (eventsByPage[event.page] ?? 0) + 1;
    }
    if (event.user_id) uniqueUsers.add(event.user_id);
    if (event.node_id) uniqueNodes.add(event.node_id);
    if (event.action) {
      actionCounts[event.action] = (actionCounts[event.action] ?? 0) + 1;
    }
  }

  const topActions = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([action, count]) => ({ action, count }));

  const sessions = await client.sessionMetric.findMany({
    where: {
      created_at: { gte: cutoff },
      end_time: { not: null },
    },
  });

  const avgSessionDuration =
    sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.duration ?? 0), 0) / sessions.length
      : 0;

  return {
    total_events: events.length,
    unique_users: uniqueUsers.size,
    unique_nodes: uniqueNodes.size,
    events_by_type: eventsByType,
    events_by_page: eventsByPage,
    avg_session_duration: Math.round(avgSessionDuration),
    top_actions: topActions,
    period_start: cutoff.toISOString(),
    period_end: new Date().toISOString(),
  };
}

// ===== Session Metrics =====

export async function startSessionMetric(
  input: CreateSessionMetricInput,
  prismaClient?: PrismaClient,
): Promise<SessionMetric> {
  const client = getPrismaClient(prismaClient);

  const metricId = crypto.randomUUID();
  const now = new Date();

  const metric = await client.sessionMetric.create({
    data: {
      metric_id: metricId,
      user_id: input.user_id,
      node_id: input.node_id,
      session_type: input.session_type,
      start_time: now,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });

  return toSessionMetric(metric as unknown as Record<string, unknown>);
}

export async function updateSessionMetric(
  metricId: string,
  updates: {
    event_count_increment?: number;
    action_count_increment?: number;
    metadata?: Record<string, unknown>;
  },
  prismaClient?: PrismaClient,
): Promise<SessionMetric> {
  const client = getPrismaClient(prismaClient);

  const existing = await client.sessionMetric.findUnique({
    where: { metric_id: metricId },
  });

  if (!existing) {
    throw new NotFoundError('SessionMetric', metricId);
  }

  const currentMetadata = (existing.metadata as Record<string, unknown>) ?? {};

  const updated = await client.sessionMetric.update({
    where: { metric_id: metricId },
    data: {
      event_count: (existing.event_count ?? 0) + (updates.event_count_increment ?? 0),
      action_count: (existing.action_count ?? 0) + (updates.action_count_increment ?? 0),
      metadata: (updates.metadata
        ? { ...currentMetadata, ...updates.metadata }
        : currentMetadata) as Prisma.InputJsonValue,
    },
  });

  return toSessionMetric(updated as unknown as Record<string, unknown>);
}

export async function endSessionMetric(
  metricId: string,
  input: EndSessionMetricInput,
  prismaClient?: PrismaClient,
): Promise<SessionMetric> {
  const client = getPrismaClient(prismaClient);

  const existing = await client.sessionMetric.findUnique({
    where: { metric_id: metricId },
  });

  if (!existing) {
    throw new NotFoundError('SessionMetric', metricId);
  }

  const now = new Date();
  const duration = Math.round(
    (now.getTime() - existing.start_time.getTime()) / 1000,
  );

  const currentMetadata = (existing.metadata as Record<string, unknown>) ?? {};

  const updated = await client.sessionMetric.update({
    where: { metric_id: metricId },
    data: {
      end_time: now,
      duration,
      outcome: input.outcome,
      metadata: (input.metadata
        ? { ...currentMetadata, ...input.metadata }
        : currentMetadata) as Prisma.InputJsonValue,
    },
  });

  return toSessionMetric(updated as unknown as Record<string, unknown>);
}

export async function getSessionMetrics(
  filters: {
    session_type?: string;
    user_id?: string;
    node_id?: string;
    outcome?: string;
    limit?: number;
    offset?: number;
  },
  prismaClient?: PrismaClient,
): Promise<{ items: SessionMetric[]; total: number }> {
  const client = getPrismaClient(prismaClient);
  const {
    session_type,
    user_id,
    node_id,
    outcome,
    limit = 50,
    offset = 0,
  } = filters;

  const where: Record<string, unknown> = {};
  if (session_type) where.session_type = session_type;
  if (user_id) where.user_id = user_id;
  if (node_id) where.node_id = node_id;
  if (outcome) where.outcome = outcome;

  const [items, total] = await Promise.all([
    client.sessionMetric.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    client.sessionMetric.count({ where }),
  ]);

  return {
    items: items.map((m) => toSessionMetric(m as unknown as Record<string, unknown>)),
    total,
  };
}
