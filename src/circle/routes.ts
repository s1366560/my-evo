import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as circleService from './service';

export async function circleRoutes(app: FastifyInstance): Promise<void> {
  app.post('/', { preHandler: [requireAuth()] }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      name: string;
      description: string;
      theme: string;
    };

    const result = await circleService.createCircle(
      auth.node_id,
      body.name,
      body.description,
      body.theme,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  app.post(
    '/:circleId/join',
    { preHandler: [requireAuth()] },
    async (request, reply) => {
      const auth = request.auth!;
      const { circleId } = request.params as { circleId: string };

      const result = await circleService.joinCircle(
        circleId,
        auth.node_id,
      );

      return reply.send({ success: true, data: result });
    },
  );

  app.post(
    '/:circleId/start-round',
    { preHandler: [requireAuth()] },
    async (request, reply) => {
      const { circleId } = request.params as { circleId: string };

      const result = await circleService.startRound(circleId);

      return reply.send({ success: true, data: result });
    },
  );

  app.post(
    '/:circleId/submit',
    { preHandler: [requireAuth()] },
    async (request, reply) => {
      const auth = request.auth!;
      const { circleId } = request.params as { circleId: string };
      const body = request.body as {
        round_number: number;
        asset_id: string;
      };

      const result = await circleService.submitAsset(
        circleId,
        body.round_number,
        auth.node_id,
        body.asset_id,
      );

      return reply.send({ success: true, data: result });
    },
  );

  app.post(
    '/:circleId/vote',
    { preHandler: [requireAuth()] },
    async (request, reply) => {
      const auth = request.auth!;
      const { circleId } = request.params as { circleId: string };
      const body = request.body as {
        round_number: number;
        target_id: string;
        score: number;
      };

      const result = await circleService.vote(
        circleId,
        body.round_number,
        auth.node_id,
        body.target_id,
        body.score,
      );

      return reply.send({ success: true, data: result });
    },
  );

  app.post(
    '/:circleId/advance',
    { preHandler: [requireAuth()] },
    async (request, reply) => {
      const { circleId } = request.params as { circleId: string };

      const result = await circleService.advanceRound(circleId);

      return reply.send({ success: true, data: result });
    },
  );

  app.post(
    '/:circleId/complete',
    { preHandler: [requireAuth()] },
    async (request, reply) => {
      const { circleId } = request.params as { circleId: string };

      const result = await circleService.completeCircle(circleId);

      return reply.send({ success: true, data: result });
    },
  );

  app.get('/', async (request, reply) => {
    const { limit, offset } = request.query as Record<string, string | undefined>;

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const [circles, total] = await Promise.all([
      prisma.circle.findMany({
        orderBy: { created_at: 'desc' },
        take: limit ? Number(limit) : 20,
        skip: offset ? Number(offset) : 0,
      }),
      prisma.circle.count(),
    ]);

    const items = circles.map((c: Record<string, unknown>) => ({
      circle_id: c.circle_id,
      name: c.name,
      description: c.description,
      theme: c.theme,
      status: c.status,
      creator_id: c.creator_id,
      participant_count: c.participant_count,
      rounds_completed: c.rounds_completed,
      entry_fee: c.entry_fee,
      prize_pool: c.prize_pool,
      created_at: (c.created_at as Date).toISOString(),
    }));

    return reply.send({
      success: true,
      data: { items, total },
    });
  });

  app.get('/:circleId', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const circle = await prisma.circle.findUnique({
      where: { circle_id: circleId },
    });

    if (!circle) {
      return reply.status(404).send({
        success: false,
        error: 'Circle not found',
      });
    }

    return reply.send({
      success: true,
      data: {
        circle_id: circle.circle_id,
        name: circle.name,
        description: circle.description,
        theme: circle.theme,
        status: circle.status,
        creator_id: circle.creator_id,
        participant_count: circle.participant_count,
        rounds: circle.rounds,
        rounds_completed: circle.rounds_completed,
        outcomes: circle.outcomes,
        entry_fee: circle.entry_fee,
        prize_pool: circle.prize_pool,
        created_at: circle.created_at.toISOString(),
      },
    });
  });
}
