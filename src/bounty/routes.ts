/**
 * Bounty Module Routes
 * Task and reward system endpoints
 */

import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as bountyService from './service';
import type {
  CreateBountyRequest,
  UpdateBountyRequest,
  BountyFilters,
  CreateBidRequest,
  UpdateBidStatusRequest,
  UpdateMilestoneStatusRequest,
} from './types';

export async function bountyRoutes(app: FastifyInstance): Promise<void> {
  // ── Public / Authenticated: List bounties ────────────────────────────────
  app.get('/', {
    schema: {
      tags: ['Bounty'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          min_amount: { type: 'number' },
          max_amount: { type: 'number' },
          creator_id: { type: 'string' },
          limit: { type: 'number', default: 20 },
          offset: { type: 'number', default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const filters = request.query as BountyFilters;
    const result = await bountyService.listBounties(app.prisma, filters);
    return reply.send(result);
  });

  // ── Public: Bounty stats ─────────────────────────────────────────────────
  app.get('/stats', {
    schema: { tags: ['Bounty'] },
  }, async (_request, reply) => {
    const result = await bountyService.getBountyStats(app.prisma);
    return reply.send(result);
  });

  // ── Public: Get single bounty ────────────────────────────────────────────
  app.get<{ Params: { bountyId: string } }>('/:bountyId', {
    schema: {
      tags: ['Bounty'],
      params: {
        type: 'object',
        required: ['bountyId'],
        properties: { bountyId: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { bountyId } = request.params;
    const result = await bountyService.getBountyById(app.prisma, bountyId);
    if (!result) return reply.status(404).send({ success: false, error: 'Bounty not found' });
    return reply.send(result);
  });

  // ── Public: List bids for a bounty ──────────────────────────────────────
  app.get<{ Params: { bountyId: string } }>('/:bountyId/bids', {
    schema: {
      tags: ['Bounty'],
      params: {
        type: 'object',
        required: ['bountyId'],
        properties: { bountyId: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { bountyId } = request.params;
    const result = await bountyService.getBidsForBounty(app.prisma, bountyId);
    return reply.send(result);
  });

  // ── Authenticated: Create bounty ─────────────────────────────────────────
  app.post('/', {
    schema: {
      tags: ['Bounty'],
      body: {
        type: 'object',
        required: ['title', 'description', 'requirements', 'amount', 'deadline'],
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 200 },
          description: { type: 'string', minLength: 10 },
          requirements: { type: 'array', items: { type: 'string' }, minItems: 1 },
          amount: { type: 'number', minimum: 1 },
          deadline: { type: 'string', format: 'date-time' },
          milestones: {
            type: 'array',
            items: {
              type: 'object',
              required: ['title', 'description', 'percentage'],
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                percentage: { type: 'number', minimum: 1, maximum: 100 },
              },
            },
          },
        },
      },
    },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    if (!auth.userId) return reply.status(401).send({ success: false, error: 'Authentication required' });
    const req = request.body as CreateBountyRequest;
    const result = await bountyService.createBounty(app.prisma, auth.userId, req);
    return reply.status(201).send(result);
  });

  // ── Authenticated: Update bounty ─────────────────────────────────────────
  app.patch<{ Params: { bountyId: string } }>('/:bountyId', {
    schema: {
      tags: ['Bounty'],
      params: {
        type: 'object',
        required: ['bountyId'],
        properties: { bountyId: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 200 },
          description: { type: 'string', minLength: 10 },
          requirements: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['open', 'in_progress', 'completed', 'cancelled'] },
          winner_id: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    if (!auth.userId) return reply.status(401).send({ success: false, error: 'Authentication required' });
    const { bountyId } = request.params;
    const req = request.body as UpdateBountyRequest;
    const result = await bountyService.updateBounty(app.prisma, bountyId, auth.userId, req);
    if (!result) return reply.status(404).send({ success: false, error: 'Bounty not found or access denied' });
    return reply.send(result);
  });

  // ── Authenticated: Delete bounty ─────────────────────────────────────────
  app.delete<{ Params: { bountyId: string } }>('/:bountyId', {
    schema: {
      tags: ['Bounty'],
      params: {
        type: 'object',
        required: ['bountyId'],
        properties: { bountyId: { type: 'string' } },
      },
    },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    if (!auth.userId) return reply.status(401).send({ success: false, error: 'Authentication required' });
    const { bountyId } = request.params;
    const deleted = await bountyService.deleteBounty(app.prisma, bountyId, auth.userId);
    if (!deleted) return reply.status(404).send({ success: false, error: 'Bounty not found or access denied' });
    return reply.status(204).send();
  });

  // ── Authenticated: Submit bid ─────────────────────────────────────────────
  app.post<{ Params: { bountyId: string } }>('/:bountyId/bids', {
    schema: {
      tags: ['Bounty'],
      params: {
        type: 'object',
        required: ['bountyId'],
        properties: { bountyId: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['proposed_amount', 'estimated_time', 'approach'],
        properties: {
          proposed_amount: { type: 'number', minimum: 1 },
          estimated_time: { type: 'string' },
          approach: { type: 'string', minLength: 10 },
        },
      },
    },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    if (!auth.userId) return reply.status(401).send({ success: false, error: 'Authentication required' });
    const { bountyId } = request.params;
    const req = request.body as CreateBidRequest;
    const result = await bountyService.createBid(app.prisma, bountyId, auth.userId, req);
    if (!result) return reply.status(400).send({ success: false, error: 'Cannot place bid: bounty not found, closed, or already bid' });
    return reply.status(201).send(result);
  });

  // ── Authenticated: Update bid status (creator only) ──────────────────────
  app.patch<{ Params: { bountyId: string; bidId: string } }>('/:bountyId/bids/:bidId', {
    schema: {
      tags: ['Bounty'],
      params: {
        type: 'object',
        required: ['bountyId', 'bidId'],
        properties: { bountyId: { type: 'string' }, bidId: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['pending', 'accepted', 'rejected', 'withdrawn'] },
        },
      },
    },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    if (!auth.userId) return reply.status(401).send({ success: false, error: 'Authentication required' });
    const { bountyId, bidId } = request.params;
    const { status } = request.body as UpdateBidStatusRequest;
    const updated = await bountyService.updateBidStatus(app.prisma, bountyId, bidId, auth.userId, status);
    if (!updated) return reply.status(404).send({ success: false, error: 'Bounty not found or not the creator' });
    return reply.send({ success: true });
  });

  // ── Authenticated: Update milestone ───────────────────────────────────────
  app.patch<{ Params: { bountyId: string; milestoneId: string } }>('/:bountyId/milestones/:milestoneId', {
    schema: {
      tags: ['Bounty'],
      params: {
        type: 'object',
        required: ['bountyId', 'milestoneId'],
        properties: { bountyId: { type: 'string' }, milestoneId: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['pending', 'in_progress', 'submitted', 'approved', 'rejected'] },
          deliverable: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    if (!auth.userId) return reply.status(401).send({ success: false, error: 'Authentication required' });
    const { bountyId, milestoneId } = request.params;
    const req = request.body as UpdateMilestoneStatusRequest;
    const updated = await bountyService.updateMilestoneStatus(app.prisma, bountyId, milestoneId, auth.userId, req);
    if (!updated) return reply.status(404).send({ success: false, error: 'Bounty not found or not the creator' });
    return reply.send({ success: true });
  });
}
