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
