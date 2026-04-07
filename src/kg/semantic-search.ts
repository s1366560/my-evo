import type { KgNode, KgRelationship, KgQueryResult } from './types';
import * as neo4jClient from './neo4j';
import * as postgresService from './service';

export interface SimilarAsset {
  node: KgNode;
  similarity: number;
  sharedSignals: string[];
  relationshipType: string;
}

/**
 * Find assets similar to a given asset based on graph structure.
 * Falls back to PostgreSQL signal-sharing when Neo4j is unavailable.
 */
export async function findSimilarAssets(
  assetId: string,
  limit = 10,
): Promise<SimilarAsset[]> {
  const connected = await neo4jClient.isConnected().catch(() => false);
  if (connected) {
    return findSimilarAssetsNeo4j(assetId, limit);
  }
  return postgresService.findSimilarAssetsPostgres(assetId, limit);
}

async function findSimilarAssetsNeo4j(
  assetId: string,
  limit: number,
): Promise<SimilarAsset[]> {
  const cypher = `
    MATCH (target {id: $assetId})
    MATCH (target)-[r]-(neighbor)
    WHERE neighbor.id <> $assetId
    RETURN neighbor, r,
           CASE
             WHEN target.signals IS NOT NULL AND neighbor.signals IS NOT NULL
             THEN [s IN target.signals WHERE s IN neighbor.signals]
             ELSE []
           END AS sharedSignals,
           type(r) AS relType
    ORDER BY size(sharedSignals) DESC
    LIMIT $limit
  `;

  const session = neo4jClient.getSession();
  try {
    const result = await session.run(cypher, { assetId, limit });
    return result.records.map((record: any) => {
      const n = record.get('neighbor') as { properties: Record<string, unknown>; labels: string[] };
      const shared = record.get('sharedSignals') as unknown[];
      return {
        node: {
          id: String(n.properties?.['id'] ?? ''),
          type: n.labels?.[0] ?? 'unknown',
          properties: Object.fromEntries(
            Object.entries(n.properties ?? {}).filter(([, v]) => v !== null),
          ),
          created_at: String(n.properties?.['created_at'] ?? ''),
        },
        similarity: shared.length > 0 ? shared.length / 10 : 0,
        sharedSignals: shared as string[],
        relationshipType: String(record.get('relType') ?? ''),
      };
    });
  } finally {
    await session.close();
  }
}

/**
 * Find capabilities (genes/capsules) related to a given node.
 * Returns nodes connected via any relationship type, with path context.
 */
export async function findRelatedCapabilities(
  nodeId: string,
  maxDepth = 2,
  limit = 20,
): Promise<KgQueryResult> {
  const connected = await neo4jClient.isConnected().catch(() => false);
  if (connected) {
    return findRelatedCapabilitiesNeo4j(nodeId, maxDepth, limit);
  }
  return postgresService.findRelatedCapabilitiesPostgres(nodeId, maxDepth, limit);
}

async function findRelatedCapabilitiesNeo4j(
  nodeId: string,
  maxDepth: number,
  limit: number,
): Promise<KgQueryResult> {
  const cypher = `
    MATCH path = (start {id: $nodeId})-[*1..${maxDepth}]-(end)
    WHERE end.id <> $nodeId
    WITH path, NODES(path) AS ns, RELATIONSHIPS(path) AS rels
    UNWIND ns AS n
    UNWIND rels AS r
    WITH DISTINCT n, r
    RETURN COLLECT(DISTINCT n) AS nodes, COLLECT(DISTINCT r) AS rels
    LIMIT 1
  `;

  const session = neo4jClient.getSession();
  try {
    const result = await session.run(cypher, { nodeId, limit });
    const record = result.records[0];

    if (!record) {
      return { nodes: [], relationships: [] };
    }

    const rawNodes = record.get('nodes') as Array<{ properties: Record<string, unknown>; labels: string[] }>;
    const rawRels = record.get('rels') as Array<{
      properties: Record<string, unknown>;
      type: string;
      start: { properties: Record<string, unknown> };
      end: { properties: Record<string, unknown> };
    }>;

    const nodes: KgNode[] = rawNodes.map((n) => ({
      id: String(n.properties?.['id'] ?? ''),
      type: n.labels?.[0] ?? 'unknown',
      properties: Object.fromEntries(
        Object.entries(n.properties ?? {}).filter(([, v]) => v !== null),
      ),
      created_at: String(n.properties?.['created_at'] ?? ''),
    }));

    const relationships: KgRelationship[] = rawRels.map((r) => ({
      id: String(r.properties?.['id'] ?? ''),
      from_id: String(r.start?.properties?.['id'] ?? ''),
      to_id: String(r.end?.properties?.['id'] ?? ''),
      type: r.type,
      properties: Object.fromEntries(
        Object.entries(r.properties ?? {}).filter(([, v]) => v !== null),
      ),
      created_at: String(r.properties?.['created_at'] ?? ''),
    }));

    return { nodes, relationships };
  } finally {
    await session.close();
  }
}
