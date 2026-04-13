import type { FastifyInstance } from 'fastify';
import * as searchService from './service';
import { DEFAULT_SEARCH_LIMIT } from '../shared/constants';
import { ValidationError } from '../shared/errors';

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', {
    schema: { tags: ['Search'] },
  }, async (request, reply) => {
    const { q, type, status, signals, tags, min_gdi, author_id, sort_by, limit, offset } =
      request.query as Record<string, string | undefined>;
    const normalizedStatus = status?.trim();

    if (!q || q.trim().length === 0) {
      throw new ValidationError('Search query "q" is required');
    }
    if (normalizedStatus && normalizedStatus !== 'published' && normalizedStatus !== 'promoted') {
      throw new ValidationError('status must be published or promoted');
    }

    const result = await searchService.search({
      q,
      type: type as 'gene' | 'capsule' | 'skill' | undefined,
      status: normalizedStatus as 'published' | 'promoted' | undefined,
      signals: signals ? signals.split(',') : undefined,
      tags: tags ? tags.split(',') : undefined,
      min_gdi: min_gdi ? Number(min_gdi) : undefined,
      author_id,
      sort_by: sort_by as 'relevance' | 'gdi' | 'downloads' | 'rating' | 'newest' | undefined,
      limit: limit ? Number(limit) : DEFAULT_SEARCH_LIMIT,
      offset: offset ? Number(offset) : 0,
    }, app.prisma);

    return reply.send({ success: true, data: result });
  });

  app.get('/autocomplete', {
    schema: { tags: ['Search'] },
  }, async (request, reply) => {
    const { prefix, type } = request.query as Record<string, string | undefined>;

    if (!prefix || prefix.trim().length === 0) {
      throw new ValidationError('Autocomplete prefix is required');
    }

    const result = await searchService.autocomplete(
      prefix,
      type as 'gene' | 'capsule' | 'skill' | undefined,
      app.prisma,
    );

    return reply.send({ success: true, data: result });
  });

  app.get('/trending', {
    schema: { tags: ['Search'] },
  }, async (request, reply) => {
    const { limit } = request.query as Record<string, string | undefined>;

    const result = await searchService.trending(
      limit ? Number(limit) : 20,
      app.prisma,
    );

    return reply.send({ success: true, data: result });
  });

  app.get('/similar/:assetId', {
    schema: { tags: ['Search'] },
  }, async (request, reply) => {
    const { assetId } = request.params as { assetId: string };
    const { threshold } = request.query as Record<string, string | undefined>;

    const result = await searchService.findSimilar(
      assetId,
      threshold ? Number(threshold) : undefined,
      app.prisma,
    );

    return reply.send({ success: true, data: result });
  });
}
