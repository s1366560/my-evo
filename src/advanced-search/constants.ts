// Advanced search module constants
export const ADVANCED_SEARCH_MAX_PAGE_SIZE = 500;
export const ADVANCED_SEARCH_DEFAULT_PAGE_SIZE = 20;
export const ADVANCED_SEARCH_MAX_QUERY_TIME_MS = 30_000;
export const ADVANCED_SEARCH_DEFAULT_QUERY_TIME_MS = 5_000;
export const ADVANCED_SEARCH_MAX_FACETS = 100;
export const ADVANCED_SEARCH_DEFAULT_FACET_LIMIT = 20;
export const ADVANCED_SEARCH_MIN_SCORE = 0.01;
export const ADVANCED_SEARCH_MAX_FILTER_GROUPS = 10;
export const ADVANCED_SEARCH_MAX_FILTERS_PER_GROUP = 50;
export const ADVANCED_SEARCH_MAX_SORT_FIELDS = 5;
export const ADVANCED_SEARCH_SAVED_SEARCH_LIMIT = 50;
export const ADVANCED_SEARCH_SUGGESTION_LIMIT = 10;
export const ADVANCED_SEARCH_HIGHLIGHT_FRAGMENT_SIZE = 150;
export const ADVANCED_SEARCH_HIGHLIGHT_FRAGMENT_COUNT = 3;
export const ADVANCED_SEARCH_INDEX_REFRESH_MS = 5_000;
export const ADVANCED_SEARCH_CURSOR_TTL_HOURS = 24;

export const FILTER_OPERATORS = [
  'eq', 'ne', 'gt', 'gte', 'lt', 'lte',
  'in', 'nin', 'contains', 'startsWith', 'endsWith',
  'between', 'exists', 'regex',
] as const;

export const LOGICAL_OPERATORS = ['AND', 'OR', 'NOT'] as const;

export const ENTITY_TYPES = [
  'asset', 'node', 'gene', 'capsule', 'recipe',
  'user', 'transaction', 'reputation_event', 'credit_transaction',
] as const;

export const SEARCH_OPTIONS_DEFAULTS = {
  include_facets: true,
  include_suggestions: false,
  include_aggregations: false,
  facet_limit: ADVANCED_SEARCH_DEFAULT_FACET_LIMIT,
  min_score: ADVANCED_SEARCH_MIN_SCORE,
  highlight_matches: false,
  explain_score: false,
  track_total_hits: true,
  request_timeout_ms: ADVANCED_SEARCH_DEFAULT_QUERY_TIME_MS,
} as const;

export const SEARCH_INDEX_STATUSES = ['active', 'stale', 'building', 'error'] as const;

export const SEARCH_PERMISSIONS = {
  search_all: 'search:all',
  search_public: 'search:public',
  search_team: 'search:team',
  save_search: 'search:save',
  use_advanced_filters: 'search:advanced',
  access_analytics: 'analytics:read',
} as const;

export const AGGREGATION_TYPES = ['sum', 'avg', 'min', 'max', 'count', 'cardinality', 'histogram', 'percentiles'] as const;

export const SEARCHABLE_FIELDS: Record<string, string[]> = {
  asset: ['name', 'description', 'signals', 'tags', 'author_id', 'status', 'gdi_score', 'downloads', 'rating', 'created_at', 'updated_at', 'carbon_cost'],
  node: ['node_id', 'model', 'status', 'reputation', 'credit_balance', 'last_seen', 'registered_at', 'trust_level'],
  gene: ['name', 'description', 'signals', 'author_id', 'status', 'gdi_score', 'carbon_cost'],
  capsule: ['name', 'description', 'author_id', 'status', 'gdi_score', 'carbon_cost'],
  recipe: ['name', 'description', 'author_id', 'status', 'gdi_score'],
  user: ['id', 'email', 'name', 'role', 'level', 'reputation', 'credits'],
  transaction: ['node_id', 'type', 'amount', 'description', 'created_at'],
  reputation_event: ['node_id', 'event_type', 'delta', 'reason', 'created_at'],
  credit_transaction: ['node_id', 'type', 'amount', 'description', 'created_at'],
};

export const SORTABLE_FIELDS: Record<string, string[]> = {
  asset: ['name', 'gdi_score', 'downloads', 'rating', 'created_at', 'updated_at', 'carbon_cost'],
  node: ['reputation', 'credit_balance', 'last_seen', 'registered_at'],
  gene: ['name', 'gdi_score', 'downloads', 'rating', 'created_at'],
  capsule: ['name', 'gdi_score', 'downloads', 'rating', 'created_at'],
  recipe: ['name', 'gdi_score', 'created_at'],
  user: ['name', 'reputation', 'credits', 'created_at'],
  transaction: ['created_at', 'amount'],
  reputation_event: ['created_at', 'delta'],
  credit_transaction: ['created_at', 'amount'],
};
