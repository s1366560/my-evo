import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as assetService from './service';
import type { PublishPayload } from '../shared/types';

export async function assetRoutes(app: FastifyInstance): Promise<void> {
  app.post('/publish', {
    schema: { tags: ['Assets'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const payload = request.body as PublishPayload;

    const result = await assetService.publishAsset(auth.node_id, payload);

    void reply.status(201).send({
      success: true,
      ...result,
      data: result,
    });
  });

  app.get('/fetch/:assetId', {
    schema: { tags: ['Assets'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { assetId } = request.params as { assetId: string };

    const result = await assetService.fetchAsset(auth.node_id, assetId);

    void reply.send({
      success: true,
      ...result,
      data: result,
    });
  });

  app.post('/revoke', {
    schema: { tags: ['Assets'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { asset_id: string };

    if (!body.asset_id) {
      void reply.status(400).send({
        success: false,
        error: 'asset_id is required',
      });
      return;
    }

    const result = await assetService.revokeAsset(auth.node_id, body.asset_id);

    void reply.send({
      success: true,
      ...result,
      data: result,
    });
  });

  app.get('/search', {
    schema: { tags: ['Assets'] },
  }, async (request, reply) => {
    const { q } = request.query as { q?: string };

    if (!q || q.trim().length === 0) {
      void reply.status(400).send({
        success: false,
        error: 'Search query parameter "q" is required',
      });
      return;
    }

    const results = await assetService.searchAssets(q.trim());

    void reply.send({
      success: true,
      assets: results,
      total: results.length,
      data: results,
    });
  });

  app.get('/gdi/:assetId', {
    schema: { tags: ['Assets'] },
  }, async (request, reply) => {
    const { assetId } = request.params as { assetId: string };

    const gdiScore = await assetService.calculateGDI(assetId);

    void reply.send({
      success: true,
      ...gdiScore,
      data: gdiScore,
    });
  });
}
