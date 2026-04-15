import type { FastifyInstance } from 'fastify';
import { requireNodeSecretAuth } from '../shared/auth';
import {
  BRANCHING_DEPTH_LIMIT,
  DRIFT_THRESHOLD,
  DRIFT_WINDOW_DAYS,
  FORECAST_HORIZON_DAYS,
} from '../shared/constants';
import { ForbiddenError, ValidationError } from '../shared/errors';
import * as analyticsService from './service';
import type { TimelineEventType } from '../shared/types';

function ensureNodeSecretAuth(
  auth: NonNullable<import('fastify').FastifyRequest['auth']>,
): void {
  if (auth.auth_type !== 'node_secret') {
    throw new ForbiddenError('Node secret credentials are required for analytics node routes');
  }
}

function ensureScopedNode(
  auth: NonNullable<import('fastify').FastifyRequest['auth']>,
  requestedNodeId: string,
): string {
  ensureNodeSecretAuth(auth);
  if (requestedNodeId !== auth.node_id) {
    throw new ValidationError('nodeId must match the authenticated node');
  }
  return requestedNodeId;
}

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
    throw new ValidationError(`${field} must be specified once`);
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a non-negative integer`);
  }

  if (value.trim() === '') {
    throw new ValidationError(`${field} must be a non-negative integer`);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ValidationError(`${field} must be a non-negative integer`);
  }

  if (max !== undefined && parsed > max) {
    throw new ValidationError(`${field} must be less than or equal to ${max}`);
  }

  return parsed;
}

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/drift/:nodeId', {
    schema: { tags: ['Analytics'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { nodeId } = request.params as { nodeId: string };
    const scopedNodeId = ensureScopedNode(auth, nodeId);

    const result = await analyticsService.getDriftReport(scopedNodeId, app.prisma);

    return reply.send({ success: true, data: result });
  });

  app.get('/branching', {
    schema: { tags: ['Analytics'] },
  }, async (_request, reply) => {
    const result = await analyticsService.getBranchingMetrics(app.prisma);

    return reply.send({ success: true, data: result });
  });

  app.get('/timeline/:nodeId', {
    schema: { tags: ['Analytics'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { nodeId } = request.params as { nodeId: string };
    const scopedNodeId = ensureScopedNode(auth, nodeId);
    const { event_type, limit, offset } =
      request.query as Record<string, unknown>;
    const parsedLimit = parseNonNegativeInteger(limit, 'limit', 20);
    const parsedOffset = parseNonNegativeInteger(offset, 'offset', 0);

    const result = await analyticsService.getTimeline(
      scopedNodeId,
      event_type as TimelineEventType | undefined,
      parsedLimit,
      parsedOffset,
      app.prisma,
    );

    return reply.send({ success: true, data: result });
  });

  app.get('/forecast/signal/:signal', {
    schema: { tags: ['Analytics'] },
  }, async (request, reply) => {
    const { signal } = request.params as { signal: string };

    const result = await analyticsService.getSignalForecast(signal, app.prisma);

    return reply.send({ success: true, data: result });
  });

  app.get('/forecast/signals', {
    schema: { tags: ['Analytics'] },
  }, async (request, reply) => {
    const { limit } = request.query as Record<string, unknown>;
    const parsedLimit = parseNonNegativeInteger(limit, 'limit', 5, 20);
    const result = await analyticsService.listSignalForecasts(parsedLimit, app.prisma);

    return reply.send({
      forecasts: result.map((forecast) => ({
        signal: forecast.signal,
        current_rank: forecast.current_rank,
        predicted_rank_7d: forecast.predicted_rank_7d,
        predicted_rank_30d: forecast.predicted_rank_30d,
        confidence: forecast.confidence,
        trend: forecast.trend,
      })),
    });
  });

  app.get('/forecast/gdi/:assetId', {
    schema: { tags: ['Analytics'] },
  }, async (request, reply) => {
    const { assetId } = request.params as { assetId: string };

    const result = await analyticsService.getGdiForecast(assetId, app.prisma);

    return reply.send({ success: true, data: result });
  });

  app.get('/alerts', {
    schema: { tags: ['Analytics'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const result = await analyticsService.getRiskAlerts(auth.node_id, app.prisma);

    return reply.send({ alerts: result });
  });

  app.get('/alerts/:nodeId', {
    schema: { tags: ['Analytics'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { nodeId } = request.params as { nodeId: string };
    const scopedNodeId = ensureScopedNode(auth, nodeId);

    const result = await analyticsService.getRiskAlerts(scopedNodeId, app.prisma);

    return reply.send({ success: true, data: result });
  });

  app.get('/config', {
    schema: { tags: ['Analytics'] },
  }, async (_request, reply) => reply.send({
    drift_threshold: DRIFT_THRESHOLD,
    drift_window_days: DRIFT_WINDOW_DAYS,
    forecast_horizon_days: FORECAST_HORIZON_DAYS,
    branching_depth_limit: BRANCHING_DEPTH_LIMIT,
  }));
}
