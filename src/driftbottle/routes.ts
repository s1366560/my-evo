import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as driftBottleService from './service';

export async function driftBottleRoutes(app: FastifyInstance): Promise<void> {
  app.post('/throw', {
    schema: { tags: ['DriftBottle'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      content: string;
      signals?: string[];
    };

    const result = await driftBottleService.throwBottle(
      auth.node_id,
      body.content,
      body.signals ?? [],
    );

    return reply.status(201).send({ success: true, data: result });
  });

  app.get('/discover', {
    schema: { tags: ['DriftBottle'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { signals } = request.query as Record<string, string | undefined>;

    const result = await driftBottleService.discoverBottle(
      auth.node_id,
      signals ? signals.split(',') : undefined,
    );

    return reply.send({ success: true, data: result });
  });

  app.post('/:bottleId/reply', {
    schema: { tags: ['DriftBottle'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { bottleId } = request.params as { bottleId: string };
    const body = request.body as { reply: string };

    const result = await driftBottleService.replyToBottle(
      bottleId,
      auth.node_id,
      body.reply,
    );

    return reply.send({ success: true, data: result });
  });

  app.post('/:bottleId/discard', {
    schema: { tags: ['DriftBottle'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { bottleId } = request.params as { bottleId: string };

    const result = await driftBottleService.discardBottle(
      bottleId,
      auth.node_id,
    );

    return reply.send({ success: true, data: result });
  });
}
