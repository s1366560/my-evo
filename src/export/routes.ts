import type { FastifyInstance } from 'fastify';
import * as exportService from './service';
import type { ExportFilters } from './types';
import { requireAuth } from '../shared/auth';

export async function exportRoutes(app: FastifyInstance): Promise<void> {

  // Create export job
  app.post('/', {
    preHandler: [requireAuth()],
    schema: { tags: ['Export'] },
  }, async (request, reply) => {
    const { entity_type, format, filters, delivery, delivery_target, compression } =
      request.body as Record<string, unknown>;
    const userId = (request as unknown as { user: { userId: string } }).user?.userId ?? 'anonymous';
    const job = await exportService.createExportJob({
      user_id: userId,
      entity_type: String(entity_type),
      format: String(format),
      filters: filters as ExportFilters,
      delivery: delivery as string,
      delivery_target: delivery_target as string,
      compression: compression as 'none' | 'gzip' | 'zip',
    });
    // Start export asynchronously
    exportService.runExportJob(job.job_id, app.prisma).catch(console.error);
    await reply.send({ success: true, data: job });
  });

  // List export jobs
  app.get('/', {
    preHandler: [requireAuth()],
    schema: { tags: ['Export'] },
  }, async (request, reply) => {
    const { status, entity_type, date_from, date_to, page, page_size } =
      request.query as Record<string, string | undefined>;
    const userId = (request as unknown as { user: { userId: string } }).user?.userId ?? 'anonymous';
    const result = exportService.listExportJobs(
      { user_id: userId, status, entity_type, date_from, date_to },
      { page: Number(page ?? 1), page_size: Number(page_size ?? 20) },
    );
    await reply.send({ success: true, data: result });
  });

  // Get export job status
  app.get('/:jobId', {
    preHandler: [requireAuth()],
    schema: { tags: ['Export'] },
  }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = exportService.getExportJob(jobId);
    if (!job) { await reply.status(404).send({ success: false, error: 'Export job not found' }); return; }
    await reply.send({ success: true, data: job });
  });

  // Get export columns (metadata)
  app.get('/columns/:entityType/:format', {
    preHandler: [requireAuth()],
    schema: { tags: ['Export'] },
  }, async (request, reply) => {
    const { entityType, format } = request.params as { entityType: string; format: string };
    const columns = exportService.getExportColumns(entityType, format);
    await reply.send({ success: true, data: columns });
  });

  // Cancel export job
  app.delete('/:jobId', {
    preHandler: [requireAuth()],
    schema: { tags: ['Export'] },
  }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = exportService.cancelExportJob(jobId);
    if (!job) { await reply.status(404).send({ success: false, error: 'Export job not found' }); return; }
    await reply.send({ success: true, data: job });
  });
}
