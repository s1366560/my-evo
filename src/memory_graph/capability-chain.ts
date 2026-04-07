import type {
  CapabilityChain,
  ChainEvaluation,
  ConfidenceGrade,
  EdgeRelation,
} from './types';
import { getEffectiveConfidence } from './decay';

// ------------------------------------------------------------------
// Edge relation groups
// ------------------------------------------------------------------

/** Relations that form a valid evolution link in a capability chain */
const EVOLUTION_RELATIONS: Set<EdgeRelation> = new Set([
  'evolves_from',
  'derived_from',
]);

/** Relations that indicate proximity but not inheritance */
const PROXIMITY_RELATIONS: Set<EdgeRelation> = new Set([
  'produced',
  'references',
  'bundled_with',
  'triggered',
]);

// ------------------------------------------------------------------
// buildChain
// ------------------------------------------------------------------

/**
 * Build a capability chain starting from `startNodeId`, following
 * `evolves_from` / `derived_from` edges as far as possible (or up
 * to `maxDepth` hops).
 *
 * Returns the ordered list of node IDs from oldest → newest (root first).
 * Returns null if the start node has no ancestry.
 */
export function buildChain(
  startNodeId: string,
  edges: Array<{ source_id: string; target_id: string; relation: string }>,
  maxDepth = 10,
): string[] | null {
  // Build incoming adjacency for evolution relations.
  // "evolves_from" edge: source is the parent, target is the child.
  // To walk toward the ROOT (oldest ancestor), we follow edges backward
  // using an "incoming" map: child -> parent.
  const incoming: Record<string, string> = {};
  for (const edge of edges) {
    if (EVOLUTION_RELATIONS.has(edge.relation as EdgeRelation)) {
      // target "evolves_from" source → source is the parent of target
      incoming[edge.target_id] = edge.source_id;
    }
  }

  const chain: string[] = [];
  const visited = new Set<string>();

  let current: string | undefined = startNodeId;
  let depth = 0;

  // Walk backward toward the root via parent references
  while (current && !visited.has(current) && depth < maxDepth) {
    visited.add(current);
    chain.push(current);
    const parent: string | undefined = incoming[current];
    current = parent;
    depth++;
  }

  // Reverse so oldest (root) is first
  chain.reverse();

  return chain.length > 0 ? chain : null;
}

/**
 * Compute all possible capability chains from a start node, including
 * branches when a node has multiple parents (multiple inheritance).
 */
export function buildAllChains(
  startNodeId: string,
  edges: Array<{ source_id: string; target_id: string; relation: string }>,
  maxDepth = 10,
): string[][] {
  // Build incoming map: child -> parents (supports multiple inheritance)
  const incoming: Record<string, string[]> = {};
  for (const edge of edges) {
    if (EVOLUTION_RELATIONS.has(edge.relation as EdgeRelation)) {
      if (!incoming[edge.target_id]) incoming[edge.target_id] = [];
      incoming[edge.target_id]!.push(edge.source_id);
    }
  }

  const results: string[][] = [];

  function dfs(current: string, depth: number, path: string[]) {
    if (depth > maxDepth) return;
    const parents: string[] = incoming[current] ?? [];
    if (parents.length === 0) {
      results.push([...path].reverse());
      return;
    }
    for (const parent of parents) {
      if (!path.includes(parent)) {
        path.push(parent);
        dfs(parent, depth + 1, path);
        path.pop();
      }
    }
  }

  dfs(startNodeId, 0, [startNodeId]);

  return results;
}

// ------------------------------------------------------------------
// evaluateChain
// ------------------------------------------------------------------

/**
 * Evaluate the strength of a previously constructed chain.
 *
 * Chain strength is a weighted composite of:
 *   - Minimum edge weight along the chain (weakest link)
 *   - Average node confidence
 *   - Total evolution steps (more steps = richer lineage)
 *   - Continuity score (no missing hops)
 */
export function evaluateChain(
  chain: string[],
  edges: Array<{ source_id: string; target_id: string; relation: string; weight: number }>,
  nodeConfidences: Record<string, number>,
  nodeSignals: Record<string, { positive: number; negative: number; usage_count: number }>,
): ChainEvaluation {
  if (chain.length === 0) {
    return {
      chain_id: '',
      strength: 0,
      grade: 'F',
      weakest_link: '',
      total_weight: 0,
      avg_weight: 0,
      recommendations: ['Chain is empty'],
    };
  }

  // Build edge weight lookup (bidirectional)
  const edgeWeight: Record<string, number> = {};
  for (const edge of edges) {
    const key = `${edge.source_id}->${edge.target_id}`;
    edgeWeight[key] = edge.weight;
    // Also allow reverse lookup for bidirectional chain segments
    edgeWeight[`${edge.target_id}->${edge.source_id}`] = edge.weight;
  }

  // Compute per-hop weights and find weakest link
  const hopWeights: number[] = [];
  let weakestLink = '';
  let minWeight = Infinity;

  for (let i = 0; i < chain.length - 1; i++) {
    const key = `${chain[i]}->${chain[i + 1]}`;
    const w = edgeWeight[key] ?? DEFAULT_EDGE_WEIGHT;
    hopWeights.push(w);
    if (w < minWeight) {
      minWeight = w;
      weakestLink = `${chain[i]} -> ${chain[i + 1]}`;
    }
  }

  // Compute effective confidence for each node in the chain
  const nodeEffectiveConfidences: number[] = [];
  for (const nodeId of chain) {
    const base = nodeConfidences[nodeId] ?? 0;
    const signals = nodeSignals[nodeId] ?? { positive: 0, negative: 0, usage_count: 0 };
    const effective = getEffectiveConfidence(
      base,
      0, // daysSinceUpdate assumed 0 for chain evaluation
      signals.usage_count,
      signals.positive,
      signals.negative,
    );
    nodeEffectiveConfidences.push(effective);
  }

  const avgConfidence = nodeEffectiveConfidences.reduce((a, b) => a + b, 0) / nodeEffectiveConfidences.length;
  const avgWeight = hopWeights.length > 0 ? hopWeights.reduce((a, b) => a + b, 0) / hopWeights.length : 0;
  const continuityScore = chain.length > 1 ? avgWeight : 1;

  // Strength formula: geometric mean of avg confidence and continuity
  const strength = Math.sqrt(avgConfidence * continuityScore);

  const recommendations: string[] = [];
  if (weakestLink) {
    recommendations.push(`Strengthen weakest link: ${weakestLink} (weight=${minWeight.toFixed(2)})`);
  }
  if (avgConfidence < 0.5) {
    recommendations.push('Average node confidence is low; consider validating high-confidence ancestors');
  }
  if (chain.length < 3) {
    recommendations.push('Chain is shallow; explore deeper ancestry for richer capability signals');
  }
  if (continuityScore < 0.5) {
    recommendations.push('Edge weights are weak; review and reinforce edge relationships');
  }

  return {
    chain_id: chain.join(' -> '),
    strength: Math.min(1, Math.max(0, strength)),
    grade: getGradeFromStrength(strength),
    weakest_link: weakestLink,
    total_weight: hopWeights.reduce((a, b) => a + b, 0),
    avg_weight: avgWeight,
    recommendations,
  };
}

const DEFAULT_EDGE_WEIGHT = 0.5;

function getGradeFromStrength(strength: number): ConfidenceGrade {
  if (strength >= 0.8) return 'A+';
  if (strength >= 0.6) return 'A';
  if (strength >= 0.4) return 'B';
  if (strength >= 0.2) return 'C';
  if (strength >= 0.1) return 'D';
  return 'F';
}

// ------------------------------------------------------------------
// optimizeChain
// ------------------------------------------------------------------

/**
 * Optimise a capability chain by attempting to find stronger paths
 * between the same start and end nodes.
 *
 * Strategy:
 *   1. If the chain has gaps (missing intermediate nodes in the graph),
 *      try to backfill using 'references' edges as proxies.
 *   2. If a hop has low edge weight (< 0.4), suggest replacing it with
 *      an alternative path.
 *   3. Return the optimised chain and notes on changes made.
 */
export function optimizeChain(
  chain: string[],
  edges: Array<{ source_id: string; target_id: string; relation: string; weight: number }>,
  nodeConfidences: Record<string, number>,
  nodeSignals: Record<string, { positive: number; negative: number; usage_count: number }>,
): {
  optimised: string[];
  improvements: string[];
  newStrength: number;
} {
  if (chain.length < 2) {
    return { optimised: chain, improvements: [], newStrength: 0 };
  }

  const improvements: string[] = [];

  // Build all outgoing edges indexed by source
  const outgoing: Record<string, Array<{ target: string; weight: number; relation: string }>> = {};
  for (const edge of edges) {
    if (!outgoing[edge.source_id]) outgoing[edge.source_id] = [];
    outgoing[edge.source_id]!.push({ target: edge.target_id, weight: edge.weight, relation: edge.relation });
  }

  let optimised = [...chain];

  // Attempt to strengthen each hop
  for (let i = 0; i < optimised.length - 1; i++) {
    const from = optimised[i];
    const to = optimised[i + 1];
    if (!from || !to) continue;

    const directEdge = edges.find(
      (e) => e.source_id === from && e.target_id === to,
    );
    const directWeight = directEdge?.weight ?? 0;

    if (directWeight < 0.4) {
      // Try to find an alternative path via a transitive node
      const viaNodes = outgoing[from] ?? [];
      const better = viaNodes.find(
        (v: { target: string; weight: number }) => v.target !== to && v.weight > directWeight + 0.2,
      );

      if (better) {
        improvements.push(
          `Hop ${from}->${to} has low weight (${directWeight.toFixed(2)}); ` +
          `consider inserting intermediate node ${better.target} (weight=${better.weight.toFixed(2)})`,
        );
      }
    }
  }

  // Compute new strength
  const evaluation = evaluateChain(optimised, edges, nodeConfidences, nodeSignals);

  return {
    optimised,
    improvements,
    newStrength: evaluation.strength,
  };
}
