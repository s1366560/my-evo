import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as management from './management';
import { ValidationError, UnauthorizedError } from '../shared/errors';

export async function sessionManagementRoutes(app: FastifyInstance): Promise<void> {
  const prisma = app.prisma;

  // ===== List User Sessions =====
  // GET /session/management/sessions
  app.get('/session/management/sessions', {
    schema: { tags: ['Session'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    if (!auth.userId) {
      throw new UnauthorizedError('User session required');
    }

    const sessions = await management.listUserSessions(auth.userId, prisma);
    return reply.send({
      success: true,
      sessions,
      total: sessions.length,
      data: { sessions, total: sessions.length },
    });
  });

  // ===== Get Session Statistics =====
  // GET /session/management/stats
  app.get('/session/management/stats', {
    schema: { tags: ['Session'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    if (!auth.userId) {
      throw new UnauthorizedError('User session required');
    }

    const stats = await management.getSessionStats(auth.userId, prisma);
    return reply.send({
      success: true,
      ...stats,
      data: stats,
    });
  });

  // ===== Revoke Specific Session =====
  // DELETE /session/management/sessions/:sessionId
  app.delete('/session/management/sessions/:sessionId', {
    schema: {
      tags: ['Session'],
      params: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string' },
        },
      },
    },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    if (!auth.userId) {
      throw new UnauthorizedError('User session required');
    }

    const { sessionId } = request.params as { sessionId: string };
    await management.revokeSession(auth.userId, sessionId, prisma);

    return reply.send({
      success: true,
      message: 'Session revoked successfully',
      session_id: sessionId,
    });
  });

  // ===== Revoke All Other Sessions =====
  // POST /session/management/revoke-others
  app.post('/session/management/revoke-others', {
    schema: {
      tags: ['Session'],
      body: {
        type: 'object',
        properties: {
          current_session_id: { type: 'string' },
        },
      },
    },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    if (!auth.userId) {
      throw new UnauthorizedError('User session required');
    }

    const body = request.body as { current_session_id?: string };
    const currentSessionId = body.current_session_id;

    if (!currentSessionId) {
      throw new ValidationError('current_session_id is required');
    }

    const result = await management.revokeAllSessionsExcept(
      auth.userId,
      currentSessionId,
      prisma,
    );

    return reply.send({
      success: true,
      message: `Revoked ${result.revoked_count} other sessions`,
      revoked_count: result.revoked_count,
      data: result,
    });
  });

  // ===== Extend Session =====
  // POST /session/management/sessions/:sessionId/extend
  app.post('/session/management/sessions/:sessionId/extend', {
    schema: {
      tags: ['Session'],
      params: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          days: { type: 'number', minimum: 1, maximum: 365 },
        },
      },
    },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    if (!auth.userId) {
      throw new UnauthorizedError('User session required');
    }

    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as { days?: number };

    const session = await management.extendSession(
      auth.userId,
      sessionId,
      body.days,
      prisma,
    );

    return reply.send({
      success: true,
      session,
      data: session,
    });
  });

  // ===== Refresh Session Token =====
  // POST /session/management/sessions/:sessionId/refresh
  app.post('/session/management/sessions/:sessionId/refresh', {
    schema: {
      tags: ['Session'],
      params: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string' },
        },
      },
    },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    if (!auth.userId) {
      throw new UnauthorizedError('User session required');
    }

    const { sessionId } = request.params as { sessionId: string };

    const result = await management.refreshSessionToken(
      auth.userId,
      sessionId,
      prisma,
    );

    // Set new token as cookie
    void reply.setCookie('session_token', result.new_token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return reply.send({
      success: true,
      message: 'Session token refreshed',
      new_token_prefix: result.new_token.slice(0, 8) + '...',
      session: result.session,
      data: result,
    });
  });

  // ===== Validate Session =====
  // POST /session/management/validate
  app.post('/session/management/validate', {
    schema: {
      tags: ['Session'],
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { token: string };
    const result = await management.validateSession(body.token, prisma);

    return reply.send({
      success: result.valid,
      valid: result.valid,
      reason: result.reason,
      session: result.session,
      data: result,
    });
  });
}
