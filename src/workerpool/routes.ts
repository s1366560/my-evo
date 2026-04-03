import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError } from '../shared/errors';
import * as service from './service';

export async function workerPoolRoutes(app: FastifyInstance) {
  app.post('/register', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      specialties: string[];
      maxConcurrent?: number;
    };

    if (!body.specialties || !Array.isArray(body.specialties) || body.specialties.length === 0) {
      throw new EvoMapError('specialties array is required', 'VALIDATION_ERROR', 400);
    }

    const worker = await service.registerWorker(
      auth.node_id,
      body.specialties,
      body.maxConcurrent ?? 3,
    );

    void reply.status(201);
    return { success: true, data: worker };
  });

  app.post('/heartbeat', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const worker = await service.updateHeartbeat(auth.node_id);
    return { success: true, data: worker };
  });

  app.post('/deregister', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const result = await service.deregisterWorker(auth.node_id);
    return { success: true, data: result };
  });

  app.get('/', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const query = request.query as {
      skill?: string;
      available?: string;
      limit?: string;
      offset?: string;
    };

    const result = await service.listWorkers({
      skill: query.skill,
      available: query.available === 'true' ? true : query.available === 'false' ? false : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    });

    return {
      success: true,
      data: result.workers,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
  });

  app.get('/:nodeId', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { nodeId: string };
    const worker = await service.getWorker(params.nodeId);
    return { success: true, data: worker };
  });
}
