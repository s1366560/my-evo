/**
 * Memory Graph Types - Chapter 30
 * Semantic experience-reuse through Gene → Capsule → EvolutionEvent graph
 *
 * Implements:
 * - Graph nodes: Gene, Capsule, EvolutionEvent
 * - Semantic edges with relationship types
 * - Capability chain (capability replay through graph traversal)
 * - Confidence decay model
 */

import { Asset, Gene, Capsule, EvolutionEvent } from '../assets/types';

// ==================== Memory Graph Core ====================

export interface MemoryGraphNode {
  id: string;           // asset_id (SHA-256 content hash)
  type: 'Gene' | 'Capsule' | 'EvolutionEvent';
  signals: string[];     // signals this asset handles
  confidence: number;    // current confidence score (0.0 - 1.0)
  gdi?: number;          // GDI score
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryGraphEdge {
  from: string;          // source node id (asset_id)
  to: string;            // target node id (asset_id)
  relation: 'produced' | 'triggered' | 'references' | 'evolves_from' | 'derived_from' | 'bundled_with';
  weight: number;        // edge confidence/strength (0.0 - 1.0)
  created_at: string;
}

// ==================== Capability Chain ====================

export interface CapabilityChain {
  chain_id: string;
  nodes: ChainNode[];
  total_confidence: number;
  depth: number;
  signals: string[];
  created_at: string;
}

export interface ChainNode {
  asset_id: string;
  type: 'Gene' | 'Capsule' | 'EvolutionEvent';
  signals: string[];
  confidence: number;
  position: number;      // position in chain (0 = root)
}

// ==================== Query & Recall ====================

export interface RecallQuery {
  signals: string[];           // signals to match against
  min_confidence?: number;     // minimum confidence threshold
  min_gdi?: number;            // minimum GDI score
  limit?: number;              // max results (default 10)
  chain_id?: string;           // restrict to specific capability chain
  node_type?: 'Gene' | 'Capsule' | 'EvolutionEvent';
  decay_window_days?: number;  // focus on assets within this window
}

export interface RecallResult {
  asset_id: string;
  type: 'Gene' | 'Capsule' | 'EvolutionEvent';
  score: number;              // composite recall score
  signal_match: string[];      // which signals matched
  confidence: number;
  gdi?: number;
  relevance_reason: string;    // why this asset was recalled
  chain_id?: string;
  depth?: number;
}

// ==================== Confidence Decay ====================

export interface ConfidenceDecayParams {
  lambda: number;             // decay coefficient (default 0.015/day)
  half_life_days: number;     // half-life in days (default 30)
  positive_boost: number;     // boost per positive verification (default 0.05)
  negative_penalty: number;    // penalty per negative verification (default 0.15)
}

export interface ConfidenceRecord {
  asset_id: string;
  initial_confidence: number;  // C₀ at creation
  current_confidence: number;  // C(t)
  positive_count: number;      // number of positive verifications
  negative_count: number;      // number of negative verifications
  last_decay_at: string;       // ISO timestamp of last decay calculation
  last_verification_at?: string;
  history: ConfidenceHistoryEntry[];
}

export interface ConfidenceHistoryEntry {
  timestamp: string;
  event: 'decay' | 'positive_verification' | 'negative_verification' | 'published';
  delta: number;
  new_value: number;
}

// ==================== Sync ====================

export interface GraphSyncState {
  node_id: string;
  last_sync: string;
  last_successful_sync: string;
  sync_status: 'synced' | 'syncing' | 'sync_error' | 'quarantine';
  consecutive_failures: number;
  pending_nodes: number;
  pending_edges: number;
  sync_history: SyncHistoryEntry[];
}

export interface SyncHistoryEntry {
  timestamp: string;
  status: 'success' | 'failure';
  nodes_fetched: number;
  edges_updated: number;
  duration_ms: number;
}

// ==================== Ban Thresholds ====================

export interface BanThresholds {
  confidence_min: number;     // below this → candidate review (default 0.15)
  gdi_min: number;            // below this for 60 days → auto-depublish (default 25)
 举报_ratio_max: number;      // valid_reports / total_fetches > 5% → review (default 0.05)
  reputation_zero: number;     // node reputation = 0 → quarantine (default 0)
}

// Default constants
export const DEFAULT_DECAY_PARAMS: ConfidenceDecayParams = {
  lambda: 0.015,
  half_life_days: 30,
  positive_boost: 0.05,
  negative_penalty: 0.15,
};

export const DEFAULT_BAN_THRESHOLDS: BanThresholds = {
  confidence_min: 0.15,
  gdi_min: 25,
  举报_ratio_max: 0.05,
  reputation_zero: 0,
};
