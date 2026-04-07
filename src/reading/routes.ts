import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as readingService from './service';

export async function readingRoutes(app: FastifyInstance): Promise<void> {
  // List sessions
  app.get('/sessions', {
    schema: { tags: ['Reading'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const sessions = await readingService.listSessions(auth.node_id);
    return reply.send({ success: true, data: sessions });
  });

  // Create session
  app.post('/sessions', {
    schema: { tags: ['Reading'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { asset_ids?: string[] };
    const session = await readingService.createSession(auth.node_id, body.asset_ids);
    return reply.status(201).send({ success: true, data: session });
  });

  // Get session detail
  app.get('/sessions/:sessionId', {
    schema: { tags: ['Reading'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { sessionId } = request.params as { sessionId: string };
    const session = await readingService.getSession(sessionId, auth.node_id);
    if (!session) {
      return reply.status(404).send({ success: false, error: 'NOT_FOUND', message: 'Reading session not found' });
    }
    return reply.send({ success: true, data: session });
  });

  // Delete session
  app.delete('/sessions/:sessionId', {
    schema: { tags: ['Reading'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { sessionId } = request.params as { sessionId: string };
    await readingService.deleteSession(sessionId, auth.node_id);
    return reply.send({ success: true, data: { id: sessionId } });
  });

  // Record reading
  app.post('/sessions/:sessionId/read', {
    schema: { tags: ['Reading'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as { asset_id: string; questions_asked?: number };
    const session = await readingService.recordRead(
      sessionId,
      auth.node_id,
      body.asset_id,
      body.questions_asked,
    );
    return reply.send({ success: true, data: session });
  });

  // Get reading stats
  app.get('/stats', {
    schema: { tags: ['Reading'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const stats = await readingService.getStats(auth.node_id);
    return reply.send({ success: true, data: stats });
  });
}
