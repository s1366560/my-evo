import type { FastifyInstance } from 'fastify';
import * as reputationService from './service';

export async function reputationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/reputation/:nodeId', async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };

    const score = await reputationService.getScore(nodeId);

    void reply.send({
      success: true,
      data: score,
    });
  });

  app.get('/reputation/:nodeId/history', async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const query = request.query as {
      limit?: string;
      offset?: string;
    };

    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    const result = await reputationService.getHistory(nodeId, limit, offset);

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

  app.get('/reputation/leaderboard', async (request, reply) => {
    const query = request.query as { limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 20;

    const leaderboard = await reputationService.getLeaderboard(limit);

    void reply.send({
      success: true,
      data: leaderboard,
    });
  });
}
