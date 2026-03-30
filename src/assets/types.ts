/**
 * Asset Types - Gene, Capsule, EvolutionEvent
 * Based on GEP specification v1.5
 */

// Asset states
export type AssetStatus = 'draft' | 'candidate' | 'promoted' | 'active' | 'rejected' | 'archived';
export type AssetType = 'Gene' | 'Capsule' | 'EvolutionEvent' | 'Mutation' | 'Recipe' | 'Organism';

// Constraint schema
export interface AssetConstraints {
  max_files?: number;
  forbidden_paths?: string[];
  max_lines?: number;
  timeout_seconds?: number;
  [key: string]: unknown;
}

// ==================== Gene ====================
export interface Gene {
  type: 'Gene';
  schema_version: string;
  id: string;
  category: 'repair' | 'optimize' | 'innovate' | 'collaborate' | 'govern';
  signals_match: string[];           // regex patterns or keywords
  preconditions?: string[];
  strategy: string[];                // execution steps
  constraints: AssetConstraints;
  validation?: string[];             // commands to validate
  epigenetic_marks?: string[];
  model_name?: string;
  asset_id: string;                  // SHA-256 content hash
  created_at: string;
  updated_at?: string;
}

// ==================== Capsule ====================
export interface Capsule {
  type: 'Capsule';
  schema_version: string;
  id: string;
  trigger: string[];
  gene: string;                      // source gene id
  summary: string;
  content: string;                   // code/content
  diff?: string;                     // unified diff
  strategy: string[];
  confidence: number;                 // 0.0 - 1.0
  blast_radius: {
    files: number;
    lines: number;
  };
  outcome: {
    status: 'success' | 'failure' | 'partial';
    score: number;
  };
  success_streak?: number;
  env_fingerprint: Record<string, unknown>;
  trigger_context?: {
    prompt?: string;
    agent_model?: string;
    [key: string]: unknown;
  };
  asset_id: string;
  created_at: string;
  updated_at?: string;
}

// ==================== EvolutionEvent ====================
export interface EvolutionEvent {
  type: 'EvolutionEvent';
  id: string;
  parent?: string;                   // previous event id
  intent: string;
  signals: string[];
  genes_used: string[];
  mutation_id?: string;
  blast_radius: {
    files: number;
    lines: number;
  };
  outcome: {
    status: 'success' | 'failure';
    score: number;
  };
  capsule_id?: string;
  source_type: 'generated' | 'reused' | 'reference';
  asset_id: string;
  created_at: string;
}

// ==================== Mutation ====================
export interface Mutation {
  type: 'Mutation';
  id: string;
  category: string;
  trigger_signals: string[];
  target: string;                    // gene:gene_id
  expected_effect: string;
  risk_level: 'low' | 'medium' | 'high';
  asset_id: string;
  created_at: string;
}

// ==================== Recipe ====================
export interface Recipe {
  type: 'Recipe';
  schema_version: string;
  id: string;
  name: string;
  genes: string[];                   // gene ids
  composition: 'sequential' | 'parallel' | 'pipeline';
  version: string;
  asset_id: string;
  created_at: string;
}

// ==================== Organism ====================
export interface Organism {
  type: 'Organism';
  schema_version: string;
  id: string;
  recipe_id: string;
  params: Record<string, unknown>;
  status: 'active' | 'paused' | 'completed';
  created_at: string;
  asset_id: string;
}

// ==================== Unified Asset ====================
export type Asset = Gene | Capsule | EvolutionEvent | Mutation | Recipe | Organism;

// ==================== Asset Bundle (for publishing) ====================
export interface AssetBundle {
  assets: Asset[];
  evolution_event?: EvolutionEvent;
}

// ==================== GDI Score ====================
export interface GDIScore {
  intrinsic: number;      // 35% - structural completeness, semantic quality
  usage: number;         // 30% - fetch count, reports
  social: number;        // 20% - votes, discussions
  freshness: number;     // 15% - time decay factor
  total: number;         // weighted sum
}

// ==================== Publish Result ====================
export interface PublishResult {
  status: 'candidate' | 'rejected';
  asset_ids: string[];
  carbon_cost: number;
  rejection_reasons?: string[];
  gdi_scores?: Record<string, GDIScore>;
}

// ==================== Fetch Query ====================
export interface FetchQuery {
  query?: string;                     // semantic search query
  type?: AssetType;
  category?: string;
  min_gdi?: number;
  min_intrinsic?: number;
  min_usage?: number;
  min_social?: number;
  signals?: string[];                  // match specific signals
  owner_id?: string;
  limit?: number;
  offset?: number;
  period?: 'day' | 'week' | 'month' | 'all';
}

// ==================== Fetch Result ====================
export interface FetchResult {
  assets: AssetWithScore[];
  total: number;
  query: FetchQuery;
}

// ==================== Asset With Score ====================
// AssetWithScore is Asset + metadata fields (not using extends due to union type)
export interface AssetWithScore {
  gdi?: GDIScore;
  owner_id?: string;
  status: AssetStatus;
  fetch_count?: number;
  report_count?: number;
  // All Asset fields:
  type: AssetType;
  asset_id: string;
  id: string;
  created_at: string;
  updated_at?: string;
  // Gene fields (may be present)
  category?: string;
  signals_match?: string[];
  preconditions?: string[];
  strategy?: string[];
  constraints?: AssetConstraints;
  validation?: string[];
  epigenetic_marks?: string[];
  model_name?: string;
  // Capsule fields
  trigger?: string[];
  gene?: string;
  summary?: string;
  content?: string;
  diff?: string;
  confidence?: number;
  blast_radius?: { files: number; lines: number };
  outcome?: { status: string; score: number };
  success_streak?: number;
  env_fingerprint?: Record<string, unknown>;
  trigger_context?: Record<string, unknown>;
  // EvolutionEvent fields
  parent?: string;
  intent?: string;
  genes_used?: string[];
  mutation_id?: string;
  capsule_id?: string;
  source_type?: 'generated' | 'reused' | 'reference';
  // Mutation fields
  risk_level?: 'low' | 'medium' | 'high';
  target?: string;
  expected_effect?: string;
  // Recipe fields
  name?: string;
  genes?: string[];
  composition?: 'sequential' | 'parallel' | 'pipeline';
  version?: string;
  // Organism fields
  recipe_id?: string;
  params?: Record<string, unknown>;
}

// ==================== Review ====================
export type ReviewVote = 'up' | 'down';

export interface Review {
  id: string;
  asset_id: string;
  reviewer_id: string;
  rating: number;              // 1-5 stars
  title?: string;
  body?: string;
  vote: ReviewVote;
  use_case?: string;           // what the reviewer used it for
  created_at: string;
  updated_at?: string;
}

export interface ReviewSummary {
  asset_id: string;
  avg_rating: number;          // 1-5
  total_reviews: number;
  up_votes: number;
  down_votes: number;
  rating_distribution: Record<number, number>; // star -> count
}

// ==================== Validation Report ====================
export interface ValidationReport {
  asset_id: string;
  outcome: {
    status: 'success' | 'failure';
    score: number;
  };
  usage_context?: string;
  reported_by?: string;
  created_at: string;
}

// ==================== Asset Store Record ====================
export interface AssetRecord {
  asset: Asset;
  status: AssetStatus;
  owner_id: string;
  gdi?: GDIScore;
  fetch_count: number;
  report_count: number;
  published_at: string;
  updated_at: string;
  rejected_at?: string;
  archived_at?: string;
  version: number;
  last_fetched_at?: string;   // For period-based trending
}
