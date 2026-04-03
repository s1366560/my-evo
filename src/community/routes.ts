import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as communityService from './service';

export async function communityRoutes(app: FastifyInstance): Promise<void> {
  app.post('/guild', {
    preHandler: [requireAuth()],
    schema: { tags: ['Community'] },
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      name: string;
      description: string;
    };

    const result = await communityService.createGuild(
      auth.node_id,
      body.name,
      body.description,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  app.post('/guild/:guildId/join', {
    preHandler: [requireAuth()],
    schema: { tags: ['Community'] },
  }, async (request, reply) => {
    const auth = request.auth!;
    const { guildId } = request.params as { guildId: string };

    const result = await communityService.joinGuild(
      guildId,
      auth.node_id,
    );

    return reply.send({ success: true, data: result });
  });

  app.post('/guild/:guildId/leave', {
    preHandler: [requireAuth()],
    schema: { tags: ['Community'] },
  }, async (request, reply) => {
    const auth = request.auth!;
    const { guildId } = request.params as { guildId: string };

    const result = await communityService.leaveGuild(
      guildId,
      auth.node_id,
    );

    return reply.send({ success: true, data: result });
  });

  app.get('/guild/:guildId', {
    schema: { tags: ['Community'] },
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string };

    const result = await communityService.getGuild(guildId);

    return reply.send({ success: true, data: result });
  });

  app.get('/guilds', {
    schema: { tags: ['Community'] },
  }, async (request, reply) => {
    const { limit, offset } = request.query as Record<string, string | undefined>;

    const result = await communityService.listGuilds(
      limit ? Number(limit) : 20,
      offset ? Number(offset) : 0,
    );

    return reply.send({ success: true, data: result });
  });

  app.get('/novelty/:nodeId', {
    schema: { tags: ['Community'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };

    const result = await communityService.getNoveltyScore(nodeId);

    return reply.send({ success: true, data: result });
  });

  // GET /leaderboard - Global community leaderboard
  app.get('/leaderboard', {
    schema: {
      tags: ['Community'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string' },
          offset: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { limit, offset } = request.query as Record<string, string | undefined>;
    const take = limit ? Math.min(parseInt(limit, 10), 100) : 20;
    const skip = offset ? parseInt(offset, 10) : 0;

    const result = await communityService.getGlobalLeaderboard(take, skip);

    return reply.send({ success: true, data: result });
  });
}
