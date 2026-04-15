import type { FastifyInstance } from 'fastify';
import { requireAuth, requireNodeSecretAuth } from '../shared/auth';
import { resolveAuthorizedNodeId } from '../shared/node-access';
import { MAX_API_KEYS_PER_USER } from '../shared/constants';
import * as accountService from './service';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../shared/errors';

function buildOnboardingJourneyPayload(
  result: Awaited<ReturnType<typeof accountService.getOnboardingJourney>>,
) {
  return {
    success: true,
    agent_id: result.agent_id,
    current_step: result.current_step,
    total_steps: result.total_steps,
    progress_percentage: result.progress_percentage,
    completed_steps: result.completed_steps,
    steps: result.steps,
    next_step: result.next_step,
    data: result,
  };
}

function ensureNodeSecretOnboardingAuth(
  auth: NonNullable<import('fastify').FastifyRequest['auth']>,
): void {
  if (auth.auth_type !== 'node_secret') {
    throw new ForbiddenError('Node secret credentials are required for onboarding routes');
  }
}

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  const prisma = app.prisma;

  app.post('/register', {
    schema: { tags: ['Account'] },
  }, async (request, reply) => {
    const body = request.body as { email?: string; password?: string };
    const result = await accountService.registerUser(
      body.email ?? '',
      body.password ?? '',
      prisma,
    );
    void reply.setCookie('session_token', result.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return reply.status(201).send({ success: true, data: result });
  });

  app.post('/login', {
    schema: { tags: ['Account'] },
  }, async (request, reply) => {
    const body = request.body as { email?: string; password?: string };
    const result = await accountService.loginUser(
      body.email ?? '',
      body.password ?? '',
      prisma,
    );
    void reply.setCookie('session_token', result.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return reply.status(200).send({ success: true, data: result });
  });

  app.post('/api-keys', {
    schema: { tags: ['Account'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    if (auth.auth_type !== 'session' || !auth.userId) {
      throw new UnauthorizedError('User session required');
    }

    const body = request.body as {
      name: string;
      scopes: string[];
      expires_at?: string;
    };

    const result = await accountService.createApiKey(
      auth.userId,
      body.name,
      body.scopes,
      body.expires_at,
      auth.auth_type,
      prisma,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  app.get('/api-keys', {
    schema: { tags: ['Account'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    if (auth.auth_type !== 'session' || !auth.userId) {
      throw new UnauthorizedError('User session required');
    }

    const keys = await accountService.listApiKeys(auth.userId, prisma);

    return reply.send({
      success: true,
      keys,
      total: keys.length,
      max_allowed: MAX_API_KEYS_PER_USER,
      data: {
        keys,
        total: keys.length,
        max_allowed: MAX_API_KEYS_PER_USER,
      },
    });
  });

  app.delete('/api-keys/:id', {
    schema: { tags: ['Account'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    if (auth.auth_type !== 'session' || !auth.userId) {
      throw new UnauthorizedError('User session required');
    }
    const { id } = request.params as { id: string };

    await accountService.revokeApiKey(auth.userId, id, prisma);

    return reply.send({
      success: true,
      status: 'ok',
      message: 'API key revoked',
      id,
      data: {
        status: 'ok',
        message: 'API key revoked',
        id,
      },
    });
  });

  app.get('/onboarding', {
    schema: { tags: ['Account'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretOnboardingAuth(auth);
    const { agent_id } = request.query as Record<string, string | undefined>;
    const agentId = await resolveAuthorizedNodeId(app, auth, {
      requestedNodeId: agent_id,
      missingNodeMessage: 'No accessible agent found for current credentials',
      unauthorizedMessage: 'Cannot access onboarding for another agent',
    });

    const result = await accountService.getOnboardingJourney(agentId, prisma);

    return reply.send(buildOnboardingJourneyPayload(result));
  });

  app.post('/onboarding/complete', {
    schema: { tags: ['Account'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretOnboardingAuth(auth);
    const body = request.body as {
      agent_id?: string;
      step: number;
    };

    if (!body.step || !Number.isInteger(body.step) || body.step < 1) {
      throw new ValidationError('Valid step number is required');
    }

    accountService.getOnboardingStepDetail(body.step);
    const agentId = await resolveAuthorizedNodeId(app, auth, {
      requestedNodeId: body.agent_id,
      missingNodeMessage: 'No accessible agent found for current credentials',
      unauthorizedMessage: 'Cannot modify onboarding for another agent',
    });

    await accountService.completeOnboardingStep(
      agentId,
      body.step,
      prisma,
    );
    const result = await accountService.getOnboardingJourney(agentId, prisma);

    return reply.send({
      ...buildOnboardingJourneyPayload(result),
      status: 'ok',
      completed_step: body.step,
      next_step: result.next_step?.step ?? null,
    });
  });

  app.get('/me', {
    schema: { tags: ['Account'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    return reply.send({
      success: true,
      data: {
        node_id: auth.node_id,
        auth_type: auth.auth_type,
        trust_level: auth.trust_level,
      },
    });
  });

  app.post('/logout', {
    schema: { tags: ['Account'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const sessionToken = request.cookies?.session_token;
    if (sessionToken) {
      await accountService.deleteSessionByToken(sessionToken, prisma);
    }
    void reply.clearCookie('session_token', {
      path: '/',
      sameSite: 'lax',
    });
    return reply.send({ success: true });
  });

  app.post('/onboarding/reset', {
    schema: { tags: ['Account'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretOnboardingAuth(auth);
    const body = request.body as {
      agent_id?: string;
    };
    const agentId = await resolveAuthorizedNodeId(app, auth, {
      requestedNodeId: body.agent_id,
      missingNodeMessage: 'No accessible agent found for current credentials',
      unauthorizedMessage: 'Cannot modify onboarding for another agent',
    });

    await accountService.resetOnboarding(agentId, prisma);
    const result = await accountService.getOnboardingJourney(agentId, prisma);

    return reply.send({
      ...buildOnboardingJourneyPayload(result),
      status: 'ok',
      progress_percentage: result.progress_percentage,
    });
  });

  app.get('/agents', {
    schema: { tags: ['Account'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    if (auth.auth_type !== 'session' || !auth.userId) {
      throw new UnauthorizedError('User session required');
    }

    const nodes = await accountService.getUserNodes(auth.userId, prisma);
    return reply.send({ success: true, data: nodes });
  });
}
