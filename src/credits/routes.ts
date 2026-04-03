import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as creditService from './service';
import type { CreditTransactionType } from '../shared/types';

export async function creditRoutes(app: FastifyInstance): Promise<void> {
  app.get('/credits/:nodeId', async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };

    const balance = await creditService.getBalance(nodeId);

    void reply.send({
      success: true,
      data: balance,
    });
  });

  app.get('/credits/:nodeId/history', async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const query = request.query as {
      type?: CreditTransactionType;
      limit?: string;
      offset?: string;
    };

    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    const result = await creditService.getHistory(
      nodeId,
      query.type,
      limit,
      offset,
    );

    void reply.send({
      success: true,
      data: result.items,
      meta: {
        total: result.total,
        page: Math.floor(offset / limit) + 1,
        limit,
      },
    });
  });

  app.post('/credits/transfer', {
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      to_id: string;
      amount: number;
      description?: string;
    };

    if (!body.to_id) {
      void reply.status(400).send({
        success: false,
        error: 'to_id is required',
      });
      return;
    }

    if (!body.amount || body.amount <= 0) {
      void reply.status(400).send({
        success: false,
        error: 'Valid positive amount is required',
      });
      return;
    }

    const result = await creditService.transfer(
      auth.node_id,
      body.to_id,
      body.amount,
    );

    void reply.send({
      success: true,
      data: result,
    });
  });
}
