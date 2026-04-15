import type { FastifyInstance } from 'fastify';
import { authenticate, requireAuth } from '../shared/auth';
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

export async function skillStoreRoutes(app: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /api/v2/skills
  // -------------------------------------------------------------------------
  app.get('/', {
    schema: { tags: ['SkillStore'] },
  }, async (request, reply) => {
    const {
      category,
      tags,
      search,
      limit,
      offset,
      sort,
    } = request.query as Record<string, string | string[] | undefined>;

    const parsedLimit = limit ? Math.min(Number(limit), 100) : 20;
    const parsedOffset = offset ? Number(offset) : 0;
    const parsedTags: string[] | undefined = Array.isArray(tags)
      ? (tags as string[])
      : tags
        ? [tags as string]
        : undefined;
    const parsedSort: string | undefined = Array.isArray(sort)
      ? (sort as string[])[0]
      : (sort as string | undefined);

    const result = await skillStoreService.listSkills(
      category as string | undefined,
      parsedTags,
      search as string | undefined,
      parsedLimit,
      parsedOffset,
      parsedSort,
      app.prisma,
    );

    return reply.send({ success: true, data: result });
  });

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
    const parsedLimit = limit ? Math.min(Number(limit), 20) : 10;

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
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const { limit, offset } = request.query as Record<string, string | undefined>;
    const parsedLimit = limit ? Math.min(Number(limit), 100) : 20;
    const parsedOffset = offset ? Number(offset) : 0;

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
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const body = request.body as {
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
    };

    if (!body.name) {
      throw new ValidationError('name is required');
    }
    if (!body.description) {
      throw new ValidationError('description is required');
    }
    if (!body.category) {
      throw new ValidationError('category is required');
    }

    const result = await skillStoreService.createSkill(nodeId, {
      name: body.name,
      description: body.description,
      category: body.category,
      price_credits: body.price_credits,
      code_template: body.code_template,
      parameters: body.parameters,
      steps: body.steps,
      examples: body.examples,
      tags: body.tags,
      source_capsules: body.source_capsules,
    }, app.prisma);

    return reply.status(201).send({ success: true, data: result });
  });

  app.post('/publish', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const body = request.body as {
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
    };

    const published = await skillStoreService.createPublishedSkill(nodeId, {
      name: body.name,
      description: body.description,
      category: body.category,
      price_credits: body.price_credits,
      code_template: body.code_template,
      parameters: body.parameters,
      steps: body.steps,
      examples: body.examples,
      tags: body.tags,
      source_capsules: body.source_capsules,
    }, app.prisma);

    return reply.status(201).send({ success: true, data: published });
  });

  // -------------------------------------------------------------------------
  // PUT /api/v2/skills/:skillId
  // -------------------------------------------------------------------------
  app.put('/:skillId', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
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

    const result = await skillStoreService.updateSkill(skillId, nodeId, body, app.prisma);
    return reply.send({ success: true, data: result });
  });

  app.post('/:skillId/update', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
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
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const { skillId } = request.params as { skillId: string };

    await skillStoreService.deleteSkill(skillId, nodeId, app.prisma);
    return reply.send({ success: true, data: { deleted: true } });
  });

  app.delete('/:skillId/delete', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
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
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const { skillId } = request.params as { skillId: string };

    const result = await skillStoreService.publishSkill(skillId, nodeId, app.prisma);
    return reply.send({ success: true, data: result });
  });

  app.post('/:skillId/rollback', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
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
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const { skillId } = request.params as { skillId: string };

    const result = await skillStoreService.restoreSkill(skillId, nodeId, app.prisma);
    return reply.send({ success: true, data: result });
  });

  app.delete('/:skillId/permanent-delete', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
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
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const { skillId } = request.params as { skillId: string };
    const body = request.body as { rating: number };

    if (!body.rating) {
      throw new ValidationError('rating is required');
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
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureSkillWriteAuth(auth);
    const nodeId = await resolveSkillNodeId(app, auth);
    const { skillId } = request.params as { skillId: string };

    const result = await skillStoreService.downloadSkill(skillId, nodeId, app.prisma);
    return reply.send({ success: true, data: result });
  });
}
