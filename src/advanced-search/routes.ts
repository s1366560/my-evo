import type { FastifyInstance } from 'fastify';
import * as advSearchService from './service';
import { requireAuth } from '../shared/auth';
import type { AdvancedSearchQuery } from './types';

export async function advancedSearchRoutes(app: FastifyInstance): Promise<void> {

  // Advanced search endpoint
  app.post('/', {
    preHandler: [requireAuth()],
    schema: { tags: ['AdvancedSearch'] },
  }, async (request, reply) => {
    const query = request.body as Record<string, unknown>;
    const result = await advSearchService.advancedSearch(
      query as unknown as AdvancedSearchQuery,
      app.prisma,
    );
    return reply.send({ success: true, data: result });
  });

  // Get searchable fields
  app.get('/fields/:entityType', {
    preHandler: [requireAuth()],
    schema: { tags: ['AdvancedSearch'] },
  }, async (request, reply) => {
    const { entityType } = request.params as { entityType: string };
    const fields = await advSearchService.getSearchableFields(entityType);
    return reply.send({ success: true, data: { entity_type: entityType, fields } });
  });

  // Get sortable fields
  app.get('/sortable/:entityType', {
    preHandler: [requireAuth()],
    schema: { tags: ['AdvancedSearch'] },
  }, async (request, reply) => {
    const { entityType } = request.params as { entityType: string };
    const fields = await advSearchService.getSortableFields(entityType);
    return reply.send({ success: true, data: { entity_type: entityType, fields } });
  });

  // Get presets
  app.get('/presets', {
    preHandler: [requireAuth()],
    schema: { tags: ['AdvancedSearch'] },
  }, async (request, reply) => {
    const presets = advSearchService.getSearchPresets();
    return reply.send({ success: true, data: presets });
  });

  // Get preset by ID
  app.get('/presets/:presetId', {
    preHandler: [requireAuth()],
    schema: { tags: ['AdvancedSearch'] },
  }, async (request, reply) => {
    const { presetId } = request.params as { presetId: string };
    const preset = advSearchService.getSearchPreset(presetId);
    if (!preset) return reply.status(404).send({ success: false, error: 'Preset not found' });
    return reply.send({ success: true, data: preset });
  });

  // Save search
  app.post('/saved', {
    preHandler: [requireAuth()],
    schema: { tags: ['AdvancedSearch'] },
  }, async (request, reply) => {
    const { name, query, description } = request.body as Record<string, unknown>;
    const userId = (request as unknown as { user: { userId: string } }).user?.userId ?? 'anonymous';
    const saved = advSearchService.saveSearch(
      userId, String(name),
      query as unknown as AdvancedSearchQuery,
      description as string | undefined,
    );
    return reply.send({ success: true, data: saved });
  });

  // List saved searches
  app.get('/saved', {
    preHandler: [requireAuth()],
    schema: { tags: ['AdvancedSearch'] },
  }, async (request, reply) => {
    const userId = (request as unknown as { user: { userId: string } }).user?.userId ?? 'anonymous';
    const searches = advSearchService.getUserSavedSearches(userId);
    return reply.send({ success: true, data: searches });
  });

  // Get saved search
  app.get('/saved/:searchId', {
    preHandler: [requireAuth()],
    schema: { tags: ['AdvancedSearch'] },
  }, async (request, reply) => {
    const { searchId } = request.params as { searchId: string };
    const search = advSearchService.getSavedSearch(searchId);
    if (!search) return reply.status(404).send({ success: false, error: 'Saved search not found' });
    return reply.send({ success: true, data: search });
  });

  // Delete saved search
  app.delete('/saved/:searchId', {
    preHandler: [requireAuth()],
    schema: { tags: ['AdvancedSearch'] },
  }, async (request, reply) => {
    const { searchId } = request.params as { searchId: string };
    const userId = (request as unknown as { user: { userId: string } }).user?.userId ?? 'anonymous';
    const deleted = advSearchService.deleteSavedSearch(searchId, userId);
    return reply.send({ success: deleted });
  });
}
