import type { FastifyInstance, FastifyReply } from 'fastify';
import { requireAuth } from '../shared/auth';
import { ValidationError } from '../shared/errors';
import * as service from './service';

const MAX_LIST_LIMIT = 100;
const RULING_STATUSES = new Set([
  'under_review',
  'hearing',
  'resolved',
  'dismissed',
  'escalated',
]);

function parseOffset(value?: string): number {
  if (value === undefined) {
    return 0;
  }

  if (!/^\d+$/.test(value)) {
    throw new ValidationError('offset must be a non-negative integer');
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ValidationError('offset must be a non-negative integer');
  }
  return parsed;
}

function parseLimit(value?: string): number {
  if (value === undefined) {
    return 20;
  }

  if (!/^\d+$/.test(value)) {
    throw new ValidationError('limit must be a positive integer');
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError('limit must be a positive integer');
  }
  return Math.min(parsed, MAX_LIST_LIMIT);
}

function isBodyRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireBodyRecord(value: unknown): Record<string, unknown> {
  if (!isBodyRecord(value)) {
    throw new ValidationError('request body must be an object');
  }

  return value;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${field} is required`);
  }

  return value;
}

function parseOptionalArray(value: unknown, field: string): unknown[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new ValidationError(`${field} must be an array`);
  }

  return value;
}

function parseOptionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ValidationError(`${field} must be a number`);
  }

  return value;
}

function parseOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${field} must be a non-empty string`);
  }

  return value;
}

function parseArbitrators(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError('arbitrators array is required');
  }

  if (!value.every((item) => typeof item === 'string' && item.trim().length > 0)) {
    throw new ValidationError('arbitrators must be an array of strings');
  }

  return value;
}

export async function disputeRoutes(app: FastifyInstance) {
  const createDispute = async (
    request: {
      auth?: { node_id: string };
      body: unknown;
    },
    reply: FastifyReply,
  ) => {
    const auth = request.auth!;
    const body = requireBodyRecord(request.body);
    const type = requireNonEmptyString(body.type, 'type');
    const defendantId = requireNonEmptyString(body.defendant_id, 'defendant_id');
    const title = requireNonEmptyString(body.title, 'title');
    const description = requireNonEmptyString(body.description, 'description');

    const dispute = await service.fileDispute(auth.node_id, {
      type,
      defendant_id: defendantId,
      title,
      description,
      evidence: parseOptionalArray(body.evidence, 'evidence') ?? [],
      related_asset_id: parseOptionalString(body.related_asset_id, 'related_asset_id'),
      related_bounty_id: parseOptionalString(body.related_bounty_id, 'related_bounty_id'),
      related_transaction_id: parseOptionalString(body.related_transaction_id, 'related_transaction_id'),
      filing_fee: parseOptionalNumber(body.filing_fee, 'filing_fee'),
    });

    void reply.status(201);
    return { success: true, data: dispute };
  };

  // Alias: POST /a2a/dispute/open  (same as POST /api/v2/disputes)
  app.post('/open', {
    schema: { tags: ['Disputes'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => createDispute(
    request as Parameters<typeof createDispute>[0],
    reply,
  ));

  app.get('/', {
    schema: { tags: ['Disputes'] },
  }, async (request) => {
    const query = request.query as {
      status?: string;
      type?: string;
      limit?: string;
      offset?: string;
    };

    const limit = parseLimit(query.limit);
    const offset = parseOffset(query.offset);

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
  }, async (request, reply) => createDispute(
    request as Parameters<typeof createDispute>[0],
    reply,
  ));

  app.post('/:disputeId/assign', {
    schema: { tags: ['Disputes'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const body = requireBodyRecord(request.body);
    const params = request.params as { disputeId: string };
    const arbitrators = parseArbitrators(body.arbitrators);

    const dispute = await service.assignArbitrators(params.disputeId, arbitrators);
    return { success: true, data: dispute };
  });

  app.post('/:disputeId/assign/auto', {
    schema: { tags: ['Disputes'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { disputeId: string };
    const arbitrators = await service.selectAndAssignArbitrators(params.disputeId);
    return { success: true, data: { dispute_id: params.disputeId, arbitrators } };
  });

  app.post('/:disputeId/ruling', {
    schema: { tags: ['Disputes'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const body = requireBodyRecord(request.body);
    const params = request.params as { disputeId: string };

    if (!Object.prototype.hasOwnProperty.call(body, 'ruling')) {
      throw new ValidationError('ruling is required');
    }

    if (body.status !== undefined && typeof body.status !== 'string') {
      throw new ValidationError(`status must be one of ${Array.from(RULING_STATUSES).join(', ')}`);
    }

    const status = body.status ?? 'resolved';
    if (!RULING_STATUSES.has(status)) {
      throw new ValidationError(`status must be one of ${Array.from(RULING_STATUSES).join(', ')}`);
    }

    const dispute = await service.issueRuling(params.disputeId, body.ruling as object, status);
    return { success: true, data: dispute };
  });

  app.post('/:disputeId/ruling/auto', {
    schema: { tags: ['Disputes'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { disputeId: string };
    const ruling = await service.autoGenerateRuling(params.disputeId);
    return { success: true, data: ruling };
  });

  app.post('/:disputeId/appeal', {
    schema: { tags: ['Disputes'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = requireBodyRecord(request.body);
    const params = request.params as { disputeId: string };

    const appeal = await service.fileAppeal(
      params.disputeId,
      auth.node_id,
      requireNonEmptyString(body.grounds, 'grounds'),
      parseOptionalNumber(body.appeal_fee, 'appeal_fee'),
      parseOptionalArray(body.new_evidence, 'new_evidence'),
    );

    void reply.status(201);
    return { success: true, data: appeal };
  });

  app.post('/appeals/:appealId/review', {
    schema: { tags: ['Disputes'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { appealId: string };
    const result = await service.reviewAppeal(params.appealId);
    return { success: true, data: result };
  });

  app.post('/appeals/:appealId/process', {
    schema: { tags: ['Disputes'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { appealId: string };
    await service.processAppealDecision(params.appealId);
    return { success: true, data: { appeal_id: params.appealId, processed: true } };
  });

  app.post('/:disputeId/escalate', {
    schema: { tags: ['Disputes'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { disputeId: string };
    const result = await service.escalateDisputeToCouncil(params.disputeId);
    return { success: true, data: result };
  });

  app.get('/:disputeId/appeals', {
    schema: { tags: ['Disputes'] },
  }, async (request) => {
    const params = request.params as { disputeId: string };
    const appeals = await service.listAppeals(params.disputeId);
    return { success: true, data: appeals };
  });
}
