import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError } from '../shared/errors';
import * as service from './service';

export async function sessionRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  app.post('/', {
    schema: { tags: ['Session'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      title: string;
      maxParticipants?: number;
      consensusConfig?: { algorithm: 'raft_like' | 'majority' | 'unanimous'; quorum?: number };
    };

    if (!body.title) {
      throw new EvoMapError('title is required', 'VALIDATION_ERROR', 400);
    }

    const session = await service.createSession(
      auth.node_id,
      body.title,
      body.maxParticipants,
      body.consensusConfig,
      prisma,
    );

    void reply.status(201);
    return { success: true, data: session };
  });

  app.post('/:sessionId/join', {
    schema: { tags: ['Session'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { sessionId: string };

    const session = await service.joinSession(params.sessionId, auth.node_id, prisma);
    return { success: true, data: session };
  });

  app.post('/:sessionId/leave', {
    schema: { tags: ['Session'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { sessionId: string };

    const session = await service.leaveSession(params.sessionId, auth.node_id, prisma);
    return { success: true, data: session };
  });

  app.post('/:sessionId/message', {
    schema: { tags: ['Session'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { sessionId: string };
    const body = request.body as {
      type: string;
      content: string;
    };

    if (!body.type || !body.content) {
      throw new EvoMapError('type and content are required', 'VALIDATION_ERROR', 400);
    }

    const validTypes = [
      'subtask_result', 'query', 'response',
      'vote', 'signal', 'system', 'operation',
    ];
    if (!validTypes.includes(body.type)) {
      throw new EvoMapError(`type must be one of: ${validTypes.join(', ')}`, 'VALIDATION_ERROR', 400);
    }

    const result = await service.sendMessage(
      params.sessionId,
      auth.node_id,
      body.type as 'subtask_result' | 'query' | 'response' | 'vote' | 'signal' | 'system' | 'operation',
      body.content,
      prisma,
    );

    return { success: true, data: result };
  });

  app.post('/:sessionId/consensus', {
    schema: { tags: ['Session'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { sessionId: string };
    const body = request.body as {
      type: string;
      content: string;
    };

    if (!body.type || !body.content) {
      throw new EvoMapError('type and content are required', 'VALIDATION_ERROR', 400);
    }

    const result = await service.proposeConsensus(
      params.sessionId,
      auth.node_id,
      body.type,
      body.content,
      prisma,
    );

    return { success: true, data: result };
  });

  app.post('/:sessionId/consensus/:proposalId/vote', {
    schema: { tags: ['Session'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { sessionId: string; proposalId: string };
    const body = request.body as {
      vote: 'approve' | 'reject';
    };

    if (!body.vote || !['approve', 'reject'].includes(body.vote)) {
      throw new EvoMapError('vote must be approve or reject', 'VALIDATION_ERROR', 400);
    }

    const result = await service.voteConsensus(
      params.sessionId,
      params.proposalId,
      auth.node_id,
      body.vote,
      prisma,
    );

    return { success: true, data: result };
  });

  app.post('/:sessionId/heartbeat', {
    schema: { tags: ['Session'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { sessionId: string };

    const session = await service.heartbeat(params.sessionId, auth.node_id, prisma);
    return { success: true, data: session };
  });

  app.get('/', {
    schema: { tags: ['Session'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const query = request.query as {
      status?: string;
      limit?: string;
      offset?: string;
    };

    const result = await service.listSessionsForNode(auth.node_id, {
      status: query.status as 'creating' | 'active' | 'paused' | 'completed' | 'cancelled' | 'error' | 'expired' | undefined,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    }, prisma);

    return {
      success: true,
      data: result.sessions,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
  });

  app.get('/:sessionId', {
    schema: { tags: ['Session'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { sessionId: string };
    const session = await service.getSession(params.sessionId, auth.node_id, prisma);
    return { success: true, data: session };
  });
}
