/**
 * Assets Module Routes
 * Asset publishing and management endpoints
 */

import type { FastifyInstance } from 'fastify';
import { requireNodeSecretAuth } from '../shared/auth';
import * as assetsService from './service';
import type {
  CreateAssetInput,
  UpdateAssetInput,
  ListAssetsInput,
  PublishAssetInput,
} from './types';

function getAuthorId(auth?: { node_id?: string | null; userId?: string | null }): string | null {
  return auth?.node_id || auth?.userId || null;
}

export async function assetRoutes(app: FastifyInstance): Promise<void> {
  // ===== Public Endpoints =====

  /**
   * GET /assets - List assets
   */
  app.get('/', {
    schema: {
      tags: ['Assets'],
      querystring: {
        type: 'object',
        properties: {
          asset_type: { type: 'string' },
          status: { type: 'string' },
          author_id: { type: 'string' },
          tags: { type: 'string' },
          search: { type: 'string' },
          limit: { type: 'number', default: 50 },
          offset: { type: 'number', default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const input: ListAssetsInput = {
      asset_type: query.asset_type as string | undefined,
      status: query.status as string | undefined,
      author_id: query.author_id as string | undefined,
      tags: query.tags ? [query.tags as string] : undefined,
      search: query.search as string | undefined,
      limit: query.limit as number | undefined,
      offset: query.offset as number | undefined,
    };

    const result = await assetsService.listAssets(app.prisma, input);
    return reply.send({
      success: true,
      data: result.assets,
      total: result.total,
    });
  });

  /**
   * GET /assets/:id - Get asset by ID
   */
  app.get<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Assets'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const asset = await assetsService.getAsset(app.prisma, id);

    if (!asset) {
      return reply.status(404).send({
        success: false,
        error: 'Asset not found',
      });
    }

    return reply.send({
      success: true,
      data: asset,
    });
  });

  /**
   * GET /assets/categories - Get asset categories
   */
  app.get('/categories', {
    schema: { tags: ['Assets'] },
  }, async (_request, reply) => {
    const categories = await assetsService.getAssetCategories(app.prisma);
    return reply.send({
      success: true,
      data: categories,
    });
  });

  // ===== Authenticated Endpoints =====

  /**
   * POST /assets - Create asset
   */
  app.post('/', {
    schema: {
      tags: ['Assets'],
      body: {
        type: 'object',
        required: ['asset_type', 'name', 'description'],
        properties: {
          asset_type: { type: 'string', enum: ['capsule', 'gene', 'workflow', 'template', 'skill'] },
          name: { type: 'string' },
          description: { type: 'string' },
          content: { type: 'string' },
          signals: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          config: { type: 'object' },
          gene_ids: { type: 'array', items: { type: 'string' } },
          parent_id: { type: 'string' },
        },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const authorId = getAuthorId(request.auth || undefined);
    if (!authorId) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
      });
    }

    const input: CreateAssetInput = request.body as CreateAssetInput;
    const asset = await assetsService.createAsset(app.prisma, authorId, input);

    return reply.status(201).send({
      success: true,
      data: asset,
      message: 'Asset created successfully',
    });
  });

  /**
   * PUT /assets/:id - Update asset
   */
  app.put<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Assets'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          content: { type: 'string' },
          signals: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          config: { type: 'object' },
          status: { type: 'string', enum: ['draft', 'published', 'archived'] },
        },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const authorId = getAuthorId(request.auth || undefined);
    if (!authorId) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
      });
    }

    const { id } = request.params;
    const input: UpdateAssetInput = request.body as UpdateAssetInput;
    const asset = await assetsService.updateAsset(app.prisma, id, authorId, input);

    if (!asset) {
      return reply.status(404).send({
        success: false,
        error: 'Asset not found or not authorized',
      });
    }

    return reply.send({
      success: true,
      data: asset,
      message: 'Asset updated successfully',
    });
  });

  /**
   * DELETE /assets/:id - Delete asset
   */
  app.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Assets'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const authorId = getAuthorId(request.auth || undefined);
    if (!authorId) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
      });
    }

    const { id } = request.params;
    const deleted = await assetsService.deleteAsset(app.prisma, id, authorId);

    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: 'Asset not found or not authorized',
      });
    }

    return reply.send({
      success: true,
      message: 'Asset deleted successfully',
    });
  });

  /**
   * POST /assets/publish - Publish asset
   */
  app.post('/publish', {
    schema: {
      tags: ['Assets'],
      body: {
        type: 'object',
        required: ['asset_id'],
        properties: {
          asset_id: { type: 'string' },
          publish_metadata: { type: 'object' },
        },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const authorId = getAuthorId(request.auth || undefined);
    if (!authorId) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
      });
    }

    const { asset_id } = request.body as PublishAssetInput;
    const asset = await assetsService.publishAsset(app.prisma, asset_id, authorId);

    if (!asset) {
      return reply.status(404).send({
        success: false,
        error: 'Asset not found or not authorized',
      });
    }

    return reply.send({
      success: true,
      data: asset,
      message: 'Asset published successfully',
    });
  });

  /**
   * POST /assets/:id/fork - Fork an asset
   */
  app.post<{ Params: { id: string } }>('/:id/fork', {
    schema: {
      tags: ['Assets'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const authorId = getAuthorId(request.auth || undefined);
    if (!authorId) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
      });
    }

    const { id } = request.params;
    const { name } = request.body as { name?: string };
    const asset = await assetsService.forkAsset(app.prisma, id, authorId, name);

    if (!asset) {
      return reply.status(404).send({
        success: false,
        error: 'Asset not found',
      });
    }

    return reply.status(201).send({
      success: true,
      data: asset,
      message: 'Asset forked successfully',
    });
  });
}
