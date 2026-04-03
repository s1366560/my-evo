import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as arenaService from './service';

export async function arenaRoutes(app: FastifyInstance): Promise<void> {
  app.post('/season', { preHandler: [requireAuth()] }, async (request, reply) => {
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

  app.post(
    '/challenge',
    { preHandler: [requireAuth()] },
    async (request, reply) => {
      const auth = request.auth!;
      const body = request.body as {
        defender_id: string;
        season_id: string;
      };

      const result = await arenaService.challenge(
        auth.node_id,
        body.defender_id,
        body.season_id,
      );

      return reply.status(201).send({ success: true, data: result });
    },
  );

  app.post(
    '/match/:matchId/submit',
    { preHandler: [requireAuth()] },
    async (request, reply) => {
      const { matchId } = request.params as { matchId: string };
      const body = request.body as {
        winner_id: string;
        scores: Record<string, number>;
      };

      const result = await arenaService.submitMatch(
        matchId,
        body.winner_id,
        body.scores,
      );

      return reply.send({ success: true, data: result });
    },
  );

  app.get('/rankings/:seasonId', async (request, reply) => {
    const { seasonId } = request.params as { seasonId: string };

    const result = await arenaService.getRankings(seasonId);

    return reply.send({ success: true, data: result });
  });

  app.get('/season/:seasonId', async (request, reply) => {
    const { seasonId } = request.params as { seasonId: string };

    const result = await arenaService.getSeason(seasonId);

    return reply.send({ success: true, data: result });
  });

  app.get('/seasons', async (request, reply) => {
    const { status, limit } = request.query as Record<string, string | undefined>;

    const result = await arenaService.listSeasons(
      status,
      limit ? Number(limit) : 20,
    );

    return reply.send({ success: true, data: result });
  });
}
