import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { ValidationError } from '../shared/errors';
import * as service from './service';

export async function questionRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  app.get('/', {
    schema: { tags: ['Questions'] },
  }, async (request) => {
    const query = request.query as {
      limit?: string;
      offset?: string;
      tags?: string;
      state?: string;
      sort?: string;
    };

    const tags = query.tags ? query.tags.split(',').map((t: string) => t.trim()) : undefined;
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;
    const sort = (query.sort as 'newest' | 'votes' | 'unanswered') ?? 'newest';

    const result = await service.listQuestions(
      { tags, state: query.state },
      limit,
      offset,
      sort,
      prisma,
    );

    return { success: true, data: { items: result.items, total: result.total } };
  });

  app.get('/:questionId', {
    schema: { tags: ['Questions'] },
  }, async (request) => {
    const params = request.params as { questionId: string };
    const question = await service.getQuestion(params.questionId, prisma);
    return { success: true, data: question };
  });

  app.post('/', {
    schema: { tags: ['Questions'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      title: string;
      body: string;
      tags?: string[];
      bounty?: number;
    };

    if (!body.title || !body.body) {
      throw new ValidationError('title and body are required');
    }

    const question = await service.createQuestion(
      auth.node_id,
      body.title,
      body.body,
      body.tags ?? [],
      body.bounty ?? 0,
      prisma,
    );

    void reply.status(201);
    return { success: true, data: question };
  });

  app.put('/:questionId', {
    schema: { tags: ['Questions'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { questionId: string };
    const body = request.body as {
      title?: string;
      body?: string;
      tags?: string[];
      bounty?: number;
    };

    const question = await service.updateQuestion(
      params.questionId,
      auth.node_id,
      {
        title: body.title,
        body: body.body,
        tags: body.tags,
        bounty: body.bounty,
      },
      prisma,
    );

    return { success: true, data: question };
  });

  app.delete('/:questionId', {
    schema: { tags: ['Questions'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { questionId: string };
    await service.deleteQuestion(params.questionId, auth.node_id, prisma);
    return { success: true, data: { message: 'Question deleted' } };
  });

  app.get('/:questionId/answers', {
    schema: { tags: ['Questions'] },
  }, async (request) => {
    const params = request.params as { questionId: string };
    const query = request.query as { limit?: string; offset?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    const result = await service.listAnswers(params.questionId, limit, offset, prisma);
    return { success: true, data: { items: result.items, total: result.total } };
  });

  app.post('/:questionId/answers', {
    schema: { tags: ['Questions'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const params = request.params as { questionId: string };
    const body = request.body as { body: string };

    if (!body.body) {
      throw new ValidationError('body is required');
    }

    const answer = await service.createAnswer(params.questionId, auth.node_id, body.body, prisma);

    void reply.status(201);
    return { success: true, data: answer };
  });

  app.post('/:questionId/answers/:answerId/upvote', {
    schema: { tags: ['Questions'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { questionId: string; answerId: string };
    await service.upvoteAnswer(params.questionId, params.answerId, prisma);
    return { success: true, data: { message: 'Answer upvoted' } };
  });

  app.post('/:questionId/answers/:answerId/downvote', {
    schema: { tags: ['Questions'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { questionId: string; answerId: string };
    await service.downvoteAnswer(params.questionId, params.answerId, prisma);
    return { success: true, data: { message: 'Answer downvoted' } };
  });

  app.post('/:questionId/answers/:answerId/accept', {
    schema: { tags: ['Questions'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { questionId: string; answerId: string };
    await service.acceptAnswer(params.questionId, params.answerId, auth.node_id, prisma);
    return { success: true, data: { message: 'Answer accepted' } };
  });
}
