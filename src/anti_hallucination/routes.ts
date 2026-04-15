import type { FastifyInstance } from 'fastify';
import { requireAuth, requireNodeSecretAuth, requireTrustLevel } from '../shared/auth';
import { resolveAuthorizedNodeId } from '../shared/node-access';
import * as antiHallucinationService from './service';
import { ForbiddenError, ValidationError } from '../shared/errors';

async function resolveAntiHallucinationNodeId(
  app: FastifyInstance,
  auth: NonNullable<import('fastify').FastifyRequest['auth']>,
) {
  return resolveAuthorizedNodeId(app, auth, {
    missingNodeMessage: 'No accessible node found for current credentials',
  });
}

function ensureNodeSecretAuth(
  auth: NonNullable<import('fastify').FastifyRequest['auth']>,
): void {
  if (auth.auth_type !== 'node_secret') {
    throw new ForbiddenError('Node secret credentials are required for anti-hallucination checks');
  }
}

export async function antiHallucinationRoutes(
  app: FastifyInstance,
): Promise<void> {
  const buildCheckCompatibilityPayload = (
    result: Awaited<ReturnType<typeof antiHallucinationService.performCheck>>,
  ) => {
    const rawResult = result?.result && typeof result.result === 'object'
      ? result.result as Record<string, unknown>
      : {};
    const passed = typeof rawResult.passed === 'boolean'
      ? rawResult.passed
      : rawResult.has_hallucination === false || rawResult.checks_passed === true;
    const summary = typeof rawResult.summary === 'string'
      ? rawResult.summary
      : 'Check completed';
    const rawAlerts = Array.isArray(rawResult.alerts)
      ? rawResult.alerts
      : [];
    const detailMessages = Array.isArray(rawResult.details)
      ? rawResult.details.filter((detail): detail is string => typeof detail === 'string')
      : [];
    const alerts = rawAlerts.length > 0
      ? rawAlerts.map((alert) => {
        const rawAlert = alert as Record<string, unknown>;
        return {
          type: typeof rawAlert.type === 'string' ? rawAlert.type : 'heuristic_alert',
          level: typeof rawAlert.level === 'string' ? rawAlert.level : (passed ? 'L0' : 'L2'),
          message: typeof rawAlert.message === 'string' ? rawAlert.message : summary,
          suggestion: typeof rawAlert.suggestion === 'string' ? rawAlert.suggestion : null,
          line: typeof rawAlert.line === 'number' ? rawAlert.line : null,
          confidence: typeof rawAlert.confidence === 'number'
            ? rawAlert.confidence
            : result.confidence,
        };
      })
      : detailMessages.map((message) => ({
        type: 'heuristic_alert',
        level: passed ? 'L0' : 'L2',
        message,
        suggestion: null,
        line: null,
        confidence: result.confidence,
      }));

    return {
      passed,
      confidence: result.confidence,
      validations: Array.isArray(rawResult.validations)
        ? rawResult.validations.map((validation) => {
          const rawValidation = validation as Record<string, unknown>;
          return {
            type: typeof rawValidation.type === 'string' ? rawValidation.type : result.validation_type ?? 'heuristic',
            passed: typeof rawValidation.passed === 'boolean' ? rawValidation.passed : passed,
            message: typeof rawValidation.message === 'string' ? rawValidation.message : summary,
          };
        })
        : [
          {
            type: result.validation_type ?? 'heuristic',
            passed,
            message: summary,
          },
        ],
      alerts,
      suggestions: Array.isArray(rawResult.suggestions)
        ? rawResult.suggestions.filter(
          (suggestion): suggestion is string => typeof suggestion === 'string',
        )
        : passed
          ? []
          : detailMessages.map((message) => `Review flagged issue: ${message}`),
    };
  };

  const getCodeContent = (body: {
    code_content?: string;
    code?: string;
  }) => body.code_content ?? body.code;

  // -------------------------------------------------------------------------
  // POST /api/v2/anti-hallucination/check
  // -------------------------------------------------------------------------
  app.post('/check', {
    schema: { tags: ['AntiHallucination'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveAntiHallucinationNodeId(app, auth);
    const body = request.body as {
      code_content?: string;
      code?: string;
      validation_type?: string;
      language?: string;
      trust_anchors?: Array<{
        type: string;
        source: string;
        confidence: number;
      }>;
      asset_id?: string;
    };
    const codeContent = getCodeContent(body);
    const validationType = body.validation_type ?? 'check';

    if (!codeContent) {
      throw new ValidationError('code_content is required');
    }
    if (!validationType) {
      throw new ValidationError('validation_type is required');
    }

    const result = await antiHallucinationService.performCheck(
      nodeId,
      codeContent,
      validationType,
      body.asset_id,
      body.language,
      body.trust_anchors,
    );

    return reply.status(201).send({
      success: true,
      ...buildCheckCompatibilityPayload(result),
      data: result,
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/v2/anti-hallucination/validate
  // -------------------------------------------------------------------------
  app.post('/validate', {
    schema: { tags: ['AntiHallucination'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveAntiHallucinationNodeId(app, auth);
    const body = request.body as {
      code_content?: string;
      code?: string;
      asset_id?: string;
      language?: string;
    };
    const codeContent = getCodeContent(body);

    if (!codeContent) {
      throw new ValidationError('code_content is required');
    }

    const result = await antiHallucinationService.validateCode(
      nodeId,
      codeContent,
      body.asset_id,
      body.language,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // POST /api/v2/anti-hallucination/detect
  // -------------------------------------------------------------------------
  app.post('/detect', {
    schema: { tags: ['AntiHallucination'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveAntiHallucinationNodeId(app, auth);
    const body = request.body as {
      code_content?: string;
      code?: string;
      asset_id?: string;
    };
    const codeContent = getCodeContent(body);

    if (!codeContent) {
      throw new ValidationError('code_content is required');
    }

    const result = await antiHallucinationService.detectHallucination(
      nodeId,
      codeContent,
      body.asset_id,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // GET /api/v2/anti-hallucination/confidence
  // -------------------------------------------------------------------------
  app.get('/confidence', {
    schema: { tags: ['AntiHallucination'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveAntiHallucinationNodeId(app, auth);
    const { check_id, asset_id } = request.query as {
      check_id?: string;
      asset_id?: string;
    };

    const result = await antiHallucinationService.getConfidence(nodeId, {
      checkId: check_id,
      assetId: asset_id,
    });

    return reply.send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // GET /api/v2/anti-hallucination/patterns
  // -------------------------------------------------------------------------
  app.get('/patterns', {
    schema: { tags: ['AntiHallucination'] },
  }, async (_request, reply) => {
    const result = antiHallucinationService.listForbiddenPatterns();
    return reply.send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // GET /api/v2/anti-hallucination/stats
  // -------------------------------------------------------------------------
  app.get('/stats', {
    schema: { tags: ['AntiHallucination'] },
  }, async (_request, reply) => {
    const result = await antiHallucinationService.getCheckStats();
    return reply.send({ success: true, data: result });
  });

  // -------------------------------------------------------------------------
  // GET /api/v2/anti-hallucination/checks/:checkId
  // -------------------------------------------------------------------------
  app.get('/checks/:checkId', {
    schema: { tags: ['AntiHallucination'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveAntiHallucinationNodeId(app, auth);
    const { checkId } = request.params as { checkId: string };

    const result = await antiHallucinationService.getCheck(checkId, nodeId);
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
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const nodeId = await resolveAntiHallucinationNodeId(app, auth);
    const { limit, offset } = request.query as Record<string, string | undefined>;

    const parsedLimit = limit ? Math.min(Number(limit), 100) : 20;
    const parsedOffset = offset ? Number(offset) : 0;

    const result = await antiHallucinationService.listChecks(
      nodeId,
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
    preHandler: [requireTrustLevel('trusted')],
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
    preHandler: [requireTrustLevel('trusted')],
  }, async (request, reply) => {
    ensureNodeSecretAuth(request.auth!);
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
    preHandler: [requireTrustLevel('trusted')],
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
    preHandler: [requireTrustLevel('trusted')],
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
    preHandler: [requireTrustLevel('trusted')],
  }, async (request, reply) => {
    ensureNodeSecretAuth(request.auth!);
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
    preHandler: [requireTrustLevel('trusted')],
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
    preHandler: [requireTrustLevel('trusted')],
  }, async (request, reply) => {
    ensureNodeSecretAuth(request.auth!);
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
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const nodeId = await resolveAntiHallucinationNodeId(app, auth);
    const { assetId } = request.params as { assetId: string };
    const asset = await app.prisma.asset.findUnique({
      where: { asset_id: assetId },
      select: { author_id: true, status: true },
    });

    if (!asset) {
      return reply.status(404).send({
        success: false,
        error: 'Capability chain not found',
        message: `No capability chain found for asset '${assetId}'`,
      });
    }

    const canRead = asset.author_id === nodeId
      || asset.status === 'published'
      || asset.status === 'promoted';
    if (!canRead) {
      throw new ForbiddenError('Cannot access capability chain for this asset');
    }

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
