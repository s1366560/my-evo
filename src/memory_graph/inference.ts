import type {
  InferredCapability,
  InteractionResult,
  PropagationResult,
} from './types';
import { getEffectiveConfidence } from './decay';

// ------------------------------------------------------------------
// Capability inference constants
// ------------------------------------------------------------------

const MAX_PROPAGATION_DEPTH = 5;
const DEFAULT_EDGE_WEIGHT = 0.5;

// ------------------------------------------------------------------
// inferCapabilities
// ------------------------------------------------------------------

/**
 * Infer capabilities for a given node based on its connected nodes
 * and their signals. Returns a list of inferred capabilities with
 * per-capability confidence scores.
 *
 * Capabilities are derived from:
 *   1. The node's own label and type
 *   2. Neighbouring nodes via 'produced' / 'references' edges
 *   3. Signal distribution across the neighbourhood
 */
export function inferCapabilities(
  nodeId: string,
  neighbourhood: Array<{
    neighbour_id: string;
    label: string;
    type: string;
    relation: string;
    weight: number;
    confidence: number;
    positive: number;
    negative: number;
    usage_count: number;
  }>,
): InferredCapability[] {
  const capabilityMap = new Map<string, { confidence: number; evidence: string[]; source_nodes: Set<string> }>();

  for (const neighbour of neighbourhood) {
    // Map label keywords to capability signals
    const keywords = extractCapabilityKeywords(neighbour.label);

    for (const keyword of keywords) {
      const effectiveConfidence = getEffectiveConfidence(
        neighbour.confidence,
        0, // daysSinceUpdate assumed 0 for in-memory inference
        neighbour.usage_count,
        neighbour.positive,
        neighbour.negative,
      );

      // Weight by edge weight and relation type
      const relationBonus = getRelationBonus(neighbour.relation);
      const weightedConfidence = effectiveConfidence * neighbour.weight * relationBonus;

      const existing = capabilityMap.get(keyword);
      if (existing) {
        existing.confidence = Math.max(existing.confidence, weightedConfidence);
        existing.evidence.push(`${neighbour.relation}(${neighbour.neighbour_id}): ${neighbour.label}`);
        existing.source_nodes.add(neighbour.neighbour_id);
      } else {
        capabilityMap.set(keyword, {
          confidence: weightedConfidence,
          evidence: [`${neighbour.relation}(${neighbour.neighbour_id}): ${neighbour.label}`],
          source_nodes: new Set([neighbour.neighbour_id]),
        });
      }
    }
  }

  // Sort by confidence descending
  return Array.from(capabilityMap.entries())
    .map(([capability, data]) => ({
      capability,
      confidence: Math.min(1, data.confidence),
      evidence: data.evidence,
      source_nodes: Array.from(data.source_nodes),
    }))
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Update the weight of edges connected to a node based on an
 * interaction result (success/failure/neutral).
 *
 * Returns updated weight (clamped to [0, 1]) and delta applied.
 */
export function updateEdgeWeights(
  currentWeight: number,
  interaction: InteractionResult,
): { weight: number; delta: number } {
  let delta: number;

  switch (interaction.outcome) {
    case 'success':
      // Positive reinforcement: increase weight
      delta = 0.1;
      break;
    case 'failure':
      // Negative reinforcement: decrease weight
      delta = -0.15;
      break;
    case 'neutral':
    default:
      // Neutral: slight drift toward default
      delta = (DEFAULT_EDGE_WEIGHT - currentWeight) * 0.05;
      break;
  }

  // Apply custom delta if provided
  if (interaction.weight_delta !== undefined) {
    delta = interaction.weight_delta;
  }

  const newWeight = Math.min(1, Math.max(0, currentWeight + delta));
  return { weight: newWeight, delta: newWeight - currentWeight };
}

/**
 * Propagate confidence from a seed node to its neighbours through
 * the graph, with depth-based attenuation.
 *
 * Each hop reduces the effective confidence by the edge weight.
 * Nodes already in `visited` are skipped.
 *
 * Returns all nodes that received propagated confidence, including
 * the seed node itself.
 */
export function propagateConfidence(
  nodeId: string,
  edges: Array<{
    source_id: string;
    target_id: string;
    weight: number;
  }>,
  nodeConfidences: Record<string, number>,
  maxDepth = MAX_PROPAGATION_DEPTH,
  visited = new Set<string>(),
): PropagationResult[] {
  const results: PropagationResult[] = [];
  const queue: Array<{ node_id: string; depth: number; inherited_confidence: number }> = [];

  const seedConfidence = nodeConfidences[nodeId] ?? 0;
  visited.add(nodeId);

  results.push({
    node_id: nodeId,
    depth: 0,
    effective_confidence: seedConfidence,
    propagated: false,
  });

  // Build adjacency list
  const adjacency: Record<string, Array<{ node_id: string; weight: number }>> = {};
  for (const edge of edges) {
    if (!adjacency[edge.source_id]) adjacency[edge.source_id] = [];
    if (!adjacency[edge.target_id]) adjacency[edge.target_id] = [];
    adjacency[edge.source_id]!.push({ node_id: edge.target_id, weight: edge.weight });
    adjacency[edge.target_id]!.push({ node_id: edge.source_id, weight: edge.weight });
  }

  // BFS
  queue.push({ node_id: nodeId, depth: 0, inherited_confidence: seedConfidence });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbours = adjacency[current.node_id] ?? [];

    for (const neighbour of neighbours) {
      if (visited.has(neighbour.node_id)) continue;
      visited.add(neighbour.node_id);

      const depth = current.depth + 1;
      if (depth > maxDepth) continue;

      // Attenuate by edge weight and depth
      const inherited = current.inherited_confidence * neighbour.weight * Math.pow(0.8, depth);
      const nodeBase = nodeConfidences[neighbour.node_id] ?? 0;

      // Propagated confidence blends inherited signal with node's own confidence
      const effective = Math.max(inherited, nodeBase * 0.5 + inherited * 0.5);

      results.push({
        node_id: neighbour.node_id,
        depth,
        effective_confidence: Math.min(1, effective),
        propagated: true,
      });

      queue.push({ node_id: neighbour.node_id, depth, inherited_confidence: effective });
    }
  }

  return results;
}

// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------

function extractCapabilityKeywords(label: string): string[] {
  // Normalise and split label into tokens
  const tokens = label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);

  // Known capability signal keywords (from EvoMap signal vocabulary)
  const KNOWN_SIGNALS = [
    'classify', 'categorize', 'detect', 'recognize', 'identify',
    'generate', 'create', 'produce', 'synthesize', 'compose',
    'optimize', 'improve', 'refactor', 'tune', 'enhance',
    'debug', 'diagnose', 'fix', 'repair', 'resolve',
    'analyze', 'examine', 'inspect', 'evaluate', 'assess',
    'extract', 'parse', 'transform', 'convert', 'translate',
    'search', 'retrieve', 'fetch', 'query',
    'predict', 'forecast', 'estimate', 'infer',
    'summarize', 'condense', 'abstract', 'describe',
    'validate', 'verify', 'check', 'test',
    'compress', 'minify', 'obfuscate', 'encrypt', 'hash',
    'schedule', 'orchestrate', 'coordinate', 'manage',
    'authenticate', 'authorize', 'secure', 'protect',
  ];

  // Return both exact matches and prefix matches (e.g. "classifier" matches "classify")
  const matched: string[] = [];
  for (const token of tokens) {
    // Exact match first
    if (KNOWN_SIGNALS.includes(token)) {
      matched.push(token);
    } else {
      // Prefix match: token starts with a known signal
      const prefix = KNOWN_SIGNALS.find((s) => token.startsWith(s) && token !== s);
      if (prefix) matched.push(prefix);
    }
  }
  return matched;
}

function getRelationBonus(relation: string): number {
  switch (relation) {
    case 'produced': return 1.2;
    case 'evolves_from': return 1.1;
    case 'derived_from': return 1.1;
    case 'references': return 1.0;
    case 'triggered': return 0.9;
    case 'bundled_with': return 0.85;
    default: return 1.0;
  }
}
