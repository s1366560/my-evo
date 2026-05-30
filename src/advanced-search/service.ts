import { PrismaClient } from '@prisma/client';
import type {
  AdvancedSearchQuery, AdvancedSearchResult, AdvancedSearchItem,
  FilterGroup, SearchFilter, SortSpec, PaginationSpec, SearchOptions,
  FacetBucket, AggregationResult, SavedSearch, SearchPreset, SearchSuggestion,
  AdvancedEntityType,
} from './types';
import {
  ADVANCED_SEARCH_DEFAULT_PAGE_SIZE, ADVANCED_SEARCH_MAX_PAGE_SIZE,
  ADVANCED_SEARCH_MAX_FACETS, ADVANCED_SEARCH_SAVED_SEARCH_LIMIT,
  SEARCHABLE_FIELDS, SORTABLE_FIELDS, SEARCH_OPTIONS_DEFAULTS,
} from './constants';
import { ValidationError } from '../shared/errors';

let prisma = new PrismaClient();
export function setPrisma(client: PrismaClient): void { prisma = client; }

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const savedSearches = new Map<string, SavedSearch>();
const presets: SearchPreset[] = [
  { preset_id: 'top_rated_assets', name: 'Top Rated Assets', description: 'Assets with highest rating', query: { entity_types: ['asset'], sort: [{ field: 'rating', order: 'desc' }], options: { include_facets: true } }, category: 'assets' },
  { preset_id: 'recent_assets', name: 'Recently Created', description: 'Latest assets by creation date', query: { entity_types: ['asset'], sort: [{ field: 'created_at', order: 'desc' }], options: { include_facets: false } }, category: 'assets' },
  { preset_id: 'high_gdi', name: 'High Quality Assets', description: 'Assets with GDI >= 70', query: { entity_types: ['asset'], sort: [{ field: 'gdi_score', order: 'desc' }], options: { include_facets: true } }, category: 'assets' },
  { preset_id: 'user_activity', name: 'Recent Transactions', description: 'Latest credit transactions', query: { entity_types: ['transaction'], sort: [{ field: 'created_at', order: 'desc' }] }, category: 'analytics' },
];

function buildPrismaWhere(filterGroups: FilterGroup[], query?: string): Record<string, unknown> {
  const conditions: unknown[] = [];
  for (const group of filterGroups) {
    if (group.logical_op === 'AND') {
      const andConds: Record<string, unknown>[] = [];
      for (const item of group.filters) {
        if ('field' in item) {
          const f = item as SearchFilter;
          andConds.push(buildCondition(f));
        }
      }
      if (andConds.length > 0) conditions.push({ AND: andConds });
    } else if (group.logical_op === 'OR') {
      const orConds: Record<string, unknown>[] = [];
      for (const item of group.filters) {
        if ('field' in item) {
          orConds.push(buildCondition(item as SearchFilter));
        }
      }
      if (orConds.length > 0) conditions.push({ OR: orConds });
    } else if (group.logical_op === 'NOT') {
      for (const item of group.filters) {
        if ('field' in item) {
          conditions.push({ NOT: buildCondition(item as SearchFilter) });
        }
      }
    }
  }
  if (query) {
    conditions.push({
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    });
  }
  return conditions.length === 1 ? (conditions[0] as Record<string, unknown>) : { AND: conditions };
}

function buildCondition(f: SearchFilter): Record<string, unknown> {
  const { field, operator, value } = f;
  switch (operator) {
    case 'eq': return { [field]: value };
    case 'ne': return { [field]: { not: value } };
    case 'gt': return { [field]: { gt: value } };
    case 'gte': return { [field]: { gte: value } };
    case 'lt': return { [field]: { lt: value } };
    case 'lte': return { [field]: { lte: value } };
    case 'in': return { [field]: { in: Array.isArray(value) ? value : [value] } };
    case 'nin': return { [field]: { notIn: Array.isArray(value) ? value : [value] } };
    case 'contains': return { [field]: { contains: String(value), mode: f.case_sensitive ? 'default' : 'insensitive' } };
    case 'startsWith': return { [field]: { startsWith: String(value), mode: f.case_sensitive ? 'default' : 'insensitive' } };
    case 'endsWith': return { [field]: { endsWith: String(value), mode: f.case_sensitive ? 'default' : 'insensitive' } };
    case 'exists': return value ? { [field]: { not: null } } : { [field]: null };
    case 'between': return Array.isArray(value) ? { [field]: { gte: value[0], lte: value[1] } } : { [field]: value };
    case 'regex': return { [field]: { contains: String(value), mode: 'insensitive' } }; // simplified
    default: return { [field]: value };
  }
}

export async function advancedSearch(query: AdvancedSearchQuery, client?: PrismaClient): Promise<AdvancedSearchResult> {
  const db = client ?? prisma;
  const startMs = Date.now();
  const opts = { ...SEARCH_OPTIONS_DEFAULTS, ...query.options };
  const pageSize = Math.min(query.pagination.page_size ?? ADVANCED_SEARCH_DEFAULT_PAGE_SIZE, ADVANCED_SEARCH_MAX_PAGE_SIZE);
  const page = query.pagination.page ?? 1;
  const offset = (page - 1) * pageSize;

  if (!query.entity_types.length) throw new ValidationError('entity_types cannot be empty');

  const where = buildPrismaWhere(query.filter_groups, query.base_query);
  const orderBy: Record<string, string>[] = [];
  for (const s of (query.sort ?? [])) {
    orderBy.push({ [s.field]: s.order });
  }
  if (orderBy.length === 0) orderBy.push({ created_at: 'desc' });

  const results: AdvancedSearchItem[] = [];
  let totalCount = 0;
  const facets: Record<string, FacetBucket[]> = {};
  const aggregations: Record<string, AggregationResult> = {};

  for (const entityType of query.entity_types) {
    if (entityType === 'asset') {
      const [items, count] = await Promise.all([
        db.asset.findMany({ where, orderBy, skip: offset, take: pageSize }),
        db.asset.count({ where }),
      ]);
      const scoredItems = (items as Record<string, unknown>[]).map((item, idx) => ({
        id: item.asset_id as string,
        entity_type: 'asset' as AdvancedEntityType,
        score: 1.0 / (idx + 1),
        rank: offset + idx + 1,
        data: item,
      }));
      results.push(...scoredItems);
      totalCount += count;

      if (opts.include_facets) {
        // Facets are computed from asset search results in memory
        const statusCounts: Record<string, number> = {};
        const typeCounts: Record<string, number> = {};
        for (const item of scoredItems) {
          const data = item.data as Record<string, unknown>;
          const status = String(data.status ?? 'unknown');
          const assetType = String(data.asset_type ?? 'unknown');
          statusCounts[status] = (statusCounts[status] ?? 0) + 1;
          typeCounts[assetType] = (typeCounts[assetType] ?? 0) + 1;
        }
        facets.status = Object.entries(statusCounts)
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, opts.facet_limit ?? ADVANCED_SEARCH_MAX_FACETS);
        facets.asset_type = Object.entries(typeCounts)
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, opts.facet_limit ?? ADVANCED_SEARCH_MAX_FACETS);
      }
    } else if (entityType === 'node') {
      const [items, count] = await Promise.all([
        db.node.findMany({ where, orderBy, skip: offset, take: pageSize }),
        db.node.count({ where }),
      ]);
      const scoredItems = (items as Record<string, unknown>[]).map((item, idx) => ({
        id: item.node_id as string,
        entity_type: 'node' as AdvancedEntityType,
        score: 1.0 / (idx + 1),
        rank: offset + idx + 1,
        data: item,
      }));
      results.push(...scoredItems);
      totalCount += count;
    } else if (entityType === 'user') {
      const [items, count] = await Promise.all([
        db.user.findMany({ where, orderBy, skip: offset, take: pageSize }),
        db.user.count({ where }),
      ]);
      const scoredItems = (items as Record<string, unknown>[]).map((item, idx) => ({
        id: item.id as string,
        entity_type: 'user' as AdvancedEntityType,
        score: 1.0 / (idx + 1),
        rank: offset + idx + 1,
        data: item,
      }));
      results.push(...scoredItems);
      totalCount += count;
    }
  }

  if (opts.include_aggregations && query.entity_types.includes('asset')) {
    const assetAggs = await db.asset.aggregate({
      where, _count: { _all: true },
      _sum: { downloads: true },
      _avg: { gdi_score: true },
      _max: { gdi_score: true },
      _min: { gdi_score: true },
    });
    aggregations.total_count = { type: 'count', value: Number(assetAggs._count._all), field: 'asset_id' };
    aggregations.total_downloads = { type: 'sum', value: Number(assetAggs._sum.downloads ?? 0), field: 'downloads' };
    aggregations.avg_gdi = { type: 'avg', value: Number(assetAggs._avg.gdi_score ?? 0), field: 'gdi_score' };
    aggregations.max_gdi = { type: 'max', value: Number(assetAggs._max.gdi_score ?? 0), field: 'gdi_score' };
    aggregations.min_gdi = { type: 'min', value: Number(assetAggs._min.gdi_score ?? 0), field: 'gdi_score' };
  }

  if (opts.include_suggestions && query.base_query) {
    const suggestions: SearchSuggestion[] = [];
    const prefix = query.base_query.toLowerCase();
    const assets = await db.asset.findMany({
      where: { name: { startsWith: prefix, mode: 'insensitive' }, status: 'published' },
      select: { name: true }, take: 5,
    });
    for (const a of assets) {
      suggestions.push({ type: 'completion', text: a.name, score: 1.0 });
    }
    return {
      items: results, total: totalCount, page, page_size: pageSize,
      total_pages: Math.ceil(totalCount / pageSize),
      query_time_ms: Date.now() - startMs,
      facets, aggregations, suggestions,
    };
  }

  return {
    items: results, total: totalCount, page, page_size: pageSize,
    total_pages: Math.ceil(totalCount / pageSize),
    query_time_ms: Date.now() - startMs,
    facets: opts.include_facets ? facets : undefined,
    aggregations: opts.include_aggregations ? aggregations : undefined,
  };
}

export function saveSearch(userId: string, name: string, query: AdvancedSearchQuery, description?: string): SavedSearch {
  const userSearches = Array.from(savedSearches.values()).filter(s => s.user_id === userId);
  if (userSearches.length >= ADVANCED_SEARCH_SAVED_SEARCH_LIMIT) {
    throw new ValidationError(`Max saved searches (${ADVANCED_SEARCH_SAVED_SEARCH_LIMIT}) reached`);
  }
  const saved: SavedSearch = {
    search_id: genId('ss'), user_id: userId, name,
    description, query, is_shared: false,
    use_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  savedSearches.set(saved.search_id, saved);
  return saved;
}

export function getSavedSearch(searchId: string): SavedSearch | null {
  const s = savedSearches.get(searchId);
  if (s) { s.use_count++; savedSearches.set(searchId, s); }
  return s ?? null;
}

export function getUserSavedSearches(userId: string): SavedSearch[] {
  return Array.from(savedSearches.values()).filter(s => s.user_id === userId);
}

export function deleteSavedSearch(searchId: string, userId: string): boolean {
  const s = savedSearches.get(searchId);
  if (!s || s.user_id !== userId) return false;
  return savedSearches.delete(searchId);
}

export function getSearchPresets(): SearchPreset[] { return presets; }
export function getSearchPreset(presetId: string): SearchPreset | undefined {
  return presets.find(p => p.preset_id === presetId);
}

export async function getSearchableFields(entityType: string): Promise<string[]> {
  return SEARCHABLE_FIELDS[entityType] ?? [];
}

export async function getSortableFields(entityType: string): Promise<string[]> {
  return SORTABLE_FIELDS[entityType] ?? [];
}

export function _resetTestState(): void { savedSearches.clear(); }
