import type { FastifyInstance } from 'fastify';
import * as monitoringService from './service';

type MonitoringRoutesOptions = {
  monitoringState?: monitoringService.MonitoringState;
  [key: string]: unknown;
};

export async function monitoringRoutes(
  app: FastifyInstance,
  opts: MonitoringRoutesOptions = {},
): Promise<void> {
  const monitoringState = opts.monitoringState ?? monitoringService.createMonitoringState();

  app.get('/health', {
    schema: { tags: ['Monitoring'] },
  }, async (_request, reply) => {
    const result = await monitoringService.checkHealth(app.prisma);

    const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;

    return reply.status(statusCode).send({ success: true, data: result });
  });

  app.get('/metrics', {
    schema: { tags: ['Monitoring'] },
  }, async (request, reply) => {
    const { names, start, end } = request.query as Record<string, string | undefined>;

    const result = await monitoringService.getMetrics(
      monitoringState,
      names ? names.split(',') : undefined,
      start,
      end,
    );

    return reply.send({ success: true, data: result });
  });

  app.get('/alerts', {
    schema: { tags: ['Monitoring'] },
  }, async (request, reply) => {
    const { severity, limit } = request.query as Record<string, string | undefined>;

    const result = await monitoringService.getAlerts(
      monitoringState,
      severity as 'info' | 'warning' | 'critical' | undefined,
      limit ? Number(limit) : 50,
    );

    return reply.send({ success: true, data: result });
  });
}
