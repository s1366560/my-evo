import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { NotFoundError, ValidationError } from '../shared/errors';
import * as circleService from './service';

export async function circleRoutes(app: FastifyInstance): Promise<void> {
  const prisma = app.prisma;

  app.post('/', {
    schema: { tags: ['Circle'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
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

  app.post('/:circleId/join', {
    schema: { tags: ['Circle'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { circleId } = request.params as { circleId: string };

    const result = await circleService.joinCircle(
      circleId,
      auth.node_id,
    );

    return reply.send({ success: true, data: result });
  });

  app.post('/:circleId/gene', {
    schema: { tags: ['Circle'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { circleId } = request.params as { circleId: string };
    const body = request.body as {
      gene_id?: string;
      asset_id?: string;
    };
    const geneId = body.gene_id ?? body.asset_id;

    if (!geneId) {
      throw new ValidationError('gene_id is required');
    }

    const result = await circleService.contributeGene(
      circleId,
      auth.node_id,
      geneId,
    );

    return reply.send({ success: true, data: result });
  });

  app.post('/:circleId/start-round', {
    schema: { tags: ['Circle'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { circleId } = request.params as { circleId: string };

    const result = await circleService.startRound(circleId, auth.node_id);

    return reply.send({ success: true, data: result });
  });

  app.post('/:circleId/submit', {
    schema: { tags: ['Circle'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
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
  });

  app.post('/:circleId/vote', {
    schema: { tags: ['Circle'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
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
  });

  app.post('/:circleId/advance', {
    schema: { tags: ['Circle'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { circleId } = request.params as { circleId: string };

    const result = await circleService.advanceRound(circleId, auth.node_id);

    return reply.send({ success: true, data: result });
  });

  app.post('/:circleId/complete', {
    schema: { tags: ['Circle'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { circleId } = request.params as { circleId: string };

    const result = await circleService.completeCircle(circleId, auth.node_id);

    return reply.send({ success: true, data: result });
  });

  app.get('/', {
    schema: { tags: ['Circle'] },
  }, async (request, reply) => {
    const { limit, offset } = request.query as Record<string, string | undefined>;

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
        gene_pool_size: Array.isArray(c.gene_pool) ? c.gene_pool.length : 0,
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

  app.get('/:circleId', {
    schema: { tags: ['Circle'] },
  }, async (request, reply) => {
    const { circleId } = request.params as { circleId: string };

    const circle = await prisma.circle.findUnique({
      where: { circle_id: circleId },
    });

    if (!circle) {
      throw new NotFoundError('Circle', circleId);
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
        gene_pool: Array.isArray(circle.gene_pool)
          ? circle.gene_pool.filter((geneId): geneId is string => typeof geneId === 'string')
          : [],
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
