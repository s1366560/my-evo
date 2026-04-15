import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { NotFoundError, ValidationError } from '../shared/errors';
import * as circleService from './service';

export async function circleRoutes(app: FastifyInstance): Promise<void> {
  const prisma = app.prisma;

  const toCircleListItem = (circle: Record<string, unknown>) => ({
    circle_id: circle.circle_id,
    name: circle.name,
    description: circle.description,
    theme: circle.theme,
    status: circle.status,
    creator_id: circle.creator_id,
    participant_count: circle.participant_count,
    gene_pool_size: Array.isArray(circle.gene_pool) ? circle.gene_pool.length : 0,
    rounds_completed: circle.rounds_completed,
    entry_fee: circle.entry_fee,
    prize_pool: circle.prize_pool,
    created_at: (circle.created_at as Date).toISOString(),
  });

  async function createCircleHandler(request: any, reply: any) {
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
  }

  async function listCirclesHandler(request: any, reply: any) {
    const { limit, offset } = request.query;

    const [circles, total] = await Promise.all([
      prisma.circle.findMany({
        orderBy: { created_at: 'desc' },
        take: limit ? Number(limit) : 20,
        skip: offset ? Number(offset) : 0,
      }),
      prisma.circle.count(),
    ]);

    return reply.send({
      success: true,
      data: {
        items: circles.map((circle: Record<string, unknown>) => toCircleListItem(circle)),
        total,
      },
    });
  }

  app.post('/', {
    schema: { tags: ['Circle'] },
    preHandler: [requireAuth()],
  }, createCircleHandler);

  app.post('/create', {
    schema: { tags: ['Circle'] },
    preHandler: [requireAuth()],
  }, createCircleHandler);

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

  app.post('/:circleId/leave', {
    schema: { tags: ['Circle'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { circleId } = request.params as { circleId: string };

    const result = await circleService.leaveCircle(
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

  app.post('/:circleId/round', {
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
  }, listCirclesHandler);

  app.get('/list', {
    schema: { tags: ['Circle'] },
  }, listCirclesHandler);

  app.get('/my', {
    schema: { tags: ['Circle'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { limit, offset } = request.query as Record<string, string | undefined>;
    const take = limit ? Number(limit) : 20;
    const skip = offset ? Number(offset) : 0;

    const circles = await prisma.circle.findMany({
      orderBy: { created_at: 'desc' },
    });

    const myCircles = circles.filter((circle: Record<string, unknown>) => {
      if (circle.creator_id === auth.node_id) {
        return true;
      }

      return Array.isArray(circle.members)
        && circle.members.some((member) => member === auth.node_id);
    });

    return reply.send({
      success: true,
      data: {
        items: myCircles
          .slice(skip, skip + take)
          .map((circle: Record<string, unknown>) => toCircleListItem(circle)),
        total: myCircles.length,
      },
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

  app.get('/:circleId/rounds', {
    schema: { tags: ['Circle'] },
  }, async (request, reply) => {
    const { circleId } = request.params as { circleId: string };

    const circle = await prisma.circle.findUnique({
      where: { circle_id: circleId },
      select: { rounds: true },
    });

    if (!circle) {
      throw new NotFoundError('Circle', circleId);
    }

    return reply.send({
      success: true,
      data: Array.isArray(circle.rounds) ? circle.rounds : [],
    });
  });
}
