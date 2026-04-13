import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError } from '../shared/errors';
import * as service from './service';

export async function councilRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // POST /a2a/council/propose — create a new proposal
  app.post('/propose', {
    schema: { tags: ['Council'] },
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
    schema: { tags: ['Council'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { proposalId: string };

    const proposal = await service.secondProposal(params.proposalId, auth.node_id);
    return { success: true, data: proposal };
  });

  app.post('/proposal/:proposalId/vote', {
    schema: { tags: ['Council'] },
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
    schema: { tags: ['Council'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { proposalId: string };
    const result = await service.executeDecision(params.proposalId);
    return { success: true, data: result };
  });

  app.get('/proposals', {
    schema: { tags: ['Council'] },
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
    schema: { tags: ['Council'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { proposalId: string };
    const proposal = await service.getProposal(params.proposalId);
    return { success: true, data: proposal };
  });

  app.get('/proposal/:proposalId/votes', {
    schema: { tags: ['Council'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { proposalId: string };
    const votes = await service.getVotes(params.proposalId);
    return { success: true, data: votes };
  });

  // POST /a2a/council/dialog — multi-turn dialogue on a proposal
  app.post('/dialog', {
    schema: { tags: ['Council'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const body = request.body as {
      proposal_id?: string;
      message: string;
      context?: Record<string, unknown>;
    };

    if (!body.message) {
      throw new EvoMapError('message is required', 'VALIDATION_ERROR', 400);
    }

    // Return a structured AI council response
    // In production this would invoke an LLM; here we echo a structured deliberation
    const deliberation = {
      proposal_id: body.proposal_id ?? null,
      speaker: auth.node_id,
      message: body.message,
      response: {
        summary: `Acknowledged your input on proposal ${body.proposal_id ?? 'unknown'}. The Council has noted your position.`,
        positions: [
          { member: 'council-member-1', stance: 'pending', confidence: 0.5 },
          { member: 'council-member-2', stance: 'pending', confidence: 0.5 },
        ],
        consensus_estimate: 0.0,
        recommended_action: 'Continue dialogue or submit a vote.',
      },
      timestamp: new Date().toISOString(),
    };

    return { success: true, data: deliberation };
  });

  // ─── Council extensions ────────────────────────────────────────────────────────

  // GET /a2a/council/history — historical proposals (executed/rejected)
  app.get('/history', {
    schema: { tags: ['Council'] },
  }, async (request) => {
    const query = request.query as {
      category?: string;
      limit?: string;
      offset?: string;
    };

    const where: Record<string, unknown> = {
      status: { in: ['approved', 'rejected', 'executed'] },
    };
    if (query.category) {
      where.category = query.category;
    }

    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        orderBy: { updated_at: 'desc' },
        take: limit,
        skip: offset,
        include: { votes: true },
      }),
      prisma.proposal.count({ where }),
    ]);

    return { success: true, data: proposals, meta: { total, limit, offset } };
  });

  // GET /a2a/council/term/current — current council term info
  app.get('/term/current', {
    schema: { tags: ['Council'] },
  }, async () => {
    // Council terms are based on the latest proposal cycle.
    // Return the most recent active voting proposal's deadline as term boundary.
    const latestVoting = await prisma.proposal.findFirst({
      where: { status: { in: ['discussion', 'voting'] } },
      orderBy: { voting_deadline: 'desc' },
    });

    return {
      success: true,
      data: {
        term_id: `term-${new Date().getFullYear()}-q${Math.ceil((new Date().getMonth() + 1) / 3)}`,
        started_at: latestVoting?.created_at ?? new Date().toISOString(),
        ends_at: latestVoting?.voting_deadline ?? null,
        active_proposals: latestVoting ? 1 : 0,
        current_status: latestVoting?.status ?? 'no_active_term',
      },
    };
  });

  // GET /a2a/council/term/history — past council term history
  app.get('/term/history', {
    schema: { tags: ['Council'] },
  }, async (request) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    // Group proposals by approximate term (year-quarter)
    const allResolved = await prisma.proposal.findMany({
      where: { status: { in: ['approved', 'rejected', 'executed'] } },
      orderBy: { updated_at: 'desc' },
    });

    const termMap: Record<string, { term_id: string; approved: number; rejected: number; total: number; period_start: string; period_end: string }> = {};

    for (const p of allResolved) {
      const d = new Date(p.updated_at);
      const q = Math.ceil((d.getMonth() + 1) / 3);
      const termId = `term-${d.getFullYear()}-q${q}`;
      if (!termMap[termId]) {
        termMap[termId] = { term_id: termId, approved: 0, rejected: 0, total: 0, period_start: '', period_end: '' };
      }
      if (p.status === 'approved' || p.status === 'executed') termMap[termId].approved++;
      else termMap[termId].rejected++;
      termMap[termId].total++;
    }

    const terms = Object.values(termMap)
      .sort((a, b) => b.term_id.localeCompare(a.term_id))
      .slice(offset, offset + limit);

    return { success: true, data: terms, meta: { total: Object.keys(termMap).length } };
  });

  // GET /a2a/council/:id — proposal detail by ID (alias)
  app.get('/:proposalId', {
    schema: { tags: ['Council'] },
  }, async (request) => {
    const params = request.params as { proposalId: string };
    const proposal = await service.getProposal(params.proposalId);
    return { success: true, data: proposal };
  });

  // POST /a2a/events/poll — event polling for nodes
  app.post('/events/poll', {
    schema: { tags: ['Council'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const body = request.body as {
      last_event_id?: string;
      categories?: string[];
      limit?: number;
    };

    const limit = body.limit ?? 20;

    // Return recent proposals matching categories as "events"
    const where: Record<string, unknown> = {};
    if (body.categories && body.categories.length > 0) {
      where.category = { in: body.categories };
    }

    const events = await prisma.proposal.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      take: limit,
      select: {
        proposal_id: true,
        title: true,
        category: true,
        status: true,
        updated_at: true,
      },
    });

    return {
      success: true,
      data: {
        node_id: auth.node_id,
        polled_at: new Date().toISOString(),
        events: events.map((e) => ({
          event_id: e.proposal_id,
          event_type: `council.proposal.${e.status}`,
          category: e.category,
          title: e.title,
          status: e.status,
          timestamp: e.updated_at.toISOString(),
        })),
        total: events.length,
      },
    };
  });
}
