import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as readingService from './service';

export async function readingRoutes(app: FastifyInstance): Promise<void> {
  // Analyze a URL and generate reading artifacts
  app.post('/analyze', {
    schema: {
      tags: ['Reading'],
      body: {
        type: 'object',
        properties: {
          url: { type: 'string' },
        },
        required: ['url'],
      },
    },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = (request.body ?? {}) as { url?: string };
    const result = await readingService.readUrl(body.url ?? '', auth.node_id);
    return reply.send({ success: true, data: result });
  });

  app.post('/ingest', {
    schema: {
      tags: ['Reading'],
      body: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          text: { type: 'string' },
          title: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = (request.body ?? {}) as { url?: string; text?: string; title?: string };
    const result = await readingService.ingestReading(body, auth.node_id);
    return reply.send({ success: true, data: result });
  });

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
    schema: {
      tags: ['Reading'],
      body: {
        type: 'object',
        properties: {
          asset_ids: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = (request.body ?? {}) as { asset_ids?: string[] };
    const session = await readingService.createSession(auth.node_id, body.asset_ids ?? []);
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
    schema: {
      tags: ['Reading'],
      body: {
        type: 'object',
        properties: {
          asset_id: { type: 'string' },
          questions_asked: { type: 'number' },
        },
        required: ['asset_id'],
        additionalProperties: false,
      },
    },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { sessionId } = request.params as { sessionId: string };
    const body = (request.body ?? {}) as { asset_id?: string; questions_asked?: number };
    const session = await readingService.recordRead(
      sessionId,
      auth.node_id,
      body.asset_id ?? '',
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

  // Get recent trending reading analyses
  app.get('/trending', {
    schema: { tags: ['Reading'] },
  }, async (request, reply) => {
    const { limit } = request.query as { limit?: string | number };
    const parsedLimit = typeof limit === 'string' ? Number.parseInt(limit, 10) : Number(limit ?? 10);
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    const trending = readingService.getCommunityTrendingReadings(safeLimit);
    return reply.send({ success: true, data: trending });
  });

  app.get('/history', {
    schema: { tags: ['Reading'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const query = request.query as {
      limit?: string | number;
      offset?: string | number;
      sort_by?: 'newest' | 'oldest';
      source_type?: 'url' | 'text';
    };
    const parsedLimit = typeof query.limit === 'string' ? Number.parseInt(query.limit, 10) : Number(query.limit ?? 20);
    const parsedOffset = typeof query.offset === 'string' ? Number.parseInt(query.offset, 10) : Number(query.offset ?? 0);
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20;
    const offset = Number.isInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
    const result = readingService.getReadingHistory(auth.node_id, limit, offset, {
      sort_by: query.sort_by,
      source_type: query.source_type,
    });
    return reply.send({ success: true, data: result });
  });

  app.get('/my-questions', {
    schema: { tags: ['Reading'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const query = request.query as {
      status?: 'pending' | 'bountied' | 'dismissed';
      limit?: string | number;
      offset?: string | number;
    };
    const parsedLimit = typeof query.limit === 'string' ? Number.parseInt(query.limit, 10) : Number(query.limit ?? 20);
    const parsedOffset = typeof query.offset === 'string' ? Number.parseInt(query.offset, 10) : Number(query.offset ?? 0);
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20;
    const offset = Number.isInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
    const result = readingService.listMyQuestions(auth.node_id, {
      status: query.status,
      limit,
      offset,
    });
    return reply.send({ success: true, data: result });
  });

  app.post('/questions/:questionId/bounty', {
    schema: {
      tags: ['Reading'],
      body: {
        type: 'object',
        properties: {
          amount: { type: 'number', minimum: 1 },
          deadline: { type: 'string' },
          description: { type: 'string' },
          requirements: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['amount', 'deadline'],
        additionalProperties: false,
      },
    },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { questionId } = request.params as { questionId: string };
    const body = request.body as {
      amount: number;
      deadline: string;
      description?: string;
      requirements?: string[];
    };
    const result = await readingService.createQuestionBounty(
      auth.node_id,
      auth.node_id,
      questionId,
      body,
    );
    return reply.status(201).send({ success: true, data: result });
  });

  app.post('/questions/:questionId/dismiss', {
    schema: { tags: ['Reading'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { questionId } = request.params as { questionId: string };
    const result = readingService.dismissQuestion(auth.node_id, questionId);
    return reply.send({ success: true, data: result });
  });

  app.get('/:readingId', {
    schema: { tags: ['Reading'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { readingId } = request.params as { readingId: string };
    const result = readingService.getReadingDetail(readingId, auth.node_id);
    return reply.send({ success: true, data: result });
  });
}
