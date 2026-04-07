import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as arenaService from './service';

export async function arenaRoutes(app: FastifyInstance): Promise<void> {
  // Create season
  app.post('/season', {
    schema: { tags: ['Arena'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      start_date: string;
      end_date: string;
    };
    const result = await arenaService.createSeason(
      body.name,
      body.start_date,
      body.end_date,
    );
    return reply.status(201).send({ success: true, data: result });
  });

  // Join matchmaking queue
  app.post('/matchmaking', {
    schema: { tags: ['Arena'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { season_id: string };
    const result = await arenaService.joinMatchmaking(body.season_id, auth.node_id);
    return reply.status(201).send({ success: true, data: result });
  });

  // Leave matchmaking
  app.delete('/matchmaking/:seasonId', {
    schema: { tags: ['Arena'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { seasonId } = request.params as { seasonId: string };
    await arenaService.leaveMatchmaking(seasonId, auth.node_id);
    return reply.send({ success: true, data: { season_id: seasonId } });
  });

  // Get matchmaking status
  app.get('/matchmaking/status/:seasonId', {
    schema: { tags: ['Arena'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { seasonId } = request.params as { seasonId: string };
    const result = await arenaService.getMatchmakingStatus(seasonId, auth.node_id);
    return reply.send({ success: true, data: result });
  });

  // Challenge
  app.post('/challenge', {
    schema: { tags: ['Arena'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      defender_id: string;
      season_id: string;
    };
    const { challenge } = await import('./service');
    const result = await challenge(
      auth.node_id,
      body.defender_id,
      body.season_id,
    );
    return reply.status(201).send({ success: true, data: result });
  });

  // List matches
  app.get('/matches', {
    schema: { tags: ['Arena'] },
  }, async (request, reply) => {
    const query = request.query as {
      season_id?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };
    const result = await arenaService.listMatches(
      query.season_id,
      query.status,
      query.limit ? Number(query.limit) : 20,
      query.offset ? Number(query.offset) : 0,
    );
    return reply.send({
      success: true,
      data: result.items,
      meta: { total: result.total },
    });
  });

  // Get match detail
  app.get('/matches/:matchId', {
    schema: { tags: ['Arena'] },
  }, async (request, reply) => {
    const { matchId } = request.params as { matchId: string };
    const { listMatches } = await import('./service');
    const { items } = await listMatches(undefined, undefined, 1000, 0);
    const match = items.find((m) => m.match_id === matchId);
    if (!match) {
      return reply.status(404).send({ success: false, error: 'NOT_FOUND', message: 'Match not found' });
    }
    return reply.send({ success: true, data: match });
  });

  // Submit match result
  app.post('/matches/:matchId/submit', {
    schema: { tags: ['Arena'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { matchId } = request.params as { matchId: string };
    const body = request.body as {
      winner_id: string;
      scores?: Record<string, number>;
    };
    const result = await arenaService.submitMatchResult(
      matchId,
      body.winner_id,
      body.scores,
    );
    return reply.send({ success: true, data: result });
  });

  // Get rankings
  app.get('/rankings/:seasonId', {
    schema: { tags: ['Arena'] },
  }, async (request, reply) => {
    const { seasonId } = request.params as { seasonId: string };
    const { getRankings } = await import('./service');
    const result = await getRankings(seasonId);
    return reply.send({ success: true, data: result });
  });

  // Get season
  app.get('/season/:seasonId', {
    schema: { tags: ['Arena'] },
  }, async (request, reply) => {
    const { seasonId } = request.params as { seasonId: string };
    const { getSeason } = await import('./service');
    const result = await getSeason(seasonId);
    return reply.send({ success: true, data: result });
  });

  // List seasons
  app.get('/seasons', {
    schema: { tags: ['Arena'] },
  }, async (request, reply) => {
    const { status, limit } = request.query as Record<string, string | undefined>;
    const { listSeasons } = await import('./service');
    const result = await listSeasons(
      status,
      limit ? Number(limit) : 20,
    );
    return reply.send({ success: true, data: result });
  });
}
