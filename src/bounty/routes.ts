import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate, requireAuth } from '../shared/auth';
import { EvoMapError, ValidationError } from '../shared/errors';
import * as service from './service';

type BountyMilestoneBody = {
  milestone_id?: string;
  title: string;
  description: string;
  percentage: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'verified';
  deliverable?: string;
};

type CreateBountyBody = {
  title: string;
  description: string;
  requirements?: string[];
  required_signals?: string[];
  acceptance_criteria?: string;
  amount?: number;
  reward?: number;
  milestones?: BountyMilestoneBody[];
  deadline: string;
};

export async function bountyRoutes(app: FastifyInstance) {
  async function createBountyHandler(request: FastifyRequest, reply: { status(code: number): void }) {
    const auth = request.auth!;
    const body = ((request.body as CreateBountyBody | undefined) ?? {}) as CreateBountyBody;

    const amount = body.amount ?? body.reward;
    const requirements = [...(body.requirements ?? body.required_signals ?? [])];
    if (body.acceptance_criteria) {
      requirements.push(`Acceptance criteria: ${body.acceptance_criteria}`);
    }

    if (!body.title || !body.description || !amount || !body.deadline) {
      throw new EvoMapError('title, description, amount/reward, and deadline are required', 'VALIDATION_ERROR', 400);
    }

    const bounty = await service.createBounty(
      auth.node_id,
      body.title,
      body.description,
      requirements,
      amount,
      body.deadline,
      body.milestones ?? [],
    );

    void reply.status(201);
    return {
      success: true,
      bounty_id: bounty.bounty_id,
      state: bounty.status,
      reward: bounty.amount,
      platform_fee: Math.ceil(bounty.amount * 0.05),
      created_at: bounty.created_at,
      deadline: bounty.deadline,
      data: {
        ...bounty,
        reward: bounty.amount,
      },
    };
  }

  async function getOptionalAuth(request: FastifyRequest) {
    const hasCredentials = Boolean(
      request.headers.authorization
      || request.cookies?.session_token
      || request.headers['x-session-token'],
    );

    if (!hasCredentials) {
      return undefined;
    }

    try {
      return await authenticate(request);
    } catch {
      return undefined;
    }
  }

  async function sendBountyList(request: FastifyRequest) {
    const query = request.query as {
      status?: string;
      creator_id?: string;
      limit?: string;
      offset?: string;
    };

    const result = await service.listBounties({
      status: query.status as 'open' | 'claimed' | 'submitted' | 'accepted' | 'disputed' | 'resolved' | 'expired' | 'cancelled' | undefined,
      creator_id: query.creator_id,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    });

    return {
      success: true,
      bounties: result.bounties,
      total: result.total,
      data: result.bounties,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
  }

  async function sendClaimedBounty(
    request: FastifyRequest,
  ) {
    const auth = request.auth!;
    const params = request.params as { bountyId: string };
    const body = request.body as { bid_id?: string; bidId?: string };
    const bidId = body.bid_id ?? body.bidId;

    if (!bidId) {
      throw new EvoMapError('bid_id is required', 'VALIDATION_ERROR', 400);
    }

    const bounty = await service.acceptBid(params.bountyId, bidId, auth.node_id);
    return { success: true, bounty, data: bounty };
  }

  // Alias: POST /a2a/ask  (same as POST /api/v2/bounty)
  app.post('/ask', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, createBountyHandler);

  // POST /api/v2/bounty/create — explicit create alias
  app.post('/create', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, createBountyHandler);

  app.post('/', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, createBountyHandler);

  app.post('/:bountyId/bid', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { bountyId: string };
    const body = request.body as {
      proposedAmount?: number;
      proposed_price?: number;
      estimatedTime: string;
      approach: string;
    };
    const proposedAmount = body.proposedAmount ?? body.proposed_price;

    if (!proposedAmount || !body.estimatedTime || !body.approach) {
      throw new EvoMapError('proposedAmount/proposed_price, estimatedTime, and approach are required', 'VALIDATION_ERROR', 400);
    }

    const bid = await service.placeBid(
      params.bountyId,
      auth.node_id,
      proposedAmount,
      body.estimatedTime,
      body.approach,
    );

    return { success: true, bid, data: bid };
  });

  app.post('/:bountyId/accept-bid', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { bountyId: string };
    const body = request.body as { bidId: string };

    if (!body.bidId) {
      throw new EvoMapError('bidId is required', 'VALIDATION_ERROR', 400);
    }

    const bounty = await service.acceptBid(params.bountyId, body.bidId, auth.node_id);
    return { success: true, bounty, data: bounty };
  });

  app.post('/:bountyId/submit', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { bountyId: string };
    const body = request.body as {
      content?: string;
      deliverable?: unknown;
      attachments?: string[];
      milestone_id?: string;
    };
    const content = body.content ?? (body.deliverable ? JSON.stringify(body.deliverable) : undefined);

    if (!content) {
      throw new EvoMapError('content or deliverable is required', 'VALIDATION_ERROR', 400);
    }

    const result = await service.submitDeliverable(
      params.bountyId,
      auth.node_id,
      content,
      body.attachments ?? [],
      body.milestone_id,
    );

    return { success: true, bounty: result, deliverable: result.deliverable ?? null, data: result };
  });

  app.post('/:bountyId/review', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { bountyId: string };
    const body = request.body as {
      accepted: boolean;
      comments?: string;
      milestone_id?: string;
    };

    if (body.accepted === undefined || body.accepted === null) {
      throw new EvoMapError('accepted is required', 'VALIDATION_ERROR', 400);
    }

    const bounty = await service.reviewDeliverable(
      params.bountyId,
      auth.node_id,
      body.accepted,
      body.comments,
      body.milestone_id,
    );

    return { success: true, bounty, data: bounty };
  });

  app.post('/:bountyId/cancel', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { bountyId: string };

    const bounty = await service.cancelBounty(params.bountyId, auth.node_id);
    return { success: true, bounty, data: bounty };
  });

  app.get('/', {
    schema: {
      tags: ['Bounty'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          creator_id: { type: 'string' },
          limit: { type: 'string' },
          offset: { type: 'string' },
        },
      },
    },
  }, sendBountyList);

  app.get('/list', {
    schema: {
      tags: ['Bounty'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          creator_id: { type: 'string' },
          limit: { type: 'string' },
          offset: { type: 'string' },
        },
      },
    },
  }, sendBountyList);

  app.get('/open', {
    schema: {
      tags: ['Bounty'],
    },
  }, async () => {
    const result = await service.listBounties({
      status: 'open',
      limit: 50,
      offset: 0,
    });

    const totalRewardPool = result.bounties.reduce((sum, bounty) => sum + bounty.amount, 0);

    return {
      success: true,
      bounties: result.bounties,
      total_open: result.total,
      total_reward_pool: totalRewardPool,
      data: {
        bounties: result.bounties,
        total_open: result.total,
        total_reward_pool: totalRewardPool,
      },
    };
  });

  app.get('/stats', {
    schema: {
      tags: ['Bounty'],
    },
  }, async () => {
    const [total, open, claimed, submitted, accepted, expired] = await Promise.all([
      service.listBounties({ limit: 1, offset: 0 }),
      service.listBounties({ status: 'open', limit: 1, offset: 0 }),
      service.listBounties({ status: 'claimed', limit: 1, offset: 0 }),
      service.listBounties({ status: 'submitted', limit: 1, offset: 0 }),
      service.listBounties({ status: 'accepted', limit: 1, offset: 0 }),
      service.listBounties({ status: 'expired', limit: 1, offset: 0 }),
    ]);

    return {
      success: true,
      total_bounties: total.total,
      open: open.total,
      in_progress: claimed.total + submitted.total,
      completed: accepted.total,
      expired: expired.total,
      data: {
        total_bounties: total.total,
        open: open.total,
        in_progress: claimed.total + submitted.total,
        completed: accepted.total,
        expired: expired.total,
      },
    };
  });

  app.get('/:bountyId', {
    schema: { tags: ['Bounty'] },
  }, async (request) => {
    const auth = await getOptionalAuth(request);
    const params = request.params as { bountyId: string };
    const bounty = await service.getBounty(params.bountyId, auth?.node_id ?? '');
    return { success: true, bounty, data: bounty };
  });

  app.get('/my', {
    schema: {
      tags: ['Bounty'],
    },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const query = request.query as { lang?: string };
    if (query.lang !== undefined) {
      throw new ValidationError('lang filter is not supported for bounty listings');
    }
    const result = await service.listBountiesByCreator(auth.node_id);
    return {
      success: true,
      bounties: result.bounties,
      total: result.total,
      data: result.bounties,
      meta: { total: result.total },
    };
  });

  app.post('/:bountyId/accept', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { bountyId: string };
    const body = request.body as {
      deliverable_id?: string;
      rating?: number;
      feedback?: string;
      comments?: string;
    };

    const bounty = await service.reviewDeliverable(
      params.bountyId,
      auth.node_id,
      true,
      body.feedback ?? body.comments,
    );

    const deliverable = bounty.deliverable as { worker_id?: string } | null;

    return {
      success: true,
      status: 'completed',
      reward_paid: bounty.amount,
      worker: deliverable?.worker_id ?? null,
      rating: body.rating ?? null,
      deliverable_id: body.deliverable_id ?? null,
      reputation_impact: '+5.0',
      data: {
        status: 'completed',
        reward_paid: bounty.amount,
        worker: deliverable?.worker_id ?? null,
        rating: body.rating ?? null,
        deliverable_id: body.deliverable_id ?? null,
        reputation_impact: '+5.0',
      },
    };
  });

  app.post('/:bountyId/claim', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, sendClaimedBounty);
}
