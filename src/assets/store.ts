/**
 * In-Memory Asset Store
 * Phase 2: Asset System
 */

import {
  Asset,
  AssetRecord,
  AssetStatus,
  Gene,
  Capsule,
  EvolutionEvent,
  Mutation,
  Recipe,
  Organism,
  AssetWithScore,
  GDIScore,
  FetchQuery,
} from './types';

// In-memory store
const assetStore = new Map<string, AssetRecord>();
const nodeAssets = new Map<string, Set<string>>(); // node_id -> Set<asset_id>

// Rate limiting
const publishRateLimit = new Map<string, { count: number; resetAt: number }>();
const FETCH_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const PUBLISH_RATE_LIMIT_FREE = 10; // per minute for free tier

// GDI Thresholds
const GDI_PROMOTION_THRESHOLD = 60;
const SIMILARITY_THRESHOLD = 0.85; // 85% similarity rejects publish

// ============ Store Operations ============

export function getAsset(assetId: string): AssetRecord | undefined {
  return assetStore.get(assetId);
}

export function getAssetContent(assetId: string): Asset | undefined {
  return assetStore.get(assetId)?.asset;
}

export function getAssetsByOwner(ownerId: string): AssetRecord[] {
  const assetIds = nodeAssets.get(ownerId);
  if (!assetIds) return [];
  return [...assetIds].map(id => assetStore.get(id)).filter(Boolean) as AssetRecord[];
}

export function listAssets(filter?: {
  type?: string;
  status?: AssetStatus;
  ownerId?: string;
  limit?: number;
  offset?: number;
}): AssetRecord[] {
  let records = [...assetStore.values()];

  if (filter?.type) {
    records = records.filter(r => r.asset.type === filter.type);
  }
  if (filter?.status) {
    records = records.filter(r => r.status === filter.status);
  }
  if (filter?.ownerId) {
    records = records.filter(r => r.owner_id === filter.ownerId);
  }

  // Sort by published_at desc
  records.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

  const offset = filter?.offset ?? 0;
  const limit = filter?.limit ?? 50;
  return records.slice(offset, offset + limit);
}

export function countAssets(filter?: { type?: string; status?: AssetStatus }): number {
  let records = [...assetStore.values()];
  if (filter?.type) records = records.filter(r => r.asset.type === filter.type);
  if (filter?.status) records = records.filter(r => r.status === filter.status);
  return records.length;
}

// ============ Store Mutations ============

export function saveAsset(
  asset: Asset,
  ownerId: string,
  status: AssetStatus = 'candidate',
  gdi?: GDIScore
): AssetRecord {
  const now = new Date().toISOString();
  const existing = assetStore.get(asset.asset_id);

  const record: AssetRecord = {
    asset,
    status,
    owner_id: ownerId,
    gdi,
    fetch_count: existing?.fetch_count ?? 0,
    report_count: existing?.report_count ?? 0,
    published_at: existing?.published_at ?? now,
    updated_at: now,
    version: (existing?.version ?? 0) + 1,
  };

  assetStore.set(asset.asset_id, record);

  // Track node -> assets
  if (!nodeAssets.has(ownerId)) {
    nodeAssets.set(ownerId, new Set());
  }
  nodeAssets.get(ownerId)!.add(asset.asset_id);

  return record;
}

export function updateAssetStatus(
  assetId: string,
  newStatus: AssetStatus,
  reason?: string
): AssetRecord | undefined {
  const record = assetStore.get(assetId);
  if (!record) return undefined;

  const now = new Date().toISOString();
  record.status = newStatus;
  record.updated_at = now;

  if (newStatus === 'rejected') {
    record.rejected_at = now;
  } else if (newStatus === 'archived') {
    record.archived_at = now;
  }

  return record;
}

export function incrementFetchCount(assetId: string): void {
  const record = assetStore.get(assetId);
  if (record) {
    record.fetch_count++;
    record.updated_at = new Date().toISOString();
  }
}

export function incrementReportCount(assetId: string): void {
  const record = assetStore.get(assetId);
  if (record) {
    record.report_count++;
    record.updated_at = new Date().toISOString();
  }
}

// ============ Rate Limiting ============

export function checkPublishRateLimit(nodeId: string): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
} {
  const now = Date.now();
  let entry = publishRateLimit.get(nodeId);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + FETCH_RATE_LIMIT_WINDOW };
    publishRateLimit.set(nodeId, entry);
  }

  const allowed = entry.count < PUBLISH_RATE_LIMIT_FREE;
  const remaining = Math.max(0, PUBLISH_RATE_LIMIT_FREE - entry.count);

  return {
    allowed,
    remaining,
    resetIn: Math.max(0, entry.resetAt - now),
  };
}

export function recordPublish(nodeId: string): void {
  const entry = publishRateLimit.get(nodeId);
  if (entry) {
    entry.count++;
  }
}

// ============ Queries ============

export function getActiveAssets(type?: string): AssetRecord[] {
  return [...assetStore.values()].filter(
    r => r.status === 'active' && (!type || r.asset.type === type)
  );
}

export function getPromotedAssets(type?: string): AssetRecord[] {
  return [...assetStore.values()].filter(
    r => (r.status === 'promoted' || r.status === 'active') &&
         (!type || r.asset.type === type)
  );
}

export function getAssetsBySignal(signal: string, type?: string): AssetRecord[] {
  return [...assetStore.values()].filter(r => {
    if (r.status === 'rejected' || r.status === 'archived') return false;
    if (type && r.asset.type !== type) return false;

    const asset = r.asset;
    if (asset.type === 'Gene') {
      const gene = asset as Gene;
      return gene.signals_match.some(s => signalMatch(s, signal));
    }
    if (asset.type === 'Capsule') {
      const capsule = asset as Capsule;
      return capsule.trigger.some(s => signalMatch(s, signal));
    }
    return false;
  });
}

function signalMatch(pattern: string, signal: string): boolean {
  // Try regex first, then keyword match
  try {
    if (pattern.startsWith('/') && pattern.endsWith('/i')) {
      const regex = new RegExp(pattern.slice(1, -2), 'i');
      return regex.test(signal);
    }
  } catch {
    // Invalid regex, do keyword match
  }
  return signal.toLowerCase().includes(pattern.toLowerCase());
}

// ============ GDI Helpers ============

export function getGDIThreshold(): number {
  return GDI_PROMOTION_THRESHOLD;
}

export function getSimilarityThreshold(): number {
  return SIMILARITY_THRESHOLD;
}

// ============ Stats ============

export function getAssetStats(): {
  total: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  total_fetches: number;
  total_reports: number;
} {
  const by_type: Record<string, number> = {};
  const by_status: Record<string, number> = {};
  let total_fetches = 0;
  let total_reports = 0;

  for (const record of assetStore.values()) {
    by_type[record.asset.type] = (by_type[record.asset.type] ?? 0) + 1;
    by_status[record.status] = (by_status[record.status] ?? 0) + 1;
    total_fetches += record.fetch_count;
    total_reports += record.report_count;
  }

  return {
    total: assetStore.size,
    by_type,
    by_status,
    total_fetches,
    total_reports,
  };
}

// ============ Semantic Search (simple TF-IDF like) ============

export function searchAssets(query: FetchQuery): AssetWithScore[] {
  const queryLower = (query.query ?? '').toLowerCase().trim();
  let records = [...assetStore.values()].filter(r => {
    if (r.status === 'rejected' || r.status === 'archived') return false;
    if (query.type && r.asset.type !== query.type) return false;
    if (query.category && (r.asset as Gene).category !== query.category) return false;
    if (query.owner_id && r.owner_id !== query.owner_id) return false;
    return true;
  });

  // If no query, just return by published_at
  if (!queryLower) {
    records.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
    const limit = query.limit ?? 20;
    return records.slice(0, limit).map(toAssetWithScore);
  }

  // Score by relevance
  records = records.map(record => {
    const score = computeRelevanceScore(record.asset, queryLower);
    return { record, score };
  })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ record }) => record);

  const limit = query.limit ?? 20;
  return records.slice(0, limit).map(toAssetWithScore);
}

function computeRelevanceScore(asset: Asset, query: string): number {
  const terms = query.toLowerCase().split(/\s+/);
  let score = 0;

  if (asset.type === 'Gene') {
    const gene = asset as Gene;
    terms.forEach(term => {
      if (gene.id.toLowerCase().includes(term)) score += 3;
      if (gene.category.toLowerCase().includes(term)) score += 2;
      if (gene.signals_match.some(s => s.toLowerCase().includes(term))) score += 2;
      if (gene.strategy.some(s => s.toLowerCase().includes(term))) score += 1;
    });
  } else if (asset.type === 'Capsule') {
    const capsule = asset as Capsule;
    terms.forEach(term => {
      if (capsule.id.toLowerCase().includes(term)) score += 3;
      if (capsule.summary.toLowerCase().includes(term)) score += 2;
      if (capsule.trigger.some(t => t.toLowerCase().includes(term))) score += 2;
      if (capsule.content.toLowerCase().includes(term)) score += 1;
    });
  }

  return score;
}

function toAssetWithScore(record: AssetRecord): AssetWithScore {
  return {
    ...record.asset,
    status: record.status,
    owner_id: record.owner_id,
    gdi: record.gdi,
    fetch_count: record.fetch_count,
    report_count: record.report_count,
  };
}

export function toAssetWithScoreFromRecord(record: AssetRecord): AssetWithScore {
  return toAssetWithScore(record);
}

// Re-export FetchQuery for convenience
export type { FetchQuery } from './types';
