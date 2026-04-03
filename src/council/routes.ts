import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError } from '../shared/errors';
import * as service from './service';

export async function councilRoutes(app: FastifyInstance) {
  app.post('/proposal', {
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      title: string;
      description: string;
      category: string;
    };

    if (!body.title || !body.description || !body.category) {
      throw new EvoMapError('title, description, and category are required', 'VALIDATION_ERROR', 400);
    }

    const validCategories = [
      'parameter_change', 'asset_review', 'member_action',
      'budget_allocation', 'protocol_upgrade', 'dispute_resolution',
    ];
    if (!validCategories.includes(body.category)) {
      throw new EvoMapError(`category must be one of: ${validCategories.join(', ')}`, 'VALIDATION_ERROR', 400);
    }

    const proposal = await service.createProposal(
      auth.node_id,
      body.title,
      body.description,
      body.category as 'parameter_change' | 'asset_review' | 'member_action' | 'budget_allocation' | 'protocol_upgrade' | 'dispute_resolution',
    );

    void reply.status(201);
    return { success: true, data: proposal };
  });

  app.post('/proposal/:proposalId/second', {
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { proposalId: string };

    const proposal = await service.secondProposal(params.proposalId, auth.node_id);
    return { success: true, data: proposal };
  });

  app.post('/proposal/:proposalId/vote', {
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { proposalId: string };
    const body = request.body as {
      decision: 'approve' | 'reject' | 'abstain';
      reason?: string;
    };

    if (!body.decision || !['approve', 'reject', 'abstain'].includes(body.decision)) {
      throw new EvoMapError('decision must be approve, reject, or abstain', 'VALIDATION_ERROR', 400);
    }

    const vote = await service.vote(
      params.proposalId,
      auth.node_id,
      body.decision,
      body.reason,
    );

    return { success: true, data: vote };
  });

  app.post('/proposal/:proposalId/execute', {
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { proposalId: string };
    const result = await service.executeDecision(params.proposalId);
    return { success: true, data: result };
  });

  app.get('/proposals', {
    preHandler: [requireAuth()],
  }, async (request) => {
    const query = request.query as {
      status?: string;
      category?: string;
      limit?: string;
      offset?: string;
    };

    const result = await service.listProposals({
      status: query.status as 'draft' | 'seconded' | 'discussion' | 'voting' | 'approved' | 'rejected' | 'executed' | undefined,
      category: query.category as 'parameter_change' | 'asset_review' | 'member_action' | 'budget_allocation' | 'protocol_upgrade' | 'dispute_resolution' | undefined,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    });

    return {
      success: true,
      data: result.proposals,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
  });

  app.get('/proposal/:proposalId', {
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { proposalId: string };
    const proposal = await service.getProposal(params.proposalId);
    return { success: true, data: proposal };
  });

  app.get('/proposal/:proposalId/votes', {
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { proposalId: string };
    const votes = await service.getVotes(params.proposalId);
    return { success: true, data: votes };
  });
}
