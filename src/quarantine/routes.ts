import type { FastifyInstance } from 'fastify';
import { requireAuth, requireTrustLevel } from '../shared/auth';
import * as quarantineService from './service';
import type { QuarantineLevel, QuarantineReason } from '../shared/types';
import { ForbiddenError, ValidationError } from '../shared/errors';

export async function quarantineRoutes(app: FastifyInstance): Promise<void> {
  app.post('/', {
    schema: { tags: ['Quarantine'] },
    preHandler: [requireAuth(), requireTrustLevel('trusted')],
  }, async (request, reply) => {
    if (request.auth?.auth_type === 'api_key') {
      throw new ForbiddenError('API keys cannot manage quarantine');
    }

    const body = request.body as {
      node_id: string;
      level: QuarantineLevel;
      reason: QuarantineReason;
    };

    if (!body.node_id) {
      throw new ValidationError('node_id is required');
    }
    if (!body.level || !['L1', 'L2', 'L3'].includes(body.level)) {
      throw new ValidationError('Valid quarantine level (L1/L2/L3) is required');
    }
    if (!body.reason) {
      throw new ValidationError('reason is required');
    }

    const result = await quarantineService.quarantineNode(
      body.node_id,
      body.level,
      body.reason,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  app.get('/status/:nodeId', {
    schema: { tags: ['Quarantine'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };

    const result = await quarantineService.checkQuarantineStatus(nodeId);

    return reply.send({ success: true, data: result });
  });

  app.get('/history/:nodeId', {
    schema: { tags: ['Quarantine'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const { limit } = request.query as { limit?: string };

    const result = await quarantineService.listHistory(
      nodeId,
      limit ? Number(limit) : 20,
    );

    return reply.send({ success: true, data: result });
  });

  app.post('/:nodeId/appeal', {
    schema: { tags: ['Quarantine'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    if (request.auth?.auth_type === 'api_key') {
      throw new ForbiddenError('API keys cannot appeal quarantine');
    }

    const { nodeId } = request.params as { nodeId: string };
    const body = request.body as {
      grounds?: string;
      evidence?: unknown[];
    };

    if (!body.grounds) {
      throw new ValidationError('grounds is required');
    }
    if (body.evidence !== undefined && !Array.isArray(body.evidence)) {
      throw new ValidationError('evidence must be an array');
    }

    const result = await quarantineService.submitAppeal(
      nodeId,
      request.auth!.node_id,
      body.grounds,
      body.evidence ?? [],
    );

    return reply.status(201).send({ success: true, data: result });
  });

  app.get('/:nodeId/appeals', {
    schema: { tags: ['Quarantine'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    if (request.auth?.auth_type === 'api_key') {
      throw new ForbiddenError('API keys cannot view quarantine appeals');
    }

    const { nodeId } = request.params as { nodeId: string };
    if (request.auth!.node_id !== nodeId && request.auth?.trust_level !== 'trusted') {
      throw new ForbiddenError('Can only view your own quarantine appeals');
    }

    const result = await quarantineService.listAppeals(nodeId);

    return reply.send({ success: true, data: result });
  });

  app.post('/appeals/:appealId/review', {
    schema: { tags: ['Quarantine'] },
    preHandler: [requireAuth(), requireTrustLevel('trusted')],
  }, async (request, reply) => {
    if (request.auth?.auth_type === 'api_key') {
      throw new ForbiddenError('API keys cannot review quarantine appeals');
    }

    const { appealId } = request.params as { appealId: string };
    const body = request.body as {
      status?: 'under_review' | 'approved' | 'rejected';
      resolution?: string;
    };

    if (!body.status) {
      throw new ValidationError('status is required');
    }

    const result = await quarantineService.reviewAppeal(
      appealId,
      request.auth!.node_id,
      body.status,
      body.resolution,
    );

    return reply.send({ success: true, data: result });
  });

  app.post('/release/:nodeId', {
    schema: { tags: ['Quarantine'] },
    preHandler: [requireAuth(), requireTrustLevel('trusted')],
  }, async (request, reply) => {
    if (request.auth?.auth_type === 'api_key') {
      throw new ForbiddenError('API keys cannot manage quarantine');
    }

    const { nodeId } = request.params as { nodeId: string };

    const result = await quarantineService.releaseNode(nodeId);

    return reply.send({ success: true, data: result });
  });

  app.get('/active', {
    schema: { tags: ['Quarantine'] },
  }, async (request, reply) => {
    const activeRecords = await app.prisma.quarantineRecord.findMany({
      where: { is_active: true },
      orderBy: { started_at: 'desc' },
    });

    const items = activeRecords.map((r: { node_id: string; level: string; reason: string; started_at: Date; expires_at: Date; reputation_penalty: number; is_active: boolean }) => ({
      node_id: r.node_id,
      level: r.level,
      reason: r.reason,
      started_at: r.started_at.toISOString(),
      expires_at: r.expires_at.toISOString(),
      reputation_penalty: r.reputation_penalty,
      is_active: r.is_active,
    }));

    return reply.send({ success: true, data: items });
  });
}
