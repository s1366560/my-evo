/**
 * Bounty Module Routes (Fastify)
 *
 * Implements the canonical v2 bounty contract:
 *   POST /api/v2/bounty/tasks              — createBounty
 *   GET  /api/v2/bounty/tasks              — listBounties
 *   GET  /api/v2/bounty/tasks/:bountyId    — getBountyById
 *
 * The legacy /api/v2/bounty/:bountyId path is preserved via compat-routes.ts.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import {
  createBounty,
  getBountyById,
  listBounties,
} from './service.js';
import type { CreateBountyRequest } from './types.js';

interface CreateBountyBody extends CreateBountyRequest {}

interface ListBountyQuery {
  status?: string;
  creator_id?: string;
  limit?: number | string;
  offset?: number | string;
}

export async function bountyRoutes(app: FastifyInstance): Promise<void> {
  const prisma = new PrismaClient();

  // POST /api/v2/bounty/tasks
  app.post(
    '/tasks',
    async (
      req: FastifyRequest<{ Body: CreateBountyBody }>,
      reply: FastifyReply,
    ) => {
      const creatorId = (req as any).userId ?? 'anonymous';
      const body = req.body ?? ({} as CreateBountyBody);
      const result = await createBounty(prisma, creatorId, body);
      reply.code(201).send(result);
    },
  );

  // GET /api/v2/bounty/tasks
  app.get(
    '/tasks',
    async (
      req: FastifyRequest<{ Querystring: ListBountyQuery }>,
      reply: FastifyReply,
    ) => {
      const q = req.query ?? {};
      const filters = {
        status: q.status,
        creator_id: q.creator_id,
        limit: q.limit ? Number(q.limit) : undefined,
        offset: q.offset ? Number(q.offset) : undefined,
      };
      const result = await listBounties(prisma, filters);
      reply.send(result);
    },
  );

  // GET /api/v2/bounty/tasks/:bountyId
  app.get(
    '/tasks/:bountyId',
    async (
      req: FastifyRequest<{ Params: { bountyId: string } }>,
      reply: FastifyReply,
    ) => {
      const result = await getBountyById(prisma, req.params.bountyId);
      if (!result) {
        reply.code(404).send({ success: false, error: 'Bounty not found' });
        return;
      }
      reply.send(result);
    },
  );
}
