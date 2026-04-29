// Advanced search module types
export type FilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'startsWith' | 'endsWith' | 'between' | 'exists' | 'regex';
export type LogicalOperator = 'AND' | 'OR' | 'NOT';

export interface SearchFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
  case_sensitive?: boolean;
}

export interface FilterGroup {
  logical_op: LogicalOperator;
  filters: (SearchFilter | FilterGroup)[];
}

export interface AdvancedSearchQuery {
  base_query?: string;
  filter_groups: FilterGroup[];
  entity_types: AdvancedEntityType[];
  sort: SortSpec[];
  pagination: PaginationSpec;
  options: SearchOptions;
}

export type AdvancedEntityType = 'asset' | 'node' | 'gene' | 'capsule' | 'recipe' | 'user' | 'transaction' | 'reputation_event' | 'credit_transaction';

export interface SortSpec {
  field: string;
  order: 'asc' | 'desc';
  nulls?: 'first' | 'last';
}

export interface PaginationSpec {
  page: number;
  page_size: number;
  offset?: number;
  cursor?: string;
  use_cursor?: boolean;
}

export interface SearchOptions {
  include_facets?: boolean;
  include_suggestions?: boolean;
  include_aggregations?: boolean;
  facet_limit?: number;
  min_score?: number;
  highlight_matches?: boolean;
  explain_score?: boolean;
  collapse_duplicates?: string;
  dedupe_by?: string;
  track_total_hits?: boolean;
  request_timeout_ms?: number;
}

export interface AdvancedSearchResult {
  items: AdvancedSearchItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  query_time_ms: number;
  facets?: Record<string, FacetBucket[]>;
  aggregations?: Record<string, AggregationResult>;
  suggestions?: SearchSuggestion[];
  highlights?: Record<string, SearchHighlight[]>;
  score_explanation?: ScoreExplanation;
}

export interface AdvancedSearchItem {
  id: string;
  entity_type: AdvancedEntityType;
  score: number;
  rank: number;
  data: Record<string, unknown>;
  highlights?: Record<string, string[]>;
  aggregations?: Record<string, unknown>;
}

export interface FacetBucket {
  value: string;
  label?: string;
  count: number;
  percentage?: number;
  is_selected?: boolean;
}

export interface AggregationResult {
  type: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'cardinality' | 'histogram' | 'percentiles';
  value: number | Record<string, number>;
  field: string;
}

export interface SearchSuggestion {
  type: 'term' | 'phrase' | 'completion' | 'correction';
  text: string;
  score: number;
  highlighted?: string;
}

export interface SearchHighlight {
  field: string;
  fragments: string[];
  pre_tag?: string;
  post_tag?: string;
}

export interface ScoreExplanation {
  max_score: number;
  score_breakdown: {
    component: string;
    contribution: number;
    details?: string;
  }[];
}

export interface SavedSearch {
  search_id: string;
  user_id: string;
  name: string;
  description?: string;
  query: AdvancedSearchQuery;
  is_shared: boolean;
  use_count: number;
  created_at: string;
  updated_at: string;
  last_run_at?: string;
}

export interface SearchPreset {
  preset_id: string;
  name: string;
  description: string;
  query: Partial<AdvancedSearchQuery>;
  category: 'analytics' | 'assets' | 'users' | 'system';
  requires_permission?: string;
}

export interface SearchIndex {
  index_id: string;
  name: string;
  entity_type: AdvancedEntityType;
  field_mappings: FieldMapping[];
  analyzer: string;
  document_count: number;
  size_bytes: number;
  last_indexed_at: string;
  status: 'active' | 'stale' | 'building' | 'error';
}

export interface FieldMapping {
  field: string;
  type: 'keyword' | 'text' | 'integer' | 'float' | 'boolean' | 'date' | 'array' | 'nested' | 'geo';
  searchable: boolean;
  filterable: boolean;
  sortable: boolean;
  aggregatable: boolean;
  analyzer?: string;
}

export interface SearchAlias {
  alias_id: string;
  name: string;
  target_index: string;
  filter?: FilterGroup;
  is_write_index: boolean;
}
