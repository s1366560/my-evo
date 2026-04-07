import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError } from '../shared/errors';
import * as service from './service';

export async function sandboxRoutes(app: FastifyInstance) {
  // List sandboxes
  app.get('/sandboxes', {
    schema: { tags: ['Sandbox'] },
  }, async (request) => {
    const query = request.query as {
      state?: string;
      isolation_level?: string;
      limit?: string;
      offset?: string;
    };

    const result = await service.listSandboxes(
      query.state,
      query.isolation_level,
      query.limit ? parseInt(query.limit, 10) : 20,
      query.offset ? parseInt(query.offset, 10) : 0,
    );

    return {
      success: true,
      data: { items: result.items, total: result.total },
    };
  });

  // Get sandbox detail
  app.get('/:sandboxId', {
    schema: { tags: ['Sandbox'] },
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const sandbox = await service.getSandbox(params.sandboxId);
    return { success: true, data: sandbox };
  });

  // Create sandbox
  app.post('/', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      name: string;
      description: string;
      isolation_level?: string;
      env?: string;
      tags?: string[];
    };

    if (!body.name || !body.description) {
      throw new EvoMapError('name and description are required', 'VALIDATION_ERROR', 400);
    }

    const sandbox = await service.createSandbox(
      auth.node_id,
      body.name,
      body.description,
      body.isolation_level,
      body.env,
      body.tags,
    );

    void reply.status(201);
    return { success: true, data: sandbox };
  });

  // Update sandbox
  app.put('/:sandboxId', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const body = request.body as {
      name?: string;
      description?: string;
      isolation_level?: string;
      env?: string;
      state?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    };

    const sandbox = await service.updateSandbox(params.sandboxId, body);
    return { success: true, data: sandbox };
  });

  // Delete sandbox
  app.delete('/:sandboxId', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    await service.deleteSandbox(params.sandboxId, auth.node_id);
    return { success: true, data: null };
  });

  // Join sandbox
  app.post('/:sandboxId/join', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const member = await service.joinSandbox(params.sandboxId, auth.node_id);
    return { success: true, data: member };
  });

  // Leave sandbox
  app.post('/:sandboxId/leave', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    await service.leaveSandbox(params.sandboxId, auth.node_id);
    return { success: true, data: null };
  });

  // List members
  app.get('/:sandboxId/members', {
    schema: { tags: ['Sandbox'] },
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const members = await service.listMembers(params.sandboxId);
    return { success: true, data: members };
  });

  // Invite member
  app.post('/:sandboxId/invite', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const body = request.body as {
      invitee: string;
      role?: string;
    };

    if (!body.invitee) {
      throw new EvoMapError('invitee is required', 'VALIDATION_ERROR', 400);
    }

    const invite = await service.inviteMember(
      params.sandboxId,
      auth.node_id,
      body.invitee,
      body.role,
    );

    void reply.status(201);
    return { success: true, data: invite };
  });

  // List sandbox assets
  app.get('/:sandboxId/assets', {
    schema: { tags: ['Sandbox'] },
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const assets = await service.listAssets(params.sandboxId);
    return { success: true, data: assets };
  });

  // Add asset to sandbox
  app.post('/:sandboxId/assets', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const body = request.body as {
      asset_id: string;
      asset_type: string;
      name: string;
      content: string;
      signals_match?: string[];
      strategy?: string[];
      tags?: string[];
    };

    if (!body.asset_id || !body.asset_type || !body.name || !body.content) {
      throw new EvoMapError('asset_id, asset_type, name, and content are required', 'VALIDATION_ERROR', 400);
    }

    const asset = await service.addAsset(params.sandboxId, auth.node_id, {
      asset_id: body.asset_id,
      asset_type: body.asset_type,
      name: body.name,
      content: body.content,
      signals_match: body.signals_match,
      strategy: body.strategy,
      tags: body.tags,
    });

    void reply.status(201);
    return { success: true, data: asset };
  });

  // Request promotion
  app.post('/:sandboxId/promote', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const body = request.body as { asset_id: string };

    if (!body.asset_id) {
      throw new EvoMapError('asset_id is required', 'VALIDATION_ERROR', 400);
    }

    const request2 = await service.requestPromotion(
      params.sandboxId,
      auth.node_id,
      body.asset_id,
    );

    void reply.status(201);
    return { success: true, data: request2 };
  });

  // List promotion requests
  app.get('/:sandboxId/promotions', {
    schema: { tags: ['Sandbox'] },
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const promotions = await service.listPromotions(params.sandboxId);
    return { success: true, data: promotions };
  });

  // Approve promotion
  app.post('/:sandboxId/promotions/:requestId/approve', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string; requestId: string };
    const auth = request.auth!;
    const result = await service.approvePromotion(
      params.sandboxId,
      params.requestId,
      auth.node_id,
    );
    return { success: true, data: result };
  });

  // Reject promotion
  app.post('/:sandboxId/promotions/:requestId/reject', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string; requestId: string };
    const auth = request.auth!;
    const body = request.body as { note?: string };
    const result = await service.rejectPromotion(
      params.sandboxId,
      params.requestId,
      auth.node_id,
      body.note ?? '',
    );
    return { success: true, data: result };
  });
}
