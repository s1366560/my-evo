import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as readingService from './service';

export async function readingRoutes(app: FastifyInstance): Promise<void> {
  app.post('/read', {
    schema: { tags: ['Reading'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as {
      url: string;
    };

    const result = await readingService.readUrl(body.url);

    return reply.status(201).send({ success: true, data: result });
  });

  app.get('/session/:sessionId', {
    schema: { tags: ['Reading'] },
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    const result = await readingService.getReadingSession(sessionId);

    if (!result) {
      return reply.status(404).send({
        success: false,
        error: 'Reading session not found',
      });
    }

    return reply.send({ success: true, data: result });
  });

  app.get('/sessions', {
    schema: { tags: ['Reading'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { limit } = request.query as Record<string, string | undefined>;

    const result = await readingService.listReadingSessions(
      auth.node_id,
      limit ? Number(limit) : 20,
    );

    return reply.send({ success: true, data: result });
  });
}
