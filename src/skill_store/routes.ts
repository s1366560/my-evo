import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as skillStoreService from './service';
import { ValidationError } from '../shared/errors';

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
    );

    return reply.send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // GET /api/v2/skills/categories
  // -------------------------------------------------------------------------
  app.get('/categories', {
    schema: { tags: ['SkillStore'] },
  }, async (request, reply) => {
    const result = await skillStoreService.getCategories();
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

    const result = await skillStoreService.getFeaturedSkills(parsedLimit);
    return reply.send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // GET /api/v2/skills/:skillId
  // -------------------------------------------------------------------------
  app.get('/:skillId', {
    schema: { tags: ['SkillStore'] },
  }, async (request, reply) => {
    const { skillId } = request.params as { skillId: string };

    const result = await skillStoreService.getSkill(skillId);
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

    const result = await skillStoreService.createSkill(auth.node_id, {
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
    });

    return reply.status(201).send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // PUT /api/v2/skills/:skillId
  // -------------------------------------------------------------------------
  app.put('/:skillId', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
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

    const result = await skillStoreService.updateSkill(skillId, auth.node_id, body);
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
    const { skillId } = request.params as { skillId: string };

    await skillStoreService.deleteSkill(skillId, auth.node_id);
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
    const { skillId } = request.params as { skillId: string };

    const result = await skillStoreService.publishSkill(skillId, auth.node_id);
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
    const { skillId } = request.params as { skillId: string };
    const body = request.body as { rating: number };

    if (!body.rating) {
      throw new ValidationError('rating is required');
    }

    const result = await skillStoreService.rateSkill(
      skillId,
      auth.node_id,
      body.rating,
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
    const { skillId } = request.params as { skillId: string };

    const result = await skillStoreService.downloadSkill(skillId, auth.node_id);
    return reply.send({ success: true, data: result });
  });
}
