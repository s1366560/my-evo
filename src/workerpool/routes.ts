import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError, ForbiddenError } from '../shared/errors';
import * as service from './service';

function parseOptionalNonNegativeInteger(value: string | undefined, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!/^\d+$/.test(value)) {
    throw new EvoMapError(`${field} must be a non-negative integer`, 'VALIDATION_ERROR', 400);
  }

  return Number(value);
}

export async function workerPoolRoutes(app: FastifyInstance) {
  async function sendWorkerList(request: {
    query: unknown;
  }) {
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
      limit: parseOptionalNonNegativeInteger(query.limit, 'limit') ?? 20,
      offset: parseOptionalNonNegativeInteger(query.offset, 'offset') ?? 0,
    });

    return {
      success: true,
      workers: result.workers,
      total: result.total,
      data: result.workers,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
  }

  async function sendWorkerDetail(request: {
    params: unknown;
  }) {
    const params = request.params as { nodeId: string };
    const worker = await service.getWorker(params.nodeId);
    return { success: true, worker, data: worker };
  }

  async function sendWorkerCatalog(request: {
    query: unknown;
  }) {
    const query = request.query as {
      skill?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };

    const result = await service.listWorkersPublic({
      skill: query.skill,
      status: query.status,
      limit: parseOptionalNonNegativeInteger(query.limit, 'limit') ?? 20,
      offset: parseOptionalNonNegativeInteger(query.offset, 'offset') ?? 0,
    });
    return { success: true, workers: result.workers, total: result.total, data: result };
  }

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
    return {
      success: true,
      worker_id: worker.node_id,
      type: 'passive',
      tier: 'bronze',
      is_available: worker.is_available,
      registered_at: worker.last_heartbeat instanceof Date
        ? worker.last_heartbeat.toISOString()
        : worker.last_heartbeat,
      data: worker,
    };
  });

  // Heartbeat
  app.post('/heartbeat', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const worker = await service.updateHeartbeat(auth.node_id);
    return {
      success: true,
      worker: {
        node_id: worker.node_id,
        is_available: worker.is_available,
        last_heartbeat: worker.last_heartbeat instanceof Date
          ? worker.last_heartbeat.toISOString()
          : worker.last_heartbeat,
      },
      data: worker,
    };
  });

  // Deregister
  app.post('/deregister', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const result = await service.deregisterWorker(auth.node_id);
    return { ...result, data: result };
  });

  // List workers (existing)
  app.get('/', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, sendWorkerList);

  app.get('/workers', {
    schema: { tags: ['Swarm'] },
  }, sendWorkerCatalog);

  // Get worker by nodeId (existing)
  app.get('/:nodeId', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, sendWorkerDetail);

  app.get('/workers/:nodeId', {
    schema: { tags: ['Swarm'] },
  }, async (request) => {
    const params = request.params as { nodeId: string };
    const worker = await service.getWorkerPublic(params.nodeId);
    return { success: true, worker, data: worker };
  });

  app.post('/workers/:nodeId/availability', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { nodeId: string };
    const body = (request.body as {
      availability?: string;
      available?: boolean;
      is_available?: boolean;
      resume_at?: string;
    } | undefined) ?? {};

    if (params.nodeId !== auth.node_id) {
      throw new ForbiddenError('Cannot update another worker availability');
    }

    if (body.availability !== undefined && typeof body.availability !== 'string') {
      throw new EvoMapError('availability must be a string', 'VALIDATION_ERROR', 400);
    }

    const normalizedAvailability = typeof body.availability === 'string'
      ? body.availability.trim().toLowerCase()
      : undefined;
    const availability = normalizedAvailability
      ?? (typeof body.available === 'boolean'
        ? (body.available ? 'active' : 'busy')
        : typeof body.is_available === 'boolean'
          ? (body.is_available ? 'active' : 'busy')
          : undefined);
    if (!availability) {
      throw new EvoMapError('availability is required', 'VALIDATION_ERROR', 400);
    }
    if (!['active', 'available', 'busy'].includes(availability)) {
      throw new EvoMapError('availability must be active, available, or busy', 'VALIDATION_ERROR', 400);
    }

    const available = availability === 'active' || availability === 'available';

    await service.setWorkerAvailability(params.nodeId, available);
    return {
      success: true,
      status: 'ok',
      availability: availability === 'available' ? 'active' : availability,
      worker_id: params.nodeId,
    };
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
      parseOptionalNonNegativeInteger(query.limit, 'limit') ?? 20,
      parseOptionalNonNegativeInteger(query.offset, 'offset') ?? 0,
    );
    return {
      success: true,
      specialists: result.items,
      total: result.total,
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
      return { success: true, specialist, data: specialist };
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
    return { success: true, pools, total: pools.length, data: { pools } };
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
    return { success: true, matches, total: matches.length, data: { matches } };
  });

  app.get('/stats', {
    schema: { tags: ['Swarm'] },
  }, async () => {
    const stats = await service.getWorkerPoolStats();
    return { success: true, ...stats, data: stats };
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
    return {
      success: true,
      rated: true,
      worker_id: params.nodeId,
      task_id: body.task_id,
      data: { rated: true },
    };
  });
}
