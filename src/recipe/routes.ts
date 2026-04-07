import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError } from '../shared/errors';
import * as service from './service';

export async function recipeRoutes(app: FastifyInstance) {
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
}
