/**
 * Knowledge Graph Types
 */

// Entity types
export type EntityType = 'gene' | 'capsule' | 'node' | 'topic';

// Relationship types
export type RelationshipType = 
  | 'uses'
  | 'evolved_from'
  | 'similar_to'
  | 'references'
  | 'triggers'
  | 'validates'
  | 'solves'
  | 'extends'
  | 'conflicts_with'
  | 'part_of';

// Graph entity
export interface KGEntity {
  id: string;
  type: EntityType;
  name: string;
  description?: string;
  properties: Record<string, any>;
  embedding?: number[]; // For semantic search
  metadata: {
    created_at: number;
    updated_at: number;
    version: number;
  };
}

// Relationship between entities
export interface KGRelationship {
  id: string;
  source_id: string;
  source_type: EntityType;
  target_id: string;
  target_type: EntityType;
  type: RelationshipType;
  weight: number; // 0-1, confidence in relationship
  properties?: Record<string, any>;
  metadata: {
    created_at: number;
    verified: boolean;
  };
}

// Graph query
export interface KGQuery {
  query?: string;           // Semantic query
  filters?: {
    types?: EntityType[];
    ids?: string[];
    relation_types?: RelationshipType[];
  };
  neighbors?: {
    enabled: boolean;
    max_depth?: number;
    relationship_types?: RelationshipType[];
  };
  limit?: number;
  offset?: number;
}

// Query result
export interface KGQueryResult {
  entities: KGEntity[];
  relationships: KGRelationship[];
  total: number;
  query_time_ms: number;
}

// Node neighbors response
export interface KGNeighborsResult {
  node: KGEntity;
  neighbors: {
    entity: KGEntity;
    relationship: KGRelationship;
    depth: number;
  }[];
  total: number;
}

// Statistics
export interface KGStats {
  total_entities: number;
  total_relationships: number;
  by_type: Record<EntityType, number>;
  by_relationship: Record<RelationshipType, number>;
}
