import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError } from '../shared/errors';
import * as service from './service';

export async function bountyRoutes(app: FastifyInstance) {
  app.post('/', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      title: string;
      description: string;
      requirements: string[];
      amount: number;
      deadline: string;
    };

    if (!body.title || !body.description || !body.amount || !body.deadline) {
      throw new EvoMapError('title, description, amount, and deadline are required', 'VALIDATION_ERROR', 400);
    }

    const bounty = await service.createBounty(
      auth.node_id,
      body.title,
      body.description,
      body.requirements ?? [],
      body.amount,
      body.deadline,
    );

    void reply.status(201);
    return { success: true, data: bounty };
  });

  app.post('/:bountyId/bid', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { bountyId: string };
    const body = request.body as {
      proposedAmount: number;
      estimatedTime: string;
      approach: string;
    };

    if (!body.proposedAmount || !body.estimatedTime || !body.approach) {
      throw new EvoMapError('proposedAmount, estimatedTime, and approach are required', 'VALIDATION_ERROR', 400);
    }

    const bid = await service.placeBid(
      params.bountyId,
      auth.node_id,
      body.proposedAmount,
      body.estimatedTime,
      body.approach,
    );

    return { success: true, data: bid };
  });

  app.post('/:bountyId/accept-bid', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { bountyId: string };
    const body = request.body as { bidId: string };

    if (!body.bidId) {
      throw new EvoMapError('bidId is required', 'VALIDATION_ERROR', 400);
    }

    const bounty = await service.acceptBid(params.bountyId, body.bidId);
    return { success: true, data: bounty };
  });

  app.post('/:bountyId/submit', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { bountyId: string };
    const body = request.body as {
      content: string;
      attachments?: string[];
    };

    if (!body.content) {
      throw new EvoMapError('content is required', 'VALIDATION_ERROR', 400);
    }

    const result = await service.submitDeliverable(
      params.bountyId,
      auth.node_id,
      body.content,
      body.attachments ?? [],
    );

    return { success: true, data: result };
  });

  app.post('/:bountyId/review', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { bountyId: string };
    const body = request.body as {
      accepted: boolean;
      comments?: string;
    };

    if (body.accepted === undefined || body.accepted === null) {
      throw new EvoMapError('accepted is required', 'VALIDATION_ERROR', 400);
    }

    const bounty = await service.reviewDeliverable(
      params.bountyId,
      body.accepted,
      body.comments,
    );

    return { success: true, data: bounty };
  });

  app.post('/:bountyId/cancel', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { bountyId: string };

    const bounty = await service.cancelBounty(params.bountyId, auth.node_id);
    return { success: true, data: bounty };
  });

  app.get('/', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const query = request.query as {
      status?: string;
      limit?: string;
      offset?: string;
    };

    const result = await service.listBounties({
      status: query.status as 'open' | 'claimed' | 'submitted' | 'accepted' | 'disputed' | 'resolved' | 'expired' | 'cancelled' | undefined,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    });

    return {
      success: true,
      data: result.bounties,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
  });

  app.get('/:bountyId', {
    schema: { tags: ['Bounty'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { bountyId: string };
    const bounty = await service.getBounty(params.bountyId);
    return { success: true, data: bounty };
  });
}
