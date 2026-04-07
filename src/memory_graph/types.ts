import type { Prisma } from '@prisma/client';

// ------------------------------------------------------------------
// Core types mirroring Prisma models
// ------------------------------------------------------------------

export type NodeType = 'gene' | 'capsule' | 'evolution_event' | 'recipe' | 'organism';

export type EdgeRelation =
  | 'produced'
  | 'triggered'
  | 'references'
  | 'evolves_from'
  | 'derived_from'
  | 'bundled_with';

export type ConfidenceGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

// ------------------------------------------------------------------
// Memory Graph Node
// ------------------------------------------------------------------

export interface MemoryGraphNode {
  node_id: string;
  type: NodeType;
  label: string;
  positive: number;
  negative: number;
  usage_count: number;
  confidence: number;
  gdi_score: number;
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface MemoryGraphNodeRecord {
  node_id: string;
  type: string;
  label: string;
  positive: number;
  negative: number;
  usage_count: number;
  confidence: number;
  gdi_score: number;
  metadata: Prisma.JsonValue | null;
  created_at: Date;
  updated_at: Date;
}

// ------------------------------------------------------------------
// Memory Graph Edge
// ------------------------------------------------------------------

export interface MemoryGraphEdge {
  source_id: string;
  target_id: string;
  relation: EdgeRelation;
  weight: number;
  created_at: Date;
}

export interface MemoryGraphEdgeRecord {
  source_id: string;
  target_id: string;
  relation: string;
  weight: number;
  created_at: Date;
}

// ------------------------------------------------------------------
// Confidence Decay
// ------------------------------------------------------------------

export interface ConfidenceDecayParams {
  lambda: number; // default 0.015
  half_life_days: number; // default 30
  positive_boost: number; // default 0.05
  negative_penalty: number; // default 0.15
  floor: number; // minimum confidence, default 0.05
}

export interface ConfidenceRecord {
  asset_id: string;
  current: number;
  initial: number;
  grade: ConfidenceGrade;
  last_decay_at: string;
  positive_signals: number;
  negative_signals: number;
  history: Array<{
    timestamp: string;
    value: number;
    reason: string;
  }>;
}

export interface DecayInput {
  initialConfidence: number;
  daysSinceUpdate: number;
  positiveCount: number;
  negativeCount: number;
  params?: Partial<ConfidenceDecayParams>;
}

// ------------------------------------------------------------------
// Inference Engine
// ------------------------------------------------------------------

export interface InferredCapability {
  capability: string;
  confidence: number;
  evidence: string[];
  source_nodes: string[];
}

export interface InteractionResult {
  node_id: string;
  outcome: 'success' | 'failure' | 'neutral';
  weight_delta?: number;
  timestamp?: string;
}

export interface PropagationResult {
  node_id: string;
  depth: number;
  effective_confidence: number;
  propagated: boolean;
}

// ------------------------------------------------------------------
// Gene Link
// ------------------------------------------------------------------

export interface GeneMemoryLink {
  gene_id: string;
  memory_node_id: string;
  link_type: 'defines' | 'references' | 'bundled';
  strength: number;
  linked_at: string;
}

export interface GeneCapabilitySuggestion {
  capability: string;
  confidence: number;
  basis: string;
}

// ------------------------------------------------------------------
// Capability Chain
// ------------------------------------------------------------------

export interface CapabilityChain {
  chain_id: string;
  root_asset_id: string;
  chain: string[];
  total_evolution_steps: number;
  constructed_at: Date;
}

export interface CapabilityChainRecord {
  chain_id: string;
  root_asset_id: string;
  chain: string[];
  total_evolution_steps: number;
  constructed_at: Date;
}

export interface ChainEvaluation {
  chain_id: string;
  strength: number;
  grade: ConfidenceGrade;
  weakest_link: string;
  total_weight: number;
  avg_weight: number;
  recommendations: string[];
}

// ------------------------------------------------------------------
// Recall
// ------------------------------------------------------------------

export interface RecallQuery {
  query: string;
  node_id?: string;
  filters?: {
    type?: NodeType[];
    min_confidence?: number;
    min_gdi?: number;
    tags?: string[];
  };
  limit?: number;
}

export interface RecallResult {
  asset_id: string;
  type: NodeType;
  label: string;
  score: number;
  confidence: number;
  gdi: number;
  snippet?: string;
  chain_depth?: number;
}

// ------------------------------------------------------------------
// Ban
// ------------------------------------------------------------------

export interface BanThresholds {
  confidence_min: number; // default 0.15
  gdi_min: number; // default 25
  report_ratio_max: number; // default 0.05
}

export interface BanCheckResult {
  node_id: string;
  should_ban: boolean;
  confidence_ok: boolean;
  gdi_ok: boolean;
  report_ratio_ok: boolean;
  reasons: string[];
}

// ------------------------------------------------------------------
// Graph Stats
// ------------------------------------------------------------------

export interface GraphStats {
  total_nodes: number;
  total_edges: number;
  node_types: Record<string, number>;
  edge_types: Record<string, number>;
  avg_confidence: number;
  avg_gdi: number;
  chains_count: number;
}

// ------------------------------------------------------------------
// Lineage
// ------------------------------------------------------------------

export interface LineageEntry {
  asset_id: string;
  depth: number;
  parent: string | null;
  relation: EdgeRelation | null;
}

export interface LineageResult {
  root: string;
  lineage: LineageEntry[];
  total_depth: number;
  chain_id: string;
}
