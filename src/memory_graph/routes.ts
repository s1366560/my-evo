import type { FastifyInstance } from 'fastify';
import type { EdgeRelation, ConfidenceDecayParams, NodeType } from './types';
import { requireAuth } from '../shared/auth';
import { ValidationError } from '../shared/errors';
import * as service from './service';

export async function memoryGraphRoutes(app: FastifyInstance): Promise<void> {
  const handleComputeDecay = async (
    body: {
      node_id?: string;
      lambda?: number;
      inactive_days?: number;
      batch_size?: number;
    } | undefined,
  ) => {
    if (body?.node_id) {
      return service.triggerDecay(
        body.node_id,
        body.lambda !== undefined ? { lambda: body.lambda } : undefined,
      );
    }

    return service.triggerDecayAll(
      body?.lambda !== undefined ? { lambda: body.lambda } : undefined,
      body?.inactive_days ?? 90,
      body?.batch_size ?? 100,
    );
  };

  // ===== Graph Nodes =====

  app.post('/nodes', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      node_id: string;
      type: string;
      label: string;
      confidence?: number;
      gdi_score?: number;
      metadata?: Record<string, unknown>;
    };
    if (!body.node_id) throw new ValidationError('node_id is required');
    if (!body.type) throw new ValidationError('type is required');
    if (!body.label) throw new ValidationError('label is required');
    const node = await service.createGraphNode(
      body.node_id, body.type, body.label,
      body.confidence ?? 1.0, body.gdi_score ?? 50, body.metadata,
    );
    return reply.status(201).send({ success: true, data: node });
  });

  app.get('/nodes', {
    schema: { tags: ['MemoryGraph'] },
  }, async (request, reply) => {
    const q = request.query as { type?: string; min_confidence?: string; limit?: string; offset?: string };
    const result = await service.listGraphNodes(
      q.type,
      q.min_confidence !== undefined ? Number(q.min_confidence) : undefined,
      q.limit ? Math.min(Number(q.limit), 100) : 20,
      q.offset ? Number(q.offset) : 0,
    );
    return reply.send({ success: true, data: result });
  });

  app.get('/nodes/:nodeId', {
    schema: { tags: ['MemoryGraph'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const node = await service.getGraphNode(nodeId);
    if (!node) return reply.status(404).send({ success: false, error: 'NOT_FOUND', message: `Node '${nodeId}' not found` });
    return reply.send({ success: true, data: node });
  });

  app.put('/nodes/:nodeId', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const body = request.body as { type?: string; label?: string; metadata?: Record<string, unknown> };
    const node = await service.upsertGraphNode(nodeId, body.type ?? '', body.label ?? '', body.metadata);
    return reply.send({ success: true, data: node });
  });

  // ===== Graph Edges =====

  app.post('/edges', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as { source_id: string; target_id: string; relation: string; weight?: number };
    if (!body.source_id) throw new ValidationError('source_id is required');
    if (!body.target_id) throw new ValidationError('target_id is required');
    if (!body.relation) throw new ValidationError('relation is required');
    await service.createGraphEdge(body.source_id, body.target_id, body.relation as EdgeRelation, body.weight ?? 0.5);
    return reply.status(201).send({ success: true, data: { source_id: body.source_id, target_id: body.target_id, relation: body.relation } });
  });

  app.get('/edges', {
    schema: { tags: ['MemoryGraph'] },
  }, async (request, reply) => {
    const q = request.query as { source_id?: string; target_id?: string; limit?: string; offset?: string };
    const result = await service.listGraphEdges(
      q.source_id, q.target_id,
      q.limit ? Math.min(Number(q.limit), 100) : 100,
      q.offset ? Number(q.offset) : 0,
    );
    return reply.send({ success: true, data: result });
  });

  // ===== Confidence =====

  app.post('/nodes/:nodeId/decay', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const body = request.body as Record<string, unknown> | undefined;
    const result = await service.triggerDecay(nodeId, body as ConfidenceDecayParams | undefined);
    return reply.send({ success: true, data: result });
  });

  app.post('/decay-all', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as { lambda?: number; inactive_days?: number; batch_size?: number } | undefined;
    const result = await service.triggerDecayAll(
      body?.lambda !== undefined ? { lambda: body.lambda } : undefined,
      body?.inactive_days ?? 90,
      body?.batch_size ?? 100,
    );
    return reply.send({ success: true, data: result });
  });

  app.post('/compute-decay', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as {
      node_id?: string;
      lambda?: number;
      inactive_days?: number;
      batch_size?: number;
    } | undefined;
    const result = await handleComputeDecay(body);
    return reply.send({ success: true, data: result });
  });

  app.post('/nodes/:nodeId/signals/positive', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const body = request.body as { amount?: number } | undefined;
    const node = await service.applyPositiveSignal(nodeId, body?.amount ?? 1);
    return reply.send({ success: true, data: node });
  });

  app.post('/nodes/:nodeId/signals/negative', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const body = request.body as { amount?: number } | undefined;
    const node = await service.applyNegativeSignal(nodeId, body?.amount ?? 1);
    return reply.send({ success: true, data: node });
  });

  app.get('/nodes/:nodeId/confidence', {
    schema: { tags: ['MemoryGraph'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const record = await service.getConfidenceRecord(nodeId);
    return reply.send({ success: true, data: record });
  });

  app.get('/confidence-stats', {
    schema: { tags: ['MemoryGraph'] },
  }, async (_request, reply) => {
    const stats = await service.getConfidenceStats();
    return reply.send({ success: true, data: stats });
  });

  // ===== Ban Check =====

  app.post('/nodes/:nodeId/ban-check', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const body = request.body as { confidence_min?: number; gdi_min?: number } | undefined;
    const result = await service.checkBan(nodeId, body);
    return reply.send({ success: true, data: result });
  });

  // ===== Recall =====

  app.post('/recall', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as {
      query: string;
      limit?: number;
      filters?: { type?: NodeType[]; min_confidence?: number; min_gdi?: number };
    };
    if (!body.query) throw new ValidationError('query is required');
    const result = await service.recall({ query: body.query, limit: body.limit ?? 10, filters: body.filters as Parameters<typeof service.recall>[0]['filters'] });
    return reply.send({ success: true, data: result });
  });

  // ===== Lineage =====

  app.get('/lineage/:assetId', {
    schema: { tags: ['MemoryGraph'] },
  }, async (request, reply) => {
    const { assetId } = request.params as { assetId: string };
    const q = request.query as { depth?: string };
    const result = await service.getLineage(assetId, q.depth ? Number(q.depth) : 5);
    return reply.send({ success: true, data: result });
  });

  // ===== Capability Chains =====

  app.post('/chains', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as { start_node_id: string; max_depth?: number };
    if (!body.start_node_id) throw new ValidationError('start_node_id is required');
    const chain = await service.constructChain(body.start_node_id, body.max_depth ?? 10);
    return reply.status(201).send({ success: true, data: chain });
  });

  app.get('/chains/:chainId', {
    schema: { tags: ['MemoryGraph'] },
  }, async (request, reply) => {
    const { chainId } = request.params as { chainId: string };
    const chain = await service.getChain(chainId);
    if (!chain) return reply.status(404).send({ success: false, error: 'NOT_FOUND', message: `Chain '${chainId}' not found` });
    return reply.send({ success: true, data: chain });
  });

  app.post('/chains/:chainId/evaluate', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { chainId } = request.params as { chainId: string };
    const result = await service.evaluateCapabilityChain(chainId);
    return reply.send({ success: true, data: result });
  });

  app.post('/chains/:chainId/optimize', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { chainId } = request.params as { chainId: string };
    const result = await service.optimizeCapabilityChain(chainId);
    return reply.send({ success: true, data: result });
  });

  // ===== Inference =====

  app.get('/nodes/:nodeId/infer', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const result = await service.inferNodeCapabilities(nodeId);
    return reply.send({ success: true, data: result });
  });

  app.post('/propagate', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as { node_id: string };
    if (!body.node_id) throw new ValidationError('node_id is required');
    const result = await service.propagateNodeConfidence(body.node_id);
    return reply.send({ success: true, data: result });
  });

  app.post('/edges/weights', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as { node_id: string; outcome?: 'success' | 'failure' | 'neutral'; weight_delta?: number };
    if (!body.node_id) throw new ValidationError('node_id is required');
    const interaction = {
      node_id: body.node_id,
      outcome: body.outcome ?? 'neutral',
      weight_delta: body.weight_delta,
      timestamp: new Date().toISOString(),
    };
    const result = await service.updateNodeEdgeWeights(body.node_id, interaction);
    return reply.send({ success: true, data: result });
  });

  // ===== Gene Links =====

  app.post('/gene-link', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as { gene_id: string; memory_node_id: string };
    if (!body.gene_id) throw new ValidationError('gene_id is required');
    if (!body.memory_node_id) throw new ValidationError('memory_node_id is required');
    await service.linkGeneToMemoryNode(body.gene_id, body.memory_node_id);
    return reply.status(201).send({ success: true, data: { gene_id: body.gene_id, memory_node_id: body.memory_node_id } });
  });

  app.get('/genes/:geneId/capabilities', {
    schema: { tags: ['MemoryGraph'] },
  }, async (request, reply) => {
    const { geneId } = request.params as { geneId: string };
    const result = await service.inferGeneCapabilities(geneId);
    return reply.send({ success: true, data: result });
  });

  app.get('/genes/:geneId/suggest', {
    schema: { tags: ['MemoryGraph'] },
  }, async (request, reply) => {
    const { geneId } = request.params as { geneId: string };
    const result = await service.suggestGeneCapabilities(geneId);
    return reply.send({ success: true, data: result });
  });

  // ===== Stats / Export / Import =====

  app.get('/stats', {
    schema: { tags: ['MemoryGraph'] },
  }, async (_request, reply) => {
    const stats = await service.getGraphStats();
    return reply.send({ success: true, data: stats });
  });

  app.post('/export', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (_request, reply) => {
    const snapshot = await service.exportGraph();
    return reply.send({ success: true, data: snapshot });
  });

  app.post('/import', {
    schema: { tags: ['MemoryGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as { nodes: unknown[]; edges: unknown[] };
    const result = await service.importGraph(body as Parameters<typeof service.importGraph>[0]);
    return reply.send({ success: true, data: result });
  });
}
