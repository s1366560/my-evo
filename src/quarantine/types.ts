/**
 * Quarantine Types
 */

export type QuarantineLevel = 'L1' | 'L2' | 'L3';
export type QuarantineReason = 
  | 'similarity_violation'
  | 'content_violation'
  | 'report_threshold'
  | 'manual';

export interface QuarantineRecord {
  node_id: string;
  level: QuarantineLevel;
  reason: QuarantineReason;
  started_at: number;
  expires_at?: number;
  auto_release_at?: number;
  violations: QuarantineViolation[];
  reputation_penalty: number;
  is_active: boolean;
}

export interface QuarantineViolation {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  detected_at: number;
  related_asset_ids?: string[];
}

export interface QuarantineStats {
  total_quarantined: number;
  by_level: { L1: number; L2: number; L3: number };
  average_recovery_time_ms: number;
  most_common_reason: QuarantineReason;
}

export interface RecoveryConfig {
  auto_release_after_ms: number;
  reputation_minimum_for_auto_release: number;
  max_L1_duration_ms: number;
  max_L2_duration_ms: number;
  max_L3_duration_ms: number;
}
