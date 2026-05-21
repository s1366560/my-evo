import type { FastifyInstance } from 'fastify';
import * as batchService from './service';
import type { BatchOperationType } from './types';
import { requireAuth } from '../shared/auth';

export async function batchRoutes(app: FastifyInstance): Promise<void> {

  // Create batch job
  app.post('/', {
    preHandler: [requireAuth()],
    schema: { tags: ['Batch'] },
  }, async (request, reply) => {
    const {
      operation_type, item_ids, parameters,
      priority, notification_email, webhook_url,
    } = request.body as Record<string, unknown>;
    const userId = (request as unknown as { user: { userId: string } }).user?.userId ?? 'anonymous';
    const job = await batchService.createBatchJob({
      user_id: userId,
      operation_type: operation_type as BatchOperationType,
      item_ids: item_ids as string[],
      parameters: parameters as Record<string, unknown>,
      priority: priority as 'low' | 'normal' | 'high' | 'urgent',
      notification_email: notification_email as string,
      webhook_url: webhook_url as string,
    });
    // Run async
    batchService.runBatchJob(job.job_id, app.prisma).catch(console.error);
    return reply.send({ success: true, data: job });
  });

  // List batch jobs
  app.get('/', {
    preHandler: [requireAuth()],
    schema: { tags: ['Batch'] },
  }, async (request, reply) => {
    const { status, operation_type, page, page_size } =
      request.query as Record<string, string | undefined>;
    const userId = (request as unknown as { user: { userId: string } }).user?.userId ?? 'anonymous';
    const result = batchService.listBatchJobs(
      { user_id: userId, status, operation_type },
      { page: Number(page ?? 1), page_size: Number(page_size ?? 20) },
    );
    return reply.send({ success: true, data: result });
  });

  // Get batch job status
  app.get('/:jobId', {
    preHandler: [requireAuth()],
    schema: { tags: ['Batch'] },
  }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = batchService.getBatchJob(jobId);
    if (!job) return reply.status(404).send({ success: false, error: 'Batch job not found' });
    // SECURITY FIX: Authorization check — users can only access their own jobs
    const requesterId = (request.auth?.userId as string | undefined) ?? (request.auth?.node_id as string | undefined);
    if (job.user_id !== requesterId) {
      return reply.status(403).send({ success: false, error: 'Access denied' });
    }
    return reply.send({ success: true, data: job });
  });

  // Get batch job progress
  app.get('/:jobId/progress', {
    preHandler: [requireAuth()],
    schema: { tags: ['Batch'] },
  }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = batchService.getBatchJob(jobId);
    if (!job) return reply.status(404).send({ success: false, error: 'Batch job not found' });
    // SECURITY FIX: Authorization check
    const requesterId = (request.auth?.userId as string | undefined) ?? (request.auth?.node_id as string | undefined);
    if (job.user_id !== requesterId) {
      return reply.status(403).send({ success: false, error: 'Access denied' });
    }
    const progress = batchService.getBatchJobProgress(jobId);
    return reply.send({ success: true, data: progress });
  });

  // Pause batch job
  app.post('/:jobId/pause', {
    preHandler: [requireAuth()],
    schema: { tags: ['Batch'] },
  }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const existing = batchService.getBatchJob(jobId);
    if (!existing) return reply.status(404).send({ success: false, error: 'Batch job not found' });
    // SECURITY FIX: Authorization check
    const requesterId = (request.auth?.userId as string | undefined) ?? (request.auth?.node_id as string | undefined);
    if (existing.user_id !== requesterId) {
      return reply.status(403).send({ success: false, error: 'Access denied' });
    }
    const job = batchService.pauseBatchJob(jobId);
    return reply.send({ success: true, data: job });
  });

  // Resume batch job
  app.post('/:jobId/resume', {
    preHandler: [requireAuth()],
    schema: { tags: ['Batch'] },
  }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const existing = batchService.getBatchJob(jobId);
    if (!existing) return reply.status(404).send({ success: false, error: 'Batch job not found' });
    // SECURITY FIX: Authorization check
    const requesterId = (request.auth?.userId as string | undefined) ?? (request.auth?.node_id as string | undefined);
    if (existing.user_id !== requesterId) {
      return reply.status(403).send({ success: false, error: 'Access denied' });
    }
    const job = batchService.resumeBatchJob(jobId);
    return reply.send({ success: true, data: job });
  });

  // Cancel batch job
  app.delete('/:jobId', {
    preHandler: [requireAuth()],
    schema: { tags: ['Batch'] },
  }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const existing = batchService.getBatchJob(jobId);
    if (!existing) return reply.status(404).send({ success: false, error: 'Batch job not found' });
    // SECURITY FIX: Authorization check
    const requesterId = (request.auth?.userId as string | undefined) ?? (request.auth?.node_id as string | undefined);
    if (existing.user_id !== requesterId) {
      return reply.status(403).send({ success: false, error: 'Access denied' });
    }
    const job = batchService.cancelBatchJob(jobId);
    return reply.send({ success: true, data: job });
  });

  // Create batch schedule
  app.post('/schedules', {
    preHandler: [requireAuth()],
    schema: { tags: ['Batch'] },
  }, async (request, reply) => {
    const { operation_type, cron_expression, parameters } =
      request.body as Record<string, unknown>;
    const userId = (request as unknown as { user: { userId: string } }).user?.userId ?? 'anonymous';
    const schedule = batchService.createBatchSchedule({
      user_id: userId,
      operation_type: operation_type as BatchOperationType,
      cron_expression: String(cron_expression),
      parameters: parameters as Record<string, unknown>,
    });
    return reply.send({ success: true, data: schedule });
  });

  // List batch schedules
  app.get('/schedules/list', {
    preHandler: [requireAuth()],
    schema: { tags: ['Batch'] },
  }, async (request, reply) => {
    const userId = (request as unknown as { user: { userId: string } }).user?.userId ?? 'anonymous';
    const schedules = batchService.listBatchSchedules(userId);
    return reply.send({ success: true, data: schedules });
  });
}
