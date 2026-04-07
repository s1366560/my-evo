import type {
  GeneCapabilitySuggestion,
  GeneMemoryLink,
  MemoryGraphNode,
} from './types';

// ------------------------------------------------------------------
// Gene–Memory link helpers
//
// These functions operate on in-memory structures derived from the
// MemoryGraphNode and MemoryGraphEdge Prisma tables. They do NOT
// persist to the database directly; the caller is responsible for
// writing results back via the memory_graph service.
// ------------------------------------------------------------------

/**
 * Create a link record between a gene and a memory graph node.
 * The caller should persist the link in the appropriate table.
 */
export function linkGeneToMemory(
  geneId: string,
  memoryNodeId: string,
  strength = 1.0,
): GeneMemoryLink {
  return {
    gene_id: geneId,
    memory_node_id: memoryNodeId,
    link_type: 'defines',
    strength,
    linked_at: new Date().toISOString(),
  };
}

/**
 * Infer capabilities for a gene based on its memory graph neighbourhood.
 *
 * Iterates over all connected nodes (via edges), aggregates capability
 * signals from labels and types, and returns a ranked list of
 * capability suggestions with confidence scores.
 */
export function inferFromGeneUsage(
  geneId: string,
  memoryNodes: MemoryGraphNode[],
  edges: Array<{ source_id: string; target_id: string; relation: string; weight: number }>,
): GeneCapabilitySuggestion[] {
  // Find directly connected node IDs
  const connectedNodeIds = new Set<string>();
  for (const edge of edges) {
    if (edge.source_id === geneId) connectedNodeIds.add(edge.target_id);
    if (edge.target_id === geneId) connectedNodeIds.add(edge.source_id);
  }

  // Build capability map from neighbourhood
  const capabilityMap = new Map<string, { confidence: number; basis: string }>();

  for (const nodeId of connectedNodeIds) {
    const node = memoryNodes.find((n) => n.node_id === nodeId);
    if (!node) continue;

    const capabilities = extractCapabilitiesFromNode(node);

    for (const capability of capabilities) {
      const edge = edges.find(
        (e) =>
          (e.source_id === geneId && e.target_id === nodeId) ||
          (e.target_id === geneId && e.source_id === nodeId),
      );
      const weight = edge?.weight ?? 0.5;

      const confidence = node.confidence * weight;
      const basis = `${node.type}: ${node.label} [weight=${weight.toFixed(2)}]`;

      const existing = capabilityMap.get(capability);
      if (!existing || existing.confidence < confidence) {
        capabilityMap.set(capability, { confidence, basis });
      }
    }
  }

  return Array.from(capabilityMap.entries())
    .map(([capability, data]) => ({
      capability,
      confidence: Math.min(1, data.confidence),
      basis: data.basis,
    }))
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Suggest capabilities for a gene based on its content and neighbours.
 *
 * Takes a broader view than `inferFromGeneUsage` by also examining
 * transitive neighbours (2 hops) and aggregating signals from both
 * direct and indirect connections.
 */
export function suggestCapabilities(
  geneId: string,
  memoryNodes: MemoryGraphNode[],
  edges: Array<{ source_id: string; target_id: string; relation: string; weight: number }>,
): GeneCapabilitySuggestion[] {
  // Build adjacency list (both directions, weight preserved)
  const adjacency: Record<string, Array<{ node_id: string; weight: number }>> = {};
  for (const edge of edges) {
    if (!adjacency[edge.source_id]) adjacency[edge.source_id] = [];
    if (!adjacency[edge.target_id]) adjacency[edge.target_id] = [];
    adjacency[edge.source_id]!.push({ node_id: edge.target_id, weight: edge.weight });
    adjacency[edge.target_id]!.push({ node_id: edge.source_id, weight: edge.weight });
  }

  // Collect up to 2 hops
  const visited = new Set<string>([geneId]);
  const candidates: Array<{ nodeId: string; distance: number; incomingWeight: number }> = [];

  const queue = [geneId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbours = adjacency[current] ?? [];
    for (const { node_id, weight } of neighbours) {
      if (visited.has(node_id)) continue;
      visited.add(node_id);
      const distance = visited.size - 1;
      candidates.push({ nodeId: node_id, distance, incomingWeight: weight });
      if (distance < 2) queue.push(node_id);
    }
  }

  // Aggregate capabilities with distance penalty
  const capabilityMap = new Map<string, { confidence: number; basis: string }>();

  for (const { nodeId, distance, incomingWeight } of candidates) {
    const node = memoryNodes.find((n) => n.node_id === nodeId);
    if (!node) continue;

    const capabilities = extractCapabilitiesFromNode(node);
    const distancePenalty = Math.pow(0.6, distance);

    for (const capability of capabilities) {
      const confidence = node.confidence * incomingWeight * distancePenalty;
      const basis = `${node.type} @ ${distance}hops: ${node.label}`;

      const existing = capabilityMap.get(capability);
      if (!existing || existing.confidence < confidence) {
        capabilityMap.set(capability, { confidence, basis });
      }
    }
  }

  return Array.from(capabilityMap.entries())
    .map(([capability, data]) => ({
      capability,
      confidence: Math.min(1, Math.max(0, data.confidence)),
      basis: data.basis,
    }))
    .sort((a, b) => b.confidence - a.confidence);
}

// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------

function extractCapabilitiesFromNode(node: MemoryGraphNode): string[] {
  const combined = `${node.label} ${node.type}`.toLowerCase();
  const tokens = combined
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const KNOWN_CAPABILITY_SIGNALS = [
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
    'compress', 'minify', 'encrypt', 'hash',
    'schedule', 'orchestrate', 'coordinate', 'manage',
    'authenticate', 'authorize', 'secure', 'protect',
  ];

  return tokens.filter((t) => KNOWN_CAPABILITY_SIGNALS.includes(t));
}
