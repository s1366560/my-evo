/**
 * Monitoring API Routes
 * Production monitoring endpoints: health, metrics, alerts, analytics, alert rules.
 */

import type { FastifyInstance } from 'fastify';
import * as monitoringService from './service';
import type { MonitoringState } from './service';

type MonitoringRoutesOptions = {
  monitoringState?: monitoringService.MonitoringState;
  [key: string]: unknown;
};

export async function monitoringRoutes(
  app: FastifyInstance,
  opts: MonitoringRoutesOptions = {},
): Promise<void> {
  const monitoringState = opts.monitoringState ?? monitoringService.createMonitoringState();

  // ── Health ───────────────────────────────────────────────────────────────

  app.get('/health', {
    schema: {
      tags: ['Monitoring'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                checks: { type: 'object' },
                uptime_seconds: { type: 'number' },
                version: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (_request, reply) => {
    const result = await monitoringService.checkHealth(app.prisma);
    const statusCode = (result.status === 'healthy' || result.status === 'degraded') ? 200 : 503;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (reply as any).code(statusCode).send({ success: true, data: result });
  });

  // ── Dashboard Metrics ─────────────────────────────────────────────────────

  app.get('/dashboard/metrics', {
    schema: { tags: ['Monitoring'] },
  }, async (_request, reply) => {
    const result = await monitoringService.getDashboardMetrics(monitoringState, app.prisma);
    return reply.send({ success: true, ...result, data: result });
  });

  // ── Metrics ─────────────────────────────────────────────────────────────

  app.get('/metrics', {
    schema: {
      tags: ['Monitoring'],
      querystring: {
        type: 'object',
        properties: {
          names: { type: 'string', description: 'Comma-separated metric names' },
          start: { type: 'string', description: 'ISO-8601 start time' },
          end: { type: 'string', description: 'ISO-8601 end time' },
          limit: { type: 'string', description: 'Max results (default 1000)' },
        },
      },
    },
  }, async (request, reply) => {
    const { names, start, end, limit } = request.query as Record<string, string | undefined>;
    const result = await monitoringService.getMetrics(
      monitoringState,
      names ? names.split(',') : undefined,
      start,
      end,
    );
    const maxLimit = limit ? Number(limit) : 1000;
    return reply.send({ success: true, data: result.slice(-maxLimit) });
  });

  app.post('/metrics', {
    schema: {
      tags: ['Monitoring'],
      body: {
        type: 'object',
        required: ['name', 'value'],
        properties: {
          name: { type: 'string' },
          value: { type: 'number' },
          labels: { type: 'object', additionalProperties: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const { name, value, labels } = request.body as {
      name: string; value: number; labels?: Record<string, string>;
    };
    await monitoringService.recordMetric(monitoringState, name, value, labels);
    return reply.status(201).send({ success: true });
  });

  app.get('/metrics/stats', {
    schema: { tags: ['Monitoring'] },
  }, async (_request, reply) => {
    const stats = monitoringService.getResponseTimeStats(monitoringState);
    return reply.send({ success: true, data: stats });
  });

  // ── Alerts ──────────────────────────────────────────────────────────────

  app.get('/alerts', {
    schema: {
      tags: ['Monitoring'],
      querystring: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
          limit: { type: 'string' },
          resolved: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { severity, limit, resolved } = request.query as Record<string, string | undefined>;
    let alerts = await monitoringService.getAlerts(
      monitoringState,
      severity as 'info' | 'warning' | 'critical' | undefined,
      limit ? Number(limit) : 50,
    );
    if (resolved === 'true') alerts = alerts.filter((a) => a.resolved);
    if (resolved === 'false') alerts = alerts.filter((a) => !a.resolved);
    return reply.send({ success: true, alerts, total: alerts.length, data: alerts });
  });

  app.post('/alerts/:alertId/acknowledge', {
    schema: { tags: ['Monitoring'] },
  }, async (request, reply) => {
    const { alertId } = request.params as { alertId: string };
    const ok = await monitoringService.acknowledgeAlert(monitoringState, alertId);
    if (!ok) return reply.status(404).send({ success: false, error: 'Alert not found' });
    return reply.send({ success: true });
  });

  app.post('/alerts/:alertId/resolve', {
    schema: { tags: ['Monitoring'] },
  }, async (request, reply) => {
    const { alertId } = request.params as { alertId: string };
    const ok = await monitoringService.resolveAlert(monitoringState, alertId);
    if (!ok) return reply.status(404).send({ success: false, error: 'Alert not found' });
    return reply.send({ success: true });
  });

  app.post('/alerts/trigger', {
    schema: {
      tags: ['Monitoring'],
      body: {
        type: 'object',
        required: ['name', 'severity', 'message'],
        properties: {
          name: { type: 'string' },
          severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
          message: { type: 'string' },
          metric_name: { type: 'string' },
          metric_value: { type: 'number' },
        },
      },
    },
  }, async (request, reply) => {
    const { name, severity, message, metric_name, metric_value } = request.body as {
      name: string; severity: 'info' | 'warning' | 'critical'; message: string;
      metric_name?: string; metric_value?: number;
    };
    const alert = await monitoringService.triggerAlert(
      monitoringState, name, severity, message, metric_name, metric_value,
    );
    return reply.status(201).send({ success: true, alert });
  });

  app.get('/alerts/stats', {
    schema: { tags: ['Monitoring'] },
  }, async (_request, reply) => {
    const result = await monitoringService.getAlertStats(monitoringState);
    return reply.send({ success: true, stats: result, data: result });
  });

  // ── Alert Rules ───────────────────────────────────────────────────────────

  app.get('/alerts/rules', {
    schema: { tags: ['Monitoring'] },
  }, async (_request, reply) => {
    const rules = await monitoringService.getAlertRules(monitoringState);
    return reply.send({ success: true, rules });
  });

  app.patch('/alerts/rules/:ruleId', {
    schema: { tags: ['Monitoring'] },
  }, async (request, reply) => {
    const { ruleId } = request.params as { ruleId: string };
    const patch = request.body as Partial<monitoringService.AlertRule>;
    const ok = await monitoringService.updateAlertRule(monitoringState, ruleId, patch);
    if (!ok) return reply.status(404).send({ success: false, error: 'Rule not found' });
    return reply.send({ success: true });
  });

  // ── User Analytics ───────────────────────────────────────────────────────

  app.get('/analytics/summary', {
    schema: {
      tags: ['Monitoring'],
      querystring: {
        type: 'object',
        properties: {
          window: { type: 'string', description: 'Time window in hours (default 24)' },
        },
      },
    },
  }, async (request, reply) => {
    const { window: windowStr } = request.query as { window?: string };
    const windowHours = windowStr ? Number(windowStr) : 24;
    const result = await monitoringService.getAnalyticsSummary(monitoringState, windowHours);
    return reply.send({ success: true, data: result });
  });

  app.get('/analytics/actions', {
    schema: {
      tags: ['Monitoring'],
      querystring: {
        type: 'object',
        properties: {
          event_type: { type: 'string' },
          user_id: { type: 'string' },
          start: { type: 'string' },
          end: { type: 'string' },
          limit: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { event_type, user_id, start, end, limit } = request.query as Record<string, string | undefined>;
    const result = await monitoringService.getUserActions(monitoringState, {
      event_type: event_type as monitoringService.UserAction['event_type'] | undefined,
      user_id,
      start,
      end,
      limit: limit ? Number(limit) : 100,
    });
    return reply.send({ success: true, actions: result, total: result.length });
  });

  app.post('/analytics/track', {
    schema: {
      tags: ['Monitoring'],
      body: {
        type: 'object',
        required: ['event_type'],
        properties: {
          event_type: { type: 'string' },
          user_id: { type: 'string' },
          node_id: { type: 'string' },
          asset_id: { type: 'string' },
          swarm_id: { type: 'string' },
          session_id: { type: 'string' },
          metadata: { type: 'object' },
          duration_ms: { type: 'number' },
          status_code: { type: 'number' },
          error_message: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const action = request.body as Omit<monitoringService.UserAction, 'timestamp'>;
    await monitoringService.trackUserAction(monitoringState, action);
    return reply.status(201).send({ success: true });
  });
}
