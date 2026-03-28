/**
 * Anti-Hallucination Types
 * Chapter 28: Verification commands, trust anchors, error detection
 */

export type ValidationType = 'syntax' | 'unit_test' | 'linter' | 'integration' | 'benchmark' | 'security';

export interface ValidationCommand {
  type: ValidationType;
  command: string;
  timeout_seconds: number;
}

export interface ValidationResult {
  passed: boolean;
  type: ValidationType;
  output: string;
  error?: string;
  duration_ms: number;
  timestamp: string;
}

export interface AntiHallucinationResult {
  asset_id: string;
  overall_passed: boolean;
  confidence: number;           // 0.0 - 1.0
  validations: ValidationResult[];
  detected_hallucinations: HallucinationAlert[];
  forbidden_patterns_found: string[];
  timestamp: string;
}

export interface HallucinationAlert {
  type: 'invalid_api' | 'invalid_params' | 'style_issue' | 'logic_error' | 'security_risk';
  severity: 'low' | 'medium' | 'high';
  location?: string;
  description: string;
  suggested_fix?: string;
  confidence: number;
}

// Trust Anchor types
export type AnchorType = 'document' | 'test_suite' | 'history' | 'community' | 'onchain';

export interface TrustAnchor {
  type: AnchorType;
  name: string;
  description: string;
  verified_apis: string[];       // list of known-valid API names
  verified_patterns: string[];    // regex of valid code patterns
  source: string;                // e.g., "official_python_docs"
  last_updated: string;
}

export interface AnchorVerificationResult {
  anchor_type: AnchorType;
  matched: boolean;
  confidence: number;
  discrepancies: string[];
}

// Confidence decay model
export interface ConfidenceSnapshot {
  asset_id: string;
  initial_confidence: number;
  current_confidence: number;
  decay_factor: number;          // λ coefficient
  positive_count: number;
  negative_count: number;
  last_fetch_count: number;
  created_at: string;
  updated_at: string;
  projected_decay: DecayProjection[];
}

export interface DecayProjection {
  date: string;
  confidence: number;
}

export interface FeedbackHistory {
  positive_count: number;
  negative_count: number;
  fetch_count: number;
  last_positive_at?: string;
  last_negative_at?: string;
  last_fetch_at?: string;
}

// Validation config per gene category
export interface ValidationConfig {
  gene_id: string;
  required_validations: ValidationCommand[];
  forbidden_patterns: string[];
  max_execution_time: number;
  confidence_threshold: number;
}

// Error level classification
export type ErrorLevel = 'L1_syntax' | 'L2_semantic' | 'L3_hallucination' | 'L4_strategy';

export interface ErrorClassification {
  level: ErrorLevel;
  category: string;
  description: string;
  auto_correctable: boolean;
  suggested_correction?: string;
}
