/**
 * Search Module Routes
 * Asset search and discovery endpoints
 */

import type { FastifyInstance } from 'fastify';
import * as searchService from './service';
import type { SearchQuery } from '../shared/types';

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  // ===== Public Endpoints =====

  /**
   * GET /search?q= - Full-text search
   */
  app.get('/', {
    schema: {
      tags: ['Search'],
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Search query' },
          type: { type: 'string', enum: ['gene', 'capsule', 'skill'] },
          status: { type: 'string', enum: ['published', 'promoted'] },
          signals: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          min_gdi: { type: 'number' },
          author_id: { type: 'string' },
          limit: { type: 'number', default: 20 },
          offset: { type: 'number', default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const query = request.query as Record<string, unknown>;

    const searchQuery: SearchQuery = {
      q: query.q as string || '',
      type: query.type as 'gene' | 'capsule' | 'skill' | undefined,
      status: query.status as 'published' | 'promoted' | undefined,
      signals: query.signals as string[] | undefined,
      tags: query.tags as string[] | undefined,
      min_gdi: query.min_gdi as number | undefined,
      author_id: query.author_id as string | undefined,
      limit: query.limit as number | undefined,
      offset: query.offset as number | undefined,
    };

    const result = await searchService.search(searchQuery, app.prisma);
    return reply.send({
      success: true,
      ...result,
    });
  });

  /**
   * GET /search/suggestions - Search suggestions (autocomplete)
   */
  app.get('/suggestions', {
    schema: {
      tags: ['Search'],
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', description: 'Search prefix' },
          type: { type: 'string', enum: ['gene', 'capsule', 'skill'] },
        },
      },
    },
  }, async (request, reply) => {
    const { q, type } = request.query as { q: string; type?: 'gene' | 'capsule' | 'skill' };
    const result = await searchService.autocomplete(q, type, app.prisma);
    return reply.send({
      success: true,
      ...result,
    });
  });

  /**
   * GET /search/trending - Trending searches
   */
  app.get('/trending', {
    schema: {
      tags: ['Search'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 20 },
        },
      },
    },
  }, async (request, reply) => {
    const { limit } = request.query as { limit?: number };
    const result = await searchService.trending(limit, app.prisma);
    return reply.send({
      success: true,
      items: result,
      total: result.length,
    });
  });

  /**
   * GET /search/similar/:assetId - Find similar assets
   */
  app.get<{ Params: { assetId: string } }>('/similar/:assetId', {
    schema: {
      tags: ['Search'],
      params: {
        type: 'object',
        required: ['assetId'],
        properties: {
          assetId: { type: 'string' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          threshold: { type: 'number', default: 0.5 },
          limit: { type: 'number', default: 10 },
        },
      },
    },
  }, async (request, reply) => {
    const { assetId } = request.params;
    const { threshold, limit } = request.query as { threshold?: number; limit?: number };
    const result = await searchService.findSimilar(
      assetId,
      threshold,
      app.prisma
    );
    const limited = result.slice(0, limit);
    return reply.send({
      success: true,
      items: limited.map((r) => ({
        asset: r.asset,
        similarity: r.similarity,
      })),
      total: limited.length,
    });
  });
}
