/* eslint-disable @typescript-eslint/no-explicit-any */
import neo4j, { Driver, Session, SessionConfig } from 'neo4j-driver';
import { getConfig } from '../shared/config';
import type { KgNode, KgRelationship, KgQueryResult } from './types';

// Module-level driver singleton — initialized lazily on first use
let _driver: Driver | null = null;

function getDriver(): Driver {
  if (!_driver) {
    const config = getConfig();
    _driver = neo4j.driver(
      config.neo4jUri,
      neo4j.auth.basic(config.neo4jUser, config.neo4jPassword),
      {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 10_000,
      },
    );
  }
  return _driver;
}

export function getSession(config?: SessionConfig): Session {
  return getDriver().session(config);
}

export async function closeDriver(): Promise<void> {
  if (_driver) {
    await _driver.close();
    _driver = null;
  }
}

export function isConnected(): Promise<boolean> {
  return getDriver()
    .verifyConnectivity()
    .then(() => true)
    .catch(() => false);
}

// ----- Record helpers -----

function nodeToKgNode(n: any, nodeType: string): KgNode {
  return {
    id: String(n.properties?.['id'] ?? ''),
    type: nodeType,
    properties: Object.fromEntries(
      Object.entries(n.properties ?? {}).filter(([, v]) => v !== null),
    ),
    created_at: String(n.properties?.['created_at'] ?? ''),
  };
}

function relToKgRelationship(
  r: any,
  fromId: string,
  toId: string,
  relType: string,
): KgRelationship {
  return {
    id: String(r.properties?.['id'] ?? ''),
    from_id: fromId,
    to_id: toId,
    type: relType,
    properties: Object.fromEntries(
      Object.entries(r.properties ?? {}).filter(([, v]) => v !== null),
    ),
    created_at: String(r.properties?.['created_at'] ?? ''),
  };
}

// ----- Node operations -----

export async function createNode(
  nodeType: string,
  properties: Record<string, unknown>,
): Promise<KgNode> {
  const id = (properties.id as string) ?? crypto.randomUUID();
  const props = {
    ...properties,
    id,
    created_at: new Date().toISOString(),
  };

  const cypher = `
    CREATE (n:\`${nodeType}\` $props)
    RETURN n
  `;

  const session = getSession();
  try {
    const result = await session.run(cypher, { props });
    const record = result.records[0];
    if (!record) throw new Error('Neo4j returned no record after CREATE');
    const n = record.get('n') as any;
    return nodeToKgNode(n, nodeType);
  } finally {
    await session.close();
  }
}

export async function createRelationship(
  fromId: string,
  toId: string,
  relType: string,
  properties: Record<string, unknown> = {},
): Promise<KgRelationship> {
  const id =
    (properties.id as string) ?? `rel-${fromId}-${toId}-${Date.now()}`;
  const props = { ...properties, id, created_at: new Date().toISOString() };

  const cypher = `
    MATCH (a), (b)
    WHERE a.id = $fromId AND b.id = $toId
    CREATE (a)-[r:\`${relType}\` $props]->(b)
    RETURN r
  `;

  const session = getSession();
  try {
    const result = await session.run(cypher, { fromId, toId, props });
    const record = result.records[0];
    if (!record)
      throw new Error(
        'Neo4j returned no record; check that both nodes exist',
      );
    const r = record.get('r') as any;
    return relToKgRelationship(r, fromId, toId, relType);
  } finally {
    await session.close();
  }
}

export async function queryPath(
  fromId: string,
  toId: string,
  maxHops = 3,
): Promise<KgQueryResult> {
  const cypher = `
    MATCH path = shortestPath((a)-[*1..${maxHops}]-(b))
    WHERE a.id = $fromId AND b.id = $toId
    UNWIND NODES(path) AS n
    WITH path, COLLECT(DISTINCT n) AS ns
    UNWIND RELATIONSHIPS(path) AS rels
    RETURN ns, COLLECT(DISTINCT rels) AS rels
  `;

  const session = getSession();
  try {
    const result = await session.run(cypher, { fromId, toId });
    const record = result.records[0];

    if (!record) {
      return { nodes: [], relationships: [] };
    }

    const rawNodes = record.get('ns') as any[];
    const rawRels = record.get('rels') as any[];

    const nodes: KgNode[] = rawNodes.map((n) =>
      nodeToKgNode(n, (n.labels?.[0] as string) ?? 'unknown'),
    );

    const relationships: KgRelationship[] = rawRels.map((r: any) => {
      const startNode = r.start as any;
      const endNode = r.end as any;
      return relToKgRelationship(
        r,
        String(startNode?.properties?.['id'] ?? ''),
        String(endNode?.properties?.['id'] ?? ''),
        r.type as string,
      );
    });

    return { nodes, relationships };
  } finally {
    await session.close();
  }
}
