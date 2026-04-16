import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as creditService from './service';
import type { CreditTransactionType } from '../shared/types';

export async function creditRoutes(app: FastifyInstance): Promise<void> {
  app.get('/credits/:nodeId', {
    schema: { tags: ['Credits'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };

    const balance = await creditService.getBalance(nodeId, app.prisma);

    void reply.send({
      success: true,
      ...balance,
      data: balance,
    });
  });

  app.get('/credits/:nodeId/history', {
    schema: { tags: ['Credits'] },
  }, async (request, reply) => {
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
      app.prisma,
    );

    void reply.send({
      success: true,
      history: result.items,
      total: result.total,
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
    schema: { tags: ['Credits'] },
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
      app.prisma,
    );

    void reply.send({
      success: true,
      from_transaction: result.from_transaction,
      to_transaction: result.to_transaction,
      data: result,
    });
  });

  // GET /credit/price - Credit pricing info (no auth)
  app.get('/credit/price', {
    schema: {
      tags: ['Credits'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            price_per_credit: { type: 'number' },
            currency: { type: 'string' },
            min_purchase: { type: 'number' },
            max_purchase: { type: 'number' },
            updated_at: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
  }, async (_request, reply) => {
    const data = {
      price_per_credit: 0.01,
      currency: 'USD',
      min_purchase: 100,
      max_purchase: 100000,
      updated_at: new Date().toISOString(),
    };
    return reply.send({
      success: true,
      ...data,
      data,
    });
  });

  // GET /credit/economics - Economy overview (no auth)
  app.get('/credit/economics', {
    schema: {
      tags: ['Credits'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            total_supply: { type: 'number' },
            circulating: { type: 'number' },
            price_per_credit_usd: { type: 'number' },
            publish_gene_cost: { type: 'number' },
            publish_capsule_cost: { type: 'number' },
            publish_recipe_cost: { type: 'number' },
            fetch_cost: { type: 'number' },
            updated_at: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
  }, async (_request, reply) => {
    const data = {
      total_supply: 10000000,
      circulating: 5000000,
      price_per_credit_usd: 0.01,
      publish_gene_cost: 5,
      publish_capsule_cost: 10,
      publish_recipe_cost: 20,
      fetch_cost: 1,
      updated_at: new Date().toISOString(),
    };
    return reply.send({
      success: true,
      ...data,
      data,
    });
  });
}
