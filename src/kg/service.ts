import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import type {
  KgNode,
  KgRelationship,
  KgQueryResult,
  ShortestPathResult,
  NeighborResult,
} from './types';
import { NotFoundError, ValidationError } from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

interface AssetGraphNode {
  asset_id: string;
  asset_type: string;
  name: string;
  description: string;
  signals: string[];
  tags: string[];
  gdi_score: number;
  author_id: string;
  parent_id: string | null;
  created_at: Date;
}

function toKgNode(asset: AssetGraphNode): KgNode {
  return {
    id: asset.asset_id,
    type: asset.asset_type,
    properties: {
      name: asset.name,
      description: asset.description,
      signals: asset.signals,
      tags: asset.tags,
      gdi_score: asset.gdi_score,
      author_id: asset.author_id,
    },
    created_at: asset.created_at.toISOString(),
  };
}

export async function queryGraph(
  query: string,
  depth = 2,
): Promise<KgQueryResult> {
  const assets = await prisma.asset.findMany({
    where: {
      status: 'published',
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { signals: { has: query } },
        { tags: { has: query } },
      ],
    },
    take: 50,
  });

  const nodes: KgNode[] = assets.map((a: Record<string, unknown>) =>
    toKgNode(a as unknown as AssetGraphNode),
  );

  const nodeIds = new Set(nodes.map((n) => n.id));
  const relationships: KgRelationship[] = [];

  for (const asset of assets) {
    if (asset.parent_id && nodeIds.has(asset.parent_id)) {
      relationships.push({
        id: `rel-${asset.asset_id}-${asset.parent_id}`,
        from_id: asset.asset_id,
        to_id: asset.parent_id,
        type: 'derived_from',
        properties: { generation: asset.generation },
        created_at: asset.created_at.toISOString(),
      });
    }

    if (depth > 1) {
      const related = await prisma.asset.findMany({
        where: {
          status: 'published',
          signals: { hasSome: asset.signals },
          asset_id: { not: asset.asset_id },
        },
        take: 5,
      });

      for (const rel of related) {
        const shared = asset.signals.filter((s: string) =>
          rel.signals.includes(s),
        );
        if (shared.length > 0 && nodeIds.has(rel.asset_id)) {
          relationships.push({
            id: `rel-sig-${asset.asset_id}-${rel.asset_id}`,
            from_id: asset.asset_id,
            to_id: rel.asset_id,
            type: 'shares_signals',
            properties: { shared_signals: shared },
            created_at: new Date().toISOString(),
          });
        }
      }
    }
  }

  return { nodes, relationships };
}

export async function createNode(
  type: string,
  properties: Record<string, unknown>,
): Promise<KgNode> {
  if (!type) {
    throw new ValidationError('Node type is required');
  }

  const asset = await prisma.asset.create({
    data: {
      asset_id: crypto.randomUUID(),
      asset_type: type,
      name: (properties.name as string) ?? 'Untitled',
      description: (properties.description as string) ?? '',
      signals: (properties.signals as string[]) ?? [],
      tags: (properties.tags as string[]) ?? [],
      author_id: (properties.author_id as string) ?? 'system',
      status: 'draft',
      gdi_score: 0,
    },
  });

  return toKgNode(asset as unknown as AssetGraphNode);
}

export async function createRelationship(
  fromId: string,
  toId: string,
  type: string,
  properties?: Record<string, unknown>,
): Promise<KgRelationship> {
  const [fromAsset, toAsset] = await Promise.all([
    prisma.asset.findUnique({ where: { asset_id: fromId } }),
    prisma.asset.findUnique({ where: { asset_id: toId } }),
  ]);

  if (!fromAsset) {
    throw new NotFoundError('Source node', fromId);
  }
  if (!toAsset) {
    throw new NotFoundError('Target node', toId);
  }

  return {
    id: `rel-${fromId}-${toId}-${Date.now()}`,
    from_id: fromId,
    to_id: toId,
    type,
    properties: properties ?? {},
    created_at: new Date().toISOString(),
  };
}

export async function getNeighbors(
  nodeId: string,
  type?: string,
  direction: 'incoming' | 'outgoing' | 'both' = 'both',
): Promise<NeighborResult[]> {
  const asset = await prisma.asset.findUnique({
    where: { asset_id: nodeId },
  });

  if (!asset) {
    throw new NotFoundError('Node', nodeId);
  }

  const results: NeighborResult[] = [];

  if (direction === 'outgoing' || direction === 'both') {
    const children = await prisma.asset.findMany({
      where: {
        parent_id: nodeId,
        ...(type ? { asset_type: type } : {}),
      },
      take: 20,
    });

    for (const child of children) {
      results.push({
        node: toKgNode(child as unknown as AssetGraphNode),
        relationship: {
          id: `rel-${child.asset_id}-${nodeId}`,
          from_id: child.asset_id,
          to_id: nodeId,
          type: 'derived_from',
          properties: { generation: child.generation },
          created_at: child.created_at.toISOString(),
        },
        direction: 'outgoing',
      });
    }
  }

  if (direction === 'incoming' || direction === 'both') {
    if (asset.parent_id) {
      const parent = await prisma.asset.findUnique({
        where: { asset_id: asset.parent_id },
      });

      if (parent && (!type || parent.asset_type === type)) {
        results.push({
          node: toKgNode(parent as unknown as AssetGraphNode),
          relationship: {
            id: `rel-${nodeId}-${parent.asset_id}`,
            from_id: nodeId,
            to_id: parent.asset_id,
            type: 'derived_from',
            properties: { generation: asset.generation },
            created_at: asset.created_at.toISOString(),
          },
          direction: 'incoming',
        });
      }
    }

    const signalNeighbors = await prisma.asset.findMany({
      where: {
        asset_id: { not: nodeId },
        status: 'published',
        signals: { hasSome: asset.signals },
        ...(type ? { asset_type: type } : {}),
      },
      take: 10,
    });

    for (const neighbor of signalNeighbors) {
      const shared = asset.signals.filter((s: string) =>
        neighbor.signals.includes(s),
      );

      results.push({
        node: toKgNode(neighbor as unknown as AssetGraphNode),
        relationship: {
          id: `rel-sig-${nodeId}-${neighbor.asset_id}`,
          from_id: nodeId,
          to_id: neighbor.asset_id,
          type: 'shares_signals',
          properties: { shared_signals: shared },
          created_at: new Date().toISOString(),
        },
        direction: 'incoming',
      });
    }
  }

  return results;
}

export async function getShortestPath(
  fromId: string,
  toId: string,
): Promise<ShortestPathResult> {
  const [fromAsset, toAsset] = await Promise.all([
    prisma.asset.findUnique({ where: { asset_id: fromId } }),
    prisma.asset.findUnique({ where: { asset_id: toId } }),
  ]);

  if (!fromAsset || !toAsset) {
    return { found: false, path: [], length: 0 };
  }

  if (fromId === toId) {
    return { found: true, path: [fromId], length: 0 };
  }

  const visited = new Set<string>();
  const queue: Array<{ id: string; path: string[] }> = [
    { id: fromId, path: [fromId] },
  ];
  visited.add(fromId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    const neighbors: string[] = [];

    const children = await prisma.asset.findMany({
      where: { parent_id: current.id },
      select: { asset_id: true },
      take: 50,
    });
    neighbors.push(...children.map((c: { asset_id: string }) => c.asset_id));

    const parentAsset = await prisma.asset.findUnique({
      where: { asset_id: current.id },
      select: { parent_id: true },
    });

    if (parentAsset?.parent_id) {
      neighbors.push(parentAsset.parent_id);
    }

    for (const neighborId of neighbors) {
      if (neighborId === toId) {
        return {
          found: true,
          path: [...current.path, neighborId],
          length: current.path.length,
        };
      }

      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({
          id: neighborId,
          path: [...current.path, neighborId],
        });
      }
    }
  }

  return { found: false, path: [], length: 0 };
}

export async function deleteNode(nodeId: string): Promise<void> {
  const asset = await prisma.asset.findUnique({
    where: { asset_id: nodeId },
  });

  if (!asset) {
    throw new NotFoundError('Node', nodeId);
  }

  await prisma.asset.delete({
    where: { asset_id: nodeId },
  });
}

// ----- Neo4j fallback helpers -----

export async function getAllPublishedAssets(): Promise<AssetGraphNode[]> {
  const assets = await prisma.asset.findMany({
    where: { status: 'published' },
    take: 1000,
  });
  return assets as unknown as AssetGraphNode[];
}

/**
 * BFS-based shortest path between two nodes using PostgreSQL.
 * Returns a KgQueryResult compatible with the graph module.
 */
export async function getShortestPathPostgres(
  fromId: string,
  toId: string,
  maxHops = 3,
): Promise<KgQueryResult> {
  if (fromId === toId) {
    return { nodes: [{ id: fromId, type: 'asset', properties: {}, created_at: '' }], relationships: [] };
  }

  const visited = new Set<string>();
  const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }];
  visited.add(fromId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.path.length > maxHops) continue;

    const neighbors: string[] = [];

    const children = await prisma.asset.findMany({
      where: { parent_id: current.id },
      select: { asset_id: true },
      take: 50,
    });
    neighbors.push(...children.map((c) => c.asset_id));

    const parentAsset = await prisma.asset.findUnique({
      where: { asset_id: current.id },
      select: { parent_id: true },
    });
    if (parentAsset?.parent_id) {
      neighbors.push(parentAsset.parent_id);
    }

    for (const neighborId of neighbors) {
      if (neighborId === toId) {
        const finalPath = [...current.path, neighborId];
        const nodes: KgNode[] = [];
        const relationships: KgRelationship[] = [];

        for (let i = 0; i < finalPath.length; i++) {
          const asset = await prisma.asset.findUnique({ where: { asset_id: finalPath[i] } });
          if (asset) {
            nodes.push(toKgNode(asset as unknown as AssetGraphNode));
            if (i > 0) {
              const from = finalPath[i - 1]!;
              const to = finalPath[i]!;
              relationships.push({
                id: `rel-${from}-${to}`,
                from_id: from,
                to_id: to,
                type: 'derived_from',
                properties: {},
                created_at: new Date().toISOString(),
              });
            }
          }
        }
        return { nodes, relationships };
      }

      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ id: neighborId, path: [...current.path, neighborId] });
      }
    }
  }

  return { nodes: [], relationships: [] };
}

/**
 * Returns relationship edges for Dijkstra/PageRank computation.
 */
export async function shortestPathPostgres(
  fromId: string,
  toId: string,
): Promise<KgRelationship[]> {
  const result = await getShortestPathPostgres(fromId, toId, 10);
  return result.relationships;
}

/**
 * Find similar assets using PostgreSQL signal-sharing.
 */
export async function findSimilarAssetsPostgres(
  assetId: string,
  limit = 10,
): Promise<Array<{ node: KgNode; similarity: number; sharedSignals: string[]; relationshipType: string }>> {
  const asset = await prisma.asset.findUnique({ where: { asset_id: assetId } });
  if (!asset) return [];

  const signalSet = new Set(asset.signals as string[]);

  const similar = await prisma.asset.findMany({
    where: {
      status: 'published',
      asset_id: { not: assetId },
      signals: { hasSome: asset.signals },
    },
    take: limit,
  });

  return similar.map((a) => {
    const shared = (a.signals as string[]).filter((s) => signalSet.has(s));
    return {
      node: toKgNode(a as unknown as AssetGraphNode),
      similarity: shared.length / Math.max(asset.signals.length, 1),
      sharedSignals: shared,
      relationshipType: 'shares_signals',
    };
  });
}

/**
 * Find related capabilities via BFS traversal in PostgreSQL.
 */
export async function findRelatedCapabilitiesPostgres(
  nodeId: string,
  maxDepth = 2,
  limit = 20,
): Promise<KgQueryResult> {
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];
  visited.add(nodeId);
  const nodes: KgNode[] = [];
  const relationships: KgRelationship[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;

    const asset = await prisma.asset.findUnique({ where: { asset_id: current.id } });
    if (!asset) continue;

    if (nodes.length < limit) {
      nodes.push(toKgNode(asset as unknown as AssetGraphNode));
    }

    if (current.depth >= maxDepth) continue;

    const children = await prisma.asset.findMany({
      where: { parent_id: current.id },
      take: 10,
    });

    for (const child of children) {
      if (!visited.has(child.asset_id)) {
        visited.add(child.asset_id);
        queue.push({ id: child.asset_id, depth: current.depth + 1 });
      }
      if (relationships.length < limit) {
        relationships.push({
          id: `rel-${current.id}-${child.asset_id}`,
          from_id: current.id,
          to_id: child.asset_id,
          type: 'derived_from',
          properties: {},
          created_at: new Date().toISOString(),
        });
      }
    }

    if (asset.signals.length > 0 && current.depth < maxDepth) {
      const signalNeighbors = await prisma.asset.findMany({
        where: {
          status: 'published',
          asset_id: { not: current.id },
          signals: { hasSome: asset.signals },
        },
        take: 5,
      });

      for (const neighbor of signalNeighbors) {
        const shared = (asset.signals as string[]).filter((s) =>
          (neighbor.signals as string[]).includes(s),
        );
        if (!visited.has(neighbor.asset_id)) {
          visited.add(neighbor.asset_id);
          queue.push({ id: neighbor.asset_id, depth: current.depth + 1 });
        }
        if (relationships.length < limit) {
          relationships.push({
            id: `rel-sig-${current.id}-${neighbor.asset_id}`,
            from_id: current.id,
            to_id: neighbor.asset_id,
            type: 'shares_signals',
            properties: { shared_signals: shared },
            created_at: new Date().toISOString(),
          });
        }
      }
    }
  }

  return { nodes, relationships };
}
