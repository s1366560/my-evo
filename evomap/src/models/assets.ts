/**
 * EvoMap GEP Protocol - Asset Data Models
 * Based on evomap-architecture-v5.md Chapter 2
 */

import { ASSET_TYPES, ASSET_STATES, type AssetType, type AssetState } from '../core/constants.js';

// Base Asset interface
export interface BaseAsset {
  asset_id?: string; // Optional - set after computing hash
  created_at: string;
  updated_at: string;
  owner_id: string;
  status: AssetState;
}

// Gene - Reusable evolution strategy
export interface Gene extends BaseAsset {
  type: typeof ASSET_TYPES.GENE;
  signals_match: string[]; // Signals this gene matches
  strategy: {
    approach: string;
    constraints?: string[];
    triggers?: string[];
  };
  validation?: {
    validated_at?: string;
    validated_by?: string;
    confidence?: number; // 0.0 - 1.0
  };
  metadata?: {
    name?: string;
    description?: string;
    tags?: string[];
    version?: string;
  };
}

// Capsule - Verified fix/solution
export interface Capsule extends BaseAsset {
  type: typeof ASSET_TYPES.CAPSULE;
  trigger: {
    error_pattern?: string;
    signals?: string[];
    description: string;
  };
  gene_ref?: string; // Reference to parent Gene
  diff: {
    files: Array<{
      path: string;
      operation: 'create' | 'update' | 'delete';
      content?: string;
    }>;
  };
  confidence: number; // 0.0 - 1.0
  blast_radius: {
    files: number;
    lines: number;
    scope: 'local' | 'global';
  };
  validation?: {
    score: number; // >= 0.7
    validated_at?: string;
    validated_by?: string;
  };
  invocation_count?: number;
  success_rate?: number;
}

// EvolutionEvent - Complete audit trail
export interface EvolutionEvent extends BaseAsset {
  type: typeof ASSET_TYPES.EVOLUTION_EVENT;
  capsule_id: string;
  parent_id?: string; // Previous evolution
  intent: string;
  genes_used: string[];
  outcome: {
    status: 'success' | 'failure' | 'partial';
    feedback?: string;
  };
  validation_report?: {
    validated: boolean;
    confidence: number;
    notes?: string;
  };
}

// Mutation - Variation declaration
export interface Mutation extends BaseAsset {
  type: typeof ASSET_TYPES.MUTATION;
  parent_asset_id: string;
  variation_type: 'repair' | 'optimize' | 'innovate';
  risk_assessment: {
    level: 'low' | 'medium' | 'high';
    potential_impact?: string;
  };
  proposed_changes: Record<string, unknown>;
}

// ValidationReport - Verification result
export interface ValidationReport extends BaseAsset {
  type: typeof ASSET_TYPES.VALIDATION_REPORT;
  asset_id: string;
  validation_result: {
    passed: boolean;
    score: number;
    checks: Array<{
      name: string;
      passed: boolean;
      details?: string;
    }>;
  };
  validator_id: string;
  validated_at: string;
}

// Recipe - Composable gene pipeline
export interface Recipe extends BaseAsset {
  type: typeof ASSET_TYPES.RECIPE;
  genes: string[]; // Gene IDs in order
  constraints?: {
    max_iterations?: number;
    timeout?: number;
    preconditions?: string[];
    postconditions?: string[];
  };
  version: string;
  previous_versions?: string[]; // Recipe IDs
}

// Organism - Executable instance of Recipe
export interface Organism extends BaseAsset {
  type: typeof ASSET_TYPES.ORGANISM;
  recipe_id: string;
  execution_state: {
    current_step: number;
    total_steps: number;
    status: 'running' | 'paused' | 'completed' | 'failed';
  };
  checkpoint_id?: string;
  results?: Record<string, unknown>;
}

// Bundle - Collection of assets for publishing
export interface Bundle {
  protocol: 'gep-a2a';
  message_type: string;
  sender_id: string;
  payload: {
    assets: Array<Gene | Capsule | EvolutionEvent | Mutation | ValidationReport | Recipe | Organism>;
  };
}

// Type guards
export function isGene(asset: BaseAsset): asset is Gene {
  return 'type' in asset && asset.type === ASSET_TYPES.GENE;
}

export function isCapsule(asset: BaseAsset): asset is Capsule {
  return 'type' in asset && asset.type === ASSET_TYPES.CAPSULE;
}

export function isEvolutionEvent(asset: BaseAsset): asset is EvolutionEvent {
  return 'type' in asset && asset.type === ASSET_TYPES.EVOLUTION_EVENT;
}

export function isMutation(asset: BaseAsset): asset is Mutation {
  return 'type' in asset && asset.type === ASSET_TYPES.MUTATION;
}

export function isValidationReport(asset: BaseAsset): asset is ValidationReport {
  return 'type' in asset && asset.type === ASSET_TYPES.VALIDATION_REPORT;
}

export function isRecipe(asset: BaseAsset): asset is Recipe {
  return 'type' in asset && asset.type === ASSET_TYPES.RECIPE;
}

export function isOrganism(asset: BaseAsset): asset is Organism {
  return 'type' in asset && asset.type === ASSET_TYPES.ORGANISM;
}

// Asset factory functions
export function createGene(partial: Partial<Gene> & Pick<Gene, 'owner_id' | 'signals_match' | 'strategy'>): Gene {
  const now = new Date().toISOString();
  return {
    type: ASSET_TYPES.GENE,
    created_at: now,
    updated_at: now,
    status: ASSET_STATES.DRAFT,
    ...partial,
  };
}

export function createCapsule(partial: Partial<Capsule> & Pick<Capsule, 'owner_id' | 'trigger' | 'diff' | 'confidence' | 'blast_radius'>): Capsule {
  const now = new Date().toISOString();
  return {
    type: ASSET_TYPES.CAPSULE,
    created_at: now,
    updated_at: now,
    status: ASSET_STATES.DRAFT,
    ...partial,
  };
}

export function createEvolutionEvent(partial: Partial<EvolutionEvent> & Pick<EvolutionEvent, 'owner_id' | 'capsule_id' | 'intent' | 'genes_used' | 'outcome'>): EvolutionEvent {
  const now = new Date().toISOString();
  return {
    type: ASSET_TYPES.EVOLUTION_EVENT,
    created_at: now,
    updated_at: now,
    status: ASSET_STATES.PUBLISHED,
    ...partial,
  };
}
