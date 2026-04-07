import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as service from './service';

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  // GET /billing/earnings/:nodeId — query earnings for a node
  app.get('/earnings/:nodeId', {
    schema: { tags: ['Billing'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const earnings = await service.getEarnings(nodeId);
    return reply.send({ success: true, data: earnings });
  });

  // GET /billing/earnings — alias for /billing/earnings/:nodeId using auth node_id
  app.get('/earnings', {
    schema: { tags: ['Billing'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const earnings = await service.getEarnings(auth.node_id);
    return reply.send({ success: true, data: earnings });
  });
}
