import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as antiHallucinationService from './service';
import { ValidationError } from '../shared/errors';

export async function antiHallucinationRoutes(
  app: FastifyInstance,
): Promise<void> {
  // -------------------------------------------------------------------------
  // POST /api/v2/anti-hallucination/check
  // -------------------------------------------------------------------------
  app.post('/check', {
    schema: { tags: ['AntiHallucination'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      code_content: string;
      validation_type: string;
      asset_id?: string;
    };

    if (!body.code_content) {
      throw new ValidationError('code_content is required');
    }
    if (!body.validation_type) {
      throw new ValidationError('validation_type is required');
    }

    const result = await antiHallucinationService.performCheck(
      auth.node_id,
      body.code_content,
      body.validation_type,
      body.asset_id,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // GET /api/v2/anti-hallucination/checks/:checkId
  // -------------------------------------------------------------------------
  app.get('/checks/:checkId', {
    schema: { tags: ['AntiHallucination'] },
  }, async (request, reply) => {
    const { checkId } = request.params as { checkId: string };

    const result = await antiHallucinationService.getCheck(checkId);
    if (!result) {
      return reply.status(404).send({
        success: false,
        error: 'Check not found',
        message: `HallucinationCheck with id '${checkId}' not found`,
      });
    }

    return reply.send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // GET /api/v2/anti-hallucination/checks
  // -------------------------------------------------------------------------
  app.get('/checks', {
    schema: { tags: ['AntiHallucination'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { limit, offset } = request.query as Record<string, string | undefined>;

    const parsedLimit = limit ? Math.min(Number(limit), 100) : 20;
    const parsedOffset = offset ? Number(offset) : 0;

    const result = await antiHallucinationService.listChecks(
      auth.node_id,
      parsedLimit,
      parsedOffset,
    );

    return reply.send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // GET /api/v2/anti-hallucination/anchors
  // -------------------------------------------------------------------------
  app.get('/anchors', {
    schema: { tags: ['AntiHallucination'] },
  }, async (request, reply) => {
    const { type, limit, offset } = request.query as Record<string, string | undefined>;

    const parsedLimit = limit ? Math.min(Number(limit), 100) : 20;
    const parsedOffset = offset ? Number(offset) : 0;

    const result = await antiHallucinationService.listAnchors(
      type,
      parsedLimit,
      parsedOffset,
    );

    return reply.send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // POST /api/v2/anti-hallucination/anchors
  // -------------------------------------------------------------------------
  app.post('/anchors', {
    schema: { tags: ['AntiHallucination'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as {
      type: string;
      source: string;
      confidence: number;
      expires_at: string;
    };

    if (!body.type) {
      throw new ValidationError('type is required');
    }
    if (!body.source) {
      throw new ValidationError('source is required');
    }
    if (body.confidence === undefined) {
      throw new ValidationError('confidence is required');
    }
    if (!body.expires_at) {
      throw new ValidationError('expires_at is required');
    }

    const expiresAt = new Date(body.expires_at);

    const result = await antiHallucinationService.addAnchor(
      body.type,
      body.source,
      body.confidence,
      expiresAt,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // GET /api/v2/anti-hallucination/graph/nodes
  // -------------------------------------------------------------------------
  app.get('/graph/nodes', {
    schema: { tags: ['AntiHallucination'] },
  }, async (request, reply) => {
    const {
      type,
      min_confidence,
      limit,
      offset,
    } = request.query as Record<string, string | undefined>;

    const parsedLimit = limit ? Math.min(Number(limit), 100) : 20;
    const parsedOffset = offset ? Number(offset) : 0;
    const parsedMinConfidence = min_confidence
      ? Number(min_confidence)
      : undefined;

    const result = await antiHallucinationService.listGraphNodes(
      type,
      parsedMinConfidence,
      parsedLimit,
      parsedOffset,
    );

    return reply.send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // GET /api/v2/anti-hallucination/graph/nodes/:nodeId
  // -------------------------------------------------------------------------
  app.get('/graph/nodes/:nodeId', {
    schema: { tags: ['AntiHallucination'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };

    const result = await antiHallucinationService.getGraphNode(nodeId);
    if (!result) {
      return reply.status(404).send({
        success: false,
        error: 'Node not found',
        message: `MemoryGraphNode with node_id '${nodeId}' not found`,
      });
    }

    return reply.send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // POST /api/v2/anti-hallucination/graph/nodes
  // -------------------------------------------------------------------------
  app.post('/graph/nodes', {
    schema: { tags: ['AntiHallucination'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as {
      node_id: string;
      type: string;
      label: string;
      metadata?: Record<string, unknown>;
    };

    if (!body.node_id) {
      throw new ValidationError('node_id is required');
    }
    if (!body.type) {
      throw new ValidationError('type is required');
    }
    if (!body.label) {
      throw new ValidationError('label is required');
    }

    const result = await antiHallucinationService.upsertGraphNode(
      body.node_id,
      body.type,
      body.label,
      body.metadata,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // GET /api/v2/anti-hallucination/graph/edges
  // -------------------------------------------------------------------------
  app.get('/graph/edges', {
    schema: { tags: ['AntiHallucination'] },
  }, async (request, reply) => {
    const {
      source_id,
      target_id,
      limit,
      offset,
    } = request.query as Record<string, string | undefined>;

    const parsedLimit = limit ? Math.min(Number(limit), 100) : 20;
    const parsedOffset = offset ? Number(offset) : 0;

    const result = await antiHallucinationService.listGraphEdges(
      source_id,
      target_id,
      parsedLimit,
      parsedOffset,
    );

    return reply.send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // POST /api/v2/anti-hallucination/graph/edges
  // -------------------------------------------------------------------------
  app.post('/graph/edges', {
    schema: { tags: ['AntiHallucination'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as {
      source_id: string;
      target_id: string;
      relation: string;
      weight?: number;
    };

    if (!body.source_id) {
      throw new ValidationError('source_id is required');
    }
    if (!body.target_id) {
      throw new ValidationError('target_id is required');
    }
    if (!body.relation) {
      throw new ValidationError('relation is required');
    }

    const result = await antiHallucinationService.createGraphEdge(
      body.source_id,
      body.target_id,
      body.relation,
      body.weight,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // GET /api/v2/anti-hallucination/chains/:assetId
  // -------------------------------------------------------------------------
  app.get('/chains/:assetId', {
    schema: { tags: ['AntiHallucination'] },
  }, async (request, reply) => {
    const { assetId } = request.params as { assetId: string };

    const result = await antiHallucinationService.getCapabilityChain(assetId);
    if (!result) {
      return reply.status(404).send({
        success: false,
        error: 'Capability chain not found',
        message: `No capability chain found for asset '${assetId}'`,
      });
    }

    return reply.send({ success: true, data: result });
  });
}
