/**
 * Knowledge Graph Service
 */

import { randomUUID } from 'crypto';
import {
  KGEntity,
  KGRelationship,
  KGQuery,
  KGQueryResult,
  KGNeighborsResult,
  KGStats,
  EntityType,
  RelationshipType,
} from './types';

// In-memory graph store
const entities: Map<string, KGEntity> = new Map();
const relationships: Map<string, KGRelationship> = new Map();
const entityIndex: Map<EntityType, Set<string>> = new Map();

// ============ Entity Operations ============

export function addEntity(entity: Partial<KGEntity> & { type: EntityType; name: string }): KGEntity {
  const now = Date.now();
  const newEntity: KGEntity = {
    ...entity,
    id: `kg_${randomUUID().slice(0, 8)}`,
    metadata: {
      created_at: now,
      updated_at: now,
      version: 1,
    },
  };
  
  entities.set(newEntity.id, newEntity);
  
  // Update index
  if (!entityIndex.has(newEntity.type)) {
    entityIndex.set(newEntity.type, new Set());
  }
  entityIndex.get(newEntity.type)!.add(newEntity.id);
  
  return newEntity;
}

export function getEntity(id: string): KGEntity | undefined {
  return entities.get(id);
}

export function getEntitiesByType(type: EntityType): KGEntity[] {
  const ids = entityIndex.get(type);
  if (!ids) return [];
  return Array.from(ids).map(id => entities.get(id)!).filter(Boolean);
}

export function updateEntity(id: string, updates: Partial<KGEntity>): KGEntity | undefined {
  const entity = entities.get(id);
  if (!entity) return undefined;
  
  const updated: KGEntity = {
    ...entity,
    ...updates,
    id: entity.id, // Can't change ID
    metadata: {
      ...entity.metadata,
      updated_at: Date.now(),
      version: entity.metadata.version + 1,
    },
  };
  
  entities.set(id, updated);
  return updated;
}

export function deleteEntity(id: string): boolean {
  const entity = entities.get(id);
  if (!entity) return false;
  
  // Remove from index
  const typeIndex = entityIndex.get(entity.type);
  if (typeIndex) {
    typeIndex.delete(id);
  }
  
  // Remove associated relationships
  for (const [relId, rel] of relationships.entries()) {
    if (rel.source_id === id || rel.target_id === id) {
      relationships.delete(relId);
    }
  }
  
  return entities.delete(id);
}

// ============ Relationship Operations ============

export function addRelationship(
  relationship: Omit<KGRelationship, 'id' | 'metadata'>
): KGRelationship {
  const newRel: KGRelationship = {
    ...relationship,
    id: `rel_${randomUUID().slice(0, 8)}`,
    metadata: {
      created_at: Date.now(),
      verified: false,
    },
  };
  
  relationships.set(newRel.id, newRel);
  
  // Auto-create bidirectional for certain relationship types
  const symmetricTypes: RelationshipType[] = ['similar_to', 'evolved_from'];
  if (symmetricTypes.includes(relationship.type)) {
    const reverseRel: KGRelationship = {
      ...newRel,
      id: `rel_${randomUUID().slice(0, 8)}`,
      source_id: relationship.target_id,
      source_type: relationship.target_type,
      target_id: relationship.source_id,
      target_type: relationship.source_type,
      metadata: {
        created_at: Date.now(),
        verified: false,
      },
    };
    relationships.set(reverseRel.id, reverseRel);
  }
  
  return newRel;
}

export function getRelationship(id: string): KGRelationship | undefined {
  return relationships.get(id);
}

export function getRelationshipsByEntity(entityId: string): KGRelationship[] {
  return Array.from(relationships.values()).filter(
    rel => rel.source_id === entityId || rel.target_id === entityId
  );
}

export function getNeighbors(
  entityId: string,
  options?: {
    relationship_types?: RelationshipType[];
    max_depth?: number;
  }
): KGRelationship[] {
  const result: KGRelationship[] = [];
  const visited = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: entityId, depth: 0 }];
  
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    
    if (visited.has(id)) continue;
    visited.add(id);
    
    const maxDepth = options?.max_depth || 1;
    if (depth > maxDepth) continue;
    
    const rels = getRelationshipsByEntity(id);
    for (const rel of rels) {
      if (options?.relationship_types && !options.relationship_types.includes(rel.type)) {
        continue;
      }
      
      if (rel.source_id === id) {
        result.push(rel);
        queue.push({ id: rel.target_id, depth: depth + 1 });
      } else if (rel.target_id === id) {
        result.push(rel);
        queue.push({ id: rel.source_id, depth: depth + 1 });
      }
    }
  }
  
  return result;
}

// ============ Query Operations ============

export function query(q: KGQuery): KGQueryResult {
  const startTime = Date.now();
  const results: KGEntity[] = [];
  
  // Filter by types
  let candidateIds: Set<string>;
  if (q.filters?.types && q.filters.types.length > 0) {
    candidateIds = new Set();
    for (const type of q.filters.types) {
      const ids = entityIndex.get(type);
      if (ids) {
        for (const id of ids) candidateIds.add(id);
      }
    }
  } else {
    candidateIds = new Set(entities.keys());
  }
  
  // Filter by IDs
  if (q.filters?.ids && q.filters.ids.length > 0) {
    candidateIds = new Set(
      Array.from(candidateIds).filter(id => q.filters!.ids!.includes(id))
    );
  }
  
  // Filter by relationship
  if (q.filters?.relation_types && q.filters.relation_types.length > 0) {
    const relEntityIds = new Set<string>();
    for (const rel of relationships.values()) {
      if (q.filters.relation_types!.includes(rel.type)) {
        relEntityIds.add(rel.source_id);
        relEntityIds.add(rel.target_id);
      }
    }
    candidateIds = new Set(
      Array.from(candidateIds).filter(id => relEntityIds.has(id))
    );
  }
  
  // Convert to entities
  for (const id of candidateIds) {
    const entity = entities.get(id);
    if (entity) results.push(entity);
  }
  
  // Get relationships
  const resultRels: KGRelationship[] = [];
  for (const entity of results) {
    resultRels.push(...getRelationshipsByEntity(entity.id));
  }
  
  const total = results.length;
  const limit = q.limit || 50;
  const offset = q.offset || 0;
  
  return {
    entities: results.slice(offset, offset + limit),
    relationships: resultRels.slice(0, limit * 2),
    total,
    query_time_ms: Date.now() - startTime,
  };
}

export function getNeighborsResult(entityId: string, maxDepth: number = 1): KGNeighborsResult | undefined {
  const entity = entities.get(entityId);
  if (!entity) return undefined;
  
  const neighborsMap = new Map<string, { entity: KGEntity; relationship: KGRelationship; depth: number }>();
  const queue: { id: string; depth: number }[] = [{ id: entityId, depth: 0 }];
  const visited = new Set<string>([entityId]);
  
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    
    const rels = getRelationshipsByEntity(id);
    for (const rel of rels) {
      const neighborId = rel.source_id === id ? rel.target_id : rel.source_id;
      
      if (!visited.has(neighborId) && depth < maxDepth) {
        visited.add(neighborId);
        const neighbor = entities.get(neighborId);
        if (neighbor && !neighborsMap.has(neighborId)) {
          neighborsMap.set(neighborId, { entity: neighbor, relationship: rel, depth: depth + 1 });
        }
        queue.push({ id: neighborId, depth: depth + 1 });
      }
    }
  }
  
  return {
    node: entity,
    neighbors: Array.from(neighborsMap.values()),
    total: neighborsMap.size,
  };
}

// ============ Statistics ============

export function getStats(): KGStats {
  const stats: KGStats = {
    total_entities: entities.size,
    total_relationships: relationships.size,
    by_type: { gene: 0, capsule: 0, node: 0, topic: 0 },
    by_relationship: {
      uses: 0, evolved_from: 0, similar_to: 0, references: 0,
      triggers: 0, validates: 0, solves: 0, extends: 0,
      conflicts_with: 0, part_of: 0,
    },
  };
  
  for (const entity of entities.values()) {
    stats.by_type[entity.type]++;
  }
  
  for (const rel of relationships.values()) {
    stats.by_relationship[rel.type]++;
  }
  
  return stats;
}

// ============ Entity Linking ============

export function linkGeneToCapsule(geneId: string, capsuleId: string, weight: number = 1.0): KGRelationship | undefined {
  const gene = entities.get(geneId);
  const capsule = entities.get(capsuleId);
  
  if (!gene || !capsule) return undefined;
  
  return addRelationship({
    source_id: capsuleId,
    source_type: 'capsule',
    target_id: geneId,
    target_type: 'gene',
    type: 'uses',
    weight,
  });
}

export function linkSimilar(entity1Id: string, entity2Id: string, similarity: number): KGRelationship | undefined {
  const entity1 = entities.get(entity1Id);
  const entity2 = entities.get(entity2Id);
  
  if (!entity1 || !entity2) return undefined;
  
  return addRelationship({
    source_id: entity1Id,
    source_type: entity1.type,
    target_id: entity2Id,
    target_type: entity2.type,
    type: 'similar_to',
    weight: similarity,
  });
}

export function trackEvolution(childCapsuleId: string, parentCapsuleId: string): KGRelationship | undefined {
  const child = entities.get(childCapsuleId);
  const parent = entities.get(parentCapsuleId);
  
  if (!child || !parent) return undefined;
  
  return addRelationship({
    source_id: childCapsuleId,
    source_type: 'capsule',
    target_id: parentCapsuleId,
    target_type: 'capsule',
    type: 'evolved_from',
    weight: 1.0,
  });
}
