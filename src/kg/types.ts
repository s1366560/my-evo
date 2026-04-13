export interface KgNode {
  id: string;
  type: string;
  properties: Record<string, unknown>;
  created_at: string;
}

export interface KgRelationship {
  id: string;
  from_id: string;
  to_id: string;
  type: string;
  properties: Record<string, unknown>;
  created_at: string;
}

export interface KgQueryResult {
  nodes: KgNode[];
  relationships: KgRelationship[];
}

export interface KgNodeDetail {
  type: string;
  id: string;
  name: string;
  properties: Record<string, unknown>;
  relationships: {
    outgoing: Array<{ type: string; target: string }>;
    incoming: Array<{ type: string; source: string }>;
  };
}

export interface KgNeighborhoodResult {
  center: { type: string; id: string };
  neighbors: Array<{
    type: string;
    id: string;
    distance: number;
    relationship: string;
  }>;
}

export interface KgStats {
  total_nodes: number;
  total_relationships: number;
  node_types: Record<string, number>;
  relationship_types: Record<string, number>;
}

export interface KgTypeQueryResult {
  type: string;
  nodes: Array<{
    id: string;
    name: string;
    gdi_score: number;
  }>;
  total: number;
}

export interface ShortestPathResult {
  found: boolean;
  path: string[];
  length: number;
}

export interface NeighborResult {
  node: KgNode;
  relationship: KgRelationship;
  direction: 'incoming' | 'outgoing';
}
