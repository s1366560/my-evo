/**
 * Asset Lineage Tracking
 * Phase 2: Asset System - Gene/Capsule Evolution Chain
 *
 * Tracks parent-child relationships between assets:
 * Gene → Capsule → EvolutionEvent
 *
 * Enables:
 * - Evolution history visualization
 * - Impact analysis (what happens if this asset changes)
 * - Trust propagation along lineage chain
 * - Cross-reference detection
 */

import { Asset, Gene, Capsule, EvolutionEvent } from './types';

// Lineage record: maps child asset_id → parent asset_id
const lineageStore = new Map<string, string>();
// Reverse index: parent asset_id → Set of child asset_ids
const childrenIndex = new Map<string, Set<string>>();
// Lineage metadata (mutations, reasoning)
const lineageMetadata = new Map<string, LineageMetadata>();

export interface LineageMetadata {
  child_asset_id: string;
  parent_asset_id: string;
  relationship: 'evolves_from' | 'derived_from' | 'references' | 'bundled_with';
  mutation_type?: 'point' | 'structural' | 'compositional';
  confidence?: number;
  reasoning?: string;
  created_at: string;
}

export interface LineageChain {
  asset_id: string;
  chain: AssetRef[];
  depth: number;
}

export interface AssetRef {
  asset_id: string;
  type: string;
  id: string;
  status: string;
}

export interface LineageResult {
  parents: AssetRef[];
  children: AssetRef[];
  depth: number;
  has_lineage: boolean;
}

/**
 * Record a lineage relationship between two assets
 */
export function recordLineage(
  childAssetId: string,
  parentAssetId: string,
  metadata?: Partial<LineageMetadata>
): LineageMetadata {
  const now = new Date().toISOString();

  const record: LineageMetadata = {
    child_asset_id: childAssetId,
    parent_asset_id: parentAssetId,
    relationship: metadata?.relationship ?? inferRelationship(childAssetId, parentAssetId),
    mutation_type: metadata?.mutation_type,
    confidence: metadata?.confidence,
    reasoning: metadata?.reasoning,
    created_at: now,
  };

  lineageStore.set(childAssetId, parentAssetId);

  if (!childrenIndex.has(parentAssetId)) {
    childrenIndex.set(parentAssetId, new Set());
  }
  childrenIndex.get(parentAssetId)!.add(childAssetId);

  lineageMetadata.set(childAssetId, record);
  return record;
}

/**
 * Infer relationship type from asset types
 */
function inferRelationship(childId: string, parentId: string): LineageMetadata['relationship'] {
  // If IDs contain type hints, use them
  // Otherwise default
  return 'evolves_from';
}

/**
 * Get the immediate parent of an asset
 */
export function getParent(assetId: string): string | undefined {
  return lineageStore.get(assetId);
}

/**
 * Get all children of an asset
 */
export function getChildren(assetId: string): string[] {
  return [...(childrenIndex.get(assetId) ?? [])];
}

/**
 * Get full lineage chain (ancestors) for an asset
 */
export function getLineageChain(assetId: string, maxDepth: number = 10): LineageChain {
  const chain: AssetRef[] = [];
  let current = assetId;
  let depth = 0;

  while (current && depth < maxDepth) {
    const parent = lineageStore.get(current);
    if (!parent) break;

    chain.push({
      asset_id: parent,
      type: '', // Will be resolved by caller
      id: parent,
      status: '',
    });
    current = parent;
    depth++;
  }

  return {
    asset_id: assetId,
    chain,
    depth,
  };
}

/**
 * Get full descendant chain (descendants) for an asset
 */
export function getDescendantChain(assetId: string, maxDepth: number = 10): LineageChain {
  const chain: AssetRef[] = [];
  const visited = new Set<string>();

  function traverse(id: string, currentDepth: number) {
    if (currentDepth >= maxDepth) return;
    const children = childrenIndex.get(id);
    if (!children) return;

    for (const childId of children) {
      if (visited.has(childId)) continue;
      visited.add(childId);

      chain.push({
        asset_id: childId,
        type: '',
        id: childId,
        status: '',
      });

      traverse(childId, currentDepth + 1);
    }
  }

  traverse(assetId, 0);

  return {
    asset_id: assetId,
    chain,
    depth: chain.length,
  };
}

/**
 * Get lineage info for an asset (parents + children)
 */
export function getLineage(assetId: string): LineageResult {
  const parents = getLineageChain(assetId).chain;
  const descendants = getDescendantChain(assetId).chain;

  return {
    parents,
    children: descendants,
    depth: parents.length,
    has_lineage: parents.length > 0 || descendants.length > 0,
  };
}

/**
 * Get metadata for a lineage relationship
 */
export function getLineageMetadata(childAssetId: string): LineageMetadata | undefined {
  return lineageMetadata.get(childAssetId);
}

/**
 * Build lineage from a Gene → Capsule → EvolutionEvent bundle
 * Called during asset publishing to establish the chain
 */
export function buildBundleLineage(
  gene: Gene,
  capsule: Capsule,
  evolutionEvent?: EvolutionEvent
): void {
  // Capsule derives from Gene
  recordLineage(capsule.asset_id, gene.asset_id, {
    relationship: 'evolves_from',
    mutation_type: inferMutationType(gene, capsule),
    confidence: capsule.confidence,
    reasoning: `Capsule derived from Gene ${gene.id}: ${capsule.summary}`,
  });

  // EvolutionEvent derives from Capsule (if present)
  if (evolutionEvent) {
    recordLineage(evolutionEvent.asset_id, capsule.asset_id, {
      relationship: 'derived_from',
      reasoning: `Evolution event: ${evolutionEvent.intent}`,
    });

    // Also link EvolutionEvent back to Gene
    recordLineage(evolutionEvent.asset_id, gene.asset_id, {
      relationship: 'references',
      reasoning: `Gene ${gene.id} used in evolution`,
    });
  }
}

/**
 * Infer mutation type from gene-capsule relationship
 */
function inferMutationType(gene: Gene, capsule: Capsule): LineageMetadata['mutation_type'] {
  // If capsule modifies strategy significantly → structural
  const geneStrategyLen = gene.strategy.length;
  const capsuleStrategyLen = capsule.strategy.length;

  if (Math.abs(geneStrategyLen - capsuleStrategyLen) > 2) {
    return 'structural';
  }

  // If content is significantly different → point
  const contentLen = capsule.content.length;
  if (contentLen < 200) return 'point';

  // Default
  return 'compositional';
}

/**
 * Calculate trust score along a lineage chain
 * Trust propagates from parent to child, decaying with distance
 */
export function calculateLineageTrust(
  assetId: string,
  parentTrustScores: Map<string, number>,
  decayFactor: number = 0.85
): number {
  const chain = getLineageChain(assetId);
  if (chain.depth === 0) return 0;

  let trust = 0;
  let decay = 1;

  for (let i = 0; i < chain.depth; i++) {
    const parentRef = chain.chain[i];
    const parentTrust = parentTrustScores.get(parentRef.asset_id) ?? 50; // Default 50 if unknown
    trust += parentTrust * decay;
    decay *= decayFactor;
  }

  // Normalize by sum of decay weights
  let decaySum = 0;
  decay = 1;
  for (let i = 0; i < chain.depth; i++) {
    decaySum += decay;
    decay *= decayFactor;
  }

  return chain.depth > 0 ? trust / decaySum : 0;
}

/**
 * Check if two assets share a common ancestor
 */
export function haveCommonAncestor(assetId1: string, assetId2: string): boolean {
  // Same asset trivially shares itself
  if (assetId1 === assetId2) return true;

  const ancestors1 = new Set<string>();
  let current = assetId1;

  // Collect all ancestors of assetId1 (not including assetId1 itself)
  while (lineageStore.has(current)) {
    current = lineageStore.get(current)!;
    ancestors1.add(current);
  }

  // Walk assetId2's ancestors and check for overlap
  current = assetId2;
  while (lineageStore.has(current)) {
    current = lineageStore.get(current)!;
    if (ancestors1.has(current)) return true;
  }

  return false;
}

/**
 * Get the oldest ancestor in a lineage chain
 */
export function getRootAncestor(assetId: string): string | undefined {
  let current = assetId;
  let last = assetId;

  while (lineageStore.has(current)) {
    last = current;
    current = lineageStore.get(current)!;
  }

  return last === assetId ? undefined : last;
}

/**
 * Count total assets in a lineage tree (including the root)
 */
export function getLineageTreeSize(assetId: string): number {
  const visited = new Set<string>();
  let count = 0;

  function traverse(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    count++;

    const children = childrenIndex.get(id);
    if (children) {
      for (const childId of children) {
        traverse(childId);
      }
    }
  }

  // Start from root ancestor
  const root = getRootAncestor(assetId) ?? assetId;
  traverse(root);

  return count;
}

/**
 * Get all asset IDs in a lineage tree
 */
export function getLineageTree(assetId: string): string[] {
  const visited = new Set<string>();

  function traverse(id: string) {
    if (visited.has(id)) return;
    visited.add(id);

    const children = childrenIndex.get(id);
    if (children) {
      for (const childId of children) {
        traverse(childId);
      }
    }
  }

  const root = getRootAncestor(assetId) ?? assetId;
  traverse(root);

  return [...visited];
}

/**
 * Reset lineage stores - FOR TESTING ONLY
 */
export function resetLineageStores(): void {
  lineageStore.clear();
  childrenIndex.clear();
  lineageMetadata.clear();
}
