import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import type {
  KgNode,
  KgNodeDetail,
  KgNeighborhoodResult,
  KgRelationship,
  KgQueryResult,
  KgStats,
  ShortestPathResult,
  NeighborResult,
  KgTypeQueryResult,
} from './types';
import { NotFoundError, ValidationError } from '../shared/errors';

let prisma = new PrismaClient();

const KG_ENTITY_TAG = 'kg:entity';

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
  generation: number;
  status: string;
  created_at: Date;
}

interface PersistedKgRelationship {
  relationship_id: string;
  from_id: string;
  to_id: string;
  relationship_type: string;
  properties: Record<string, unknown> | null;
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

function normalizeKgType(type: string): string {
  const normalized = type.trim().toLowerCase();
  if (!normalized) {
    throw new ValidationError('Node type is required');
  }
  return normalized;
}

function normalizeRelationshipType(type: string): string {
  const normalized = type.trim().toLowerCase();
  if (!normalized) {
    throw new ValidationError('Relationship type is required');
  }
  return normalized;
}

function buildRelationshipId(fromId: string, toId: string, type: string): string {
  return `rel-${crypto.createHash('sha256').update(`${fromId}:${type}:${toId}`).digest('hex').slice(0, 24)}`;
}

function relationshipSignature(fromId: string, toId: string, type: string): string {
  return `${fromId}::${toId}::${type}`;
}

function toKgRelationship(record: PersistedKgRelationship): KgRelationship {
  return {
    id: record.relationship_id,
    from_id: record.from_id,
    to_id: record.to_id,
    type: record.relationship_type,
    properties: record.properties ?? {},
    created_at: record.created_at.toISOString(),
  };
}

function assertReadableNode(
  asset: AssetGraphNode | null,
  expectedType: string,
  nodeId: string,
): AssetGraphNode {
  if (
    !asset
    || asset.status !== 'published'
    || asset.asset_type.toLowerCase() !== expectedType
  ) {
    throw new NotFoundError(`${expectedType} node`, nodeId);
  }
  return asset;
}

function countSharedSignalRelationships(
  assets: Array<Pick<AssetGraphNode, 'asset_id' | 'signals' | 'status'>>,
): number {
  const signalToAssets = new Map<string, Set<string>>();

  for (const asset of assets) {
    if (asset.status !== 'published' || asset.signals.length === 0) {
      continue;
    }

    for (const signal of asset.signals) {
      if (!signalToAssets.has(signal)) {
        signalToAssets.set(signal, new Set<string>());
      }
      signalToAssets.get(signal)!.add(asset.asset_id);
    }
  }

  const pairs = new Set<string>();
  for (const assetIds of signalToAssets.values()) {
    const ids = [...assetIds].sort();
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        pairs.add(`${ids[i]}::${ids[j]}`);
      }
    }
  }

  return pairs.size;
}

async function getExplicitRelationshipsBetweenNodes(
  nodeIds: string[],
): Promise<PersistedKgRelationship[]> {
  if (nodeIds.length === 0) {
    return [];
  }

  const relationships = await prisma.knowledgeGraphRelationship.findMany({
    where: {
      from_id: { in: nodeIds },
      to_id: { in: nodeIds },
    },
    orderBy: { created_at: 'desc' },
  });

  return relationships as unknown as PersistedKgRelationship[];
}

async function getTraversalEdges(nodeId: string): Promise<Array<{ neighborId: string; relationship: KgRelationship }>> {
  const [asset, children, explicitOutgoing, explicitIncoming] = await Promise.all([
    prisma.asset.findUnique({
      where: { asset_id: nodeId },
      select: {
        asset_id: true,
        parent_id: true,
        generation: true,
        created_at: true,
      },
    }),
    prisma.asset.findMany({
      where: { parent_id: nodeId, status: 'published' },
      select: {
        asset_id: true,
        generation: true,
        created_at: true,
      },
      take: 50,
    }),
    prisma.knowledgeGraphRelationship.findMany({
      where: { from_id: nodeId },
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
    prisma.knowledgeGraphRelationship.findMany({
      where: { to_id: nodeId },
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
  ]);

  if (!asset) {
    return [];
  }

  const edges: Array<{ neighborId: string; relationship: KgRelationship }> = [];

  if (asset.parent_id) {
    edges.push({
      neighborId: asset.parent_id,
      relationship: {
        id: buildRelationshipId(nodeId, asset.parent_id, 'derived_from'),
        from_id: nodeId,
        to_id: asset.parent_id,
        type: 'derived_from',
        properties: { generation: asset.generation },
        created_at: asset.created_at.toISOString(),
      },
    });
  }

  for (const child of children) {
    edges.push({
      neighborId: child.asset_id,
      relationship: {
        id: buildRelationshipId(child.asset_id, nodeId, 'derived_from'),
        from_id: child.asset_id,
        to_id: nodeId,
        type: 'derived_from',
        properties: { generation: child.generation },
        created_at: child.created_at.toISOString(),
      },
    });
  }

  for (const relationship of explicitOutgoing as unknown as PersistedKgRelationship[]) {
    edges.push({
      neighborId: relationship.to_id,
      relationship: toKgRelationship(relationship),
    });
  }

  for (const relationship of explicitIncoming as unknown as PersistedKgRelationship[]) {
    edges.push({
      neighborId: relationship.from_id,
      relationship: toKgRelationship(relationship),
    });
  }

  return edges;
}

async function getDirectNeighborhoodEdges(
  asset: AssetGraphNode,
  relationshipType?: string,
): Promise<Array<{ asset: AssetGraphNode; relationship: string }>> {
  const edges: Array<{ asset: AssetGraphNode; relationship: string }> = [];
  const wantsDerived =
    relationshipType === undefined
    || relationshipType === 'derived_from'
    || relationshipType === 'evolved_from';
  const wantsSignals =
    relationshipType === undefined
    || relationshipType === 'shares_signals';

  if (wantsDerived) {
    if (asset.parent_id) {
      const parent = await prisma.asset.findUnique({
        where: { asset_id: asset.parent_id },
      });
      if (parent && parent.status === 'published') {
        edges.push({
          asset: parent as unknown as AssetGraphNode,
          relationship: 'derived_from',
        });
      }
    }

    const children = await prisma.asset.findMany({
      where: {
        parent_id: asset.asset_id,
        status: 'published',
      },
      take: 20,
    });

    for (const child of children) {
      edges.push({
        asset: child as unknown as AssetGraphNode,
        relationship: 'derived_from',
      });
    }
  }

  if (wantsSignals && asset.signals.length > 0) {
    const signalNeighbors = await prisma.asset.findMany({
      where: {
        status: 'published',
        asset_id: { not: asset.asset_id },
        signals: { hasSome: asset.signals },
      },
      take: 20,
    });

    for (const neighbor of signalNeighbors) {
      edges.push({
        asset: neighbor as unknown as AssetGraphNode,
        relationship: 'shares_signals',
      });
    }
  }

  const explicitRelationships = await prisma.knowledgeGraphRelationship.findMany({
    where: {
      ...(relationshipType ? { relationship_type: relationshipType } : {}),
      OR: [
        { from_id: asset.asset_id },
        { to_id: asset.asset_id },
      ],
    },
    orderBy: { created_at: 'desc' },
    take: 20,
  });

  if (explicitRelationships.length > 0) {
    const neighborIds = Array.from(new Set(
      (explicitRelationships as unknown as PersistedKgRelationship[])
        .map((relationship) =>
          relationship.from_id === asset.asset_id ? relationship.to_id : relationship.from_id)
        .filter((neighborId) => neighborId !== asset.asset_id),
    ));

    const neighbors = await prisma.asset.findMany({
      where: {
        asset_id: { in: neighborIds },
        status: 'published',
      },
      take: neighborIds.length || 1,
    });
    const neighborsById = new Map(
      neighbors.map((neighbor) => [neighbor.asset_id, neighbor as unknown as AssetGraphNode]),
    );

    for (const relationship of explicitRelationships as unknown as PersistedKgRelationship[]) {
      const neighborId = relationship.from_id === asset.asset_id
        ? relationship.to_id
        : relationship.from_id;
      const neighbor = neighborsById.get(neighborId);
      if (!neighbor) {
        continue;
      }

      edges.push({
        asset: neighbor,
        relationship: relationship.relationship_type,
      });
    }
  }

  return edges;
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
  const relationshipMap = new Map<string, KgRelationship>();

  for (const asset of assets) {
    if (asset.parent_id && nodeIds.has(asset.parent_id)) {
      const relationship = {
        id: `rel-${asset.asset_id}-${asset.parent_id}`,
        from_id: asset.asset_id,
        to_id: asset.parent_id,
        type: 'derived_from',
        properties: { generation: asset.generation },
        created_at: asset.created_at.toISOString(),
      };
      relationshipMap.set(
        relationshipSignature(relationship.from_id, relationship.to_id, relationship.type),
        relationship,
      );
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
          const relationship = {
            id: `rel-sig-${asset.asset_id}-${rel.asset_id}`,
            from_id: asset.asset_id,
            to_id: rel.asset_id,
            type: 'shares_signals',
            properties: { shared_signals: shared },
            created_at: new Date().toISOString(),
          };
          relationshipMap.set(
            relationshipSignature(relationship.from_id, relationship.to_id, relationship.type),
            relationship,
          );
        }
      }
    }
  }

  const explicitRelationships = await getExplicitRelationshipsBetweenNodes([...nodeIds]);
  for (const relationship of explicitRelationships) {
    const mapped = toKgRelationship(relationship);
    relationshipMap.set(
      relationshipSignature(mapped.from_id, mapped.to_id, mapped.type),
      mapped,
    );
  }

  return { nodes, relationships: [...relationshipMap.values()] };
}

export async function createNode(
  type: string,
  properties: Record<string, unknown>,
  authorId: string,
): Promise<KgNode> {
  const normalizedType = normalizeKgType(type);
  if (!authorId) {
    throw new ValidationError('authorId is required');
  }

  const inputTags = Array.isArray(properties.tags)
    ? (properties.tags as string[])
    : [];

  const requestedNodeId = typeof properties.id === 'string' && properties.id.trim()
    ? properties.id.trim()
    : crypto.randomUUID();

  const asset = await prisma.asset.upsert({
    where: { asset_id: requestedNodeId },
    update: {
      asset_type: normalizedType,
      name: (properties.name as string) ?? 'Untitled',
      description: (properties.description as string) ?? '',
      signals: (properties.signals as string[]) ?? [],
      tags: Array.from(new Set([...inputTags, KG_ENTITY_TAG])),
      status: 'published',
    },
    create: {
      asset_id: requestedNodeId,
      asset_type: normalizedType,
      name: (properties.name as string) ?? 'Untitled',
      description: (properties.description as string) ?? '',
      signals: (properties.signals as string[]) ?? [],
      tags: Array.from(new Set([...inputTags, KG_ENTITY_TAG])),
      author_id: authorId,
      status: 'published',
      gdi_score: 0,
    },
  });

  return toKgNode(asset as unknown as AssetGraphNode);
}

export async function getNode(
  type: string,
  nodeId: string,
): Promise<KgNodeDetail> {
  const normalizedType = normalizeKgType(type);
  const assetRecord = await prisma.asset.findUnique({ where: { asset_id: nodeId } });
  const asset = assertReadableNode(
    assetRecord as unknown as AssetGraphNode | null,
    normalizedType,
    nodeId,
  );

  const [children, explicitOutgoing, explicitIncoming] = await Promise.all([
    prisma.asset.findMany({
      where: {
        parent_id: nodeId,
        status: 'published',
      },
      select: { asset_id: true },
      take: 20,
    }),
    prisma.knowledgeGraphRelationship.findMany({
      where: { from_id: nodeId },
      select: { relationship_id: true, to_id: true, relationship_type: true, from_id: true, properties: true, created_at: true },
      orderBy: { created_at: 'desc' },
      take: 20,
    }),
    prisma.knowledgeGraphRelationship.findMany({
      where: { to_id: nodeId },
      select: { relationship_id: true, from_id: true, relationship_type: true, to_id: true, properties: true, created_at: true },
      orderBy: { created_at: 'desc' },
      take: 20,
    }),
  ]);

  const outgoing = asset.parent_id
    ? [{ type: 'derived_from', target: asset.parent_id }]
    : [];
  for (const relationship of explicitOutgoing as unknown as PersistedKgRelationship[]) {
    outgoing.push({
      type: relationship.relationship_type,
      target: relationship.to_id,
    });
  }

  const incoming = children.map((child) => ({
    type: 'derived_from',
    source: child.asset_id,
  }));
  for (const relationship of explicitIncoming as unknown as PersistedKgRelationship[]) {
    incoming.push({
      type: relationship.relationship_type,
      source: relationship.from_id,
    });
  }

  return {
    type: asset.asset_type,
    id: asset.asset_id,
    name: asset.name,
    properties: {
      gdi_score: asset.gdi_score,
      author: asset.author_id,
      author_id: asset.author_id,
      signals: asset.signals,
      description: asset.description,
      tags: asset.tags,
    },
    relationships: {
      outgoing,
      incoming,
    },
  };
}

export async function getNeighborhood(
  type: string,
  nodeId: string,
  depth = 1,
  relationshipType?: string,
): Promise<KgNeighborhoodResult> {
  const normalizedType = normalizeKgType(type);
  if (!Number.isInteger(depth) || depth < 1) {
    throw new ValidationError('depth must be an integer greater than 0');
  }

  const rootRecord = await prisma.asset.findUnique({ where: { asset_id: nodeId } });
  const root = assertReadableNode(
    rootRecord as unknown as AssetGraphNode | null,
    normalizedType,
    nodeId,
  );

  const visited = new Set<string>([root.asset_id]);
  const queue: Array<{ asset: AssetGraphNode; distance: number }> = [
    { asset: root, distance: 0 },
  ];
  const neighbors: KgNeighborhoodResult['neighbors'] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.distance >= depth) {
      continue;
    }

    const edges = await getDirectNeighborhoodEdges(current.asset, relationshipType);
    for (const edge of edges) {
      if (visited.has(edge.asset.asset_id)) {
        continue;
      }

      visited.add(edge.asset.asset_id);
      const nextDistance = current.distance + 1;
      neighbors.push({
        type: edge.asset.asset_type,
        id: edge.asset.asset_id,
        distance: nextDistance,
        relationship: edge.relationship,
      });

      if (nextDistance < depth) {
        queue.push({ asset: edge.asset, distance: nextDistance });
      }
    }
  }

  return {
    center: {
      type: root.asset_type,
      id: root.asset_id,
    },
    neighbors,
  };
}

export async function getGraphStats(): Promise<KgStats> {
  const [assets, explicitRelationships] = await Promise.all([
    prisma.asset.findMany({
      select: {
        asset_id: true,
        asset_type: true,
        parent_id: true,
        signals: true,
        status: true,
      },
    }),
    prisma.knowledgeGraphRelationship.findMany({
      select: {
        relationship_id: true,
        from_id: true,
        to_id: true,
        relationship_type: true,
        properties: true,
        created_at: true,
      },
    }),
  ]);

  const nodeTypes: Record<string, number> = {};
  let derivedFromCount = 0;

  for (const asset of assets) {
    nodeTypes[asset.asset_type] = (nodeTypes[asset.asset_type] ?? 0) + 1;
    if (asset.parent_id) {
      derivedFromCount += 1;
    }
  }

  const sharedSignalsCount = countSharedSignalRelationships(
    assets as Array<Pick<AssetGraphNode, 'asset_id' | 'signals' | 'status'>>,
  );
  const relationshipTypes: Record<string, number> = {};
  if (derivedFromCount > 0) {
    relationshipTypes.derived_from = derivedFromCount;
  }
  if (sharedSignalsCount > 0) {
    relationshipTypes.shares_signals = sharedSignalsCount;
  }
  for (const relationship of explicitRelationships as unknown as PersistedKgRelationship[]) {
    relationshipTypes[relationship.relationship_type] = (relationshipTypes[relationship.relationship_type] ?? 0) + 1;
  }

  return {
    total_nodes: assets.length,
    total_relationships: derivedFromCount + sharedSignalsCount + explicitRelationships.length,
    node_types: nodeTypes,
    relationship_types: relationshipTypes,
  };
}

export async function listNodesByType(
  type: string,
  limit = 50,
  offset = 0,
): Promise<KgTypeQueryResult> {
  const normalizedType = normalizeKgType(type);

  const [nodes, total] = await Promise.all([
    prisma.asset.findMany({
      where: {
        asset_type: normalizedType,
        status: 'published',
      },
      select: {
        asset_id: true,
        name: true,
        gdi_score: true,
      },
      orderBy: [
        { gdi_score: 'desc' },
        { created_at: 'desc' },
      ],
      take: limit,
      skip: offset,
    }),
    prisma.asset.count({
      where: {
        asset_type: normalizedType,
        status: 'published',
      },
    }),
  ]);

  return {
    type: normalizedType,
    nodes: nodes.map((node) => ({
      id: node.asset_id,
      name: node.name,
      gdi_score: node.gdi_score,
    })),
    total,
  };
}

export async function createRelationship(
  fromId: string,
  toId: string,
  type: string,
  properties?: Record<string, unknown>,
): Promise<KgRelationship> {
  const normalizedType = normalizeRelationshipType(type);
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

  const relationshipId = buildRelationshipId(fromId, toId, normalizedType);
  const relationship = await prisma.knowledgeGraphRelationship.upsert({
    where: { relationship_id: relationshipId },
    update: {
      properties: (properties ?? {}) as Prisma.InputJsonValue,
    },
    create: {
      relationship_id: relationshipId,
      from_id: fromId,
      to_id: toId,
      relationship_type: normalizedType,
      properties: (properties ?? {}) as Prisma.InputJsonValue,
    },
  });

  return toKgRelationship(relationship as unknown as PersistedKgRelationship);
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
    const [children, explicitOutgoing] = await Promise.all([
      prisma.asset.findMany({
        where: {
          parent_id: nodeId,
          ...(type ? { asset_type: type } : {}),
        },
        take: 20,
      }),
      prisma.knowledgeGraphRelationship.findMany({
        where: { from_id: nodeId },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
    ]);

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

    if (explicitOutgoing.length > 0) {
      const explicitTargets = Array.from(new Set(
        (explicitOutgoing as unknown as PersistedKgRelationship[])
          .map((relationship) => relationship.to_id),
      ));
      const targetAssets = await prisma.asset.findMany({
        where: {
          asset_id: { in: explicitTargets },
          status: 'published',
          ...(type ? { asset_type: type } : {}),
        },
        take: explicitTargets.length || 1,
      });
      const targetsById = new Map(
        targetAssets.map((targetAsset) => [targetAsset.asset_id, targetAsset as unknown as AssetGraphNode]),
      );

      for (const relationship of explicitOutgoing as unknown as PersistedKgRelationship[]) {
        const target = targetsById.get(relationship.to_id);
        if (!target) {
          continue;
        }

        results.push({
          node: toKgNode(target),
          relationship: toKgRelationship(relationship),
          direction: 'outgoing',
        });
      }
    }
  }

  if (direction === 'incoming' || direction === 'both') {
    const [explicitIncoming, signalNeighbors, parent] = await Promise.all([
      prisma.knowledgeGraphRelationship.findMany({
        where: { to_id: nodeId },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
      prisma.asset.findMany({
        where: {
          asset_id: { not: nodeId },
          status: 'published',
          signals: { hasSome: asset.signals },
          ...(type ? { asset_type: type } : {}),
        },
        take: 10,
      }),
      asset.parent_id
        ? prisma.asset.findUnique({
          where: { asset_id: asset.parent_id },
        })
        : Promise.resolve(null),
    ]);

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

    if (explicitIncoming.length > 0) {
      const explicitSources = Array.from(new Set(
        (explicitIncoming as unknown as PersistedKgRelationship[])
          .map((relationship) => relationship.from_id),
      ));
      const sourceAssets = await prisma.asset.findMany({
        where: {
          asset_id: { in: explicitSources },
          status: 'published',
          ...(type ? { asset_type: type } : {}),
        },
        take: explicitSources.length || 1,
      });
      const sourcesById = new Map(
        sourceAssets.map((sourceAsset) => [sourceAsset.asset_id, sourceAsset as unknown as AssetGraphNode]),
      );

      for (const relationship of explicitIncoming as unknown as PersistedKgRelationship[]) {
        const source = sourcesById.get(relationship.from_id);
        if (!source) {
          continue;
        }

        results.push({
          node: toKgNode(source),
          relationship: toKgRelationship(relationship),
          direction: 'incoming',
        });
      }
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
    const neighbors = await getTraversalEdges(current.id);

    for (const neighbor of neighbors) {
      const neighborId = neighbor.neighborId;
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

  await prisma.knowledgeGraphRelationship.deleteMany({
    where: {
      OR: [
        { from_id: nodeId },
        { to_id: nodeId },
      ],
    },
  });
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
  const queue: Array<{ id: string; path: string[]; relationships: KgRelationship[] }> = [{
    id: fromId,
    path: [fromId],
    relationships: [],
  }];
  visited.add(fromId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.path.length > maxHops) continue;

    const neighbors = await getTraversalEdges(current.id);

    for (const neighbor of neighbors) {
      const neighborId = neighbor.neighborId;
      if (neighborId === toId) {
        const finalPath = [...current.path, neighborId];
        const nodes: KgNode[] = [];
        const relationships = [...current.relationships, neighbor.relationship];

        for (let i = 0; i < finalPath.length; i++) {
          const asset = await prisma.asset.findUnique({ where: { asset_id: finalPath[i] } });
          if (asset) {
            nodes.push(toKgNode(asset as unknown as AssetGraphNode));
          }
        }
        return { nodes, relationships };
      }

      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({
          id: neighborId,
          path: [...current.path, neighborId],
          relationships: [...current.relationships, neighbor.relationship],
        });
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

    const traversalEdges = await getTraversalEdges(current.id);
    for (const edge of traversalEdges) {
      if (!visited.has(edge.neighborId)) {
        visited.add(edge.neighborId);
        queue.push({ id: edge.neighborId, depth: current.depth + 1 });
      }
      if (relationships.length < limit) {
        relationships.push(edge.relationship);
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
