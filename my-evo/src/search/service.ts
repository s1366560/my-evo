/**
 * Search Service - Skill/Gene/Capsule Semantic Search
 */

import { randomUUID } from 'crypto';

export type AssetType = 'gene' | 'capsule' | 'skill';

export interface SearchableAsset {
  id: string;
  type: AssetType;
  name: string;
  description: string;
  signals: string[];
  tags: string[];
  author_id: string;
  gdi_score: number;
  downloads: number;
  rating: number;
  created_at: number;
  updated_at: number;
  metadata?: Record<string, any>;
}

export interface SearchQuery {
  q?: string;
  type?: AssetType;
  signals?: string[];
  tags?: string[];
  min_gdi?: number;
  author_id?: string;
  sort_by?: 'relevance' | 'gdi' | 'downloads' | 'rating' | 'newest';
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  assets: SearchableAsset[];
  total: number;
  query_time_ms: number;
  facets: {
    by_type: Record<AssetType, number>;
    by_signal: Record<string, number>;
  };
}

// In-memory search index
const searchIndex: Map<string, SearchableAsset> = new Map();
const signalIndex: Map<string, Set<string>> = new Map(); // signal -> asset IDs
const tagIndex: Map<string, Set<string>> = new Map();   // tag -> asset IDs
const typeIndex: Map<AssetType, Set<string>> = new Map(); // type -> asset IDs

// ============ Indexing ============

export function indexAsset(asset: SearchableAsset): void {
  searchIndex.set(asset.id, asset);
  
  // Index by type
  if (!typeIndex.has(asset.type)) {
    typeIndex.set(asset.type, new Set());
  }
  typeIndex.get(asset.type)!.add(asset.id);
  
  // Index by signals
  for (const signal of asset.signals) {
    if (!signalIndex.has(signal)) {
      signalIndex.set(signal, new Set());
    }
    signalIndex.get(signal)!.add(asset.id);
  }
  
  // Index by tags
  for (const tag of asset.tags) {
    if (!tagIndex.has(tag)) {
      tagIndex.set(tag, new Set());
    }
    tagIndex.get(tag)!.add(asset.id);
  }
}

export function removeFromIndex(assetId: string): void {
  const asset = searchIndex.get(assetId);
  if (!asset) return;
  
  searchIndex.delete(assetId);
  
  // Remove from type index
  typeIndex.get(asset.type)?.delete(assetId);
  
  // Remove from signal index
  for (const signal of asset.signals) {
    signalIndex.get(signal)?.delete(assetId);
  }
  
  // Remove from tag index
  for (const tag of asset.tags) {
    tagIndex.get(tag)?.delete(assetId);
  }
}

// ============ Search ============

export function search(query: SearchQuery): SearchResult {
  const startTime = Date.now();
  
  let candidateIds = new Set<string>(searchIndex.keys());
  
  // Filter by type
  if (query.type) {
    const typeIds = typeIndex.get(query.type);
    if (typeIds) {
      candidateIds = new Set([...candidateIds].filter(id => typeIds.has(id)));
    }
  }
  
  // Filter by signals (match any)
  if (query.signals && query.signals.length > 0) {
    const signalIds = new Set<string>();
    for (const signal of query.signals) {
      const ids = signalIndex.get(signal);
      if (ids) {
        for (const id of ids) {
          signalIds.add(id);
        }
      }
    }
    candidateIds = new Set([...candidateIds].filter(id => signalIds.has(id)));
  }
  
  // Filter by tags (match any)
  if (query.tags && query.tags.length > 0) {
    const tagIds = new Set<string>();
    for (const tag of query.tags) {
      const ids = tagIndex.get(tag);
      if (ids) {
        for (const id of ids) {
          tagIds.add(id);
        }
      }
    }
    candidateIds = new Set([...candidateIds].filter(id => tagIds.has(id)));
  }
  
  // Filter by minimum GDI
  if (query.min_gdi !== undefined) {
    candidateIds = new Set(
      [...candidateIds].filter(id => {
        const asset = searchIndex.get(id);
        return asset && asset.gdi_score >= query.min_gdi!;
      })
    );
  }
  
  // Filter by author
  if (query.author_id) {
    candidateIds = new Set(
      [...candidateIds].filter(id => {
        const asset = searchIndex.get(id);
        return asset && asset.author_id === query.author_id;
      })
    );
  }
  
  // Text search (keyword match)
  if (query.q) {
    const q = query.q.toLowerCase();
    candidateIds = new Set(
      [...candidateIds].filter(id => {
        const asset = searchIndex.get(id);
        if (!asset) return false;
        return (
          asset.name.toLowerCase().includes(q) ||
          asset.description.toLowerCase().includes(q) ||
          asset.signals.some(s => s.toLowerCase().includes(q)) ||
          asset.tags.some(t => t.toLowerCase().includes(q))
        );
      })
    );
  }
  
  // Convert to assets
  let assets = [...candidateIds].map(id => searchIndex.get(id)!).filter(Boolean);
  
  // Calculate relevance scores
  if (query.q) {
    const q = query.q.toLowerCase();
    assets = assets.map(asset => ({
      asset,
      relevance: calculateRelevance(asset, q),
    }))
    .sort((a, b) => b.relevance - a.relevance)
    .map(({ asset }) => asset);
  }
  
  // Sort
  assets = sortAssets(assets, query.sort_by || 'relevance');
  
  // Facets
  const facets = computeFacets([...candidateIds].map(id => searchIndex.get(id)!));
  
  // Pagination
  const total = assets.length;
  const limit = query.limit || 20;
  const offset = query.offset || 0;
  assets = assets.slice(offset, offset + limit);
  
  return {
    assets,
    total,
    query_time_ms: Date.now() - startTime,
    facets,
  };
}

function calculateRelevance(asset: SearchableAsset, query: string): number {
  let score = 0;
  
  // Name match (highest weight)
  if (asset.name.toLowerCase().includes(query)) score += 10;
  if (asset.name.toLowerCase() === query) score += 20;
  
  // Description match
  if (asset.description.toLowerCase().includes(query)) score += 5;
  
  // Signal match
  for (const signal of asset.signals) {
    if (signal.toLowerCase().includes(query)) score += 3;
  }
  
  // Tag match
  for (const tag of asset.tags) {
    if (tag.toLowerCase().includes(query)) score += 2;
  }
  
  // Boost by quality metrics
  score += asset.gdi_score / 20;
  score += asset.downloads / 100;
  score += asset.rating;
  
  return score;
}

function sortAssets(assets: SearchableAsset[], sortBy: SearchQuery['sort_by']): SearchableAsset[] {
  switch (sortBy) {
    case 'gdi':
      return [...assets].sort((a, b) => b.gdi_score - a.gdi_score);
    case 'downloads':
      return [...assets].sort((a, b) => b.downloads - a.downloads);
    case 'rating':
      return [...assets].sort((a, b) => b.rating - a.rating);
    case 'newest':
      return [...assets].sort((a, b) => b.created_at - a.created_at);
    case 'relevance':
    default:
      return assets;
  }
}

function computeFacets(assets: SearchableAsset[]): SearchResult['facets'] {
  const byType: Record<AssetType, number> = { gene: 0, capsule: 0, skill: 0 };
  const bySignal: Record<string, number> = {};
  
  for (const asset of assets) {
    byType[asset.type]++;
    for (const signal of asset.signals) {
      bySignal[signal] = (bySignal[signal] || 0) + 1;
    }
  }
  
  return { by_type: byType, by_signal: bySignal };
}

// ============ Skill-specific ============

export function searchSkills(query: Omit<SearchQuery, 'type'>): SearchResult {
  return search({ ...query, type: 'skill' });
}

export function searchGenes(query: Omit<SearchQuery, 'type'>): SearchResult {
  return search({ ...query, type: 'gene' });
}

export function searchCapsules(query: Omit<SearchQuery, 'type'>): SearchResult {
  return search({ ...query, type: 'capsule' });
}

// ============ Autocomplete ============

export function autocomplete(q: string, limit: number = 10): string[] {
  const results: { text: string; score: number }[] = [];
  const qLower = q.toLowerCase();
  
  // Collect matching names and signals
  for (const asset of searchIndex.values()) {
    if (asset.name.toLowerCase().includes(qLower)) {
      results.push({ text: asset.name, score: 10 });
    }
    for (const signal of asset.signals) {
      if (signal.toLowerCase().includes(qLower)) {
        results.push({ text: signal, score: 5 });
      }
    }
    for (const tag of asset.tags) {
      if (tag.toLowerCase().includes(qLower)) {
        results.push({ text: tag, score: 3 });
      }
    }
  }
  
  // Sort and dedupe
  const seen = new Set<string>();
  return results
    .sort((a, b) => b.score - a.score)
    .filter(r => {
      if (seen.has(r.text)) return false;
      seen.add(r.text);
      return true;
    })
    .slice(0, limit)
    .map(r => r.text);
}

// ============ Trending ============

export function getTrending(limit: number = 10): SearchableAsset[] {
  return [...searchIndex.values()]
    .sort((a, b) => {
      // Trending score = downloads recent + GDI
      const recentDownloadsA = a.downloads;
      const recentDownloadsB = b.downloads;
      return (recentDownloadsB + b.gdi_score) - (recentDownloadsA + a.gdi_score);
    })
    .slice(0, limit);
}

// ============ Similar ============

export function findSimilar(assetId: string, limit: number = 5): SearchableAsset[] {
  const asset = searchIndex.get(assetId);
  if (!asset) return [];
  
  const signalSet = new Set(asset.signals);
  const tagSet = new Set(asset.tags);
  
  return [...searchIndex.values()]
    .filter(a => a.id !== assetId)
    .map(a => {
      const signalOverlap = a.signals.filter(s => signalSet.has(s)).length;
      const tagOverlap = a.tags.filter(t => tagSet.has(t)).length;
      const similarity = (signalOverlap * 2 + tagOverlap) / (asset.signals.length + asset.tags.length + a.signals.length + a.tags.length);
      return { asset: a, similarity };
    })
    .filter(r => r.similarity > 0.1)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(r => r.asset);
}

// ============ TF-IDF Vector Storage for Semantic Search ============

interface TFIDFVector {
  [term: string]: number;
}

// Document frequency map
const docFrequency: Map<string, number> = new Map();
const totalDocs = () => searchIndex.size;

// Build TF-IDF vector for an asset
function buildTFIDFVector(asset: SearchableAsset): TFIDFVector {
  const text = [
    asset.name,
    asset.description,
    ...asset.signals,
    ...asset.tags,
  ].join(' ').toLowerCase();
  
  const terms = text.split(/\s+/).filter(t => t.length > 1);
  const termFreq: Map<string, number> = new Map();
  
  for (const term of terms) {
    termFreq.set(term, (termFreq.get(term) || 0) + 1);
  }
  
  const tfidf: TFIDFVector = {};
  const n = totalDocs();
  
  for (const [term, tf] of termFreq) {
    const df = docFrequency.get(term) || 0;
    if (df === 0) continue;
    // TF-IDF: tf * log(n / df)
    tfidf[term] = tf * Math.log(n / df);
  }
  
  return tfidf;
}

// Compute cosine similarity between two vectors
function cosineSimilarity(vecA: TFIDFVector, vecB: TFIDFVector): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  const allTerms = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  
  for (const term of allTerms) {
    const a = vecA[term] || 0;
    const b = vecB[term] || 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Update document frequency when indexing
function updateDocFrequency(asset: SearchableAsset): void {
  const text = [
    asset.name,
    asset.description,
    ...asset.signals,
    ...asset.tags,
  ].join(' ').toLowerCase();
  
  const terms = new Set(text.split(/\s+/).filter(t => t.length > 1));
  
  for (const term of terms) {
    docFrequency.set(term, (docFrequency.get(term) || 0) + 1);
  }
}

// Semantic Search Result
export interface SemanticSearchResult {
  assets: Array<SearchableAsset & { similarity_score: number }>;
  total: number;
  query_time_ms: number;
  method: 'tfidf_cosine';
}

// Semantic search using TF-IDF vectors and cosine similarity
export function semanticSearch(
  query: string,
  options?: {
    type?: AssetType;
    min_gdi?: number;
    limit?: number;
    min_similarity?: number;
  }
): SemanticSearchResult {
  const startTime = Date.now();
  
  if (searchIndex.size === 0) {
    return {
      assets: [],
      total: 0,
      query_time_ms: Date.now() - startTime,
      method: 'tfidf_cosine',
    };
  }
  
  // Build query vector from search terms
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
  const queryTF: TFIDFVector = {};
  
  for (const term of queryTerms) {
    queryTF[term] = (queryTF[term] || 0) + 1;
  }
  
  // Normalize query vector
  const queryNorm = Math.sqrt(Object.values(queryTF).reduce((sum, v) => sum + v * v, 0));
  if (queryNorm > 0) {
    for (const term in queryTF) {
      queryTF[term] /= queryNorm;
    }
  }
  
  // Get all candidates
  let candidates = [...searchIndex.values()];
  
  // Filter by type
  if (options?.type) {
    candidates = candidates.filter(a => a.type === options.type);
  }
  
  // Filter by minimum GDI
  if (options?.min_gdi !== undefined) {
    candidates = candidates.filter(a => a.gdi_score >= options.min_gdi!);
  }
  
  // Compute similarity for each candidate
  const results: Array<SearchableAsset & { similarity_score: number }> = [];
  
  for (const asset of candidates) {
    // Build asset TF-IDF vector
    const assetVector = buildTFIDFVector(asset);
    
    // Normalize asset vector
    const assetNorm = Math.sqrt(Object.values(assetVector).reduce((sum, v) => sum + v * v, 0));
    if (assetNorm > 0) {
      for (const term in assetVector) {
        assetVector[term] /= assetNorm;
      }
    }
    
    // Compute cosine similarity
    let dotProduct = 0;
    for (const term of Object.keys(queryTF)) {
      dotProduct += queryTF[term] * (assetVector[term] || 0);
    }
    
    const similarity = dotProduct;
    
    // Skip low similarity
    const minSim = options?.min_similarity ?? 0.1;
    if (similarity < minSim) continue;
    
    results.push({
      ...asset,
      similarity_score: Math.round(similarity * 1000) / 1000,
    });
  }
  
  // Sort by similarity descending
  results.sort((a, b) => b.similarity_score - a.similarity_score);
  
  const limit = options?.limit || 20;
  const total = results.length;
  const topResults = results.slice(0, limit);
  
  return {
    assets: topResults,
    total,
    query_time_ms: Date.now() - startTime,
    method: 'tfidf_cosine',
  };
}

// ============ Semantic Similarity Between Assets ============

export function findSimilarByText(assetId: string, limit: number = 5): SearchableAsset[] {
  const asset = searchIndex.get(assetId);
  if (!asset) return [];
  
  const query = [asset.name, asset.description, ...asset.signals, ...asset.tags].join(' ');
  const result = semanticSearch(query, { limit: limit + 1 });
  
  return result.assets
    .filter(a => a.id !== assetId)
    .slice(0, limit);
}

// ============ Asset Indexing with TF-IDF Update ============

// Enhanced indexAsset that updates document frequency
export function indexAssetWithTFIDF(asset: SearchableAsset): void {
  indexAsset(asset);
  updateDocFrequency(asset);
}
