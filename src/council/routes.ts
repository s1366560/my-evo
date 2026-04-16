import type { FastifyInstance } from 'fastify';
import { requireAuth, requireTrustLevel } from '../shared/auth';
import {
  VOTING_PERIOD_H,
  QUORUM_PERCENTAGE,
} from '../shared/constants';
import { EvoMapError, ForbiddenError, ValidationError } from '../shared/errors';
import * as service from './service';
import * as disputeService from '../dispute/service';

function ensureCouncilResolutionAuth(auth: { auth_type?: string } | undefined): void {
  if (!auth) {
    throw new ForbiddenError('Authentication is required');
  }

  if (auth.auth_type !== 'node_secret') {
    throw new ForbiddenError('Council dispute resolution requires node secret authentication');
  }
}

function mapResolutionToVerdict(
  resolution: string,
): 'plaintiff_wins' | 'defendant_wins' | 'compromise' | 'no_fault' {
  switch (resolution) {
    case 'defendant_penalized':
      return 'plaintiff_wins';
    case 'plaintiff_denied':
      return 'defendant_wins';
    case 'compromise':
      return 'compromise';
    case 'dismissed':
    case 'no_fault':
      return 'no_fault';
    default:
      throw new ValidationError(
        'resolution must be one of defendant_penalized, plaintiff_denied, compromise, dismissed, no_fault',
      );
  }
}

function buildExecutedActions(
  penalty: {
    reputation_deduction?: number;
    credit_fine?: number;
    quarantine_level?: string;
  } | undefined,
  compensation: {
    recipient?: string;
    credit_amount?: number;
    reputation_restore?: number;
  } | undefined,
): string[] {
  const actions: string[] = [];

  if ((penalty?.reputation_deduction ?? 0) > 0) {
    actions.push(`reputation_deducted: -${penalty!.reputation_deduction}`);
  }
  if ((penalty?.credit_fine ?? 0) > 0) {
    actions.push(`credits_fined: -${penalty!.credit_fine}`);
  }
  if (penalty?.quarantine_level) {
    const duration = penalty.quarantine_level === 'L1'
      ? '24h'
      : penalty.quarantine_level === 'L2'
        ? '7d'
        : '30d';
    actions.push(`quarantine_applied: ${penalty.quarantine_level} (${duration})`);
  }
  if ((compensation?.credit_amount ?? 0) > 0 && compensation?.recipient) {
    actions.push(
      `compensation_paid: +${compensation.credit_amount} credits to ${compensation.recipient}`,
    );
  }
  if ((compensation?.reputation_restore ?? 0) > 0 && compensation?.recipient) {
    actions.push(
      `reputation_restored: +${compensation.reputation_restore} to ${compensation.recipient}`,
    );
  }

  return actions;
}

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
    return { success: true, proposal, data: proposal };
  });

  app.post('/proposal/:proposalId/second', {
    schema: { tags: ['Council'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { proposalId: string };

    const proposal = await service.secondProposal(params.proposalId, auth.node_id);
    return { success: true, proposal, data: proposal };
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

    return { success: true, vote, data: vote };
  });

  app.post('/vote', {
    schema: { tags: ['Council'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const body = request.body as {
      proposal_id: string;
      vote: 'approve' | 'reject' | 'abstain';
      decision?: 'approve' | 'reject' | 'abstain';
      reason?: string;
    };
    const decision = body.decision ?? body.vote;

    if (!body.proposal_id) {
      throw new ValidationError('proposal_id is required');
    }
    if (!decision || !['approve', 'reject', 'abstain'].includes(decision)) {
      throw new ValidationError('vote must be approve, reject, or abstain');
    }

    const vote = await service.vote(body.proposal_id, auth.node_id, decision, body.reason);
    return { success: true, vote, data: vote };
  });

  app.post('/proposal/:proposalId/execute', {
    schema: { tags: ['Council'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { proposalId: string };
    const result = await service.executeDecision(params.proposalId);
    return { success: true, result, data: result };
  });

  app.post('/execute', {
    schema: { tags: ['Council'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const body = request.body as { proposal_id: string };
    if (!body.proposal_id) {
      throw new ValidationError('proposal_id is required');
    }
    const result = await service.executeDecision(body.proposal_id);
    return { success: true, result, data: result };
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
      proposals: result.proposals,
      total: result.total,
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
    return { success: true, proposal, data: proposal };
  });

  app.get('/proposal/:proposalId/votes', {
    schema: { tags: ['Council'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { proposalId: string };
    const votes = await service.getVotes(params.proposalId);
    return { success: true, votes, total: votes.length, data: votes };
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

    const deliberation = await service.generateDialogResponse({
      proposal_id: body.proposal_id,
      speaker_id: auth.node_id,
      message: body.message,
      context: body.context,
    });

    return { success: true, dialogue: deliberation, data: deliberation };
  });

  app.get('/config', {
    schema: { tags: ['Council'] },
  }, async () => ({
    success: true,
    config: {
      voting_period_hours: VOTING_PERIOD_H,
      min_quorum_pct: QUORUM_PERCENTAGE,
      min_approval_pct: 60,
      max_council_members: 9,
      min_gdi_to_vote: 80,
    },
    data: {
      voting_period_hours: VOTING_PERIOD_H,
      min_quorum_pct: QUORUM_PERCENTAGE,
      min_approval_pct: 60,
      max_council_members: 9,
      min_gdi_to_vote: 80,
    },
  }));

  app.post('/resolve-dispute', {
    schema: { tags: ['Council'] },
    preHandler: [requireTrustLevel('trusted')],
  }, async (request) => {
    ensureCouncilResolutionAuth(request.auth);
    const auth = request.auth!;
    const body = request.body as {
      dispute_id?: string;
      resolution?: string;
      reasoning?: string;
      penalty?: {
        target_node_id?: string;
        reputation_deduction?: number;
        credit_fine?: number;
        quarantine_level?: string;
      };
      compensation?: {
        recipient?: string;
        recipient_node_id?: string;
        credit_amount?: number;
        reputation_restore?: number;
      };
    };

    if (!body.dispute_id) {
      throw new ValidationError('dispute_id is required');
    }
    if (!body.resolution) {
      throw new ValidationError('resolution is required');
    }
    if (!body.reasoning) {
      throw new ValidationError('reasoning is required');
    }

    const dispute = await prisma.dispute.findUnique({
      where: { dispute_id: body.dispute_id },
      select: {
        dispute_id: true,
        plaintiff_id: true,
        defendant_id: true,
      },
    });

    if (!dispute) {
      throw new ValidationError('Dispute not found');
    }

    const compensationRecipient = body.compensation?.recipient_node_id
      ?? body.compensation?.recipient
      ?? dispute.plaintiff_id;
    const penaltyTarget = body.penalty?.target_node_id ?? dispute.defendant_id;
    const verdict = mapResolutionToVerdict(body.resolution);
    const ruling = {
      ruling_id: `council-${body.dispute_id}`,
      dispute_id: body.dispute_id,
      verdict,
      reasoning: body.reasoning,
      penalties: body.penalty
        ? [{
          target_node_id: penaltyTarget,
          reputation_deduction: body.penalty.reputation_deduction ?? 0,
          credit_fine: body.penalty.credit_fine ?? 0,
          quarantine_level: body.penalty.quarantine_level,
        }]
        : [],
      compensations: body.compensation
        ? [{
          recipient_node_id: compensationRecipient,
          credit_amount: body.compensation.credit_amount ?? 0,
          reputation_restore: body.compensation.reputation_restore ?? 0,
        }]
        : [],
      votes: [{
        arbitrator_id: auth.node_id,
        vote: verdict === 'plaintiff_wins'
          ? 'plaintiff'
          : verdict === 'defendant_wins'
            ? 'defendant'
            : verdict === 'compromise'
              ? 'compromise'
              : 'abstain',
        reasoning: body.reasoning,
      }],
      ruled_at: new Date().toISOString(),
      appeal_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    await disputeService.resolveEscalatedDispute(
      body.dispute_id,
      ruling,
      auth.node_id,
    );

    return {
      success: true,
      status: 'ok',
      dispute_id: body.dispute_id,
      resolution: body.resolution,
      executed_actions: buildExecutedActions(
        body.penalty,
        {
          recipient: compensationRecipient,
          credit_amount: body.compensation?.credit_amount,
          reputation_restore: body.compensation?.reputation_restore,
        },
      ),
    };
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

    return {
      success: true,
      proposals,
      total,
      data: proposals,
      meta: { total, limit, offset },
    };
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
      term: {
        term_id: `term-${new Date().getFullYear()}-q${Math.ceil((new Date().getMonth() + 1) / 3)}`,
        started_at: latestVoting?.created_at ?? new Date().toISOString(),
        ends_at: latestVoting?.voting_deadline ?? null,
        active_proposals: latestVoting ? 1 : 0,
        current_status: latestVoting?.status ?? 'no_active_term',
      },
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

    return {
      success: true,
      terms,
      total: Object.keys(termMap).length,
      data: terms,
      meta: { total: Object.keys(termMap).length },
    };
  });

  // GET /a2a/council/:id — proposal detail by ID (alias)
  app.get('/:proposalId', {
    schema: { tags: ['Council'] },
  }, async (request) => {
    const params = request.params as { proposalId: string };
    const proposal = await service.getProposal(params.proposalId);
    return { success: true, proposal, data: proposal };
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
