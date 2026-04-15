import type { FastifyInstance } from 'fastify';
import { authenticate, requireAuth, requireNodeSecretAuth } from '../shared/auth';
import { resolveAuthorizedNodeId } from '../shared/node-access';
import * as skillStoreService from './service';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../shared/errors';

async function authenticateIfPresent(request: Parameters<typeof authenticate>[0]) {
  const hasSessionToken = Boolean(
    request.cookies?.session_token || request.headers['x-session-token'],
  );
  const hasBearerToken = typeof request.headers.authorization === 'string'
    && request.headers.authorization.startsWith('Bearer ');

  if (!hasSessionToken && !hasBearerToken) {
    return undefined;
  }

  try {
    return await authenticate(request);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return undefined;
    }

    throw error;
  }
}

async function resolveSkillNodeId(
  app: FastifyInstance,
  auth: NonNullable<import('fastify').FastifyRequest['auth']>,
) {
  return resolveAuthorizedNodeId(app, auth, {
    missingNodeMessage: 'No accessible node found for current credentials',
  });
}

function ensureSkillWriteAuth(auth: NonNullable<import('fastify').FastifyRequest['auth']>): void {
  if (auth.auth_type === 'api_key') {
    throw new ForbiddenError('API keys cannot modify skill store state');
  }
}

function ensureNodeSecretAuth(auth: NonNullable<import('fastify').FastifyRequest['auth']>): void {
  if (auth.auth_type !== 'node_secret') {
    throw new ForbiddenError('Node secret credentials are required for skill store mutations');
  }
}

function parseNonNegativeInteger(
  value: string | undefined,
  field: string,
  defaultValue: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }
  if (!/^\d+$/.test(value)) {
    throw new ValidationError(`${field} must be a non-negative integer`);
  }

  return Number(value);
}

function getSingleQueryValue(
  value: string | string[] | undefined,
  field: string,
): string | undefined {
  if (Array.isArray(value)) {
    throw new ValidationError(`${field} must not be repeated`);
  }

  return value;
}

function parseSortOption(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!['popular', 'newest', 'rating'].includes(value)) {
    throw new ValidationError('sort must be one of popular, newest, or rating');
  }

  return value;
}

type SkillWriteRequestBody = {
  name: string;
  description: string;
  category: string;
  price_credits?: number;
  code_template?: string;
  parameters?: Record<string, unknown>;
  steps?: string[];
  examples?: string[];
  tags?: string[];
  source_capsules?: string[];
  content?: {
    code_template?: string;
    parameters?: Record<string, unknown>;
    steps?: string[];
    examples?: string[];
  };
};

function normalizeSkillWriteInput(body: SkillWriteRequestBody) {
  return {
    name: body.name,
    description: body.description,
    category: body.category,
    price_credits: body.price_credits,
    code_template: body.code_template ?? body.content?.code_template,
    parameters: body.parameters ?? body.content?.parameters,
    steps: body.steps ?? body.content?.steps,
    examples: body.examples ?? body.content?.examples,
    tags: body.tags,
    source_capsules: body.source_capsules,
  };
}

function validateSkillWriteBody(body: SkillWriteRequestBody, options?: { allowDefaultCategory?: boolean }): void {
  if (!body.name) {
    throw new ValidationError('name is required');
  }
  if (!body.description) {
    throw new ValidationError('description is required');
  }
  if (!options?.allowDefaultCategory && !body.category) {
    throw new ValidationError('category is required');
  }
}

export async function skillStoreRoutes(app: FastifyInstance): Promise<void> {
  const listSkillsHandler = async (
    request: import('fastify').FastifyRequest,
    reply: import('fastify').FastifyReply,
  ) => {
    const {
      category,
      tags,
      search,
      limit,
      offset,
      sort,
      cursor,
    } = request.query as Record<string, string | string[] | undefined>;

    const parsedLimit = Math.min(
      parseNonNegativeInteger(getSingleQueryValue(limit, 'limit'), 'limit', 20),
      100,
    );
    const parsedOffset = getSingleQueryValue(offset, 'offset');
    const parsedTags: string[] | undefined = Array.isArray(tags)
      ? (tags as string[])
      : tags
        ? [tags as string]
        : undefined;
    const parsedSort = parseSortOption(getSingleQueryValue(sort, 'sort'));
    const parsedCategory = getSingleQueryValue(category, 'category');
    const parsedSearch = getSingleQueryValue(search, 'search');
    const parsedCursor = getSingleQueryValue(cursor, 'cursor');

    if (parsedOffset !== undefined) {
      throw new ValidationError('offset is not supported; use cursor for pagination');
    }

    const result = await skillStoreService.listSkills(
      parsedCategory,
      parsedTags,
      parsedSearch,
      parsedLimit,
      0,
      parsedSort,
      parsedCursor,
      app.prisma,
    );

    return reply.send({
      success: true,
      skills: result.items,
      next_cursor: result.next_cursor,
      has_more: result.has_more,
      data: result,
    });
  };

  const downloadSkillHandler = async (
    request: import('fastify').FastifyRequest,
    reply: import('fastify').FastifyReply,
  ) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const { skillId } = request.params as { skillId: string };

    const result = await skillStoreService.downloadSkill(skillId, nodeId, app.prisma);
    return reply.send({
      success: true,
      skill_id: result.skill_id,
      name: result.name,
      content: {
        code_template: result.code_template,
        parameters: result.parameters,
        steps: result.steps,
        examples: result.examples,
      },
      credits_charged: result.credits_charged,
      remaining_credits: result.remaining_credits,
      data: result,
    });
  };

  // -------------------------------------------------------------------------
  // GET /api/v2/skills
  // -------------------------------------------------------------------------
  app.get('/', {
    schema: { tags: ['SkillStore'] },
  }, listSkillsHandler);

  app.get('/browse', {
    schema: { tags: ['SkillStore'] },
  }, listSkillsHandler);

  // -------------------------------------------------------------------------
  // GET /api/v2/skills/categories
  // -------------------------------------------------------------------------
  app.get('/categories', {
    schema: { tags: ['SkillStore'] },
  }, async (request, reply) => {
    const result = await skillStoreService.getCategories(app.prisma);
    return reply.send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // GET /api/v2/skills/featured
  // -------------------------------------------------------------------------
  app.get('/featured', {
    schema: { tags: ['SkillStore'] },
  }, async (request, reply) => {
    const { limit } = request.query as Record<string, string | undefined>;
    const parsedLimit = Math.min(parseNonNegativeInteger(limit, 'limit', 10), 20);

    const result = await skillStoreService.getFeaturedSkills(parsedLimit, app.prisma);
    return reply.send({ success: true, data: result });
  });

  app.get('/stats', {
    schema: { tags: ['SkillStore'] },
  }, async (_request, reply) => {
    const result = await skillStoreService.getSkillStoreStats(app.prisma);
    return reply.send({ success: true, data: result });
  });

  app.get('/my', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const { limit, offset } = request.query as Record<string, string | undefined>;
    const parsedLimit = Math.min(parseNonNegativeInteger(limit, 'limit', 20), 100);
    const parsedOffset = parseNonNegativeInteger(offset, 'offset', 0);

    const result = await skillStoreService.getMySkills(
      nodeId,
      parsedLimit,
      parsedOffset,
      app.prisma,
    );

    return reply.send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // GET /api/v2/skills/:skillId
  // -------------------------------------------------------------------------
  app.get('/:skillId', {
    schema: { tags: ['SkillStore'] },
  }, async (request, reply) => {
    const { skillId } = request.params as { skillId: string };
    const auth = await authenticateIfPresent(request);
    let nodeId: string | undefined;
    if (auth) {
      try {
        nodeId = await resolveSkillNodeId(app, auth);
      } catch (error) {
        if (!(error instanceof ValidationError || error instanceof UnauthorizedError)) {
          throw error;
        }
      }
    }

    const result = await skillStoreService.getSkill(skillId, app.prisma, nodeId);
    if (!result) {
      return reply.status(404).send({
        success: false,
        error: 'Skill not found',
        message: `Skill with id '${skillId}' not found`,
      });
    }

    return reply.send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // POST /api/v2/skills
  // -------------------------------------------------------------------------
  app.post('/', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const body = request.body as SkillWriteRequestBody;
    validateSkillWriteBody(body);
    const input = normalizeSkillWriteInput(body);

    const result = await skillStoreService.createSkill(nodeId, input, app.prisma);

    return reply.status(201).send({ success: true, data: result });
  });

  app.post('/publish', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const body = request.body as SkillWriteRequestBody;
    validateSkillWriteBody(body, { allowDefaultCategory: true });
    const input = normalizeSkillWriteInput({
      ...body,
      category: body.category ?? 'general',
    });

    const published = await skillStoreService.createPublishedSkill(nodeId, input, app.prisma);

    return reply.status(201).send({
      success: true,
      skill_id: published.skill_id,
      status: published.status,
      message: 'Skill passed moderation and is now available.',
      data: {
        ...published,
      },
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/v2/skills/:skillId
  // -------------------------------------------------------------------------
  app.put('/:skillId', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const { skillId } = request.params as { skillId: string };
    const body = request.body as {
      name?: string;
      description?: string;
      category?: string;
      price_credits?: number;
      code_template?: string | null;
      parameters?: Record<string, unknown> | null;
      steps?: string[];
      examples?: string[];
      tags?: string[];
      source_capsules?: string[];
    };

    const result = await skillStoreService.updateSkillVersion(skillId, nodeId, body, app.prisma);
    return reply.send({ success: true, data: result });
  });

  app.post('/:skillId/update', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const { skillId } = request.params as { skillId: string };
    const body = request.body as {
      version?: string;
      name?: string;
      description?: string;
      category?: string;
      price_credits?: number;
      code_template?: string | null;
      parameters?: Record<string, unknown> | null;
      steps?: string[];
      examples?: string[];
      tags?: string[];
      source_capsules?: string[];
    };

    const result = await skillStoreService.updateSkillVersion(skillId, nodeId, body, app.prisma);
    return reply.send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/v2/skills/:skillId
  // -------------------------------------------------------------------------
  app.delete('/:skillId', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const { skillId } = request.params as { skillId: string };

    await skillStoreService.deleteSkill(skillId, nodeId, app.prisma);
    return reply.send({ success: true, data: { deleted: true } });
  });

  app.delete('/:skillId/delete', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const { skillId } = request.params as { skillId: string };

    await skillStoreService.deleteSkill(skillId, nodeId, app.prisma);
    return reply.send({ success: true, data: { deleted: true } });
  });

  // -------------------------------------------------------------------------
  // POST /api/v2/skills/:skillId/publish
  // -------------------------------------------------------------------------
  app.post('/:skillId/publish', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const { skillId } = request.params as { skillId: string };

    const result = await skillStoreService.publishSkill(skillId, nodeId, app.prisma);
    return reply.send({ success: true, data: result });
  });

  app.post('/:skillId/rollback', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const { skillId } = request.params as { skillId: string };
    const body = (request.body as { version?: string } | undefined) ?? {};

    const result = await skillStoreService.rollbackSkillVersion(
      skillId,
      nodeId,
      body.version,
      app.prisma,
    );
    return reply.send({ success: true, data: result });
  });

  app.post('/:skillId/restore', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const { skillId } = request.params as { skillId: string };

    const result = await skillStoreService.restoreSkill(skillId, nodeId, app.prisma);
    return reply.send({ success: true, data: result });
  });

  app.delete('/:skillId/permanent-delete', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const { skillId } = request.params as { skillId: string };

    const result = await skillStoreService.permanentlyDeleteSkill(skillId, nodeId, app.prisma);
    return reply.send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // GET /api/v2/skills/:skillId/rate
  // -------------------------------------------------------------------------
  app.get('/:skillId/rate', {
    schema: { tags: ['SkillStore'] },
  }, async (request, reply) => {
    const { skillId } = request.params as { skillId: string };

    const { prisma } = app;
    const ratings = await prisma.skillRating.findMany({
      where: { skill_id: skillId },
      orderBy: { created_at: 'desc' },
    });

    return reply.send({
      success: true,
      data: { items: ratings, total: ratings.length },
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/v2/skills/:skillId/rate
  // -------------------------------------------------------------------------
  app.post('/:skillId/rate', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const { skillId } = request.params as { skillId: string };
    const body = request.body as { rating: number };

    if (!body.rating) {
      throw new ValidationError('rating is required');
    }
    if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
      throw new ValidationError('rating must be an integer between 1 and 5');
    }

    const result = await skillStoreService.rateSkill(
      skillId,
      nodeId,
      body.rating,
      app.prisma,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // POST /api/v2/skills/:skillId/download
  // -------------------------------------------------------------------------
  app.post('/:skillId/download', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireNodeSecretAuth()],
  }, downloadSkillHandler);

  // -------------------------------------------------------------------------
  // POST /api/v2/skills/:skillId/install
  // Compatibility alias for architecture overview and older clients.
  // -------------------------------------------------------------------------
  app.post('/:skillId/install', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireNodeSecretAuth()],
  }, downloadSkillHandler);
}
