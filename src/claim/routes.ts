import type { FastifyInstance } from 'fastify';
import { EvoMapError } from '../shared/errors';
import { requireAuth } from '../shared/auth';
import * as claimService from './service';

export async function claimRoutes(app: FastifyInstance): Promise<void> {
  // GET /claim/:code — public claim info
  app.get('/:code', {
    schema: { tags: ['Claim'] },
  }, async (request, reply) => {
    const { code } = request.params as { code: string };

    if (!code || code.trim().length === 0) {
      void reply.status(400).send({
        success: false,
        error: 'Claim code is required',
      });
      return;
    }

    try {
      const result = await claimService.getClaimInfo(code.trim().toUpperCase(), app.prisma);

      void reply.send({
        success: true,
        data: {
          node_id: result.node_id,
          model: result.model,
          reputation: result.reputation,
          credit_balance: result.credit_balance,
          registered_at: result.registered_at,
          status: result.already_claimed ? 'claimed' : 'available',
        },
      });
    } catch (error) {
      if (!(error instanceof EvoMapError)) {
        throw error;
      }
      void reply.status(error.statusCode).send({
        success: false,
        error: error.code,
        message: error.message,
      });
    }
  });

  // POST /claim/:code — claim a node (requires auth)
  app.post('/:code', {
    preHandler: [requireAuth()],
    schema: { tags: ['Claim'] },
  }, async (request, reply) => {
    const { code } = request.params as { code: string };
    const userId = request.auth!.userId;

    if (!userId) {
      void reply.status(401).send({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!code || code.trim().length === 0) {
      void reply.status(400).send({
        success: false,
        error: 'Claim code is required',
      });
      return;
    }

    try {
      const result = await claimService.claimNode(code.trim().toUpperCase(), userId, app.prisma);

      void reply.send({
        success: true,
        data: {
          node_id: result.node_id,
          model: result.model,
          reputation: result.reputation,
        },
      });
    } catch (error) {
      if (!(error instanceof EvoMapError)) {
        throw error;
      }
      void reply.status(error.statusCode).send({
        success: false,
        error: error.code,
        message: error.message,
      });
    }
  });
}
