import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError, NotFoundError } from '../shared/errors';
import * as service from './service';

export async function recipeRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  // List recipes
  app.get('/', {
    schema: { tags: ['Recipe'] },
  }, async (request) => {
    const query = request.query as {
      status?: string;
      author?: string;
      limit?: string;
      offset?: string;
    };

    const result = await service.listRecipes(
      query.status,
      query.author,
      query.limit ? parseInt(query.limit, 10) : 20,
      query.offset ? parseInt(query.offset, 10) : 0,
    );

    return {
      success: true,
      data: { items: result.items, total: result.total },
    };
  });

  // Get recipe detail
  app.get('/:recipeId', {
    schema: { tags: ['Recipe'] },
  }, async (request) => {
    const params = request.params as { recipeId: string };
    const recipe = await service.getRecipe(params.recipeId);
    return { success: true, data: recipe };
  });

  // Create recipe
  app.post('/', {
    schema: { tags: ['Recipe'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      title: string;
      description: string;
      genes?: unknown;
      price_per_execution?: number;
      max_concurrent?: number;
      input_schema?: unknown;
      output_schema?: unknown;
    };

    if (!body.title || !body.description) {
      throw new EvoMapError('title and description are required', 'VALIDATION_ERROR', 400);
    }

    const recipe = await service.createRecipe(
      auth.node_id,
      body.title,
      body.description,
      body.genes,
      body.price_per_execution,
      body.max_concurrent,
      body.input_schema,
      body.output_schema,
    );

    void reply.status(201);
    return { success: true, data: recipe };
  });

  // Update recipe
  app.put('/:recipeId', {
    schema: { tags: ['Recipe'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { recipeId: string };
    const auth = request.auth!;
    const body = request.body as {
      title?: string;
      description?: string;
      genes?: unknown;
      price_per_execution?: number;
      max_concurrent?: number;
      input_schema?: unknown;
      output_schema?: unknown;
    };

    const recipe = await service.updateRecipe(params.recipeId, auth.node_id, body);
    return { success: true, data: recipe };
  });

  // Publish recipe
  app.post('/:recipeId/publish', {
    schema: { tags: ['Recipe'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { recipeId: string };
    const auth = request.auth!;
    const recipe = await service.publishRecipe(params.recipeId, auth.node_id);
    return { success: true, data: recipe };
  });

  // Delete recipe
  app.delete('/:recipeId', {
    schema: { tags: ['Recipe'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { recipeId: string };
    const auth = request.auth!;
    await service.deleteRecipe(params.recipeId, auth.node_id);
    return { success: true, data: null };
  });

  // List organisms
  app.get('/:recipeId/organisms', {
    schema: { tags: ['Recipe'] },
  }, async (request) => {
    const params = request.params as { recipeId: string };
    const organisms = await service.listOrganisms(params.recipeId);
    return { success: true, data: organisms };
  });

  // Create organism
  app.post('/:recipeId/organisms', {
    schema: { tags: ['Recipe'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const params = request.params as { recipeId: string };
    const auth = request.auth!;
    const body = request.body as {
      gene_ids?: string[];
      ttl_seconds?: number;
    };

    const organism = await service.createOrganism(
      params.recipeId,
      auth.node_id,
      body.gene_ids,
      body.ttl_seconds,
    );

    void reply.status(201);
    return { success: true, data: organism };
  });

  // Get organism
  app.get('/:recipeId/organisms/:organismId', {
    schema: { tags: ['Recipe'] },
  }, async (request) => {
    const params = request.params as { recipeId: string; organismId: string };
    const organism = await service.getOrganism(params.organismId);
    return { success: true, data: organism };
  });

  // Execute organism
  app.post('/:recipeId/organisms/:organismId/execute', {
    schema: { tags: ['Recipe'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { recipeId: string; organismId: string };
    const body = request.body as { inputs?: unknown };
    const result = await service.executeOrganism(params.organismId, body.inputs);
    return { success: true, data: result };
  });

  // ─── A. Recipe extensions ─────────────────────────────────────────────────────

  // GET /a2a/recipe/search — keyword search across published recipes
  app.get('/search', {
    schema: { tags: ['Recipe'] },
  }, async (request) => {
    const query = request.query as { q?: string; limit?: string; offset?: string };

    if (!query.q) {
      throw new EvoMapError('q (query) is required', 'VALIDATION_ERROR', 400);
    }

    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    const where = {
      status: 'published',
      OR: [
        { title: { contains: query.q, mode: 'insensitive' as const } },
        { description: { contains: query.q, mode: 'insensitive' as const } },
      ],
    };

    const [items, total] = await Promise.all([
      prisma.recipe.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip: offset }),
      prisma.recipe.count({ where }),
    ]);

    return { success: true, data: { items, total } };
  });

  // GET /a2a/recipe/stats — aggregate recipe statistics
  app.get('/stats', {
    schema: { tags: ['Recipe'] },
  }, async () => {
    const [total, published, draft] = await Promise.all([
      prisma.recipe.count(),
      prisma.recipe.count({ where: { status: 'published' } }),
      prisma.recipe.count({ where: { status: 'draft' } }),
    ]);

    const organismsResult = await prisma.organism.groupBy({
      by: ['status'],
      _count: { organism_id: true },
    });

    const organismStats: Record<string, number> = {};
    for (const row of organismsResult) {
      organismStats[row.status] = row._count.organism_id;
    }

    return {
      success: true,
      data: {
        total_recipes: total,
        published_recipes: published,
        draft_recipes: draft,
        organisms: organismStats,
      },
    };
  });

  // POST /a2a/recipe/:id/express — express a recipe into a live organism instance
  app.post('/:recipeId/express', {
    schema: { tags: ['Recipe'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const params = request.params as { recipeId: string };
    const body = request.body as { gene_ids?: string[]; ttl_seconds?: number };

    const recipe = await prisma.recipe.findUnique({
      where: { recipe_id: params.recipeId },
    });

    if (!recipe) {
      throw new NotFoundError('Recipe', params.recipeId);
    }

    if (recipe.status !== 'published') {
      throw new EvoMapError('Only published recipes can be expressed', 'VALIDATION_ERROR', 400);
    }

    const organismId = crypto.randomUUID();
    const now = new Date();
    const genes = (body.gene_ids ?? []) as string[];
    const genesTotalCount = genes.length;

    const organism = await prisma.organism.create({
      data: {
        organism_id: organismId,
        recipe_id: params.recipeId,
        status: 'assembling',
        genes_expressed: 0,
        genes_total_count: genesTotalCount,
        current_position: 0,
        ttl_seconds: body.ttl_seconds ?? 3600,
        created_at: now,
        updated_at: now,
      },
    });

    void reply.status(201);
    return { success: true, data: organism };
  });

  // ─── B. Organism routes ───────────────────────────────────────────────────────

  // GET /a2a/organism/active — list organisms, optionally filtered by executor
  app.get('/organism/active', {
    schema: { tags: ['Recipe'] },
  }, async (request) => {
    const query = request.query as { executor_node_id?: string; limit?: string; offset?: string };

    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    // organisms are linked to recipes via recipe_id; to filter by executor_node_id
    // we join through the recipe author relationship
    const recipes = query.executor_node_id
      ? await prisma.recipe.findMany({
          where: { author_id: query.executor_node_id },
          select: { recipe_id: true },
        })
      : null;

    const recipeIds = recipes ? recipes.map((r) => r.recipe_id) : undefined;

    const where: Record<string, unknown> = {
      status: { in: ['assembling', 'running'] },
    };
    if (recipeIds) {
      where.recipe_id = { in: recipeIds };
    }

    const [items, total] = await Promise.all([
      prisma.organism.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.organism.count({ where }),
    ]);

    return { success: true, data: { items, total } };
  });

  // PATCH /a2a/organism/:id — update organism (status, position, etc.)
  app.patch('/organism/:organismId', {
    schema: { tags: ['Recipe'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { organismId: string };
    const body = request.body as {
      status?: string;
      genes_expressed?: number;
      current_position?: number;
      ttl_seconds?: number;
    };

    const organism = await prisma.organism.findUnique({
      where: { organism_id: params.organismId },
    });

    if (!organism) {
      throw new NotFoundError('Organism', params.organismId);
    }

    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (body.status !== undefined) updateData.status = body.status;
    if (body.genes_expressed !== undefined) updateData.genes_expressed = body.genes_expressed;
    if (body.current_position !== undefined) updateData.current_position = body.current_position;
    if (body.ttl_seconds !== undefined) updateData.ttl_seconds = body.ttl_seconds;

    const updated = await prisma.organism.update({
      where: { organism_id: params.organismId },
      data: updateData,
    });

    return { success: true, data: updated };
  });
}
