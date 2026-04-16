import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError } from '../shared/errors';
import * as service from './service';

export async function gepxRoutes(app: FastifyInstance) {
  if (!app.hasContentTypeParser('application/octet-stream')) {
    app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_request, body, done) => {
      done(null, body);
    });
  }

  app.post('/export', {
    schema: { tags: ['Gepx'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const body = request.body as {
      bundle_name: string;
      description: string;
      asset_ids: string[];
      tags?: string[];
      compress?: boolean;
      bundle_type?: string;
    };

    if (!body.bundle_name || !body.description || !Array.isArray(body.asset_ids)) {
      throw new EvoMapError('bundle_name, description, and asset_ids are required', 'VALIDATION_ERROR', 400);
    }

    const result = await service.exportBundleArchive(auth.node_id, {
      bundle_name: body.bundle_name,
      description: body.description,
      asset_ids: body.asset_ids,
      tags: body.tags,
      compress: body.compress,
      bundle_type: body.bundle_type as any,
    });

    return { success: true, data: result };
  });

  app.post('/export/single', {
    schema: { tags: ['Gepx'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const body = request.body as {
      asset_id: string;
      bundle_type?: string;
      description?: string;
      compress?: boolean;
    };

    if (!body.asset_id) {
      throw new EvoMapError('asset_id is required', 'VALIDATION_ERROR', 400);
    }

    const result = await service.exportBundleArchive(auth.node_id, {
      bundle_name: body.asset_id,
      description: body.description ?? `Single asset export for ${body.asset_id}`,
      asset_ids: [body.asset_id],
      compress: body.compress,
      bundle_type: (body.bundle_type as any) ?? 'Gene',
    });

    return { success: true, data: result };
  });

  app.post('/validate', {
    schema: { tags: ['Gepx'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    if (Buffer.isBuffer(request.body)) {
      return { success: true, data: service.validateGepxBinary(request.body) };
    }

    const body = request.body as { base64?: string; payload?: unknown; bundle_data?: unknown };

    if (typeof body?.base64 === 'string') {
      const buffer = Buffer.from(body.base64, 'base64');
      return { success: true, data: service.validateGepxBinary(buffer) };
    }

    const payload = body?.payload ?? body?.bundle_data;
    if (!payload) {
      throw new EvoMapError('application/octet-stream body, base64, or payload/bundle_data is required', 'VALIDATION_ERROR', 400);
    }

    return { success: true, data: service.validateGepxPayload(payload) };
  });

  app.get('/bundle/:bundleId', {
    schema: { tags: ['Gepx'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { bundleId: string };
    const auth = request.auth!;
    const { bundle, assets, exportRecord } = await service.downloadBundle(params.bundleId, auth.node_id);
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
