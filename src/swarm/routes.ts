import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError } from '../shared/errors';
import * as service from './service';

export async function swarmRoutes(app: FastifyInstance) {
  app.post('/', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      title: string;
      description: string;
      cost?: number;
    };

    if (!body.title || !body.description) {
      throw new EvoMapError('title and description are required', 'VALIDATION_ERROR', 400);
    }

    const cost = body.cost ?? 50;
    const swarm = await service.createSwarm(
      auth.node_id,
      body.title,
      body.description,
      cost,
    );

    void reply.status(201);
    return {
      success: true,
      swarm_id: swarm.swarm_id,
      state: swarm.status,
      created_at: swarm.created_at,
      data: swarm,
    };
  });

  app.post('/:swarmId/decompose', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { swarmId: string };
    const body = request.body as {
      subtasks: Array<{ title: string; description: string }>;
    };

    if (!body.subtasks || !Array.isArray(body.subtasks)) {
      throw new EvoMapError('subtasks array is required', 'VALIDATION_ERROR', 400);
    }

    const result = await service.decomposeTask(params.swarmId, body.subtasks);
    return { success: true, swarm: result, subtasks: result.subtasks, data: result };
  });

  app.post('/:swarmId/assign', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { swarmId: string };
    const body = request.body as {
      subtaskId: string;
      workerId: string;
    };

    if (!body.subtaskId || !body.workerId) {
      throw new EvoMapError('subtaskId and workerId are required', 'VALIDATION_ERROR', 400);
    }

    const result = await service.assignSubtask(body.subtaskId, body.workerId);
    return { success: true, subtask: result, data: result };
  });

  app.post('/:swarmId/subtask/:subtaskId/submit', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { swarmId: string; subtaskId: string };
    const body = request.body as { result: string };

    if (!body.result) {
      throw new EvoMapError('result is required', 'VALIDATION_ERROR', 400);
    }

    const result = await service.submitSubtaskResult(params.subtaskId, body.result);
    return { success: true, subtask: result, data: result };
  });

  app.post('/:swarmId/aggregate', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { swarmId: string };
    const result = await service.aggregateResults(params.swarmId);
    return { success: true, swarm: result, result: result.result ?? null, data: result };
  });

  app.get('/:swarmId', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { swarmId: string };
    const result = await service.getSwarm(params.swarmId);
    return { success: true, swarm: result, data: result };
  });

  app.get('/', {
    schema: { tags: ['Swarm'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const query = request.query as {
      status?: string;
      limit?: string;
      offset?: string;
    };

    const result = await service.listSwarms({
      status: query.status as import('./types').ListSwarmsInput['status'],
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    });

    return {
      success: true,
      swarms: result.swarms,
      total: result.total,
      data: result.swarms,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
  });
}
