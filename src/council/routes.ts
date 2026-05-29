/**
 * Council Module Routes
 * AI governance council — proposal submission, voting, and results.
 *
 * Route Prefix: /a2a/council
 * Frontend contract (see frontend/src/lib/api/endpoints.ts):
 *   GET  /a2a/council/history                      → list proposals
 *   GET  /a2a/council/proposal/:proposalId          → proposal details
 *   POST /a2a/council/proposal                      → create proposal
 *   POST /a2a/council/proposal/:proposalId/vote     → cast vote
 *   POST /a2a/council/proposal/:proposalId/second   → second proposal
 *   POST /a2a/council/proposal/:proposalId/activate → activate for voting
 *   POST /a2a/council/proposal/:proposalId/finalize → tally & finalize
 *   POST /a2a/council/proposal/:proposalId/cancel   → cancel draft
 */

import type { FastifyInstance } from 'fastify';
import { requireNodeSecretAuth } from '../shared/auth';
import { ValidationError, NotFoundError } from '../shared/errors';
import * as councilService from './service';
import type { ProposalStatus, ProposalCategory } from './types';

// ============================================================
// Helpers
// ============================================================

function ensureNodeSecretAuth(
  auth: NonNullable<import('fastify').FastifyRequest['auth']>,
): void {
  if (auth.auth_type !== 'node_secret') {
    throw new ValidationError('Node secret credentials are required');
  }
  if (!auth.node_id) {
    throw new ValidationError('Node ID not found in authentication context');
  }
}

const VALID_STATUSES: ProposalStatus[] = [
  'draft', 'active', 'passed', 'rejected', 'executed', 'cancelled',
];

const VALID_CATEGORIES: ProposalCategory[] = [
  'protocol', 'parameter', 'treasury', 'upgrade', 'governance', 'emergency',
];

// ============================================================
// Routes
// ============================================================

export async function councilRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /a2a/council/history ─────────────────────────────
  app.get<{
    Querystring: { status?: string; limit?: string; offset?: string };
  }>('/history', {
    schema: {
      tags: ['Council'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          limit: { type: 'string' },
          offset: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { status, limit, offset } = request.query;
    const statusFilter = status && VALID_STATUSES.includes(status as ProposalStatus)
      ? (status as ProposalStatus)
      : undefined;

    const result = await councilService.listProposals(app.prisma, {
      status: statusFilter,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    void reply.send({
      success: true,
      proposals: result.proposals,
      meta: {
        total: result.total,
        limit: parseInt(limit ?? '50', 10),
        offset: parseInt(offset ?? '0', 10),
      },
    });
  });

  // ── GET /a2a/council/proposal/:proposalId ────────────────
  app.get<{ Params: { proposalId: string } }>(
    '/proposal/:proposalId',
    {
      schema: {
        tags: ['Council'],
        params: {
          type: 'object',
          properties: { proposalId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { proposalId } = request.params;
      const proposal = await councilService.getProposal(app.prisma, proposalId);

      if (!proposal) {
        void reply.status(404).send({
          success: false,
          error: 'NOT_FOUND',
          message: `Proposal '${proposalId}' not found`,
        });
        return;
      }

      void reply.send({ success: true, proposal, votes: proposal.votes });
    },
  );

  // ── POST /a2a/council/proposal ───────────────────────────
  app.post('/proposal', {
    schema: {
      tags: ['Council'],
      body: {
        type: 'object',
        required: ['title', 'description', 'category'],
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 200 },
          description: { type: 'string', minLength: 10, maxLength: 5000 },
          category: { type: 'string' },
          content: { type: 'string' },
          discussion_deadline: { type: 'string' },
          voting_deadline: { type: 'string' },
        },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const body = request.body as {
      title: string;
      description: string;
      category: string;
      content?: string;
      discussion_deadline?: string;
      voting_deadline?: string;
    };

    if (!VALID_CATEGORIES.includes(body.category as ProposalCategory)) {
      void reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: `Invalid category. Valid: ${VALID_CATEGORIES.join(', ')}`,
      });
      return;
    }

    try {
      const proposal = await councilService.createProposal(app.prisma, {
        proposer_id: auth.node_id!,
        title: body.title,
        description: body.description,
        category: body.category as ProposalCategory,
        content: body.content,
        discussion_deadline: body.discussion_deadline
          ? new Date(body.discussion_deadline)
          : undefined,
        voting_deadline: body.voting_deadline
          ? new Date(body.voting_deadline)
          : undefined,
      });

      void reply.status(201).send({
        success: true,
        proposal,
        message: 'Proposal created in draft status',
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        void reply.status(error.statusCode).send({
          success: false,
          error: error.code,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  });

  // ── POST /a2a/council/proposal/:proposalId/vote ──────────
  app.post<{ Params: { proposalId: string } }>('/proposal/:proposalId/vote', {
    schema: {
      tags: ['Council'],
      params: {
        type: 'object',
        properties: { proposalId: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['vote'],
        properties: {
          vote: { type: 'string', enum: ['approve', 'reject', 'abstain'] },
          reason: { type: 'string' },
        },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const { proposalId } = request.params;
    const body = request.body as { vote: string; reason?: string };

    try {
      const vote = await councilService.castVote(app.prisma, {
        voter_id: auth.node_id!,
        proposal_id: proposalId,
        decision: body.vote as 'approve' | 'reject' | 'abstain',
        reason: body.reason,
      });

      void reply.send({
        success: true,
        vote,
        message: 'Vote cast successfully',
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        void reply.status(error.statusCode).send({
          success: false,
          error: error.code,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  });

  // ── POST /a2a/council/proposal/:proposalId/second ────────
  app.post<{ Params: { proposalId: string } }>('/proposal/:proposalId/second', {
    schema: {
      tags: ['Council'],
      params: {
        type: 'object',
        properties: { proposalId: { type: 'string' } },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    try {
      const result = await councilService.secondProposal(
        app.prisma,
        request.params.proposalId,
        auth.node_id!,
      );
      void reply.send({ ...result, message: 'Proposal seconded' });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        void reply.status(error.statusCode).send({
          success: false,
          error: error.code,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  });

  // ── POST /a2a/council/proposal/:proposalId/activate ──────
  app.post<{ Params: { proposalId: string }}>('/proposal/:proposalId/activate', {
    schema: {
      tags: ['Council'],
      params: {
        type: 'object',
        properties: { proposalId: { type: 'string' } },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    try {
      const proposal = await councilService.activateProposal(
        app.prisma,
        request.params.proposalId,
        auth.node_id!,
      );
      void reply.send({
        success: true,
        proposal,
        message: 'Proposal activated for voting',
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        void reply.status(error.statusCode).send({
          success: false,
          error: error.code,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  });

  // ── POST /a2a/council/proposal/:proposalId/finalize ──────
  app.post<{ Params: { proposalId: string } }>('/proposal/:proposalId/finalize', {
    schema: {
      tags: ['Council'],
      params: {
        type: 'object',
        properties: { proposalId: { type: 'string' } },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    try {
      const proposal = await councilService.finalizeProposal(
        app.prisma,
        request.params.proposalId,
      );
      void reply.send({
        success: true,
        proposal,
        message: `Proposal finalized: ${proposal.status}`,
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        void reply.status(error.statusCode).send({
          success: false,
          error: error.code,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  });

  // ── POST /a2a/council/proposal/:proposalId/cancel ────────
  app.post<{ Params: { proposalId: string } }>('/proposal/:proposalId/cancel', {
    schema: {
      tags: ['Council'],
      params: {
        type: 'object',
        properties: { proposalId: { type: 'string' } },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    try {
      const proposal = await councilService.cancelProposal(
        app.prisma,
        request.params.proposalId,
        auth.node_id!,
      );
      void reply.send({
        success: true,
        proposal,
        message: 'Proposal cancelled, deposit refunded',
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        void reply.status(error.statusCode).send({
          success: false,
          error: error.code,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  });
}
