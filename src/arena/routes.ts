/**
 * Arena Routes - Fastify plugin for Arena rankings and matches
 */
import type { FastifyInstance } from 'fastify';
import { getSeasons, getRankings, getMatches, getStats } from './service';

function createResponse<T>(success: boolean, data?: T, err?: { code: string; message: string }) {
  return success ? { success: true, data } : { success: false, error: err };
}

export default async function arenaRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v2/arena/seasons - List all seasons
  app.get('/seasons', async (request, reply) => {
    try {
      const seasons = await getSeasons();
      return reply.send(createResponse(true, { seasons }));
    } catch (error) {
      return reply.status(500).send(createResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown',
      }));
    }
  });

  // GET /api/v2/arena/rankings/:seasonId - Get rankings for a season
  app.get('/rankings/:seasonId', async (request, reply) => {
    try {
      const { seasonId } = request.params as any;
      const result = await getRankings(seasonId);
      if (!result) {
        return reply.status(404).send(createResponse(false, undefined, {
          code: 'SEASON_NOT_FOUND',
          message: 'Season not found',
        }));
      }
      return reply.send(createResponse(true, result));
    } catch (error) {
      return reply.status(500).send(createResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown',
      }));
    }
  });

  // GET /api/v2/arena/matches - List match history
  app.get('/matches', async (request, reply) => {
    try {
      const query = request.query as any;
      const seasonId = query.season_id || undefined;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const result = await getMatches(seasonId, limit);
      return reply.send(createResponse(true, result));
    } catch (error) {
      return reply.status(500).send(createResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown',
      }));
    }
  });

  // GET /api/v2/arena/stats - Get arena statistics
  app.get('/stats', async (request, reply) => {
    try {
      const stats = await getStats();
      return reply.send(createResponse(true, stats));
    } catch (error) {
      return reply.status(500).send(createResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown',
      }));
    }
  });
}
