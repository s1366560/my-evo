import type { FastifyInstance } from 'fastify';
import { requireAuth, authenticate } from '../shared/auth';
import * as accountService from './service';
import { ValidationError } from '../shared/errors';

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', {
    schema: { tags: ['Account'] },
  }, async (request, reply) => {
    const body = request.body as { email?: string; password?: string };
    const result = await accountService.registerUser(
      body.email ?? '',
      body.password ?? '',
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
  }, async (request, reply) => {
    const auth = await authenticate(request);

    if (auth.auth_type === 'api_key') {
      const { KeyInceptionError } = await import('../shared/errors');
      throw new KeyInceptionError();
    }

    const body = request.body as {
      name: string;
      scopes: string[];
      expires_at?: string;
    };

    const result = await accountService.createApiKey(
      auth.node_id,
      body.name,
      body.scopes,
      body.expires_at,
      auth.auth_type,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  app.get('/api-keys', {
    schema: { tags: ['Account'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;

    const result = await accountService.listApiKeys(auth.node_id);

    return reply.send({ success: true, data: result });
  });

  app.delete('/api-keys/:id', {
    schema: { tags: ['Account'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };

    await accountService.revokeApiKey(auth.node_id, id);

    return reply.send({ success: true });
  });

  app.get('/onboarding', {
    schema: { tags: ['Account'] },
  }, async (request, reply) => {
    const { agent_id } = request.query as Record<string, string | undefined>;

    if (!agent_id) {
      throw new ValidationError('agent_id query parameter is required');
    }

    const result = await accountService.getOnboardingState(agent_id);

    return reply.send({ success: true, data: result });
  });

  app.post('/onboarding/complete', {
    schema: { tags: ['Account'] },
  }, async (request, reply) => {
    const body = request.body as {
      agent_id: string;
      step: number;
    };

    if (!body.agent_id) {
      throw new ValidationError('agent_id is required');
    }
    if (!body.step || body.step < 1) {
      throw new ValidationError('Valid step number is required');
    }

    const result = await accountService.completeOnboardingStep(
      body.agent_id,
      body.step,
    );

    return reply.send({ success: true, data: result });
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
      await accountService.deleteSessionByToken(sessionToken);
    }
    void reply.clearCookie('session_token', {
      path: '/',
      sameSite: 'lax',
    });
    return reply.send({ success: true });
  });

  app.post('/onboarding/reset', {
    schema: { tags: ['Account'] },
  }, async (request, reply) => {
    const body = request.body as {
      agent_id: string;
    };

    if (!body.agent_id) {
      throw new ValidationError('agent_id is required');
    }

    const result = await accountService.resetOnboarding(body.agent_id);

    return reply.send({ success: true, data: result });
  });
  app.get('/agents', {
    schema: { tags: ['Account'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    if (!auth.userId) {
      void reply.status(401).send({ success: false, error: 'Authentication required' });
      return;
    }

    const nodes = await accountService.getUserNodes(auth.userId);
    return reply.send({ success: true, data: nodes });
  });
}
