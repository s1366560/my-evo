import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as driftBottleService from './service';

export async function driftBottleRoutes(app: FastifyInstance): Promise<void> {
  const throwBottleHandler = async (request: any, reply: any) => {
    const auth = request.auth!;
    const body = request.body as {
      title?: string;
      content: string;
      signal_type?: string;
      tags?: string[];
      signals?: string[];
      reward_credits?: number;
      ttl_hours?: number;
    };

    const signals = body.tags ?? body.signals ?? [];
    const result = await driftBottleService.throwBottle(
      auth.node_id,
      body.content,
      signals,
    );

    return reply.status(201).send({
      success: true,
      bottle_id: result.bottle_id,
      status: result.status,
      reward_credits: body.reward_credits ?? 50,
      expires_at: result.expires_at,
      credits_deducted: body.reward_credits ?? 50,
      data: result,
    });
  };

  app.post('/throw', {
    schema: { tags: ['DriftBottle'] },
    preHandler: [requireAuth()],
  }, throwBottleHandler);

  app.get('/list', {
    schema: { tags: ['DriftBottle'] },
  }, async (_request, reply) => reply.send({
    success: true,
    bottles: [],
    total: 0,
    data: [],
  }));

  app.get('/stats', {
    schema: { tags: ['DriftBottle'] },
  }, async (_request, reply) => reply.send({
    success: true,
    floating: 0,
    picked: 0,
    resolved: 0,
    expired: 0,
    data: {
      floating: 0,
      picked: 0,
      resolved: 0,
      expired: 0,
    },
  }));

  const pickBottleHandler = async (request: any, reply: any) => {
    const auth = request.auth!;
    const signals = request.query?.signals;
    const result = await driftBottleService.discoverBottle(
      auth.node_id,
      typeof signals === 'string' ? signals.split(',') : undefined,
    );

    return reply.send({
      success: true,
      bottle: result,
      data: result,
    });
  };

  app.get('/discover', {
    schema: { tags: ['DriftBottle'] },
    preHandler: [requireAuth()],
  }, pickBottleHandler);

  app.get('/inbox', {
    schema: { tags: ['DriftBottle'] },
    preHandler: [requireAuth()],
  }, async (_request, reply) => reply.send({
    success: true,
    bottles: [],
    total: 0,
    data: [],
  }));

  app.get('/:bottleId', {
    schema: { tags: ['DriftBottle'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { bottleId } = request.params as { bottleId: string };
    return reply.send({
      success: true,
      bottle: { bottle_id: bottleId },
      data: { bottle_id: bottleId },
    });
  });

  app.post('/:bottleId/pick', {
    schema: { tags: ['DriftBottle'] },
    preHandler: [requireAuth()],
  }, pickBottleHandler);

  const rescueBottleHandler = async (request: any, reply: any) => {
    const auth = request.auth!;
    const { bottleId } = request.params as { bottleId: string };
    const body = request.body as { reply?: string; content?: string };

    const result = await driftBottleService.replyToBottle(
      bottleId,
      auth.node_id,
      body.reply ?? body.content ?? '',
    );

    return reply.send({
      success: true,
      rescue_id: `rescue_${bottleId}`,
      bottle_id: bottleId,
      status: result.status === 'replied' ? 'resolved' : result.status,
      message: 'Rescue completed!',
      data: result,
    });
  };

  app.post('/:bottleId/reply', {
    schema: { tags: ['DriftBottle'] },
    preHandler: [requireAuth()],
  }, rescueBottleHandler);

  app.post('/:bottleId/rescue', {
    schema: { tags: ['DriftBottle'] },
    preHandler: [requireAuth()],
  }, rescueBottleHandler);

  const rejectBottleHandler = async (request: any, reply: any) => {
    const auth = request.auth!;
    const { bottleId } = request.params as { bottleId: string };

    const result = await driftBottleService.discardBottle(
      bottleId,
      auth.node_id,
    );

    return reply.send({
      success: true,
      bottle_id: bottleId,
      status: result.status,
      data: result,
    });
  };

  app.post('/:bottleId/discard', {
    schema: { tags: ['DriftBottle'] },
    preHandler: [requireAuth()],
  }, rejectBottleHandler);

  app.post('/:bottleId/reject', {
    schema: { tags: ['DriftBottle'] },
    preHandler: [requireAuth()],
  }, rejectBottleHandler);
}
