import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as marketplaceService from './service';
import type { AssetType } from '../shared/types';

export async function marketplaceRoutes(app: FastifyInstance): Promise<void> {
  app.post('/list', {
    schema: { tags: ['Marketplace'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      asset_id: string;
      asset_type: AssetType;
      price: number;
    };

    const result = await marketplaceService.createListing(
      auth.node_id,
      body.asset_id,
      body.asset_type,
      body.price,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  app.post('/buy/:listingId', {
    schema: { tags: ['Marketplace'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { listingId } = request.params as { listingId: string };

    const result = await marketplaceService.buyListing(
      auth.node_id,
      listingId,
    );

    return reply.send({ success: true, data: result });
  });

  app.post('/cancel/:listingId', {
    schema: { tags: ['Marketplace'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { listingId } = request.params as { listingId: string };

    const result = await marketplaceService.cancelListing(
      auth.node_id,
      listingId,
    );

    return reply.send({ success: true, data: result });
  });

  app.get('/listings', {
    schema: { tags: ['Marketplace'] },
  }, async (request, reply) => {
    const { type, minPrice, maxPrice, sort, limit, offset } =
      request.query as Record<string, string | undefined>;

    const result = await marketplaceService.getListings(
      type,
      minPrice ? Number(minPrice) : undefined,
      maxPrice ? Number(maxPrice) : undefined,
      (sort as 'price_asc' | 'price_desc' | 'newest') ?? 'newest',
      limit ? Number(limit) : 20,
      offset ? Number(offset) : 0,
    );

    return reply.send({ success: true, data: result });
  });

  app.get('/transactions/:nodeId', {
    schema: { tags: ['Marketplace'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const { limit, offset } = request.query as Record<string, string | undefined>;

    const result = await marketplaceService.getTransactionHistory(
      nodeId,
      limit ? Number(limit) : 20,
      offset ? Number(offset) : 0,
    );

    return reply.send({ success: true, data: result });
  });
}
