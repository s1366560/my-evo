/**
 * Search Service - Skill/Gene/Capsule Semantic Search
 */

import { v4 as uuidv4 } from 'uuid';

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
