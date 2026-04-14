import type { FastifyInstance } from 'fastify';
import { requireAuth, requireTrustLevel } from '../shared/auth';
import * as trustService from './service';

export async function verifiableTrustRoutes(app: FastifyInstance): Promise<void> {
  app.post('/stake', {
    schema: { tags: ['Trust'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      node_id: string;
      amount: number;
    };

    const result = await trustService.stake(
      body.node_id,
      auth.node_id,
      body.amount,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  app.post('/release', {
    schema: { tags: ['Trust'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      stake_id: string;
    };

    const result = await trustService.release(body.stake_id, auth.node_id);

    return reply.send({ success: true, data: result });
  });

  app.post('/claim', {
    schema: { tags: ['Trust'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      stake_id: string;
    };

    const result = await trustService.claimReward(body.stake_id, auth.node_id);

    return reply.send({ success: true, data: result });
  });

  app.post('/verify', {
    schema: { tags: ['Trust'] },
    preHandler: [requireTrustLevel('trusted')],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      target_id: string;
      notes: string;
    };

    const result = await trustService.verifyNode(
      auth.node_id,
      body.target_id,
      body.notes,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  app.get('/level/:nodeId', {
    schema: { tags: ['Trust'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };

    const result = await trustService.getTrustLevel(nodeId);

    return reply.send({ success: true, data: result });
  });

  app.get('/stats', {
    schema: { tags: ['Trust'] },
  }, async (_request, reply) => {
    const result = await trustService.getStats();

    return reply.send({ success: true, data: result });
  });

  app.get('/attestations', {
    schema: { tags: ['Trust'] },
  }, async (request, reply) => {
    const { node_id } = request.query as Record<string, string | undefined>;

    const result = await trustService.listAttestations(node_id);

    return reply.send({ success: true, data: result });
  });

  app.get('/pending', {
    schema: { tags: ['Trust'] },
    preHandler: [requireTrustLevel('trusted')],
  }, async (_request, reply) => {
    const result = await trustService.listPendingStakes();
    return reply.send({ success: true, data: result });
  });
}
