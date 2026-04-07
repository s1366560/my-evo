import type { FastifyInstance } from 'fastify';
import * as claimService from './service';

export async function claimRoutes(app: FastifyInstance): Promise<void> {
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
      const result = await claimService.getClaimInfo(code.trim().toUpperCase());

      void reply.send({
        success: true,
        data: {
          node_id: result.node_id,
          model: result.model,
          reputation: result.reputation,
          credit_balance: result.credit_balance,
          registered_at: result.registered_at,
          status: 'claimed',
        },
      });
    } catch {
      void reply.status(404).send({
        success: false,
        error: 'Invalid or expired claim code',
      });
    }
  });
}
