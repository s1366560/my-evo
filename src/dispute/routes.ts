import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { ValidationError } from '../shared/errors';
import * as service from './service';

export async function disputeRoutes(app: FastifyInstance) {
  // Alias: POST /a2a/dispute/open  (same as POST /api/v2/disputes)
  app.post('/open', {
    schema: { tags: ['Disputes'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      type: string;
      defendant_id: string;
      title: string;
      description: string;
      evidence?: unknown[];
      related_asset_id?: string;
      related_bounty_id?: string;
      filing_fee?: number;
    };

    if (!body.type || !body.defendant_id || !body.title || !body.description) {
      throw new ValidationError('type, defendant_id, title, and description are required');
    }

    const dispute = await service.fileDispute(auth.node_id, {
      type: body.type,
      defendant_id: body.defendant_id,
      title: body.title,
      description: body.description,
      evidence: body.evidence ?? [],
      related_asset_id: body.related_asset_id,
      related_bounty_id: body.related_bounty_id,
      filing_fee: body.filing_fee ?? 50,
    });

    void reply.status(201);
    return { success: true, data: dispute };
  });

  app.get('/', {
    schema: { tags: ['Disputes'] },
  }, async (request) => {
    const query = request.query as {
      status?: string;
      type?: string;
      limit?: string;
      offset?: string;
    };

    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    const result = await service.listDisputes(
      query.status,
      query.type,
      limit,
      offset,
    );

    return { success: true, data: { items: result.items, total: result.total } };
  });

  app.get('/:disputeId', {
    schema: { tags: ['Disputes'] },
  }, async (request) => {
    const params = request.params as { disputeId: string };
    const dispute = await service.getDispute(params.disputeId);
    return { success: true, data: dispute };
  });

  app.post('/', {
    schema: { tags: ['Disputes'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      type: string;
      defendant_id: string;
      title: string;
      description: string;
      evidence?: unknown[];
      related_asset_id?: string;
      related_bounty_id?: string;
      filing_fee?: number;
    };

    if (!body.type || !body.defendant_id || !body.title || !body.description) {
      throw new ValidationError('type, defendant_id, title, and description are required');
    }

    const dispute = await service.fileDispute(auth.node_id, {
      type: body.type,
      defendant_id: body.defendant_id,
      title: body.title,
      description: body.description,
      evidence: body.evidence ?? [],
      related_asset_id: body.related_asset_id,
      related_bounty_id: body.related_bounty_id,
      filing_fee: body.filing_fee ?? 50,
    });

    void reply.status(201);
    return { success: true, data: dispute };
  });

  app.post('/:disputeId/assign', {
    schema: { tags: ['Disputes'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const body = request.body as { arbitrators: string[] };
    const params = request.params as { disputeId: string };

    if (!body.arbitrators || body.arbitrators.length === 0) {
      throw new ValidationError('arbitrators array is required');
    }

    const dispute = await service.assignArbitrators(params.disputeId, body.arbitrators);
    return { success: true, data: dispute };
  });

  app.post('/:disputeId/ruling', {
    schema: { tags: ['Disputes'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const body = request.body as { ruling: unknown; status: string };
    const params = request.params as { disputeId: string };

    if (!body.ruling || !body.status) {
      throw new ValidationError('ruling and status are required');
    }

    const dispute = await service.issueRuling(params.disputeId, body.ruling as object, body.status);
    return { success: true, data: dispute };
  });

  app.post('/:disputeId/appeal', {
    schema: { tags: ['Disputes'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      grounds: string;
      new_evidence?: unknown[];
      appeal_fee?: number;
    };
    const params = request.params as { disputeId: string };

    if (!body.grounds) {
      throw new ValidationError('grounds is required');
    }

    const appeal = await service.fileAppeal(
      params.disputeId,
      auth.node_id,
      body.grounds,
      body.appeal_fee ?? 100,
      body.new_evidence ?? undefined,
    );

    void reply.status(201);
    return { success: true, data: appeal };
  });

  app.get('/:disputeId/appeals', {
    schema: { tags: ['Disputes'] },
  }, async (request) => {
    const params = request.params as { disputeId: string };
    const appeals = await service.listAppeals(params.disputeId);
    return { success: true, data: appeals };
  });
}
