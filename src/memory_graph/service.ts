import { PrismaClient, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ValidationError } from '../shared/errors';
import type {
  BanCheckResult,
  BanThresholds,
  CapabilityChain,
  ChainEvaluation,
  ConfidenceDecayParams,
  ConfidenceGrade,
  ConfidenceRecord,
  EdgeRelation,
  GeneCapabilitySuggestion,
  GeneMemoryLink,
  GraphStats,
  InferredCapability,
  InteractionResult,
  LineageEntry,
  LineageResult,
  MemoryGraphNode,
  PropagationResult,
  RecallQuery,
  RecallResult,
} from './types';
import {
  calculateDecay,
  adjustByFrequency,
  computeDecay,
  DEFAULT_DECAY_PARAMS,
  getConfidenceGrade,
  getEffectiveConfidence,
} from './decay';
import {
  evaluateChain,
  optimizeChain,
  buildChain,
  buildAllChains,
} from './capability-chain';
import {
  inferCapabilities,
  propagateConfidence,
  updateEdgeWeights,
} from './inference';
import {
  inferFromGeneUsage,
  linkGeneToMemory,
  suggestCapabilities,
} from './gene-link';

// ------------------------------------------------------------------
// Prisma client singleton
// ------------------------------------------------------------------

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function getPrismaClient(prismaClient?: PrismaClient): PrismaClient {
  return prismaClient ?? prisma;
}

// ------------------------------------------------------------------
// Graph nodes
// ------------------------------------------------------------------

export async function createGraphNode(
  nodeId: string,
  type: string,
  label: string,
  confidence = 1.0,
  gdiScore = 50,
  metadata?: Record<string, unknown>,
): Promise<MemoryGraphNode> {
  if (!nodeId) throw new ValidationError('node_id is required');
  if (!type) throw new ValidationError('type is required');
  if (!label) throw new ValidationError('label is required');

  const node = await prisma.memoryGraphNode.create({
    data: {
      node_id: nodeId,
      type,
      label,
      confidence,
      gdi_score: gdiScore,
      metadata: metadata as Prisma.InputJsonValue | undefined,
    },
  });

  return node as unknown as MemoryGraphNode;
}

export async function upsertGraphNode(
  nodeId: string,
  type: string,
  label: string,
  metadata?: Record<string, unknown>,
): Promise<MemoryGraphNode> {
  if (!nodeId) throw new ValidationError('node_id is required');
  if (!type) throw new ValidationError('type is required');
  if (!label) throw new ValidationError('label is required');

  const node = await prisma.memoryGraphNode.upsert({
    where: { node_id: nodeId },
    update: {
      type,
      label,
      metadata: metadata as Prisma.InputJsonValue | undefined,
      updated_at: new Date(),
    },
    create: {
      node_id: nodeId,
      type,
      label,
      metadata: metadata as Prisma.InputJsonValue | undefined,
    },
  });

  return node as unknown as MemoryGraphNode;
}

export async function getGraphNode(nodeId: string): Promise<MemoryGraphNode | null> {
  const node = await prisma.memoryGraphNode.findUnique({ where: { node_id: nodeId } });
  return node as unknown as MemoryGraphNode | null;
}

export async function listGraphNodes(
  type?: string,
  minConfidence?: number,
  limit = 20,
  offset = 0,
): Promise<{ items: MemoryGraphNode[]; total: number }> {
  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (minConfidence !== undefined) where.confidence = { gte: minConfidence };

  const [items, total] = await Promise.all([
    prisma.memoryGraphNode.findMany({ where, take: limit, skip: offset, orderBy: { gdi_score: 'desc' } }),
    prisma.memoryGraphNode.count({ where }),
  ]);

  return { items: items as unknown as MemoryGraphNode[], total };
}

// ------------------------------------------------------------------
// Graph edges
// ------------------------------------------------------------------

export async function createGraphEdge(
  sourceId: string,
  targetId: string,
  relation: EdgeRelation,
  weight = 0.5,
): Promise<void> {
  if (!sourceId) throw new ValidationError('source_id is required');
  if (!targetId) throw new ValidationError('target_id is required');
  if (!relation) throw new ValidationError('relation is required');
  if (weight < 0 || weight > 1) throw new ValidationError('weight must be between 0 and 1');

  await prisma.memoryGraphEdge.create({
    data: { source_id: sourceId, target_id: targetId, relation, weight },
  });
}

export async function listGraphEdges(
  sourceId?: string,
  targetId?: string,
  limit = 100,
  offset = 0,
): Promise<{ items: Array<{ source_id: string; target_id: string; relation: string; weight: number }>; total: number }> {
  const where: Record<string, unknown> = {};
  if (sourceId) where.source_id = sourceId;
  if (targetId) where.target_id = targetId;

  const [items, total] = await Promise.all([
    prisma.memoryGraphEdge.findMany({ where, take: limit, skip: offset, orderBy: { created_at: 'desc' } }),
    prisma.memoryGraphEdge.count({ where }),
  ]);

  return {
    items: items as unknown as Array<{ source_id: string; target_id: string; relation: string; weight: number }>,
    total,
  };
}

// ------------------------------------------------------------------
// Confidence Decay
// ------------------------------------------------------------------

/**
 * Trigger decay for a single node: compute new confidence and update the DB.
 * Returns the updated node and the decay record.
 */
export async function triggerDecay(
  nodeId: string,
  params?: Partial<ConfidenceDecayParams>,
  prismaClient?: PrismaClient,
): Promise<{ node: MemoryGraphNode; decay: ReturnType<typeof computeDecay> }> {
  const client = getPrismaClient(prismaClient);
  const node = await client.memoryGraphNode.findUnique({ where: { node_id: nodeId } });
  if (!node) throw new NotFoundError('MemoryGraphNode', nodeId);

  const p = { ...DEFAULT_DECAY_PARAMS, ...params };

  // Compute days since last update
  const daysSinceUpdate = Math.floor(
    (Date.now() - node.updated_at.getTime()) / (1000 * 60 * 60 * 24),
  );

  const result = computeDecay({
    initialConfidence: node.confidence,
    daysSinceUpdate,
    positiveCount: node.positive,
    negativeCount: node.negative,
    params: p,
  });

  const updated = await client.memoryGraphNode.update({
    where: { node_id: nodeId },
    data: {
      confidence: result.effective,
      updated_at: new Date(),
    },
  });

  return {
    node: updated as unknown as MemoryGraphNode,
    decay: result,
  };
}

/**
 * Trigger decay for all nodes that have not been updated in the decay
 * period (default: 90 days, configurable via `inactiveDays`).
 */
export async function triggerDecayAll(
  params?: Partial<ConfidenceDecayParams>,
  inactiveDays = 90,
  batchSize = 100,
  prismaClient?: PrismaClient,
): Promise<{ processed: number; skipped: number }> {
  const client = getPrismaClient(prismaClient);
  const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

  let processed = 0;
  let skipped = 0;
  let cursor: string | undefined;

  while (true) {
    const nodes = await client.memoryGraphNode.findMany({
      where: { updated_at: { lt: cutoff } },
      take: batchSize,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { id: cursor }, orderBy: { id: 'asc' } } : {}),
    });

    if (nodes.length === 0) break;

    for (const node of nodes) {
      try {
        await triggerDecay(node.node_id, params, client);
        processed++;
      } catch {
        skipped++;
      }
    }

    const last = nodes[nodes.length - 1];
    cursor = last ? last.id : undefined;
  }

  return { processed, skipped };
}

/**
 * Apply a positive signal (usage / upvote) to a node.
 */
export async function applyPositiveSignal(
  nodeId: string,
  amount = 1,
): Promise<MemoryGraphNode> {
  const node = await prisma.memoryGraphNode.findUnique({ where: { node_id: nodeId } });
  if (!node) throw new NotFoundError('MemoryGraphNode', nodeId);

  const newPositive = node.positive + amount;
  const newUsageCount = node.usage_count + amount;

  // Recompute effective confidence with updated signals
  const daysSinceUpdate = Math.floor(
    (Date.now() - node.updated_at.getTime()) / (1000 * 60 * 60 * 24),
  );

  const effective = getEffectiveConfidence(
    node.confidence,
    daysSinceUpdate,
    newUsageCount,
    newPositive,
    node.negative,
  );

  const updated = await prisma.memoryGraphNode.update({
    where: { node_id: nodeId },
    data: {
      positive: newPositive,
      usage_count: newUsageCount,
      confidence: effective,
      updated_at: new Date(),
    },
  });

  return updated as unknown as MemoryGraphNode;
}

/**
 * Apply a negative signal (report / downvote) to a node.
 */
export async function applyNegativeSignal(
  nodeId: string,
  amount = 1,
): Promise<MemoryGraphNode> {
  const node = await prisma.memoryGraphNode.findUnique({ where: { node_id: nodeId } });
  if (!node) throw new NotFoundError('MemoryGraphNode', nodeId);

  const newNegative = node.negative + amount;

  const daysSinceUpdate = Math.floor(
    (Date.now() - node.updated_at.getTime()) / (1000 * 60 * 60 * 24),
  );

  const effective = getEffectiveConfidence(
    node.confidence,
    daysSinceUpdate,
    node.usage_count,
    node.positive,
    newNegative,
  );

  const updated = await prisma.memoryGraphNode.update({
    where: { node_id: nodeId },
    data: {
      negative: newNegative,
      confidence: effective,
      updated_at: new Date(),
    },
  });

  return updated as unknown as MemoryGraphNode;
}

/**
 * Get confidence record for a node, including grade and history.
 */
export async function getConfidenceRecord(nodeId: string): Promise<ConfidenceRecord> {
  const node = await prisma.memoryGraphNode.findUnique({ where: { node_id: nodeId } });
  if (!node) throw new NotFoundError('MemoryGraphNode', nodeId);

  const daysSinceUpdate = Math.floor(
    (Date.now() - node.updated_at.getTime()) / (1000 * 60 * 60 * 24),
  );

  const decayed = calculateDecay(
    node.confidence,
    daysSinceUpdate,
    node.positive,
  );

  return {
    asset_id: nodeId,
    current: node.confidence,
    initial: 1.0,
    grade: getConfidenceGrade(node.confidence),
    last_decay_at: node.updated_at.toISOString(),
    positive_signals: node.positive,
    negative_signals: node.negative,
    history: [],
  };
}

/**
 * Get confidence statistics across all nodes.
 */
export async function getConfidenceStats(): Promise<{
  avg_confidence: number;
  by_grade: Record<ConfidenceGrade, number>;
  total: number;
}> {
  const nodes = await prisma.memoryGraphNode.findMany({ select: { confidence: true } });
  if (nodes.length === 0) {
    return { avg_confidence: 0, by_grade: { 'A+': 0, A: 0, B: 0, C: 0, D: 0, F: 0 }, total: 0 };
  }

  const total = nodes.length;
  const sum = nodes.reduce((acc, n) => acc + n.confidence, 0);
  const avg_confidence = sum / total;

  const by_grade: Record<string, number> = { 'A+': 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const node of nodes) {
    const grade = getConfidenceGrade(node.confidence);
    by_grade[grade] = (by_grade[grade] ?? 0) + 1;
  }

  return { avg_confidence, by_grade: by_grade as Record<ConfidenceGrade, number>, total };
}

// ------------------------------------------------------------------
// Ban Check
// ------------------------------------------------------------------

const DEFAULT_BAN_THRESHOLDS: BanThresholds = {
  confidence_min: 0.15,
  gdi_min: 25,
  report_ratio_max: 0.05,
};

export async function checkBan(
  nodeId: string,
  thresholds: Partial<BanThresholds> = {},
): Promise<BanCheckResult> {
  const t = { ...DEFAULT_BAN_THRESHOLDS, ...thresholds };

  const node = await prisma.memoryGraphNode.findUnique({ where: { node_id: nodeId } });
  if (!node) throw new NotFoundError('MemoryGraphNode', nodeId);

  const reasons: string[] = [];
  const totalSignals = node.positive + node.negative;

  const confidenceOk = node.confidence >= t.confidence_min;
  const gdiOk = node.gdi_score >= t.gdi_min;

  const reportRatio = totalSignals > 0 ? node.negative / totalSignals : 0;
  const reportRatioOk = !(reportRatio > t.report_ratio_max && totalSignals >= 10);

  if (!confidenceOk) reasons.push(`Confidence ${node.confidence.toFixed(3)} < ${t.confidence_min}`);
  if (!gdiOk) reasons.push(`GDI ${node.gdi_score} < ${t.gdi_min}`);
  if (!reportRatioOk) {
    reasons.push(
      `Report ratio ${reportRatio.toFixed(3)} > ${t.report_ratio_max} (total signals: ${totalSignals})`,
    );
  }

  return {
    node_id: nodeId,
    should_ban: reasons.length > 0,
    confidence_ok: confidenceOk,
    gdi_ok: gdiOk,
    report_ratio_ok: reportRatioOk,
    reasons,
  };
}

// ------------------------------------------------------------------
// Recall (semantic search ranking)
// ------------------------------------------------------------------

export async function recall(query: RecallQuery): Promise<{
  results: RecallResult[];
  total: number;
  query_time_ms: number;
}> {
  const start = Date.now();
  const limit = query.limit ?? 10;
  const maxSignal = 100;

  // Load all active nodes (in a production system this would use a vector DB)
  const where: Record<string, unknown> = {};
  if (query.filters?.type && query.filters.type.length > 0) {
    where.type = { in: query.filters.type };
  }
  if (query.filters?.min_confidence !== undefined) {
    where.confidence = { gte: query.filters.min_confidence };
  }
  if (query.filters?.min_gdi !== undefined) {
    where.gdi_score = { gte: query.filters.min_gdi };
  }

  const nodes = await prisma.memoryGraphNode.findMany({ where });

  // Load edges for chain depth
  const edges = await prisma.memoryGraphEdge.findMany({
    select: { source_id: true, target_id: true, relation: true },
  });

  const scored: RecallResult[] = [];

  for (const node of nodes) {
    const totalSignals = node.positive + node.negative;
    const signalScore = totalSignals / maxSignal;
    const confidenceScore = node.confidence;
    const gdiScore = node.gdi_score / 100;

    const daysSinceUpdate = Math.floor(
      (Date.now() - node.updated_at.getTime()) / (1000 * 60 * 60 * 24),
    );
    const recencyFactor = 1 / (1 + daysSinceUpdate / 30);

    // Simple keyword match score
    const queryTerms = query.query.toLowerCase().split(/\s+/).filter(Boolean);
    const labelLower = node.label.toLowerCase();
    const keywordScore = queryTerms.length > 0
      ? queryTerms.filter((t) => labelLower.includes(t)).length / queryTerms.length
      : 0.5;

    const score =
      signalScore * 0.4 +
      confidenceScore * 0.3 +
      gdiScore * 0.15 +
      recencyFactor * 0.15;

    // Chain depth: count evolves_from / derived_from ancestors
    let chainDepth = 0;
    let current: string | undefined = node.node_id;
    const visited = new Set<string>();
    while (current && !visited.has(current) && chainDepth < 10) {
      visited.add(current);
      const parentEdge = edges.find(
        (e) =>
          e.target_id === current &&
          (e.relation === 'evolves_from' || e.relation === 'derived_from'),
      );
      if (parentEdge) {
        chainDepth++;
        current = parentEdge.source_id;
      } else {
        break;
      }
    }

    scored.push({
      asset_id: node.node_id,
      type: node.type as RecallResult['type'],
      label: node.label,
      score: Math.min(1, score + keywordScore * 0.2),
      confidence: node.confidence,
      gdi: node.gdi_score,
      snippet: node.label.slice(0, 120),
      chain_depth: chainDepth,
    });
  }

  scored.sort((a, b) => b.score - a.score);

  return {
    results: scored.slice(0, limit),
    total: scored.length,
    query_time_ms: Date.now() - start,
  };
}

// ------------------------------------------------------------------
// Lineage
// ------------------------------------------------------------------

export async function getLineage(
  assetId: string,
  depth = 5,
): Promise<LineageResult> {
  const chain = buildChain(assetId, [], depth);
  const lineage: LineageEntry[] = [];

  // Walk backward
  let current: string | undefined = assetId;
  let d = 0;
  const visited = new Set<string>();

  while (current && d < depth && !visited.has(current)) {
    visited.add(current);
    type EdgeResult = { source_id: string; relation: string } | null;
    const edge = await prisma.memoryGraphEdge.findFirst({
      where: {
        target_id: current,
        relation: { in: ['evolves_from', 'derived_from'] },
      },
      orderBy: { created_at: 'desc' },
    }) as EdgeResult;

    lineage.push({
      asset_id: current,
      depth: d,
      parent: edge?.source_id ?? null,
      relation: (edge?.relation as EdgeRelation) ?? null,
    });

    current = edge?.source_id ?? undefined;
    d++;
  }

  return {
    root: assetId,
    lineage,
    total_depth: lineage.length - 1,
    chain_id: `chain_${uuidv4()}`,
  };
}

// ------------------------------------------------------------------
// Capability Chain
// ------------------------------------------------------------------

export async function constructChain(
  startNodeId: string,
  maxDepth = 10,
): Promise<CapabilityChain> {
  const edges = await prisma.memoryGraphEdge.findMany({
    where: {
      OR: [
        { source_id: startNodeId },
        { target_id: startNodeId },
      ],
    },
    select: { source_id: true, target_id: true, relation: true },
  });

  const chainList = buildChain(startNodeId, edges, maxDepth);
  const chain = chainList ?? [startNodeId];

  const chainId = `chain_${uuidv4()}`;

  const record = await prisma.capabilityChain.create({
    data: {
      chain_id: chainId,
      root_asset_id: startNodeId,
      chain,
      total_evolution_steps: Math.max(0, chain.length - 1),
    },
  });

  return record as unknown as CapabilityChain;
}

export async function getChain(chainId: string): Promise<CapabilityChain | null> {
  const chain = await prisma.capabilityChain.findUnique({ where: { chain_id: chainId } });
  return chain as unknown as CapabilityChain | null;
}

export async function evaluateCapabilityChain(
  chainId: string,
): Promise<ChainEvaluation> {
  const chain = await prisma.capabilityChain.findUnique({ where: { chain_id: chainId } });
  if (!chain) throw new NotFoundError('CapabilityChain', chainId);

  const edges = await prisma.memoryGraphEdge.findMany();
  const nodes = await prisma.memoryGraphNode.findMany();

  const nodeConfidences: Record<string, number> = {};
  const nodeSignals: Record<string, { positive: number; negative: number; usage_count: number }> = {};

  for (const n of nodes) {
    nodeConfidences[n.node_id] = n.confidence;
    nodeSignals[n.node_id] = {
      positive: n.positive,
      negative: n.negative,
      usage_count: n.usage_count,
    };
  }

  return evaluateChain(
    chain.chain,
    edges,
    nodeConfidences,
    nodeSignals,
  );
}

export async function optimizeCapabilityChain(
  chainId: string,
): Promise<{ optimised: string[]; improvements: string[]; newStrength: number }> {
  const chain = await prisma.capabilityChain.findUnique({ where: { chain_id: chainId } });
  if (!chain) throw new NotFoundError('CapabilityChain', chainId);

  const edges = await prisma.memoryGraphEdge.findMany();
  const nodes = await prisma.memoryGraphNode.findMany();

  const nodeConfidences: Record<string, number> = {};
  const nodeSignals: Record<string, { positive: number; negative: number; usage_count: number }> = {};

  for (const n of nodes) {
    nodeConfidences[n.node_id] = n.confidence;
    nodeSignals[n.node_id] = {
      positive: n.positive,
      negative: n.negative,
      usage_count: n.usage_count,
    };
  }

  return optimizeChain(chain.chain, edges, nodeConfidences, nodeSignals);
}

// ------------------------------------------------------------------
// Inference Engine
// ------------------------------------------------------------------

export async function inferNodeCapabilities(nodeId: string): Promise<InferredCapability[]> {
  const node = await prisma.memoryGraphNode.findUnique({ where: { node_id: nodeId } });
  if (!node) throw new NotFoundError('MemoryGraphNode', nodeId);

  const edges = await prisma.memoryGraphEdge.findMany({
    where: {
      OR: [{ source_id: nodeId }, { target_id: nodeId }],
    },
  });

  const neighbourIds = new Set<string>();
  for (const edge of edges) {
    neighbourIds.add(edge.source_id === nodeId ? edge.target_id : edge.source_id);
  }

  const neighbours = await prisma.memoryGraphNode.findMany({
    where: { node_id: { in: Array.from(neighbourIds) } },
  });

  const neighbourhood = neighbours.map((n) => {
    const edge = edges.find(
      (e) =>
        (e.source_id === nodeId && e.target_id === n.node_id) ||
        (e.target_id === nodeId && e.source_id === n.node_id),
    )!;
    return {
      neighbour_id: n.node_id,
      label: n.label,
      type: n.type,
      relation: edge.relation,
      weight: edge.weight,
      confidence: n.confidence,
      positive: n.positive,
      negative: n.negative,
      usage_count: n.usage_count,
    };
  });

  return inferCapabilities(nodeId, neighbourhood);
}

export async function updateNodeEdgeWeights(
  nodeId: string,
  interaction: InteractionResult,
): Promise<{ node_id: string; edge_id: string; new_weight: number; delta: number }[]> {
  const edges = await prisma.memoryGraphEdge.findMany({
    where: {
      OR: [{ source_id: nodeId }, { target_id: nodeId }],
    },
  });

  const results: Array<{ node_id: string; edge_id: string; new_weight: number; delta: number }> = [];

  for (const edge of edges) {
    const { weight, delta } = updateEdgeWeights(edge.weight, interaction);
    await prisma.memoryGraphEdge.update({
      where: { id: edge.id },
      data: { weight },
    });
    results.push({
      node_id: nodeId,
      edge_id: edge.id,
      new_weight: weight,
      delta,
    });
  }

  return results;
}

export async function propagateNodeConfidence(
  nodeId: string,
  maxDepth = 5,
): Promise<PropagationResult[]> {
  const edges = await prisma.memoryGraphEdge.findMany();
  const nodes = await prisma.memoryGraphNode.findMany();

  const nodeConfidences: Record<string, number> = {};
  for (const n of nodes) {
    nodeConfidences[n.node_id] = n.confidence;
  }

  const results = propagateConfidence(
    nodeId,
    edges,
    nodeConfidences,
    maxDepth,
  );

  // Batch-update propagated nodes
  for (const result of results) {
    if (result.propagated) {
      await prisma.memoryGraphNode.updateMany({
        where: { node_id: result.node_id },
        data: { confidence: result.effective_confidence },
      }).catch(() => {/* node may not exist */});
    }
  }

  return results;
}

// ------------------------------------------------------------------
// Gene Link
// ------------------------------------------------------------------

export async function linkGeneToMemoryNode(
  geneId: string,
  memoryNodeId: string,
  strength = 1.0,
): Promise<GeneMemoryLink> {
  // Verify memory node exists
  const node = await prisma.memoryGraphNode.findUnique({ where: { node_id: memoryNodeId } });
  if (!node) throw new NotFoundError('MemoryGraphNode', memoryNodeId);

  return linkGeneToMemory(geneId, memoryNodeId, strength);
}

export async function inferGeneCapabilities(geneId: string): Promise<GeneCapabilitySuggestion[]> {
  const nodes = await prisma.memoryGraphNode.findMany();
  const edges = await prisma.memoryGraphEdge.findMany({
    where: {
      OR: [{ source_id: geneId }, { target_id: geneId }],
    },
  });

  return inferFromGeneUsage(
    geneId,
    nodes as unknown as MemoryGraphNode[],
    edges,
  );
}

export async function suggestGeneCapabilities(geneId: string): Promise<GeneCapabilitySuggestion[]> {
  const nodes = await prisma.memoryGraphNode.findMany();
  const edges = await prisma.memoryGraphEdge.findMany({
    where: {
      OR: [{ source_id: geneId }, { target_id: geneId }],
    },
  });

  return suggestCapabilities(
    geneId,
    nodes as unknown as MemoryGraphNode[],
    edges,
  );
}
export async function getGraphStats(): Promise<GraphStats> {
  const [nodes, edges, chainCount] = await Promise.all([
    prisma.memoryGraphNode.findMany(),
    prisma.memoryGraphEdge.findMany(),
    prisma.capabilityChain.count(),
  ]);

  const nodeTypes: Record<string, number> = {};
  const edgeTypes: Record<string, number> = {};

  for (const n of nodes) {
    nodeTypes[n.type] = (nodeTypes[n.type] ?? 0) + 1;
  }
  for (const e of edges) {
    edgeTypes[e.relation] = (edgeTypes[e.relation] ?? 0) + 1;
  }

  const avgConfidence = nodes.length > 0
    ? nodes.reduce((acc, n) => acc + n.confidence, 0) / nodes.length
    : 0;

  const avgGdi = nodes.length > 0
    ? nodes.reduce((acc, n) => acc + n.gdi_score, 0) / nodes.length
    : 0;

  return {
    total_nodes: nodes.length,
    total_edges: edges.length,
    node_types: nodeTypes,
    edge_types: edgeTypes,
    avg_confidence: avgConfidence,
    avg_gdi: avgGdi,
    chains_count: chainCount,
  };
}

// ------------------------------------------------------------------
// Export / Import
// ------------------------------------------------------------------

export async function exportGraph(): Promise<{
  nodes: unknown[];
  edges: unknown[];
  chains: unknown[];
  exported_at: string;
}> {
  const [nodes, edges, chains] = await Promise.all([
    prisma.memoryGraphNode.findMany(),
    prisma.memoryGraphEdge.findMany(),
    prisma.capabilityChain.findMany(),
  ]);

  return {
    nodes: nodes as unknown as unknown[],
    edges: edges as unknown as unknown[],
    chains: chains as unknown as unknown[],
    exported_at: new Date().toISOString(),
  };
}

export async function importGraph(snapshot: {
  nodes?: unknown[];
  edges?: unknown[];
  chains?: unknown[];
}): Promise<{ imported_nodes: number; imported_edges: number; imported_chains: number }> {
  let imported_nodes = 0;
  let imported_edges = 0;
  let imported_chains = 0;

  if (snapshot.nodes) {
    for (const node of snapshot.nodes) {
      const n = node as Record<string, unknown>;
      try {
        await prisma.memoryGraphNode.upsert({
          where: { node_id: n.node_id as string },
          update: {},
          create: {
            node_id: n.node_id as string,
            type: n.type as string,
            label: n.label as string,
            positive: (n.positive as number) ?? 0,
            negative: (n.negative as number) ?? 0,
            usage_count: (n.usage_count as number) ?? 0,
            confidence: (n.confidence as number) ?? 1,
            gdi_score: (n.gdi_score as number) ?? 50,
          },
        });
        imported_nodes++;
      } catch { /* skip duplicates */ }
    }
  }

  if (snapshot.edges) {
    for (const edge of snapshot.edges) {
      const e = edge as Record<string, unknown>;
      try {
        const existing = await prisma.memoryGraphEdge.findFirst({
          where: { source_id: e.source_id as string, target_id: e.target_id as string },
        });
        if (!existing) {
          await prisma.memoryGraphEdge.create({
            data: {
              source_id: e.source_id as string,
              target_id: e.target_id as string,
              relation: e.relation as string,
              weight: (e.weight as number) ?? 0.5,
            },
          });
          imported_edges++;
        }
      } catch { /* skip */ }
    }
  }

  if (snapshot.chains) {
    for (const chain of snapshot.chains) {
      const c = chain as Record<string, unknown>;
      try {
        const existing = await prisma.capabilityChain.findUnique({
          where: { chain_id: c.chain_id as string },
        });
        if (!existing) {
          await prisma.capabilityChain.create({
            data: {
              chain_id: c.chain_id as string,
              root_asset_id: c.root_asset_id as string,
              chain: c.chain as string[],
              total_evolution_steps: (c.total_evolution_steps as number) ?? 0,
            },
          });
          imported_chains++;
        }
      } catch { /* skip */ }
    }
  }

  return { imported_nodes, imported_edges, imported_chains };
}
