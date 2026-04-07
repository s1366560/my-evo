import type { KgNode, KgRelationship } from './types';
import * as neo4jClient from './neo4j';
import * as postgresService from './service';

export async function shortestPath(
  fromId: string,
  toId: string,
): Promise<KgRelationship[]> {
  const connected = await neo4jClient.isConnected().catch(() => false);
  if (connected) {
    const result = await neo4jClient.queryPath(fromId, toId, 10);
    return result.relationships;
  }
  // PostgreSQL BFS Dijkstra fallback
  return postgresService.shortestPathPostgres(fromId, toId);
}

/**
 * Simplified PageRank for the asset graph.
 *
 * Algorithm:
 * 1. Start with equal rank for all published assets
 * 2. Iteratively propagate rank: rank(j) = (1-d)/N + d * sum(rank(i)/outDegree(i))
 * 3. Normalize after each iteration
 * 4. Return top assets by rank
 *
 * @param iterations  Number of iterations (default 20)
 * @param dampingFactor Damping factor d (default 0.85)
 * @param limit       Maximum results returned (default 20)
 */
export async function pageRank(
  iterations = 20,
  dampingFactor = 0.85,
  limit = 20,
): Promise<Array<{ node: KgNode; rank: number }>> {
  const connected = await neo4jClient.isConnected().catch(() => false);
  if (connected) {
    return pageRankNeo4j(iterations, dampingFactor, limit);
  }
  return pageRankPostgres(iterations, dampingFactor, limit);
}

async function pageRankNeo4j(
  iterations: number,
  damping: number,
  limit: number,
): Promise<Array<{ node: KgNode; rank: number }>> {
  const cypher = `
    MATCH (n)
    WITH count(n) AS totalNodes
    MATCH (n)-[r]-()
    WITH totalNodes, n, count(r) AS degree
    RETURN n, degree, totalNodes
    LIMIT 5000
  `;

  const session = neo4jClient.getSession();
  try {
    const result = await session.run(cypher, {});
    const records = result.records;

    const N = records.length > 0 ? Number(records[0]!.get('totalNodes')) : 1;
    if (N === 0) return [];

    // Build adjacency: nodeId -> Set<neighborId>
    const adjacency = new Map<string, Set<string>>();
    const degrees = new Map<string, number>();

    for (const record of records) {
      const n = record.get('n') as { properties: Record<string, unknown> };
      const nodeId = String(n.properties?.['id'] ?? '');
      const deg = Number(record.get('degree'));
      if (!nodeId) continue;
      degrees.set(nodeId, deg);
      if (!adjacency.has(nodeId)) adjacency.set(nodeId, new Set());
    }

    // Rebuild adjacency with actual neighbors
    const neighborCypher = `
      MATCH (a)-[r]-(b)
      WHERE a.id IS NOT NULL AND b.id IS NOT NULL
      RETURN a.id AS source, b.id AS target
      LIMIT 10000
    `;
    const neighborResult = await session.run(neighborCypher, {});
    for (const record of neighborResult.records) {
      const src = String(record.get('source'));
      const tgt = String(record.get('target'));
      adjacency.get(src)?.add(tgt);
      adjacency.get(tgt)?.add(src);
    }

    return runPageRank(adjacency, degrees, iterations, damping, limit);
  } finally {
    await session.close();
  }
}

async function pageRankPostgres(
  iterations: number,
  damping: number,
  limit: number,
): Promise<Array<{ node: KgNode; rank: number }>> {
  const assets = await postgresService.getAllPublishedAssets();
  if (assets.length === 0) return [];

  const N = assets.length;

  // Build adjacency from parent_id + signal-sharing
  const adjacency = new Map<string, Set<string>>();
  const degrees = new Map<string, number>();

  for (const asset of assets) {
    adjacency.set(asset.asset_id, new Set());
  }
  for (const asset of assets) {
    if (asset.parent_id && adjacency.has(asset.parent_id)) {
      adjacency.get(asset.asset_id)!.add(asset.parent_id);
      adjacency.get(asset.parent_id)!.add(asset.asset_id);
    }
  }

  // Signal-sharing neighbors
  for (let i = 0; i < assets.length; i++) {
    for (let j = i + 1; j < assets.length; j++) {
      const shared = (assets[i]!.signals as string[]).filter((s) =>
        (assets[j]!.signals as string[]).includes(s),
      );
      if (shared.length > 0) {
        adjacency.get(assets[i]!.asset_id)!.add(assets[j]!.asset_id);
        adjacency.get(assets[j]!.asset_id)!.add(assets[i]!.asset_id);
      }
    }
  }

  for (const [id, neighbors] of adjacency) {
    degrees.set(id, neighbors.size);
  }

  return runPageRank(adjacency, degrees, iterations, damping, limit);
}

function runPageRank(
  adjacency: Map<string, Set<string>>,
  degrees: Map<string, number>,
  iterations: number,
  damping: number,
  limit: number,
): Array<{ node: KgNode; rank: number }> {
  const nodeIds = [...adjacency.keys()];
  const N = nodeIds.length;
  if (N === 0) return [];

  let ranks = new Map(nodeIds.map((id) => [id, 1 / N]));

  for (let iter = 0; iter < iterations; iter++) {
    const newRanks = new Map<string, number>();

    for (const nodeId of nodeIds) {
      let contribution = 0;
      const neighbors = adjacency.get(nodeId) ?? new Set();
      for (const neighbor of neighbors) {
        const deg = degrees.get(neighbor) ?? 1;
        if (deg > 0) {
          contribution += (ranks.get(neighbor) ?? 0) / deg;
        }
      }
      const newRank = (1 - damping) / N + damping * contribution;
      newRanks.set(nodeId, newRank);
    }

    // Normalize
    const sum = [...newRanks.values()].reduce((s, r) => s + r, 0);
    if (sum > 0) {
      for (const [id, r] of newRanks) {
        newRanks.set(id, r / sum);
      }
    }
    ranks = newRanks;
  }

  return [...ranks.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, rank]) => ({
      node: { id, type: 'asset', properties: {}, created_at: '' },
      rank,
    }));
}

/**
 * Simplified Louvain-style community detection using label propagation.
 *
 * Algorithm:
 * 1. Assign each node a unique community = its own ID
 * 2. Iterate nodes; reassign to the most frequent community among neighbors
 * 3. Repeat until convergence (no changes) or max iterations reached
 *
 * @param algorithm  Algorithm name ('louvain' or 'label_propagation')
 */
export async function communityDetection(
  algorithm: 'louvain' | 'label_propagation' = 'louvain',
  limit = 1000,
): Promise<Map<string, string>> {
  const connected = await neo4jClient.isConnected().catch(() => false);
  if (connected) {
    return communityDetectionNeo4j(limit);
  }
  return communityDetectionPostgres();
}

async function communityDetectionNeo4j(
  limit: number,
): Promise<Map<string, string>> {
  const cypher = `
    MATCH (a)-[r]-(b)
    WHERE a.id IS NOT NULL AND b.id IS NOT NULL
    RETURN a.id AS source, b.id AS target
    LIMIT ${limit}
  `;

  const session = neo4jClient.getSession();
  try {
    const result = await session.run(cypher, {});

    // Build adjacency list
    const adjacency = new Map<string, Set<string>>();
    for (const record of result.records) {
      const src = String(record.get('source'));
      const tgt = String(record.get('target'));
      if (!adjacency.has(src)) adjacency.set(src, new Set());
      if (!adjacency.has(tgt)) adjacency.set(tgt, new Set());
      adjacency.get(src)!.add(tgt);
      adjacency.get(tgt)!.add(src);
    }

    return runLabelPropagation(adjacency);
  } finally {
    await session.close();
  }
}

async function communityDetectionPostgres(): Promise<Map<string, string>> {
  const assets = await postgresService.getAllPublishedAssets();
  const adjacency = new Map<string, Set<string>>();

  for (const asset of assets) {
    adjacency.set(asset.asset_id, new Set());
  }
  for (const asset of assets) {
    if (asset.parent_id && adjacency.has(asset.parent_id)) {
      adjacency.get(asset.asset_id)!.add(asset.parent_id);
      adjacency.get(asset.parent_id)!.add(asset.asset_id);
    }
  }

  return runLabelPropagation(adjacency);
}

function runLabelPropagation(
  adjacency: Map<string, Set<string>>,
): Map<string, string> {
  const communities = new Map<string, string>();

  // Initialize each node to its own community
  for (const nodeId of adjacency.keys()) {
    communities.set(nodeId, nodeId);
  }

  const nodeIds = [...adjacency.keys()];
  const maxIterations = 20;

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    for (const nodeId of nodeIds) {
      const neighbors = [...(adjacency.get(nodeId) ?? new Set())];
      if (neighbors.length === 0) continue;

      // Count community frequencies among neighbors
      const freq = new Map<string, number>();
      for (const neighbor of neighbors) {
        const comm = communities.get(neighbor) ?? neighbor;
        freq.set(comm, (freq.get(comm) ?? 0) + 1);
      }

      // Find most frequent community; tie-break by smaller ID
      let best: [string, number] | null = null;
      for (const [comm, count] of freq) {
        if (!best || count > best[1] || (count === best[1] && comm < best[0])) {
          best = [comm, count];
        }
      }

      if (best && communities.get(nodeId) !== best[0]) {
        communities.set(nodeId, best[0]);
        changed = true;
      }
    }

    if (!changed) break;
  }

  return communities;
}
