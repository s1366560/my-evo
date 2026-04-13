import type { FastifyInstance } from 'fastify';
import * as analyticsService from './service';
import type { TimelineEventType } from '../shared/types';

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/drift/:nodeId', {
    schema: { tags: ['Analytics'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };

    const result = await analyticsService.getDriftReport(nodeId, app.prisma);

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
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const { event_type, limit, offset } =
      request.query as Record<string, string | undefined>;

    const result = await analyticsService.getTimeline(
      nodeId,
      event_type as TimelineEventType | undefined,
      limit ? Number(limit) : 20,
      offset ? Number(offset) : 0,
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

  app.get('/forecast/gdi/:assetId', {
    schema: { tags: ['Analytics'] },
  }, async (request, reply) => {
    const { assetId } = request.params as { assetId: string };

    const result = await analyticsService.getGdiForecast(assetId, app.prisma);

    return reply.send({ success: true, data: result });
  });

  app.get('/alerts/:nodeId', {
    schema: { tags: ['Analytics'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };

    const result = await analyticsService.getRiskAlerts(nodeId, app.prisma);

    return reply.send({ success: true, data: result });
  });
}
