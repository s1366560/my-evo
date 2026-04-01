/**
 * Memory Graph Service - Chapter 30
 * Semantic experience-reuse engine
 *
 * Implements:
 * - Graph construction from Gene/Capsule/EvolutionEvent assets
 * - Signal-based semantic recall with composite scoring
 * - Capability chain traversal and replay
 * - Confidence decay model
 * - Cross-session graph sync
 */

import {
  MemoryGraphNode,
  MemoryGraphEdge,
  CapabilityChain,
  RecallQuery,
  RecallResult,
  ConfidenceRecord,
  ConfidenceDecayParams,
  DEFAULT_DECAY_PARAMS,
  DEFAULT_BAN_THRESHOLDS,
  ChainNode,
} from './types';

// ==================== In-Memory Graph Stores ====================

const nodes = new Map<string, MemoryGraphNode>();
const edges: MemoryGraphEdge[] = [];
const chains = new Map<string, CapabilityChain>();
const confidenceStore = new Map<string, ConfidenceRecord>();

// Node type indexes for fast lookup
const nodesByType = new Map<string, Set<string>>();
const nodesBySignal = new Map<string, Set<string>>();

// ==================== Graph Operations ====================

/**
 * Add a node to the memory graph
 */
export function addNode(
  assetId: string,
  type: 'Gene' | 'Capsule' | 'EvolutionEvent',
  signals: string[],
  initialConfidence: number,
  gdi?: number,
  metadata?: Record<string, unknown>
): MemoryGraphNode {
  const now = new Date().toISOString();

  const node: MemoryGraphNode = {
    id: assetId,
    type,
    signals,
    confidence: initialConfidence,
    gdi,
    created_at: now,
    updated_at: now,
    metadata,
  };

  nodes.set(assetId, node);

  // Index by type
  if (!nodesByType.has(type)) nodesByType.set(type, new Set());
  nodesByType.get(type)!.add(assetId);

  // Index by signals (simple keyword match)
  for (const signal of signals) {
    const key = signal.toLowerCase();
    if (!nodesBySignal.has(key)) nodesBySignal.set(key, new Set());
    nodesBySignal.get(key)!.add(assetId);
  }

  // Initialize confidence record
  initConfidence(assetId, initialConfidence);

  return node;
}

/**
 * Add an edge between two nodes
 */
export function addEdge(
  from: string,
  to: string,
  relation: MemoryGraphEdge['relation'],
  weight: number = 0.8
): MemoryGraphEdge | null {
  if (!nodes.has(from) || !nodes.has(to)) return null;

  const edge: MemoryGraphEdge = {
    from,
    to,
    relation,
    weight,
    created_at: new Date().toISOString(),
  };

  edges.push(edge);
  return edge;
}

/**
 * Build edges from asset lineage (Gene → Capsule → EvolutionEvent)
 */
export function buildLineageEdges(
  geneId: string,
  capsuleId: string,
  eventId?: string
): void {
  addEdge(geneId, capsuleId, 'produced', 1.0);
  if (eventId) {
    addEdge(capsuleId, eventId, 'triggered', 0.9);
  }
}

// ==================== Capability Chain (Chapter 30.1) ====================

/**
 * Construct a capability chain from a starting node
 * Chain: Gene → Capsule → EvolutionEvent
 */
export function constructChain(
  rootAssetId: string,
  chainId?: string
): CapabilityChain | null {
  if (!nodes.has(rootAssetId)) return null;

  const id = chainId || `chain_${Date.now()}`;
  const chainNodes: ChainNode[] = [];
  const visited = new Set<string>();
  let currentId: string | undefined = rootAssetId;
  let position = 0;
  let totalConfidence = 0;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const node = nodes.get(currentId);
    if (!node) break;

    chainNodes.push({
      asset_id: node.id,
      type: node.type,
      signals: node.signals,
      confidence: node.confidence,
      position,
    });

    totalConfidence += node.confidence;
    position++;

    // Follow the 'produced' edge to find next node
    const nextEdge = edges.find(
      (e) => e.from === currentId && e.relation === 'produced'
    );
    currentId = nextEdge?.to;
  }

  const allSignals = chainNodes.flatMap((n) => n.signals);

  const chain: CapabilityChain = {
    chain_id: id,
    nodes: chainNodes,
    total_confidence: chainNodes.length > 0 ? totalConfidence / chainNodes.length : 0,
    depth: chainNodes.length,
    signals: [...new Set(allSignals)],
    created_at: new Date().toISOString(),
  };

  chains.set(id, chain);
  return chain;
}

/**
 * Get chain by ID
 */
export function getChain(chainId: string): CapabilityChain | undefined {
  return chains.get(chainId);
}

// ==================== Semantic Recall (Chapter 30.2) ====================

/**
 * Recall matching assets from the memory graph based on signals
 * Returns top-K results sorted by composite recall score
 */
export function recall(
  query: RecallQuery
): RecallResult[] {
  const limit = query.limit || 10;
  const decayWindow = query.decay_window_days || 365;

  // Score all nodes matching the query
  const scored: RecallResult[] = [];

  for (const [assetId, node] of nodes) {
    // Filter by type
    if (query.node_type && node.type !== query.node_type) continue;

    // Filter by decay window
    const age = daysSince(node.created_at);
    if (age > decayWindow) continue;

    // Calculate signal match score
    const querySignals = query.signals.map((s) => s.toLowerCase());
    const nodeSignals = node.signals.map((s) => s.toLowerCase());

    const matchedSignals = querySignals.filter((qs) =>
      nodeSignals.some((ns) => ns.includes(qs) || qs.includes(ns))
    );

    if (matchedSignals.length === 0) continue;

    // Composite recall score
    const signalScore = matchedSignals.length / querySignals.length;
    const confidenceScore = node.confidence;
    const gdiScore = node.gdi ? node.gdi / 100 : 0.5;

    // Recency factor (newer = better)
    const recencyFactor = Math.max(0.3, 1 - age / 365);

    const compositeScore =
      signalScore * 0.4 +
      confidenceScore * 0.3 +
      gdiScore * 0.15 +
      recencyFactor * 0.15;

    // Apply minimum thresholds
    if (
      compositeScore < 0.1 ||
      (query.min_confidence && node.confidence < query.min_confidence) ||
      (query.min_gdi && node.gdi && node.gdi < query.min_gdi)
    ) {
      continue;
    }

    // Find chain if node belongs to one
    let nodeChainId: string | undefined;
    let chainDepth: number | undefined;
    for (const [cid, chain] of chains) {
      if (chain.nodes.some((n) => n.asset_id === assetId)) {
        nodeChainId = cid;
        chainDepth = chain.depth;
        break;
      }
    }

    scored.push({
      asset_id: assetId,
      type: node.type,
      score: Math.round(compositeScore * 1000) / 1000,
      signal_match: matchedSignals,
      confidence: node.confidence,
      gdi: node.gdi,
      relevance_reason: `matched ${matchedSignals.length}/${querySignals.length} signals`,
      chain_id: nodeChainId,
      depth: chainDepth,
    });
  }

  // Sort by composite score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

// ==================== Confidence Decay Model (Chapter 30.3) ====================

export function initConfidence(
  assetId: string,
  initialConfidence: number
): ConfidenceRecord {
  const now = new Date().toISOString();
  const record: ConfidenceRecord = {
    asset_id: assetId,
    initial_confidence: initialConfidence,
    current_confidence: initialConfidence,
    positive_count: 0,
    negative_count: 0,
    last_decay_at: now,
    history: [
      {
        timestamp: now,
        event: 'published',
        delta: 0,
        new_value: initialConfidence,
      },
    ],
  };
  confidenceStore.set(assetId, record);
  return record;
}

export function recordPositiveVerification(assetId: string): ConfidenceRecord | null {
  const record = confidenceStore.get(assetId);
  if (!record) return null;

  const params = DEFAULT_DECAY_PARAMS;
  const oldValue = record.current_confidence;

  record.positive_count++;
  record.last_verification_at = new Date().toISOString();

  // Apply positive boost
  const boost = params.positive_boost * (1 - oldValue);
  record.current_confidence = Math.min(1.0, oldValue + boost);

  record.history.push({
    timestamp: record.last_verification_at,
    event: 'positive_verification',
    delta: record.current_confidence - oldValue,
    new_value: record.current_confidence,
  });

  // Update node confidence
  const node = nodes.get(assetId);
  if (node) node.confidence = record.current_confidence;

  return record;
}

export function recordNegativeVerification(assetId: string): ConfidenceRecord | null {
  const record = confidenceStore.get(assetId);
  if (!record) return null;

  const params = DEFAULT_DECAY_PARAMS;
  const oldValue = record.current_confidence;

  record.negative_count++;
  record.last_verification_at = new Date().toISOString();

  // Apply negative penalty (floor at 0.05 minimum)
  record.current_confidence = Math.max(0.05, oldValue - params.negative_penalty);

  record.history.push({
    timestamp: record.last_verification_at,
    event: 'negative_verification',
    delta: record.current_confidence - oldValue,
    new_value: record.current_confidence,
  });

  // Update node confidence
  const node = nodes.get(assetId);
  if (node) node.confidence = record.current_confidence;

  return record;
}

/**
 * Apply time-based decay to all assets
 */
export function applyDecay(params: ConfidenceDecayParams = DEFAULT_DECAY_PARAMS): void {
  const now = new Date();

  for (const [assetId, record] of confidenceStore) {
    const lastDecay = new Date(record.last_decay_at);
    const daysElapsed = (now.getTime() - lastDecay.getTime()) / (1000 * 60 * 60 * 24);

    if (daysElapsed < 1) continue;

    const oldValue = record.current_confidence;

    // Natural decay: C(t) = C₀ × e^(-λ·Δt)
    const decayedValue = record.initial_confidence * Math.exp(-params.lambda * daysElapsed);

    // Usage factor: 1 + log(1 + fetch_count) — simplified, using positive_count
    const usageFactor = 1 + Math.log(1 + record.positive_count);

    record.current_confidence = Math.max(
      0.05,
      Math.min(1.0, decayedValue * usageFactor)
    );
    record.last_decay_at = now.toISOString();

    if (record.current_confidence !== oldValue) {
      record.history.push({
        timestamp: now.toISOString(),
        event: 'decay',
        delta: record.current_confidence - oldValue,
        new_value: record.current_confidence,
      });

      // Sync to graph node
      const node = nodes.get(assetId);
      if (node) node.confidence = record.current_confidence;
    }
  }
}

/**
 * Get confidence record for an asset
 */
export function getConfidence(assetId: string): ConfidenceRecord | undefined {
  return confidenceStore.get(assetId);
}

/**
 * Get confidence statistics across all assets
 */
export function getConfidenceStats(): {
  avg_confidence: number;
  total_assets: number;
  confidence_distribution: Record<string, number>;
} {
  const values = Array.from(confidenceStore.values()).map((r) => r.current_confidence);
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const distribution: Record<string, number> = {
    'A+': 0, // 0.9-1.0
    A: 0,    // 0.7-0.9
    B: 0,    // 0.5-0.7
    C: 0,    // 0.3-0.5
    D: 0,    // 0.1-0.3
    F: 0,    // <0.1
  };

  for (const v of values) {
    if (v >= 0.9) distribution['A+']++;
    else if (v >= 0.7) distribution.A++;
    else if (v >= 0.5) distribution.B++;
    else if (v >= 0.3) distribution.C++;
    else if (v >= 0.1) distribution.D++;
    else distribution.F++;
  }

  return {
    avg_confidence: Math.round(avg * 1000) / 1000,
    total_assets: values.length,
    confidence_distribution: distribution,
  };
}

// ==================== Ban Thresholds (Chapter 30.3) ====================

/**
 * Check ban thresholds and return assets that need attention
 */
export function checkBanThresholds(): {
  below_confidence_min: string[];
  below_gdi_min: string[];
  quarantine_ready: string[];
} {
  const thresholds = DEFAULT_BAN_THRESHOLDS;

  const below_confidence_min: string[] = [];
  const below_gdi_min: string[] = [];
  const quarantine_ready: string[] = [];

  for (const [assetId, record] of confidenceStore) {
    if (record.current_confidence < thresholds.confidence_min) {
      below_confidence_min.push(assetId);
    }
  }

  for (const [assetId, node] of nodes) {
    if (node.gdi && node.gdi < thresholds.gdi_min) {
      below_gdi_min.push(assetId);
    }
  }

  return { below_confidence_min, below_gdi_min, quarantine_ready };
}

// ==================== Graph Export/Import (used by .gepx) ====================

export function exportGraph(): {
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
  chains: CapabilityChain[];
  confidence: ConfidenceRecord[];
} {
  return {
    nodes: Array.from(nodes.values()),
    edges: [...edges],
    chains: Array.from(chains.values()),
    confidence: Array.from(confidenceStore.values()),
  };
}

export function importGraph(data: {
  nodes?: MemoryGraphNode[];
  edges?: MemoryGraphEdge[];
  chains?: CapabilityChain[];
  confidence?: ConfidenceRecord[];
}): { imported: number; conflicts: number } {
  let imported = 0;
  let conflicts = 0;

  if (data.nodes) {
    for (const node of data.nodes) {
      if (nodes.has(node.id)) {
        conflicts++;
      } else {
        nodes.set(node.id, node);
        if (!nodesByType.has(node.type)) nodesByType.set(node.type, new Set());
        nodesByType.get(node.type)!.add(node.id);
        imported++;
      }
    }
  }

  if (data.edges) {
    for (const edge of data.edges) {
      edges.push(edge);
      imported++;
    }
  }

  if (data.chains) {
    for (const chain of data.chains) {
      chains.set(chain.chain_id, chain);
      imported++;
    }
  }

  if (data.confidence) {
    for (const record of data.confidence) {
      confidenceStore.set(record.asset_id, record);
      imported++;
    }
  }

  return { imported, conflicts };
}

// ==================== Graph Statistics ====================

export function getGraphStats(): {
  total_nodes: number;
  total_edges: number;
  total_chains: number;
  nodes_by_type: Record<string, number>;
  avg_signal_count: number;
} {
  const nodesArray = Array.from(nodes.values());

  const nodesByTypeCount: Record<string, number> = {};
  let totalSignals = 0;

  for (const node of nodesArray) {
    nodesByTypeCount[node.type] = (nodesByTypeCount[node.type] || 0) + 1;
    totalSignals += node.signals.length;
  }

  return {
    total_nodes: nodes.size,
    total_edges: edges.length,
    total_chains: chains.size,
    nodes_by_type: nodesByTypeCount,
    avg_signal_count: nodesArray.length > 0 ? Math.round((totalSignals / nodesArray.length) * 10) / 10 : 0,
  };
}

// ==================== Utility ====================

function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return (now - then) / (1000 * 60 * 60 * 24);
}

/**
 * Reset all in-memory stores (for testing only)
 */
export function resetGraph(): void {
  nodes.clear();
  edges.length = 0;
  chains.clear();
  confidenceStore.clear();
  nodesByType.clear();
  nodesBySignal.clear();
}
