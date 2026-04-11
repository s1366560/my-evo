import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { ConflictError, ForbiddenError, ValidationError } from '../shared/errors';
import * as service from './service';

const SYNC_HISTORY_MAX_LIMIT = 100;

function requireNodeBackedIdentity(nodeId: string): string {
  if (!nodeId || nodeId.startsWith('user-')) {
    throw new ForbiddenError('Sync routes require a node-backed identity');
  }
  return nodeId;
}

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  app.post('/trigger', {
    schema: { tags: ['A2A'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const nodeId = requireNodeBackedIdentity(auth.node_id);
    const claimed = await service.claimSyncTrigger(nodeId);
    if (!claimed) {
      throw new ConflictError('A sync is already in progress for this node');
    }
    const result = await service.triggerPeriodicSync(nodeId);
    const data = result.status === 'SYNC_ERROR'
      ? { ...result, message: 'Sync failed' }
      : result;
    return reply.status(202).send({ success: true, data });
  });

  app.get('/status', {
    schema: { tags: ['A2A'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const nodeId = requireNodeBackedIdentity(auth.node_id);
    const result = await service.getNodeSyncStatus(nodeId);
    return reply.send({ success: true, data: result });
  });

  app.get('/history', {
    schema: { tags: ['A2A'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const nodeId = requireNodeBackedIdentity(auth.node_id);
    const query = request.query as { limit?: string };
    const requestedLimit = query.limit === undefined ? 50 : Number.parseInt(query.limit, 10);

    if (!Number.isInteger(requestedLimit) || requestedLimit <= 0) {
      throw new ValidationError('limit must be a positive integer');
    }

    const limit = Math.min(requestedLimit, SYNC_HISTORY_MAX_LIMIT);
    const result = await service.fetchSyncHistory(nodeId, limit);
    return reply.send({ success: true, data: result });
  });

  app.post('/check', {
    schema: { tags: ['A2A'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const nodeId = requireNodeBackedIdentity(auth.node_id);
    const result = await service.checkSyncIntegrity(nodeId);
    return reply.send({ success: true, data: result });
  });
}
