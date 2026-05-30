import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as service from './service';
import { ValidationError, UnauthorizedError } from '../shared/errors';

// Supported OAuth2 providers
const SUPPORTED_PROVIDERS = ['github', 'google', 'discord'] as const;
type OAuthProvider = typeof SUPPORTED_PROVIDERS[number];

export async function oauthRoutes(app: FastifyInstance): Promise<void> {
  const prisma = app.prisma;

  // ===== OAuth2 Authorization Endpoint =====
  // GET /oauth/authorize?provider=github&redirect_uri=...&state=...&code_challenge=...
  app.get('/oauth/authorize', {
    schema: {
      tags: ['OAuth'],
      querystring: {
        type: 'object',
        required: ['provider', 'redirect_uri'],
        properties: {
          provider: { type: 'string', enum: [...SUPPORTED_PROVIDERS] },
          redirect_uri: { type: 'string', format: 'uri' },
          state: { type: 'string' },
          code_challenge: { type: 'string' },
          code_challenge_method: { type: 'string', enum: ['S256', 'plain'], default: 'S256' },
          scope: { type: 'string', default: 'read profile email' },
        },
      },
    },
  }, async (request, reply) => {
    const query = request.query as {
      provider: OAuthProvider;
      redirect_uri: string;
      state?: string;
      code_challenge?: string;
      code_challenge_method?: 'S256' | 'plain';
      scope?: string;
    };

    // Validate PKCE code_challenge
    if (query.code_challenge) {
      if (!/^[A-Za-z0-9_-]{43,128}$/.test(query.code_challenge)) {
        throw new ValidationError('Invalid code_challenge format (must be 43-128 base64url chars)');
      }
      if (!query.code_challenge_method) {
        query.code_challenge_method = 'S256';
      }
    }

    // Generate authorization URL for the provider
    const authUrl = service.buildAuthorizationUrl(
      query.provider,
      query.redirect_uri,
      query.state,
      query.code_challenge,
      query.code_challenge_method,
      query.scope,
    );

    return reply.send({
      success: true,
      authorization_url: authUrl,
      provider: query.provider,
      state: query.state,
      code_challenge_received: !!query.code_challenge,
      code_challenge_method: query.code_challenge_method,
    });
  });

  // ===== OAuth2 Token Endpoint =====
  // POST /oauth/token — exchange authorization code for tokens
  app.post('/oauth/token', {
    schema: {
      tags: ['OAuth'],
      body: {
        type: 'object',
        required: ['grant_type', 'code', 'redirect_uri', 'provider'],
        properties: {
          grant_type: { type: 'string', enum: ['authorization_code', 'refresh_token'] },
          code: { type: 'string' },
          redirect_uri: { type: 'string', format: 'uri' },
          provider: { type: 'string', enum: [...SUPPORTED_PROVIDERS] },
          code_verifier: { type: 'string' },
          refresh_token: { type: 'string' },
          client_id: { type: 'string' },
          client_secret: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      grant_type: 'authorization_code' | 'refresh_token';
      code?: string;
      redirect_uri: string;
      provider: OAuthProvider;
      code_verifier?: string;
      refresh_token?: string;
      client_id?: string;
      client_secret?: string;
    };

    if (body.grant_type === 'authorization_code') {
      if (!body.code || !body.code_verifier) {
        throw new ValidationError('code and code_verifier are required for authorization_code grant');
      }

      // Verify the authorization code and PKCE
      const result = await service.exchangeCodeForToken(
        body.code,
        body.code_verifier,
        body.redirect_uri,
        body.provider,
        prisma,
      );

      void reply.status(200);
      return {
        success: true,
        access_token: result.access_token,
        token_type: 'Bearer',
        expires_in: result.expires_in,
        refresh_token: result.refresh_token,
        scope: result.scope,
        data: result,
      };
    }

    if (body.grant_type === 'refresh_token') {
      if (!body.refresh_token) {
        throw new ValidationError('refresh_token is required for refresh_token grant');
      }

      const result = await service.refreshAccessToken(
        body.refresh_token,
        body.provider,
        prisma,
      );

      void reply.status(200);
      return {
        success: true,
        access_token: result.access_token,
        token_type: 'Bearer',
        expires_in: result.expires_in,
        refresh_token: result.refresh_token,
        scope: result.scope,
        data: result,
      };
    }

    throw new ValidationError('Unsupported grant_type');
  });

  // ===== OAuth2 User Info =====
  // GET /oauth/userinfo — get OAuth-linked user info
  app.get('/oauth/userinfo', {
    schema: { tags: ['OAuth'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    if (!auth.userId) {
      throw new UnauthorizedError('User session required for OAuth user info');
    }

    const userInfo = await service.getOAuthUserInfo(auth.userId, prisma);
    return reply.send({
      success: true,
      data: userInfo,
    });
  });

  // ===== OAuth2 Link Provider =====
  // POST /oauth/link — link OAuth provider to existing account
  app.post('/oauth/link', {
    schema: {
      tags: ['OAuth'],
      body: {
        type: 'object',
        required: ['provider', 'code', 'redirect_uri'],
        properties: {
          provider: { type: 'string', enum: [...SUPPORTED_PROVIDERS] },
          code: { type: 'string' },
          redirect_uri: { type: 'string', format: 'uri' },
          code_verifier: { type: 'string' },
        },
      },
    },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      provider: OAuthProvider;
      code: string;
      redirect_uri: string;
      code_verifier?: string;
    };

    if (!auth.userId) {
      throw new UnauthorizedError('User session required to link OAuth provider');
    }

    const result = await service.linkOAuthProvider(
      auth.userId,
      body.provider,
      body.code,
      body.code_verifier,
      body.redirect_uri,
      prisma,
    );

    return reply.send({
      success: true,
      linked: result.linked,
      provider: body.provider,
      data: result,
    });
  });

  // ===== OAuth2 Unlink Provider =====
  // DELETE /oauth/link/:provider — unlink OAuth provider
  app.delete('/oauth/link/:provider', {
    schema: {
      tags: ['OAuth'],
      params: {
        type: 'object',
        properties: {
          provider: { type: 'string', enum: [...SUPPORTED_PROVIDERS] },
        },
      },
    },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { provider } = request.params as { provider: OAuthProvider };

    if (!auth.userId) {
      throw new UnauthorizedError('User session required to unlink OAuth provider');
    }

    await service.unlinkOAuthProvider(auth.userId, provider, prisma);
    return reply.send({
      success: true,
      provider,
      message: `OAuth provider ${provider} unlinked successfully`,
    });
  });

  // ===== OAuth2 List Linked Providers =====
  // GET /oauth/providers — list linked OAuth providers
  app.get('/oauth/providers', {
    schema: { tags: ['OAuth'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    if (!auth.userId) {
      throw new UnauthorizedError('User session required');
    }

    const providers = await service.listLinkedProviders(auth.userId, prisma);
    return reply.send({
      success: true,
      providers,
      data: providers,
    });
  });

  // ===== OAuth2 Revoke Token =====
  // POST /oauth/revoke — revoke OAuth tokens
  app.post('/oauth/revoke', {
    schema: {
      tags: ['OAuth'],
      body: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          token_type_hint: { type: 'string', enum: ['access_token', 'refresh_token'] },
        },
      },
    },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { token?: string; token_type_hint?: string };

    if (!auth.userId) {
      throw new UnauthorizedError('User session required');
    }

    await service.revokeOAuthToken(auth.userId, body.token, prisma);
    return reply.send({
      success: true,
      message: 'Token revoked successfully',
    });
  });

  // ===== OAuth2 Callback (Provider redirect handler) =====
  // POST /oauth/callback/:provider — handle OAuth provider callback
  app.post('/oauth/callback/:provider', {
    schema: {
      tags: ['OAuth'],
      params: {
        type: 'object',
        properties: {
          provider: { type: 'string', enum: [...SUPPORTED_PROVIDERS] },
        },
      },
      body: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          state: { type: 'string' },
          error: { type: 'string' },
          error_description: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { provider } = request.params as { provider: OAuthProvider };
    const body = request.body as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    if (body.error) {
      throw new ValidationError(`OAuth error: ${body.error} - ${body.error_description}`);
    }

    if (!body.code) {
      throw new ValidationError('Authorization code is required');
    }

    // Generate a temporary auth code for the frontend to exchange
    const tempCode = await service.createOAuthCallbackCode(
      provider,
      body.code,
      body.state,
      prisma,
    );

    return reply.send({
      success: true,
      code: tempCode,
      state: body.state,
      provider,
    });
  });
}
