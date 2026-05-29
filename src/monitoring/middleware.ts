/**
 * Monitoring Middleware
 * Hooks into Fastify request lifecycle to automatically capture:
 * - HTTP request/response metrics
 * - Response time (latency)
 * - Error rates
 * - User action analytics
 *
 * Usage in app.ts:
 *   import { monitoringMiddleware } from './monitoring/middleware';
 *   app.addHook('onRequest', monitoringMiddleware.onRequest);
 *   app.addHook('onResponse', monitoringMiddleware.onResponse);
 *   app.addHook('onError', monitoringMiddleware.onError);
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MonitoringState } from './service';

// Paths to exclude from metrics collection
const EXCLUDED_PATHS = new Set([
  '/health',
  '/metrics',
  '/dashboard/metrics',
  '/metrics/stats',
]);

// Slow request threshold in ms
const SLOW_REQUEST_THRESHOLD_MS = 2000;

// ─── Request tracking ─────────────────────────────────────────────────────────

/**
 * onRequest hook: record request start time and basic request metrics.
 */
export function createOnRequestHook(state: MonitoringState) {
  return async function onRequest(request: FastifyRequest): Promise<void> {
    // Attach start time for latency calculation
    (request as FastifyRequest & { _startTime?: number })._startTime = Date.now();

    // Don't track excluded health/metrics endpoints
    if (EXCLUDED_PATHS.has(normalizePath(request.url))) return;

    // Count total requests (1 per unique timestamp bucket to avoid noise)
    await recordMetric(state, 'http.requests.total', 1, {
      method: request.method,
      path: normalizePath(request.url),
    });
  };
}

/**
 * onResponse hook: record response time and status metrics.
 */
export function createOnResponseHook(state: MonitoringState) {
  return async function onResponse(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const startTime = (request as FastifyRequest & { _startTime?: number })._startTime;
    if (!startTime) return;

    if (EXCLUDED_PATHS.has(normalizePath(request.url))) return;

    const duration = Date.now() - startTime;
    const path = normalizePath(request.url);

    // Record response time
    await recordMetric(state, 'http.response_time_ms', duration, {
      method: request.method,
      path,
      status: String(reply.statusCode),
    });

    // Record by route type
    if (path.includes('/search')) {
      await recordMetric(state, 'http.response_time_ms.search', duration);
    }

    // Record slow requests
    if (duration > SLOW_REQUEST_THRESHOLD_MS) {
      await recordMetric(state, 'http.slow_requests', 1, {
        method: request.method,
        path,
        duration_ms: String(duration),
      });
    }

    // Track user action for analytics
    await trackAction(state, 'api_call', request, reply, duration);
  };
}

/**
 * onError hook: record error metrics and trigger alert.
 */
export function createOnErrorHook(state: MonitoringState) {
  return async function onError(
    request: FastifyRequest,
    reply: FastifyReply,
    error: Error,
  ): Promise<void> {
    if (EXCLUDED_PATHS.has(normalizePath(request.url))) return;

    const path = normalizePath(request.url);
    const startTime = (request as FastifyRequest & { _startTime?: number })._startTime;
    const duration = startTime ? Date.now() - startTime : 0;

    // Record error metric
    await recordMetric(state, 'http.errors', 1, {
      method: request.method,
      path,
      error_type: error.name || 'Error',
    });

    // Track error for analytics
    await trackAction(state, 'error', request, reply, duration, error.message);

    // Trigger alert for critical errors (5xx)
    const replyStatus = reply.statusCode;
    if (replyStatus >= 500) {
      await triggerAlertIfNeeded(state, 'http.error_rate', 'critical');
    }
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function recordMetric(
  state: MonitoringState,
  name: string,
  value: number,
  labels?: Record<string, string>,
): Promise<void> {
  // Lazy import to avoid circular dependency
  const { recordMetric: rec } = await import('./service');
  await rec(state, name, value, labels);
}

async function trackAction(
  state: MonitoringState,
  eventType: Parameters<typeof import('./service').trackUserAction>[1]['event_type'],
  request: FastifyRequest,
  reply: FastifyReply,
  durationMs: number,
  errorMessage?: string,
): Promise<void> {
  const { trackUserAction } = await import('./service');

  // Extract user/node identity from auth if available
  const userId = (request as FastifyRequest & { user?: { id?: string } }).user?.id;
  const sessionId = request.headers['x-session-id'] as string | undefined;
  const nodeId = request.headers['x-node-id'] as string | undefined;

  await trackUserAction(state, {
    event_type: eventType,
    user_id: userId,
    node_id: nodeId,
    session_id: sessionId,
    metadata: {
      route: normalizePath(request.url),
      method: request.method,
    },
    duration_ms: durationMs,
    status_code: reply.statusCode,
    error_message: errorMessage,
  });
}

async function triggerAlertIfNeeded(
  state: MonitoringState,
  metricName: string,
  severity: 'info' | 'warning' | 'critical',
): Promise<void> {
  const { triggerAlert } = await import('./service');
  await triggerAlert(
    state,
    `HTTP ${severity} Error Detected`,
    severity,
    `HTTP ${severity} error detected in request pipeline`,
    metricName,
    1,
  );
}

/**
 * Normalize path by replacing dynamic segments (UUIDs, IDs) with placeholders.
 * Example: /api/v2/assets/abc123 -> /api/v2/assets/:id
 */
function normalizePath(url: string | undefined): string {
  const raw = url ?? '';
  let path = raw.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id');
  path = path.replace(/\/[0-9a-f]{32,}/gi, '/:hash');
  path = path.replace(/\/\d{10,}/g, '/:id');
  path = path.replace(/\/[0-9a-f]{8,}/gi, '/:id');
  const parts = path.split('?');
  return parts[0] ?? path;
}

// ─── Alert-rate metrics ───────────────────────────────────────────────────────

/**
 * Record rate-limited request (called by rate-limit handler).
 */
export async function recordRateLimitHit(
  state: MonitoringState,
  identifier: string,
): Promise<void> {
  const { recordMetric } = await import('./service');
  await recordMetric(state, 'http.rate_limited', 1, { identifier });
}

// ─── Express middleware factory ──────────────────────────────────────────────

export interface MonitoringMiddleware {
  onRequest: ReturnType<typeof createOnRequestHook>;
  onResponse: ReturnType<typeof createOnResponseHook>;
  onError: ReturnType<typeof createOnErrorHook>;
}

/**
 * Create all monitoring hooks bound to a shared MonitoringState.
 */
export function createMonitoringMiddleware(state: MonitoringState): MonitoringMiddleware {
  return {
    onRequest: createOnRequestHook(state),
    onResponse: createOnResponseHook(state),
    onError: createOnErrorHook(state),
  };
}
