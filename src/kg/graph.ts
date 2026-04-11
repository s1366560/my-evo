import type { KgNode, KgRelationship, KgQueryResult, ShortestPathResult } from './types';
import * as neo4jClient from './neo4j';
import * as postgresService from './service';

export async function createNode(
  nodeType: string,
  properties: Record<string, unknown>,
  authorId: string,
): Promise<KgNode> {
  const connected = await neo4jClient.isConnected().catch(() => false);
  if (connected) {
    return neo4jClient.createNode(nodeType, {
      ...properties,
      author_id: authorId,
    });
  }
  return postgresService.createNode(nodeType, properties, authorId);
}

export async function createRelationship(
  fromId: string,
  toId: string,
  relType: string,
  properties?: Record<string, unknown>,
): Promise<KgRelationship> {
  const connected = await neo4jClient.isConnected().catch(() => false);
  if (connected) {
    return neo4jClient.createRelationship(fromId, toId, relType, properties ?? {});
  }
  return postgresService.createRelationship(fromId, toId, relType, properties);
}

export async function queryPath(
  fromId: string,
  toId: string,
  maxHops = 3,
): Promise<KgQueryResult> {
  const connected = await neo4jClient.isConnected().catch(() => false);
  if (connected) {
    return neo4jClient.queryPath(fromId, toId, maxHops);
  }
  // PostgreSQL fallback: run BFS shortest path
  return postgresService.getShortestPathPostgres(fromId, toId, maxHops);
}

export async function shortestPath(
  fromId: string,
  toId: string,
): Promise<ShortestPathResult> {
  const connected = await neo4jClient.isConnected().catch(() => false);
  if (connected) {
    // Use Dijkstra via Neo4j shortestPath
    const result = await queryPath(fromId, toId, 10);
    if (result.nodes.length === 0) {
      return { found: false, path: [], length: 0 };
    }
    const path = result.nodes.map((n) => n.id);
    return { found: true, path, length: path.length - 1 };
  }
  return postgresService.getShortestPath(fromId, toId);
}

export async function closeConnections(): Promise<void> {
  await neo4jClient.closeDriver();
}
