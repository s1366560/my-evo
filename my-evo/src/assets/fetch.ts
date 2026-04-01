/**
 * Asset Fetch/Search Logic
 * Phase 2: Asset System
 */

import {
  FetchQuery,
  FetchResult,
  AssetWithScore,
  Gene,
  Capsule,
} from './types';
import {
  searchAssets,
  listAssets,
  incrementFetchCount,
  getAsset,
  getAssetsByOwner,
  assetStore,
} from './store';
import { calculateGDI } from './gdi';

/**
 * Fetch/search assets based on query
 */
export function fetchAssets(
  query: FetchQuery,
  requesterId?: string
): FetchResult {
  // Use semantic search if query provided, otherwise list
  let assets: AssetWithScore[];

  if (query.query && query.query.trim().length > 0) {
    assets = searchAssets(query);
  } else {
    // List with filters
    // When fetching by owner_id, include all statuses (candidate, active, etc.)
    // Otherwise, only show active assets for public browsing
    const records = listAssets({
      type: query.type,
      status: query.owner_id ? undefined : 'active',
      ownerId: query.owner_id,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });

    assets = records.map(record => ({
      ...record.asset,
      status: record.status,
      owner_id: record.owner_id,
      gdi: record.gdi,
      fetch_count: record.fetch_count,
      report_count: record.report_count,
    }));
  }

  // Apply additional filters
  if (query.min_gdi !== undefined) {
    assets = assets.filter(a => (a.gdi?.total ?? 0) >= query.min_gdi!);
  }
  if (query.min_intrinsic !== undefined) {
    assets = assets.filter(a => (a.gdi?.intrinsic ?? 0) >= query.min_intrinsic!);
  }
  if (query.min_usage !== undefined) {
    assets = assets.filter(a => (a.gdi?.usage ?? 0) >= query.min_usage!);
  }
  if (query.min_social !== undefined) {
    assets = assets.filter(a => (a.gdi?.social ?? 0) >= query.min_social!);
  }
  if (query.signals && query.signals.length > 0) {
    assets = assets.filter(a => matchesSignals(a, query.signals!));
  }
  if (query.owner_id) {
    assets = assets.filter(a => a.owner_id === query.owner_id);
  }

  // Increment fetch counts (for GDI)
  if (requesterId) {
    for (const asset of assets) {
      incrementFetchCount(asset.asset_id);
    }
  }

  // Sort and limit
  const total = assets.length;
  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;
  assets = assets.slice(offset, offset + limit);

  // Attach current GDI if not present
  assets = assets.map(asset => {
    if (!asset.gdi) {
      const record = getAsset(asset.asset_id);
      if (record?.gdi) {
        return { ...asset, gdi: record.gdi };
      }
    }
    return asset;
  });

  return {
    assets,
    total,
    query,
  };
}

/**
 * Check if asset matches any of the given signals
 */
function matchesSignals(asset: AssetWithScore, signals: string[]): boolean {
  if (asset.type === 'Gene') {
    const gene = asset as unknown as Gene;
    return signals.some(sig =>
      gene.signals_match.some(pattern => signalMatch(pattern, sig))
    );
  }
  if (asset.type === 'Capsule') {
    const capsule = asset as unknown as Capsule;
    return signals.some(sig =>
      capsule.trigger.some(pattern => signalMatch(pattern, sig))
    );
  }
  return false;
}

function signalMatch(pattern: string, signal: string): boolean {
  try {
    if (pattern.startsWith('/') && pattern.endsWith('/i')) {
      const regex = new RegExp(pattern.slice(1, -2), 'i');
      return regex.test(signal);
    }
  } catch {
    // Invalid regex
  }
  return signal.toLowerCase().includes(pattern.toLowerCase());
}

/**
 * Get trending assets (most fetched recently)
 * Supports period filtering: day, week, month
 */
export function getTrendingAssets(options?: {
  type?: string;
  period?: 'day' | 'week' | 'month' | 'all';
  limit?: number;
}): AssetWithScore[] {
  const records = listAssets({
    type: options?.type,
    status: 'active',
    limit: 200,
  });

  // Filter by period based on last_fetched_at
  let filtered = records;
  const period = options?.period ?? 'week';
  if (period !== 'all') {
    const now = Date.now();
    const periodMs: Record<string, number> = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };
    const cutoff = now - (periodMs[period] ?? periodMs['week']);

    filtered = records.filter(r => {
      // If never fetched, use published_at as fallback
      const fetchTime = r.last_fetched_at ? new Date(r.last_fetched_at).getTime() : new Date(r.published_at).getTime();
      return fetchTime >= cutoff;
    });
  }

  // Sort by fetch_count (descending)
  const sorted = filtered
    .map(record => ({
      ...record.asset,
      status: record.status,
      owner_id: record.owner_id,
      gdi: record.gdi,
      fetch_count: record.fetch_count,
      report_count: record.report_count,
    }))
    .sort((a, b) => (b.fetch_count ?? 0) - (a.fetch_count ?? 0));

  return sorted.slice(0, options?.limit ?? 10);
}

/**
 * Get GDI-ranked assets
 */
export function getRankedAssets(options?: {
  type?: string;
  period?: 'day' | 'week' | 'month';
  limit?: number;
}): AssetWithScore[] {
  const records = listAssets({
    type: options?.type,
    status: 'active',
    limit: 200,
  });

  // Calculate GDI for all and sort
  const withGdi = records.map(record => {
    const gdi = record.gdi ?? calculateGDI(record.asset, {
      fetchCount: record.fetch_count,
      reportCount: record.report_count,
    });
    return {
      ...record.asset,
      status: record.status,
      owner_id: record.owner_id,
      gdi,
      fetch_count: record.fetch_count,
      report_count: record.report_count,
    };
  });

  // Sort by GDI total desc
  withGdi.sort((a, b) => (b.gdi?.total ?? 0) - (a.gdi?.total ?? 0));

  return withGdi.slice(0, options?.limit ?? 20);
}

/**
 * Get asset details by ID
 */
export function getAssetDetails(assetId: string): AssetWithScore | null {
  const record = getAsset(assetId);
  if (!record) return null;

  const gdi = record.gdi ?? calculateGDI(record.asset, {
    fetchCount: record.fetch_count,
    reportCount: record.report_count,
  });

  return {
    ...record.asset,
    status: record.status,
    owner_id: record.owner_id,
    gdi,
    fetch_count: record.fetch_count,
    report_count: record.report_count,
  };
}

/**
 * Get all categories with asset counts
 */
export function getCategories(): { category: string; count: number; type: string }[] {
  const records = [...assetStore.values()].filter(r => r.status === 'active');
  const result: Record<string, { count: number; type: string }> = {};

  for (const record of records) {
    const asset = record.asset;
    if (asset.type === 'Gene') {
      const gene = asset as unknown as Gene;
      const key = gene.category;
      if (!result[key]) result[key] = { count: 0, type: 'Gene' };
      result[key].count++;
    }
  }

  return Object.entries(result)
    .map(([category, info]) => ({ category, ...info }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get popular signals (most used trigger/signal keywords)
 */
export function getPopularSignals(options?: { limit?: number; type?: string }): { signal: string; count: number; type: string }[] {
  const records = listAssets({ type: options?.type, status: 'active', limit: 200 });
  const signalCounts: Record<string, number> = {};

  for (const record of records) {
    const asset = record.asset;
    const signals: string[] = asset.type === 'Gene'
      ? (asset as unknown as Gene).signals_match
      : (asset as unknown as Capsule).trigger;
    for (const s of signals) {
      signalCounts[s] = (signalCounts[s] ?? 0) + 1;
    }
  }

  return Object.entries(signalCounts)
    .map(([signal, count]) => ({ signal, count, type: options?.type ?? 'all' }))
    .sort((a, b) => b.count - a.count)
    .slice(0, options?.limit ?? 20);
}

/**
 * Explore assets with filters
 */
export function exploreAssets(options?: {
  type?: string;
  category?: string;
  status?: string;
  query?: string;
  limit?: number;
  offset?: number;
}): { assets: AssetWithScore[]; total: number } {
  const all = listAssets({
    type: options?.type,
    status: options?.status as 'active' | 'candidate' | 'rejected' | 'archived' | undefined,
    limit: 500,
  });

  let filtered = all;
  if (options?.category) {
    filtered = filtered.filter(r => {
      const asset = r.asset;
      return asset.type === 'Gene' && (asset as unknown as Gene).category === options.category;
    });
  }
  if (options?.query) {
    const q = options.query.toLowerCase();
    filtered = filtered.filter(r => {
      const a = r.asset;
      if (a.type === 'Gene') {
        const gene = a as unknown as Gene;
        return gene.signals_match.some(s => s.toLowerCase().includes(q)) ||
          gene.strategy.some(s => s.toLowerCase().includes(q));
      }
      const capsule = a as unknown as Capsule;
      return capsule.trigger.some(t => t.toLowerCase().includes(q)) ||
        capsule.summary?.toLowerCase().includes(q);
    });
  }

  const total = filtered.length;
  const assets = filtered
    .slice(options?.offset ?? 0, (options?.offset ?? 0) + (options?.limit ?? 20))
    .map(record => ({
      ...record.asset,
      status: record.status,
      owner_id: record.owner_id,
      gdi: record.gdi,
      fetch_count: record.fetch_count,
      report_count: record.report_count,
    }));

  return { assets, total };
}

/**
 * Get daily discovery — curated feed of high-quality new assets
 */
export function getDailyDiscovery(options?: { limit?: number }): AssetWithScore[] {
  const records = listAssets({ status: 'active', limit: 200 });
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const cutoff = now - oneDay;

  return records
    .filter(r => {
      const publishedAt = new Date(r.published_at).getTime();
      return publishedAt >= cutoff;
    })
    .sort((a, b) => (b.gdi?.total ?? 0) - (a.gdi?.total ?? 0))
    .slice(0, options?.limit ?? 10)
    .map(record => ({
      ...record.asset,
      status: record.status,
      owner_id: record.owner_id,
      gdi: record.gdi,
      fetch_count: record.fetch_count,
      report_count: record.report_count,
    }));
}

/**
 * Get personalized recommended assets for a node
 * Based on collaborative filtering: user's categories/signals → similar high-quality assets
 * For anonymous users: returns top GDI active assets
 */
export function getRecommendedAssets(nodeId?: string, options?: { limit?: number }): AssetWithScore[] {
  const limit = options?.limit ?? 10;

  // Anonymous: return top GDI active assets
  if (!nodeId) {
    const records = listAssets({ status: 'active', limit: 200 });
    return records
      .sort((a, b) => (b.gdi?.total ?? 0) - (a.gdi?.total ?? 0))
      .slice(0, limit)
      .map(record => ({
        ...record.asset,
        status: record.status,
        owner_id: record.owner_id,
        gdi: record.gdi,
        fetch_count: record.fetch_count,
        report_count: record.report_count,
      }));
  }

  // Authenticated: collaborative filtering based on user's published assets
  const myAssets = getAssetsByOwner(nodeId);
  if (myAssets.length === 0) {
    // No published assets → fallback to top GDI
    return getRecommendedAssets(undefined, options);
  }

  // Extract preference signals and categories from user's assets
  const prefSignals = new Set<string>();
  const prefCategories = new Set<string>();
  for (const record of myAssets) {
    if (record.asset.type === 'Gene') {
      const gene = record.asset as unknown as Gene;
      gene.signals_match.forEach(s => prefSignals.add(s.toLowerCase()));
      if (gene.category) prefCategories.add(gene.category);
    } else {
      const capsule = record.asset as unknown as Capsule;
      capsule.trigger.forEach(t => prefSignals.add(t.toLowerCase()));
    }
  }

  // Find candidate assets: active, not owned by this node
  const candidates = listAssets({ status: 'active', limit: 500 })
    .filter(r => r.owner_id !== nodeId);

  // Score candidates by signal overlap + GDI
  const scored = candidates
    .map(record => {
      let signalScore = 0;
      if (record.asset.type === 'Gene') {
        const gene = record.asset as unknown as Gene;
        gene.signals_match.forEach(s => {
          if (prefSignals.has(s.toLowerCase())) signalScore += 2;
        });
        if (prefCategories.has(gene.category)) signalScore += 3;
      } else {
        const capsule = record.asset as unknown as Capsule;
        capsule.trigger.forEach(t => {
          if (prefSignals.has(t.toLowerCase())) signalScore += 1;
        });
      }

      const gdiScore = record.gdi?.total ?? 0;
      const combinedScore = signalScore * 100 + gdiScore;

      return { record, combinedScore, signalScore };
    })
    .filter(s => s.signalScore > 0 || myAssets.length === 0)
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, limit)
    .map(s => ({
      ...s.record.asset,
      status: s.record.status,
      owner_id: s.record.owner_id,
      gdi: s.record.gdi,
      fetch_count: s.record.fetch_count,
      report_count: s.record.report_count,
    }));

  return scored;
}

/**
 * Get related assets (using signal/tag overlap)
 */
export function getRelatedAssets(assetId: string, options?: { limit?: number }): AssetWithScore[] {
  const record = getAsset(assetId);
  if (!record) return [];

  const targetSignals: string[] = record.asset.type === 'Gene'
    ? (record.asset as unknown as Gene).signals_match
    : (record.asset as unknown as Capsule).trigger;
  const targetTags: string[] = (record.asset as any).tags ?? [];

  const candidates = listAssets({ status: 'active', limit: 200 })
    .filter(r => r.asset.asset_id !== assetId);

  const scored = candidates.map(r => {
    const signals: string[] = r.asset.type === 'Gene'
      ? (r.asset as unknown as Gene).signals_match
      : (r.asset as unknown as Capsule).trigger;
    const tags: string[] = (r.asset as any).tags ?? [];

    const signalOverlap = signals.filter(s => targetSignals.includes(s)).length;
    const tagOverlap = tags.filter(t => targetTags.includes(t)).length;
    const score = signalOverlap * 2 + tagOverlap;

    return { record, score };
  })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, options?.limit ?? 5)
    .map(s => ({
      ...s.record.asset,
      status: s.record.status,
      owner_id: s.record.owner_id,
      gdi: s.record.gdi,
      fetch_count: s.record.fetch_count,
      report_count: s.record.report_count,
    }));

  return scored;
}

/**
 * Vote on an asset (up/down)
 */
export function voteAsset(assetId: string, nodeId: string, direction: 'up' | 'down'): { status: string; newVoteCount: number } {
  const record = getAsset(assetId);
  if (!record) throw new Error('Asset not found');

  // Initialize gdi if not present
  if (!record.gdi) record.gdi = calculateGDI(record.asset, { fetchCount: record.fetch_count, reportCount: record.report_count });

  // Vote changes the social score component (0-100 scale)
  const voteDelta = direction === 'up' ? 10 : -10;
  const newSocial = Math.max(0, Math.min(100, (record.gdi.social ?? 50) + voteDelta));
  record.gdi.social = newSocial;

  // Recalculate total GDI
  record.gdi.total = record.gdi.intrinsic * 0.35 +
    record.gdi.usage * 0.30 +
    record.gdi.social * 0.20 +
    record.gdi.freshness * 0.15;

  return { status: 'ok', newVoteCount: newSocial };
}

/**
 * Get validation reports
 */
export function getValidationReports(options?: { assetId?: string; limit?: number }) {
  const records = listAssets({ status: 'active', limit: 200 });
  const reports: unknown[] = [];

  for (const record of records) {
    if (options?.assetId && record.asset.asset_id !== options.assetId) continue;
    const confidence = (record.asset as any).confidence;
    if (confidence !== undefined) {
      reports.push({
        asset_id: record.asset.asset_id,
        confidence,
        status: record.status,
        validated_at: record.published_at,
        validator: record.owner_id,
      });
    }
  }

  return reports.slice(0, options?.limit ?? 50);
}

/**
 * Get evolution events
 */
export function getEvolutionEvents(options?: { limit?: number }): unknown[] {
  const records = listAssets({ status: 'active', limit: 200 });
  const events: unknown[] = [];

  for (const record of records) {
    const asset = record.asset;
    if (asset.type === 'Capsule' && (asset as unknown as Capsule).gene) {
      events.push({
        id: `evt_${record.asset.asset_id.slice(0, 12)}`,
        asset_id: record.asset.asset_id,
        gene: (asset as unknown as Capsule).gene,
        parent: undefined,
        intent: (asset as unknown as Capsule).summary,
        signals: (asset as unknown as Capsule).trigger,
        outcome: (asset as unknown as Capsule).outcome,
        created_at: asset.created_at,
      });
    }
  }

  return events.slice(0, options?.limit ?? 50);
}

/**
 * Get assets by signal/keyword
 */
export function getAssetsBySignal(
  signal: string,
  options?: { type?: string; limit?: number }
): AssetWithScore[] {
  const records = listAssets({
    type: options?.type,
    limit: 100,
  });

  const matches = records.filter(record => {
    if (record.status === 'rejected' || record.status === 'archived') return false;

    const asset = record.asset;
    if (asset.type === 'Gene') {
      const gene = asset as unknown as Gene;
      return gene.signals_match.some(p => signalMatch(p, signal));
    }
    if (asset.type === 'Capsule') {
      const capsule = asset as unknown as Capsule;
      return capsule.trigger.some(p => signalMatch(p, signal));
    }
    return false;
  });

  return matches
    .map(record => ({
      ...record.asset,
      status: record.status,
      owner_id: record.owner_id,
      gdi: record.gdi,
      fetch_count: record.fetch_count,
      report_count: record.report_count,
    }))
    .slice(0, options?.limit ?? 20);
}
