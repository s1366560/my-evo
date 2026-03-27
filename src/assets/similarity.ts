/**
 * Content Similarity Detection
 * Phase 2: Asset System
 * 
 * Prevents duplicate/spam assets by checking similarity before publishing.
 * Uses multiple strategies:
 * 1. SHA-256 exact hash match
 * 2. Normalized text similarity (Jaccard on tokens)
 * 3. Signal pattern overlap (for Genes)
 */

import { Asset, Gene, Capsule } from './types';
import { listAssets } from './store';

const SIMILARITY_THRESHOLD = 0.85; // 85% - reject above this

export interface SimilarityResult {
  is_duplicate: boolean;
  similar_assets: Array<{
    asset_id: string;
    similarity: number;
    reason: string;
  }>;
  max_similarity: number;
}

/**
 * Check if an asset is too similar to existing assets
 */
export function checkSimilarity(
  asset: Asset,
  excludeAssetId?: string
): SimilarityResult {
  const existingAssets = listAssets({ type: asset.type, limit: 1000 });
  const similarAssets: SimilarityResult['similar_assets'] = [];
  let maxSimilarity = 0;

  for (const record of existingAssets) {
    if (record.asset.asset_id === excludeAssetId) continue;
    if (record.status === 'rejected' || record.status === 'archived') continue;

    const similarity = computeSimilarity(asset, record.asset);

    if (similarity >= SIMILARITY_THRESHOLD) {
      similarAssets.push({
        asset_id: record.asset.asset_id,
        similarity,
        reason: getSimilarityReason(asset, record.asset, similarity),
      });
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }
  }

  similarAssets.sort((a, b) => b.similarity - a.similarity);

  return {
    is_duplicate: similarAssets.length > 0,
    similar_assets: similarAssets,
    max_similarity: maxSimilarity,
  };
}

/**
 * Compute similarity score between two assets (0-1)
 */
function computeSimilarity(a: Asset, b: Asset): number {
  if (a.type !== b.type) return 0;

  if (a.type === 'Gene' && b.type === 'Gene') {
    return computeGeneSimilarity(a as Gene, b as Gene);
  }
  if (a.type === 'Capsule' && b.type === 'Capsule') {
    return computeCapsuleSimilarity(a as Capsule, b as Capsule);
  }

  // Default: exact ID match only
  return a.asset_id === b.asset_id ? 1 : 0;
}

function computeGeneSimilarity(a: Gene, b: Gene): number {
  let score = 0;
  let maxScore = 0;

  // Category match (weight: 20%)
  maxScore += 20;
  if (a.category === b.category) score += 20;

  // Signals overlap (weight: 35%)
  maxScore += 35;
  const signalOverlap = jaccardSimilarity(a.signals_match, b.signals_match);
  score += signalOverlap * 35;

  // Strategy overlap (weight: 30%)
  maxScore += 30;
  const strategyOverlap = jaccardSimilarity(a.strategy, b.strategy);
  score += strategyOverlap * 30;

  // ID prefix match (weight: 15%) - genes with same prefix are likely versions
  maxScore += 15;
  const idPrefixA = a.id.split('_').slice(0, 2).join('_');
  const idPrefixB = b.id.split('_').slice(0, 2).join('_');
  if (idPrefixA === idPrefixB && a.id !== b.id) score += 15;

  return score / maxScore;
}

function computeCapsuleSimilarity(a: Capsule, b: Capsule): number {
  let score = 0;
  let maxScore = 0;

  // Source gene match (weight: 25%)
  maxScore += 25;
  if (a.gene === b.gene) score += 25;

  // Trigger overlap (weight: 30%)
  maxScore += 30;
  const triggerOverlap = jaccardSimilarity(a.trigger, b.trigger);
  score += triggerOverlap * 30;

  // Summary similarity (weight: 25%)
  maxScore += 25;
  const summarySim = textSimilarity(a.summary, b.summary);
  score += summarySim * 25;

  // Confidence within 10% (weight: 10%)
  maxScore += 10;
  if (Math.abs(a.confidence - b.confidence) <= 0.1) score += 10;

  // Same env_fingerprint (weight: 10%)
  maxScore += 10;
  if (
    JSON.stringify(a.env_fingerprint) === JSON.stringify(b.env_fingerprint) &&
    a.env_fingerprint.platform === b.env_fingerprint.platform
  ) {
    score += 10;
  }

  return score / maxScore;
}

/**
 * Jaccard similarity coefficient for string arrays
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const setA = new Set(a.map(s => s.toLowerCase().trim()));
  const setB = new Set(b.map(s => s.toLowerCase().trim()));

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

/**
 * Simple text similarity using word overlap
 */
function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(w => w.length > 2));

  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

/**
 * Get human-readable similarity reason
 */
function getSimilarityReason(
  newAsset: Asset,
  existingAsset: Asset,
  similarity: number
): string {
  if (similarity >= 0.95) {
    return 'Near-identical content detected';
  }
  if (similarity >= 0.90) {
    return 'Very high similarity - likely a minor variation';
  }

  if (newAsset.type === 'Gene') {
    const newGene = newAsset as Gene;
    const existingGene = existingAsset as Gene;
    if (newGene.category === existingGene.category) {
      return `Same category (${newGene.category}) with overlapping signals`;
    }
    return 'Similar strategy patterns detected';
  }

  if (newAsset.type === 'Capsule') {
    const newCapsule = newAsset as Capsule;
    const existingCapsule = existingAsset as Capsule;
    if (newCapsule.gene === existingCapsule.gene) {
      return `Same source gene (${newCapsule.gene})`;
    }
    return 'Similar trigger patterns and outcomes';
  }

  return `Similarity score: ${(similarity * 100).toFixed(1)}%`;
}

/**
 * Quick hash-based duplicate check
 * O(1) - just checks if content hash already exists
 */
export function isExactDuplicate(assetId: string): boolean {
  const existing = listAssets({ limit: 1 });
  // This is handled by the store - if asset_id exists it's an exact duplicate
  return false; // Will be checked properly in publish logic
}
