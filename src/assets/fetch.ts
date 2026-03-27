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
    const records = listAssets({
      type: query.type,
      status: 'active',
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
    const gene = asset as Gene;
    return signals.some(sig =>
      gene.signals_match.some(pattern => signalMatch(pattern, sig))
    );
  }
  if (asset.type === 'Capsule') {
    const capsule = asset as Capsule;
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
 */
export function getTrendingAssets(options?: {
  type?: string;
  period?: 'day' | 'week' | 'month';
  limit?: number;
}): AssetWithScore[] {
  const records = listAssets({
    type: options?.type,
    status: 'active',
    limit: 100,
  });

  // Sort by fetch_count
  const sorted = records
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
      const gene = asset as Gene;
      return gene.signals_match.some(p => signalMatch(p, signal));
    }
    if (asset.type === 'Capsule') {
      const capsule = asset as Capsule;
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
