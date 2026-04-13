import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as marketplaceService from './service';
import * as serviceMarketplaceService from './service.marketplace';
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
      app.prisma,
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
      app.prisma,
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
      app.prisma,
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
      app.prisma,
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
      app.prisma,
    );

    return reply.send({ success: true, data: result });
  });

  // ---- Service Marketplace ----

  // POST /marketplace/listings — create service listing [auth]
  app.post('/listings', {
    schema: {
      tags: ['Marketplace'],
      body: {
        type: 'object',
        required: ['title', 'description', 'category', 'price_type', 'license_type'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          price_type: { type: 'string', enum: ['free', 'per_use', 'subscription', 'one_time'] },
          price_credits: { type: 'number' },
          license_type: { type: 'string', enum: ['open_source', 'proprietary', 'custom'] },
        },
      },
    },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      title: string;
      description: string;
      category: string;
      tags?: string[];
      price_type: 'free' | 'per_use' | 'subscription' | 'one_time';
      price_credits?: number;
      license_type: 'open_source' | 'proprietary' | 'custom';
    };

    const listing = await serviceMarketplaceService.createServiceListing(auth.node_id, {
      title: body.title,
      description: body.description,
      category: body.category,
      tags: body.tags ?? [],
      price_type: body.price_type,
      price_credits: body.price_credits,
      license_type: body.license_type,
    }, app.prisma);

    return reply.status(201).send({ success: true, data: listing });
  });

  // POST /marketplace/purchases — purchase a service [auth]
  app.post('/purchases', {
    schema: {
      tags: ['Marketplace'],
      body: {
        type: 'object',
        required: ['listing_id'],
        properties: {
          listing_id: { type: 'string' },
        },
      },
    },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { listing_id: string };

    const purchase = await serviceMarketplaceService.purchaseService(auth.node_id, body.listing_id, app.prisma);
    return reply.status(201).send({ success: true, data: purchase });
  });

  // GET /marketplace/purchases — list my purchases [auth]
  app.get('/purchases', {
    schema: { tags: ['Marketplace'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { limit, offset } = request.query as Record<string, string | undefined>;

    const result = await serviceMarketplaceService.getMyPurchases(
      auth.node_id,
      limit ? Number(limit) : 20,
      offset ? Number(offset) : 0,
      app.prisma,
    );
    return reply.send({ success: true, data: result.items, meta: { total: result.total } });
  });

  // POST /marketplace/purchases/:id/confirm — confirm purchase complete [auth]
  app.post('/purchases/:id/confirm', {
    schema: {
      tags: ['Marketplace'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
    },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };

    const result = await serviceMarketplaceService.confirmPurchase(auth.node_id, id, app.prisma);
    return reply.send({ success: true, data: result });
  });

  // POST /marketplace/purchases/:id/dispute — open dispute on purchase [auth]
  app.post('/purchases/:id/dispute', {
    schema: {
      tags: ['Marketplace'],
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['reason'],
        properties: { reason: { type: 'string' } },
      },
    },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason: string };

    const result = await serviceMarketplaceService.disputePurchase(auth.node_id, id, reason, app.prisma);
    return reply.status(201).send({ success: true, data: result });
  });

  // GET /marketplace/transactions — transaction history [auth]
  app.get('/transactions', {
    schema: { tags: ['Marketplace'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { limit, offset } = request.query as Record<string, string | undefined>;

    const result = await serviceMarketplaceService.getTransactionHistory(
      auth.node_id,
      limit ? Number(limit) : 20,
      offset ? Number(offset) : 0,
      app.prisma,
    );
    return reply.send({ success: true, data: result });
  });

  // GET /marketplace/transactions/:id — transaction detail [auth]
  app.get('/transactions/detail/:id', {
    schema: {
      tags: ['Marketplace'],
      params: { type: 'object', properties: { id: { type: 'string' } } },
    },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };

    const result = await serviceMarketplaceService.getTransaction(auth.node_id, id, app.prisma);
    return reply.send({ success: true, data: result });
  });

  // GET /marketplace/stats — market statistics (public)
  app.get('/stats', {
    schema: { tags: ['Marketplace'] },
  }, async (_request, reply) => {
    const stats = await serviceMarketplaceService.getMarketStats(app.prisma);
    return reply.send({ success: true, data: stats });
  });

  // GET /marketplace/balance — my credit balance [auth]
  app.get('/balance', {
    schema: { tags: ['Marketplace'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const balance = await serviceMarketplaceService.getBalance(auth.node_id, app.prisma);
    return reply.send({ success: true, data: balance });
  });
}
