import type { FastifyInstance, FastifyReply } from 'fastify';
import { requireAuth, requireTrustLevel, AuthResult } from '../shared/auth';
import { ForbiddenError, ValidationError } from '../shared/errors';
import * as service from './service';

const MAX_LIST_LIMIT = 100;
const MAX_LIST_OFFSET = 10_000;
const RULING_STATUSES = new Set([
  'under_review',
  'hearing',
  'resolved',
  'dismissed',
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
  if (parsed > MAX_LIST_OFFSET) {
    throw new ValidationError(`offset must be less than or equal to ${MAX_LIST_OFFSET}`);
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

function ensureDisputeManagementAuth(auth: { auth_type: string } | undefined): void {
  if (!auth) {
    throw new ForbiddenError('Authentication is required');
  }

  if (auth.auth_type === 'api_key') {
    throw new ForbiddenError('API keys cannot manage disputes');
  }
}

function ensureDisputeWriteAuth(auth: AuthResult | undefined): void {
  if (!auth) {
    throw new ForbiddenError('Authentication is required');
  }

  if (auth.auth_type === 'api_key') {
    throw new ForbiddenError('API keys cannot create or appeal disputes');
  }
}

export async function disputeRoutes(app: FastifyInstance) {
  const createDispute = async (
    request: {
      auth?: AuthResult;
      body: unknown;
    },
    reply: FastifyReply,
  ) => {
    const auth = request.auth!;
    ensureDisputeWriteAuth(auth);
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
    return {
      success: true,
      dispute,
      data: dispute,
    };
  };

  // Alias: POST /a2a/dispute/open  (same as POST /api/v2/disputes)
  app.post('/open', {
    preHandler: [requireAuth()],
  }, async (request, reply) => createDispute(
    request as Parameters<typeof createDispute>[0],
    reply,
  ));

  app.get('/', {
    preHandler: [requireAuth()],
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
      request.auth!,
      query.status,
      query.type,
      limit,
      offset,
    );

    return {
      success: true,
      disputes: result.items,
      total: result.total,
      data: { items: result.items, total: result.total },
    };
  });

  app.get('/:disputeId', {
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { disputeId: string };
    const dispute = await service.getDispute(params.disputeId, request.auth!);
    return { success: true, dispute, data: dispute };
  });

  app.post('/', {
    preHandler: [requireAuth()],
  }, async (request, reply) => createDispute(
    request as Parameters<typeof createDispute>[0],
    reply,
  ));

  app.post('/:disputeId/assign', {
    preHandler: [requireTrustLevel('trusted')],
  }, async (request) => {
    ensureDisputeManagementAuth(request.auth);
    const body = requireBodyRecord(request.body);
    const params = request.params as { disputeId: string };
    const arbitrators = parseArbitrators(body.arbitrators);

    const dispute = await service.assignArbitrators(
      params.disputeId,
      arbitrators,
      request.auth!.node_id,
    );
    return { success: true, dispute, data: dispute };
  });

  app.post('/:disputeId/assign/auto', {
    preHandler: [requireTrustLevel('trusted')],
  }, async (request) => {
    ensureDisputeManagementAuth(request.auth);
    const params = request.params as { disputeId: string };
    const arbitrators = await service.selectAndAssignArbitrators(
      params.disputeId,
      request.auth!.node_id,
    );
    return {
      success: true,
      dispute_id: params.disputeId,
      arbitrators,
      data: { dispute_id: params.disputeId, arbitrators },
    };
  });

  app.post('/:disputeId/ruling', {
    preHandler: [requireTrustLevel('trusted')],
  }, async (request) => {
    ensureDisputeManagementAuth(request.auth);
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

    const dispute = await service.issueRuling(
      params.disputeId,
      body.ruling as object,
      status,
      request.auth!.node_id,
    );
    return { success: true, dispute, ruling: dispute.ruling ?? null, data: dispute };
  });

  app.post('/:disputeId/ruling/auto', {
    preHandler: [requireTrustLevel('trusted')],
  }, async (request) => {
    ensureDisputeManagementAuth(request.auth);
    const params = request.params as { disputeId: string };
    const ruling = await service.autoGenerateRuling(
      params.disputeId,
      request.auth!.node_id,
    );
    return { success: true, ruling, data: ruling };
  });

  app.post('/:disputeId/appeal', {
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureDisputeWriteAuth(auth);
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
    return { success: true, appeal, data: appeal };
  });

  app.post('/appeals/:appealId/review', {
    preHandler: [requireTrustLevel('trusted')],
  }, async (request) => {
    ensureDisputeManagementAuth(request.auth);
    const params = request.params as { appealId: string };
    const result = await service.reviewAppeal(params.appealId, request.auth!.node_id);
    return { success: true, appeal: result, data: result };
  });

  app.post('/appeals/:appealId/process', {
    preHandler: [requireTrustLevel('trusted')],
  }, async (request) => {
    ensureDisputeManagementAuth(request.auth);
    const params = request.params as { appealId: string };
    await service.processAppealDecision(params.appealId, request.auth!.node_id);
    return {
      success: true,
      appeal_id: params.appealId,
      processed: true,
      data: { appeal_id: params.appealId, processed: true },
    };
  });

  app.post('/:disputeId/escalate', {
    preHandler: [requireTrustLevel('trusted')],
  }, async (request) => {
    ensureDisputeManagementAuth(request.auth);
    const params = request.params as { disputeId: string };
    const result = await service.escalateDisputeToCouncil(params.disputeId, request.auth!.node_id);
    return { success: true, escalation: result, data: result };
  });

  app.get('/:disputeId/appeals', {
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { disputeId: string };
    const appeals = await service.listAppeals(params.disputeId, request.auth!);
    return { success: true, appeals, total: appeals.length, data: appeals };
  });
}
