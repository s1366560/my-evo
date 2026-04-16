import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { NotFoundError, ValidationError } from '../shared/errors';
import * as circleService from './service';

export async function circleRoutes(app: FastifyInstance): Promise<void> {
  const prisma = app.prisma;
  const DEFAULT_APPROVAL_THRESHOLD = 0.6;
  const DEFAULT_VOTING_DEADLINE_DAYS = 7;
  const DEFAULT_MAX_MEMBERS = 20;

  const toCircleState = (circle: Record<string, unknown>) => {
    const status = circle.status as string;
    const rounds = Array.isArray(circle.rounds) ? circle.rounds as Array<Record<string, unknown>> : [];
    if (status === 'completed') return 'completed';
    if (status === 'archived') return 'dissolved';
    if (rounds.some((round) => round.status === 'ongoing')) return 'evolving';
    if ((circle.participant_count as number) <= 1 && rounds.length === 0) return 'forming';
    return 'active';
  };

  const toCircleMembers = (circle: Record<string, unknown>) => {
    const creatorId = circle.creator_id as string;
    const members = Array.isArray(circle.members) ? circle.members as unknown[] : [creatorId];
    return members
      .filter((member): member is string => typeof member === 'string')
      .map((memberId) => ({
        node_id: memberId,
        role: memberId === creatorId ? 'founder' : 'member',
        contributions: 0,
      }));
  };

  const toCircleConfig = () => ({
    max_members: DEFAULT_MAX_MEMBERS,
    approval_threshold: DEFAULT_APPROVAL_THRESHOLD,
    voting_deadline_days: DEFAULT_VOTING_DEADLINE_DAYS,
  });

  const toCircleListItem = (circle: Record<string, unknown>) => ({
    circle_id: circle.circle_id,
    name: circle.name,
    description: circle.description,
    theme: circle.theme,
    status: circle.status,
    state: toCircleState(circle),
    creator_id: circle.creator_id,
    founder_id: circle.creator_id,
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

    const founderId = result.creator_id ?? auth.node_id;
    const circleRecord = {
      ...result,
      creator_id: founderId,
      participant_count: result.participant_count ?? 1,
      rounds: result.rounds ?? [],
      gene_pool: result.gene_pool ?? [],
    } as unknown as Record<string, unknown>;

    return reply.status(201).send({
      success: true,
      circle_id: result.circle_id,
      state: toCircleState(circleRecord),
      founder_id: founderId,
      members: [{
        node_id: founderId,
        role: 'founder',
        contributions: 0,
      }],
      gene_pool: circleRecord.gene_pool,
      message: 'Circle created. Invite members to join.',
      circle: {
        ...circleRecord,
        state: toCircleState(circleRecord),
        founder_id: founderId,
        members: [{
          node_id: founderId,
          role: 'founder',
          contributions: 0,
        }],
        config: toCircleConfig(),
      },
      data: result,
    });
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

    const items = circles.map((circle: Record<string, unknown>) => toCircleListItem(circle));

    return reply.send({
      success: true,
      items,
      circles: items,
      total,
      data: {
        items,
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

    const detail = {
      circle_id: circle.circle_id,
      name: circle.name,
      description: circle.description,
      theme: circle.theme,
      status: circle.status,
      state: toCircleState(circle as unknown as Record<string, unknown>),
      creator_id: circle.creator_id,
      founder_id: circle.creator_id,
      members: toCircleMembers(circle as unknown as Record<string, unknown>),
      participant_count: circle.participant_count,
      gene_pool: Array.isArray(circle.gene_pool)
        ? circle.gene_pool.filter((geneId): geneId is string => typeof geneId === 'string')
        : [],
      rounds: circle.rounds,
      current_round: Array.isArray(circle.rounds)
        ? (circle.rounds as Array<Record<string, unknown>>).find((round) => round.status === 'ongoing')
        : undefined,
      rounds_completed: circle.rounds_completed,
      outcomes: circle.outcomes,
      config: toCircleConfig(),
      entry_fee: circle.entry_fee,
      prize_pool: circle.prize_pool,
      created_at: circle.created_at.toISOString(),
      updated_at: ('updated_at' in circle && circle.updated_at instanceof Date
        ? circle.updated_at
        : circle.created_at).toISOString(),
    };

    return reply.send({
      success: true,
      circle: detail,
      data: detail,
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
