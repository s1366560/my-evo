import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError } from '../shared/errors';
import * as service from './service';

export async function gepxRoutes(app: FastifyInstance) {
  // List bundles
  app.get('/bundles', {
    schema: { tags: ['Gepx'] },
  }, async (request) => {
    const query = request.query as {
      bundle_type?: string;
      limit?: string;
      offset?: string;
    };

    const result = await service.listBundles(
      query.bundle_type,
      query.limit ? parseInt(query.limit, 10) : 20,
      query.offset ? parseInt(query.offset, 10) : 0,
    );

    return {
      success: true,
      data: { items: result.items, total: result.total },
    };
  });

  // Get bundle detail
  app.get('/bundles/:bundleId', {
    schema: { tags: ['Gepx'] },
  }, async (request) => {
    const params = request.params as { bundleId: string };
    const bundle = await service.getBundle(params.bundleId);
    return { success: true, data: bundle };
  });

  // Create bundle
  app.post('/bundles', {
    schema: { tags: ['Gepx'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      name: string;
      description: string;
      bundle_type: string;
      tags?: string[];
      asset_ids: string[];
    };

    if (!body.name || !body.description || !body.bundle_type) {
      throw new EvoMapError('name, description, and bundle_type are required', 'VALIDATION_ERROR', 400);
    }

    if (!Array.isArray(body.asset_ids)) {
      throw new EvoMapError('asset_ids must be an array', 'VALIDATION_ERROR', 400);
    }

    const bundle = await service.createBundle(
      auth.node_id,
      body.name,
      body.description,
      body.bundle_type,
      body.asset_ids,
      body.tags,
    );

    void reply.status(201);
    return { success: true, data: bundle };
  });

  // Download bundle as gepx file
  app.get('/bundles/:bundleId/download', {
    schema: { tags: ['Gepx'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { bundleId: string };
    const auth = request.auth!;
    const { bundle, assets, exportRecord } = await service.downloadBundle(
      params.bundleId,
      auth.node_id,
    );

    return {
      success: true,
      data: {
        gepx_version: '1.0',
        bundle,
        assets,
        export: exportRecord,
      },
    };
  });

  // List assets in bundle
  app.get('/bundles/:bundleId/assets', {
    schema: { tags: ['Gepx'] },
  }, async (request) => {
    const params = request.params as { bundleId: string };
    const bundle = await service.getBundle(params.bundleId);

    // Fetch assets linked to this bundle
    const assets = await app.prisma.sandboxAsset.findMany({
      where: {
        sandbox_id: params.bundleId,
      },
      take: bundle.asset_count,
    });

    return { success: true, data: assets };
  });

  // List user's exports
  app.get('/exports', {
    schema: { tags: ['Gepx'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const exports = await service.listExports(auth.node_id);
    return { success: true, data: exports };
  });

  // Import a gepx bundle
  app.post('/import', {
    schema: { tags: ['Gepx'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const body = request.body as {
      bundle_data: unknown;
      node_id?: string;
    };

    if (!body.bundle_data) {
      throw new EvoMapError('bundle_data is required', 'VALIDATION_ERROR', 400);
    }

    const result = await service.importBundle(
      body.node_id ?? auth.node_id,
      body.bundle_data,
    );

    return { success: true, data: result };
  });
}
