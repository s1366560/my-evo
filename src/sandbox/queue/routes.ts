/**
 * Sandbox Execution Queue — Fastify Routes
 *
 * REST API endpoints for:
 * - GET  /api/v2/sandbox/execution/stats       — queue statistics
 * - GET  /api/v2/sandbox/execution/queue      — list queued jobs for a node
 * - GET  /api/v2/sandbox/execution/jobs/:id   — get job status
 * - POST /api/v2/sandbox/execution/enqueue    — enqueue a new job
 * - POST /api/v2/sandbox/execution/cancel/:id — cancel a queued job
 * - GET  /api/v2/sandbox/execution/rate-limits — get rate limit status
 */

import type { FastifyInstance } from 'fastify';
import type { RouteShorthandOptions } from 'fastify';
import { requireAuth } from '../../shared/auth';
import { resolveAuthorizedNodeId } from '../../shared/node-access';
import { requireSandboxEntitlement } from '../routes';
import { getSandboxExecutionEngine } from './engine';
import { RateLimitExceededError, QueueFullError } from './engine';
import type { JobPriority, RateLimitConfig } from './types';
import { DEFAULT_RATE_LIMIT_CONFIG } from './types';

// ── Auth helper ────────────────────────────────────────────────────────────

async function resolveNodeId(
  app: FastifyInstance,
  auth: NonNullable<import('fastify').FastifyRequest['auth']>
): Promise<string> {
  return resolveAuthorizedNodeId(app, auth as Parameters<typeof resolveAuthorizedNodeId>[1], {
    missingNodeMessage: 'No accessible node found for current credentials',
  });
}

// ── Routes ──────────────────────────────────────────────────────────────────

export async function sandboxExecutionRoutes(app: FastifyInstance) {
  const engine = getSandboxExecutionEngine();

  // ── GET /execution/stats ───────────────────────────────────────────────────
  app.get('/execution/stats', {
    schema: { tags: ['Sandbox Execution'] },
    preHandler: [requireAuth()],
  }, async () => {
    const stats = engine.getStats();
    const rateLimiter = engine.getRateLimiter();
    const globalStatus = rateLimiter.getGlobalStatus();

    return {
      success: true,
      stats,
      global: globalStatus,
    };
  });

  // ── GET /execution/queue ───────────────────────────────────────────────────
  app.get('/execution/queue', {
    schema: { tags: ['Sandbox Execution'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const nodeId = await resolveNodeId(app, auth);
    await requireSandboxEntitlement(nodeId);

    const jobs = engine.getJobsByNode(nodeId);

    return {
      success: true,
      jobs: jobs.map(job => ({
        job_id: job.job_id,
        sandbox_id: job.sandbox_id,
        status: job.status,
        priority: job.priority,
        created_at: job.created_at.toISOString(),
        started_at: job.started_at?.toISOString(),
        expires_at: job.expires_at.toISOString(),
        error: job.error,
      })),
      total: jobs.length,
    };
  });

  // ── GET /execution/jobs/:jobId ─────────────────────────────────────────────
  app.get('/execution/jobs/:jobId', {
    schema: { tags: ['Sandbox Execution'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const auth = request.auth!;
    const nodeId = await resolveNodeId(app, auth);

    const job = engine.getJob(jobId);

    if (!job) {
      return reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: `Job '${jobId}' not found`,
      });
    }

    if (job.node_id !== nodeId) {
      return reply.status(403).send({
        success: false,
        error: 'FORBIDDEN',
        message: 'Access denied to this job',
      });
    }

    return {
      success: true,
      job: {
        job_id: job.job_id,
        sandbox_id: job.sandbox_id,
        status: job.status,
        priority: job.priority,
        created_at: job.created_at.toISOString(),
        started_at: job.started_at?.toISOString(),
        completed_at: job.completed_at?.toISOString(),
        expires_at: job.expires_at.toISOString(),
        retry_count: job.retry_count,
        max_retries: job.max_retries,
        error: job.error,
        metadata: job.metadata,
      },
    };
  });

  // ── POST /execution/enqueue ────────────────────────────────────────────────
  app.post('/execution/enqueue', {
    schema: { tags: ['Sandbox Execution'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const nodeId = await resolveNodeId(app, auth);
    await requireSandboxEntitlement(nodeId);

    const body = request.body as {
      sandbox_id?: string;
      payload?: unknown;
      priority?: JobPriority;
      max_retries?: number;
      timeout_ms?: number;
      metadata?: Record<string, unknown>;
    };

    if (!body.sandbox_id) {
      return reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'sandbox_id is required',
      });
    }

    try {
      const job = engine.enqueue(
        body.sandbox_id,
        nodeId,
        body.payload ?? {},
        {
          priority: body.priority,
          maxRetries: body.max_retries,
          timeoutMs: body.timeout_ms,
          metadata: body.metadata,
        }
      );

      const queuePos = engine.getQueuePosition(job.job_id);

      return reply.status(202).send({
        success: true,
        job_id: job.job_id,
        status: job.status,
        queue_position: queuePos,
      });
    } catch (err) {
      if (err instanceof RateLimitExceededError) {
        const retryMs = (err as RateLimitExceededError & { retryAfterMs?: number }).retryAfterMs;
        return reply
          .status(429)
          .header('Retry-After', String(Math.ceil((retryMs ?? 5000) / 1000)))
          .send({
            success: false,
            error: 'RATE_LIMIT_EXCEEDED',
            message: err.message,
            retryAfterMs: retryMs,
          });
      }
      if (err instanceof QueueFullError) {
        return reply.status(503).send({
          success: false,
          error: 'QUEUE_FULL',
          message: err.message,
        });
      }
      throw err;
    }
  });

  // ── POST /execution/cancel/:jobId ───────────────────────────────────────────
  app.post('/execution/cancel/:jobId', {
    schema: { tags: ['Sandbox Execution'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const auth = request.auth!;
    const nodeId = await resolveNodeId(app, auth);

    const cancelled = engine.cancel(jobId, nodeId);

    if (!cancelled) {
      return reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: 'Job not found, already started, or access denied',
      });
    }

    return { success: true, job_id: jobId, status: 'cancelled' };
  });

  // ── GET /execution/rate-limits ─────────────────────────────────────────────
  app.get('/execution/rate-limits', {
    schema: { tags: ['Sandbox Execution'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const nodeId = await resolveNodeId(app, auth);

    const rateLimiter = engine.getRateLimiter();
    const nodeStatus = rateLimiter.getNodeStatus(nodeId);
    const globalStatus = rateLimiter.getGlobalStatus();

    return {
      success: true,
      node: nodeStatus,
      global: globalStatus,
      config: DEFAULT_RATE_LIMIT_CONFIG as RateLimitConfig,
    };
  });
}
