import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError } from '../shared/errors';
import * as service from './service';

function mapBountySummary(bounty: {
  bounty_id: string;
  title: string;
  amount: number;
  status: string;
  deadline: Date;
}, bidCount = 0) {
  return {
    bounty_id: bounty.bounty_id,
    title: bounty.title,
    reward: bounty.amount,
    status: bounty.status,
    bid_count: bidCount,
    deadline: bounty.deadline,
  };
}

export async function bountyCompatibilityRoutes(app: FastifyInstance): Promise<void> {
  app.post('/create', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = (request.body as {
      title?: string;
      description?: string;
      reward?: number;
      required_signals?: string[];
      acceptance_criteria?: string;
      deadline?: string;
    } | undefined) ?? {};

    if (!body.title || !body.description || !body.reward || !body.deadline) {
      throw new EvoMapError('title, description, reward, and deadline are required', 'VALIDATION_ERROR', 400);
    }

    const requirements = [...(body.required_signals ?? [])];
    if (body.acceptance_criteria) {
      requirements.push(`Acceptance criteria: ${body.acceptance_criteria}`);
    }

    const bounty = await service.createBounty(
      auth.node_id,
      body.title,
      body.description,
      requirements,
      body.reward,
      body.deadline,
    );

    return {
      bounty_id: bounty.bounty_id,
      status: bounty.status,
      reward: bounty.amount,
      created_at: bounty.created_at,
    };
  });

  app.get('/list', {
    schema: { tags: ['Bounty'] },
  }, async (request) => {
    const query = request.query as { status?: string; sort?: string; limit?: string; offset?: string };
    const requestedLimit = query.limit ? parseInt(query.limit, 10) : 20;
    const requestedOffset = query.offset ? parseInt(query.offset, 10) : 0;
    const result = await service.listBounties({
      status: query.status as 'open' | 'claimed' | 'submitted' | 'accepted' | 'disputed' | 'resolved' | 'expired' | 'cancelled' | undefined,
      sort: query.sort === 'reward_desc' || query.sort === 'reward_asc' ? query.sort : undefined,
      limit: requestedLimit,
      offset: requestedOffset,
    });
    const bidCounts = await service.getBountyBidCounts(result.bounties.map((bounty) => bounty.bounty_id));

    return {
      bounties: result.bounties.map((bounty) => mapBountySummary(bounty, bidCounts.get(bounty.bounty_id) ?? 0)),
      total: result.total,
    };
  });

  app.get('/open', {
    schema: { tags: ['Bounty'] },
  }, async () => {
    const result = await service.listBounties({ status: 'open', limit: 50, offset: 0 });
    const bidCounts = await service.getBountyBidCounts(result.bounties.map((bounty) => bounty.bounty_id));
    return {
      bounties: result.bounties.map((bounty) => mapBountySummary(bounty, bidCounts.get(bounty.bounty_id) ?? 0)),
      total_open: result.total,
      total_reward_pool: result.bounties.reduce((sum, bounty) => sum + bounty.amount, 0),
    };
  });

  app.get('/stats', {
    schema: { tags: ['Bounty'] },
  }, async () => {
    const [total, open, claimed, submitted, accepted, expired] = await Promise.all([
      service.listBounties({ limit: 1, offset: 0 }),
      service.listBounties({ status: 'open', limit: 1, offset: 0 }),
      service.listBounties({ status: 'claimed', limit: 1, offset: 0 }),
      service.listBounties({ status: 'submitted', limit: 1, offset: 0 }),
      service.listBounties({ status: 'accepted', limit: 1000, offset: 0 }),
      service.listBounties({ status: 'expired', limit: 1, offset: 0 }),
    ]);

    const completedWithTiming = accepted.bounties.filter((bounty) => bounty.completed_at);
    const avgCompletionTimeDays = completedWithTiming.length === 0
      ? 0
      : Number((completedWithTiming.reduce((sum, bounty) => {
          const completedAt = bounty.completed_at ? new Date(bounty.completed_at).getTime() : new Date(bounty.created_at).getTime();
          return sum + ((completedAt - new Date(bounty.created_at).getTime()) / (1000 * 60 * 60 * 24));
        }, 0) / completedWithTiming.length).toFixed(1));

    return {
      total_bounties: total.total,
      open: open.total,
      in_progress: claimed.total + submitted.total,
      completed: accepted.total,
      expired: expired.total,
      total_reward_paid: accepted.bounties.reduce((sum, bounty) => sum + bounty.amount, 0),
      avg_completion_time_days: avgCompletionTimeDays,
    };
  });

  app.get('/:bountyId', {
    schema: { tags: ['Bounty'] },
  }, async (request) => {
    const { bountyId } = request.params as { bountyId: string };
    const bounty = await service.getBounty(bountyId, '');
    return {
      ...bounty,
      reward: bounty.amount,
    };
  });

  app.post('/:bountyId/bid', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const { bountyId } = request.params as { bountyId: string };
    const body = (request.body as {
      proposed_price?: number;
      estimated_time?: string;
      approach?: string;
    } | undefined) ?? {};

    if (!body.proposed_price || !body.estimated_time || !body.approach) {
      throw new EvoMapError('proposed_price, estimated_time, and approach are required', 'VALIDATION_ERROR', 400);
    }

    const bid = await service.placeBid(
      bountyId,
      auth.node_id,
      body.proposed_price,
      body.estimated_time,
      body.approach,
    );

    return {
      bid_id: bid.bid_id,
      status: 'submitted',
      bounty_id: bid.bounty_id,
    };
  });

  app.post('/:bountyId/claim', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const { bountyId } = request.params as { bountyId: string };
    const body = (request.body as { bid_id?: string } | undefined) ?? {};

    if (!body.bid_id) {
      throw new EvoMapError('bid_id is required', 'VALIDATION_ERROR', 400);
    }

    const bounty = await service.acceptBid(bountyId, body.bid_id, auth.node_id);
    const acceptedBid = bounty.bids.find((bid) => bid.status === 'accepted');

    return {
      status: 'claimed',
      bounty_id: bounty.bounty_id,
      worker_id: acceptedBid?.bidder_id ?? null,
      deadline: bounty.deadline,
    };
  });

  app.post('/:bountyId/submit', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const { bountyId } = request.params as { bountyId: string };
    const body = (request.body as { deliverable?: unknown } | undefined) ?? {};

    if (!body.deliverable) {
      throw new EvoMapError('deliverable is required', 'VALIDATION_ERROR', 400);
    }

    const result = await service.submitDeliverable(
      bountyId,
      auth.node_id,
      JSON.stringify(body.deliverable),
      [],
    );

    return {
      status: 'submitted',
      deliverable_id: result.deliverable.deliverable_id,
      awaiting_review: true,
    };
  });

  app.post('/:bountyId/accept', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const { bountyId } = request.params as { bountyId: string };
    const body = (request.body as {
      deliverable_id?: string;
      feedback?: string;
      rating?: number;
    } | undefined) ?? {};

    if (!body.deliverable_id) {
      throw new EvoMapError('deliverable_id is required', 'VALIDATION_ERROR', 400);
    }

    const current = await service.getBounty(bountyId, auth.node_id);
    const currentDeliverable = current.deliverable as { deliverable_id?: string; worker_id?: string } | null;
    if (!currentDeliverable || currentDeliverable.deliverable_id !== body.deliverable_id) {
      throw new EvoMapError('deliverable_id does not match the current bounty deliverable', 'VALIDATION_ERROR', 400);
    }

    const bounty = await service.reviewDeliverable(
      bountyId,
      auth.node_id,
      true,
      body.feedback,
    );
    const acceptedDeliverable = bounty.deliverable as { worker_id?: string } | null;

    return {
      status: 'completed',
      reward_paid: bounty.amount,
      worker: acceptedDeliverable?.worker_id ?? null,
      reputation_impact: '+5.0',
      rating: body.rating ?? null,
    };
  });
}
