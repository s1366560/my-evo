import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../shared/errors';
import type { EdgeRelation, ConfidenceDecayParams, NodeType } from './types';
import * as service from './service';

const MAX_IMPORT_ITEMS = 500;

function requireTrustedNodeOperator(
  auth: NonNullable<import('fastify').FastifyRequest['auth']>,
  action: string,
): void {
  if (auth.auth_type !== 'node_secret') {
    throw new UnauthorizedError(`${action} requires trusted node authentication`);
  }

  if (auth.trust_level !== 'trusted') {
    throw new ForbiddenError(`${action} requires trusted node authentication`);
  }
}

function buildDecayParams(body: {
  lambda?: number;
  half_life_days?: number;
  positive_boost?: number;
  negative_penalty?: number;
  floor?: number;
}): Partial<ConfidenceDecayParams> | undefined {
  const params = {
    ...(body.lambda !== undefined ? { lambda: body.lambda } : {}),
    ...(body.half_life_days !== undefined ? { half_life_days: body.half_life_days } : {}),
    ...(body.positive_boost !== undefined ? { positive_boost: body.positive_boost } : {}),
    ...(body.negative_penalty !== undefined ? { negative_penalty: body.negative_penalty } : {}),
    ...(body.floor !== undefined ? { floor: body.floor } : {}),
  };

  return Object.keys(params).length > 0 ? params : undefined;
}

function validateImportItems(name: string, value: unknown): unknown[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ValidationError(`${name} must be an array`);
  }

  if (value.length > MAX_IMPORT_ITEMS) {
    throw new ValidationError(`${name} exceeds maximum import size of ${MAX_IMPORT_ITEMS}`);
  }

  return value;
}

export async function memoryGraphSpecRoutes(app: FastifyInstance): Promise<void> {
  const handleDecayRequest = async (body: {
    asset_id?: string;
    node_id?: string;
    inactive_days?: number;
    batch_size?: number;
    lambda?: number;
    half_life_days?: number;
    positive_boost?: number;
    negative_penalty?: number;
    floor?: number;
  }) => {
    const targetId = body.asset_id ?? body.node_id;
    const params = buildDecayParams(body);
    return targetId
      ? service.triggerDecay(targetId, params)
      : service.triggerDecayAll(params, body.inactive_days ?? 90, body.batch_size ?? 100);
  };

  app.post('/node', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    requireTrustedNodeOperator(auth, 'Memory graph node creation');
    const body = request.body as {
      id?: string;
      node_id?: string;
      type?: string;
      label?: string;
      confidence?: number;
      gdi?: number;
      gdi_score?: number;
      metadata?: Record<string, unknown>;
      signals?: {
        positive?: number;
        negative?: number;
        usage_count?: number;
      };
    };

    const nodeId = body.id ?? body.node_id;
    if (!nodeId) throw new ValidationError('id is required');
    if (!body.type) throw new ValidationError('type is required');
    if (!body.label) throw new ValidationError('label is required');

    const node = await service.createGraphNode(
      nodeId,
      body.type,
      body.label,
      body.confidence ?? 1.0,
      body.gdi ?? body.gdi_score ?? 50,
      body.metadata,
    );

    if (!body.signals) {
      return reply.status(201).send({ success: true, node, data: node });
    }

    const updated = await app.prisma.memoryGraphNode.update({
      where: { node_id: nodeId },
      data: {
        positive: body.signals.positive ?? 0,
        negative: body.signals.negative ?? 0,
        usage_count: body.signals.usage_count ?? 0,
      },
    });

    return reply.status(201).send({ success: true, node: updated, data: updated });
  });

  app.post('/edge', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    requireTrustedNodeOperator(auth, 'Memory graph edge creation');
    const body = request.body as {
      source_id?: string;
      target_id?: string;
      relation?: string;
      weight?: number;
    };

    if (!body.source_id) throw new ValidationError('source_id is required');
    if (!body.target_id) throw new ValidationError('target_id is required');
    if (!body.relation) throw new ValidationError('relation is required');

    const edge = await service.createGraphEdge(
      body.source_id,
      body.target_id,
      body.relation as EdgeRelation,
      body.weight ?? 0.5,
    );

    return reply.status(201).send({ success: true, edge, data: edge });
  });

  app.get('/lineage', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const query = request.query as { asset_id?: string; depth?: string };
    if (!query.asset_id) {
      throw new ValidationError('asset_id query parameter is required');
    }

    const result = await service.getLineage(
      query.asset_id,
      query.depth ? Number(query.depth) : 5,
    );
    return reply.send({ success: true, root: result.root, lineage: result.lineage, total_depth: result.total_depth, chain_id: result.chain_id, data: result });
  });

  app.get('/stats', {
    schema: { tags: ['MemoryGraph'] },
  }, async (_request, reply) => {
    const result = await service.getGraphStats();
    return reply.send({ success: true, ...result, data: result });
  });

  app.post('/chain/construct', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    requireTrustedNodeOperator(auth, 'Memory graph chain construction');
    const body = request.body as { start_node_id?: string; asset_id?: string; max_depth?: number };
    const startNodeId = body.start_node_id ?? body.asset_id;
    if (!startNodeId) {
      throw new ValidationError('start_node_id is required');
    }

    const result = await service.constructChain(startNodeId, body.max_depth ?? 10);
    return reply.status(201).send({ success: true, chain: result, data: result });
  });

  app.get('/chain/:id', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const chain = await service.getChain(id);
    if (!chain) {
      return reply.status(404).send({
        success: false,
        error: 'NOT_FOUND',
        message: `Chain '${id}' not found`,
      });
    }

    return reply.send({ success: true, chain, data: chain });
  });

  app.post('/recall', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as {
      query?: string;
      limit?: number;
      filters?: {
        type?: NodeType[];
        min_confidence?: number;
        min_gdi?: number;
      };
    };
    if (!body.query) {
      throw new ValidationError('query is required');
    }

    const result = await service.recall({
      query: body.query,
      limit: body.limit ?? 10,
      filters: body.filters as Parameters<typeof service.recall>[0]['filters'],
    });
    return reply.send({ success: true, results: result.results, total: result.total, query_time_ms: result.query_time_ms, data: result });
  });

  app.get('/confidence/:assetId', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { assetId } = request.params as { assetId: string };
    const result = await service.getConfidenceRecord(assetId);
    return reply.send({ success: true, ...result, data: result });
  });

  app.get('/confidence/stats', {
    schema: { tags: ['MemoryGraph'] },
  }, async (_request, reply) => {
    const result = await service.getConfidenceStats();
    return reply.send({ success: true, ...result, data: result });
  });

  app.post('/decay', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    requireTrustedNodeOperator(auth, 'Memory graph decay');
    const body = request.body as {
      asset_id?: string;
      node_id?: string;
      inactive_days?: number;
      batch_size?: number;
      lambda?: number;
      half_life_days?: number;
      positive_boost?: number;
      negative_penalty?: number;
      floor?: number;
    };
    const result = await handleDecayRequest(body);
    const decayPayload = 'node' in result
      ? { node: result.node, decay: result.decay }
      : { processed: result.processed, skipped: result.skipped };
    return reply.send({ success: true, ...decayPayload, data: result });
  });

  app.post('/compute-decay', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    requireTrustedNodeOperator(auth, 'Memory graph decay');
    const body = request.body as {
      asset_id?: string;
      node_id?: string;
      inactive_days?: number;
      batch_size?: number;
      lambda?: number;
      half_life_days?: number;
      positive_boost?: number;
      negative_penalty?: number;
      floor?: number;
    };
    const result = await handleDecayRequest(body);
    const decayPayload = 'node' in result
      ? { node: result.node, decay: result.decay }
      : { processed: result.processed, skipped: result.skipped };
    return reply.send({ success: true, ...decayPayload, data: result });
  });

  app.post('/ban-check', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as {
      node_id?: string;
      confidence_min?: number;
      gdi_min?: number;
      report_ratio_max?: number;
    };
    if (!body.node_id) {
      throw new ValidationError('node_id is required');
    }

    const result = await service.checkBan(body.node_id, {
      ...(body.confidence_min !== undefined ? { confidence_min: body.confidence_min } : {}),
      ...(body.gdi_min !== undefined ? { gdi_min: body.gdi_min } : {}),
      ...(body.report_ratio_max !== undefined ? { report_ratio_max: body.report_ratio_max } : {}),
    });

    return reply.send({ success: true, ...result, data: result });
  });

  app.get('/export', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    requireTrustedNodeOperator(auth, 'Memory graph export');
    const result = await service.exportGraph();
    return reply.send({ success: true, nodes: result.nodes, edges: result.edges, chains: result.chains, exported_at: result.exported_at, data: result });
  });

  app.post('/import', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    requireTrustedNodeOperator(auth, 'Memory graph import');

    const body = (request.body as {
      nodes?: unknown;
      edges?: unknown;
      chains?: unknown;
    } | undefined) ?? {};
    const nodes = validateImportItems('nodes', body.nodes);
    const edges = validateImportItems('edges', body.edges);
    const chains = validateImportItems('chains', body.chains);

    if (nodes.length === 0 && edges.length === 0 && chains.length === 0) {
      throw new ValidationError('Import payload must include at least one node, edge, or chain');
    }

    const result = await service.importGraph({ nodes, edges, chains });
    return reply.send({ success: true, ...result, data: result });
  });
}
