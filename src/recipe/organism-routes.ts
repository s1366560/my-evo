import type { FastifyInstance } from 'fastify';
import * as service from './service';

export async function organismRoutes(app: FastifyInstance): Promise<void> {
  app.get('/:organismId', {
    schema: { tags: ['Recipe'] },
  }, async (request) => {
    const { organismId } = request.params as { organismId: string };
    const organism = await service.getOrganism(organismId);
    return { success: true, organism, data: organism };
  });

  app.get('/:organismId/progress', {
    schema: { tags: ['Recipe'] },
  }, async (request) => {
    const { organismId } = request.params as { organismId: string };
    const organism = await service.getOrganism(organismId);
    const genesTotalCount = organism.genes_total_count || 0;
    const genesExpressed = organism.genes_expressed || 0;
    const progress = genesTotalCount > 0
      ? Math.min(100, Math.round((genesExpressed / genesTotalCount) * 100))
      : 0;

    return {
      success: true,
      organism_id: organism.organism_id,
      recipe_id: organism.recipe_id,
      status: organism.status,
      genes_expressed: genesExpressed,
      genes_total_count: genesTotalCount,
      current_position: organism.current_position,
      progress_percent: progress,
      updated_at: organism.updated_at,
      data: {
        organism_id: organism.organism_id,
        recipe_id: organism.recipe_id,
        status: organism.status,
        genes_expressed: genesExpressed,
        genes_total_count: genesTotalCount,
        current_position: organism.current_position,
        progress_percent: progress,
        updated_at: organism.updated_at,
      },
    };
  });
}
