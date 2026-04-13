import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError } from '../shared/errors';
import * as service from './service';

export async function workerPoolRoutes(app: FastifyInstance) {
  // Register worker
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

  // Heartbeat
  app.post('/heartbeat', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const worker = await service.updateHeartbeat(auth.node_id);
    return { success: true, data: worker };
  });

  // Deregister
  app.post('/deregister', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const result = await service.deregisterWorker(auth.node_id);
    return { success: true, data: result };
  });

  // List workers (existing)
  app.get('/', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const query = request.query as {
      q?: string;
      skill?: string;
      available?: string;
      limit?: string;
      offset?: string;
    };

    const result = await service.listWorkers({
      q: query.q,
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

  // Get worker by nodeId (existing)
  app.get('/:nodeId', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { nodeId: string };
    const worker = await service.getWorker(params.nodeId);
    return { success: true, data: worker };
  });

  // ---- Missing specialist endpoints ----

  // List specialists
  app.get('/specialists', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const query = request.query as {
      specialty?: string;
      available_only?: string;
      limit?: string;
      offset?: string;
    };
    const result = await service.listSpecialists(
      query.specialty,
      query.available_only === 'true' ? true : query.available_only === 'false' ? false : undefined,
      query.limit ? parseInt(query.limit, 10) : 20,
      query.offset ? parseInt(query.offset, 10) : 0,
    );
    return {
      success: true,
      data: result.items,
      meta: { total: result.total },
    };
  });

  // Get specialist profile
  app.get('/specialists/:nodeId', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const params = request.params as { nodeId: string };
    try {
      const specialist = await service.getSpecialist(params.nodeId);
      return { success: true, data: specialist };
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        return reply.status(404).send({ success: false, error: 'NOT_FOUND', message: 'Specialist not found' });
      }
      throw err;
    }
  });

  app.get('/specialist/pools', {
    schema: { tags: ['Swarm'] },
  }, async () => {
    const pools = await service.listSpecialistPools();
    return { success: true, data: { pools } };
  });

  app.post('/match', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const body = request.body as {
      task_signals: string[];
      min_reputation?: number;
      limit?: number;
    };

    if (!Array.isArray(body.task_signals) || body.task_signals.length === 0) {
      throw new EvoMapError('task_signals array is required', 'VALIDATION_ERROR', 400);
    }

    const matches = await service.matchWorkers(
      body.task_signals,
      body.min_reputation ?? 0,
      body.limit ?? 10,
    );
    return { success: true, data: { matches } };
  });

  app.get('/stats', {
    schema: { tags: ['Swarm'] },
  }, async () => {
    const stats = await service.getWorkerPoolStats();
    return { success: true, data: stats };
  });

  // Rate specialist
  app.post('/specialists/:nodeId/rate', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const params = request.params as { nodeId: string };
    const body = request.body as {
      task_id: string;
      rating: number;
      review?: string;
    };
    if (!body.task_id) {
      throw new EvoMapError('task_id is required', 'VALIDATION_ERROR', 400);
    }
    await service.rateSpecialist(
      params.nodeId,
      body.task_id,
      auth.node_id,
      body.rating,
      body.review,
    );
    void reply.status(201);
    return { success: true, data: { rated: true } };
  });
}
