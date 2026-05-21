// Durable Verifier - type definitions
export type TaskStatus = 'PENDING' | 'VERIFYING' | 'PROGRESS' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
export type VerificationDimension = 'completeness' | 'consistency' | 'freshness' | 'preflight';
export type StorageBackend = 'json' | 'db' | 'both';
export const CHECKPOINT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const RESULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;
export interface PreflightCheck {
  check_id: string; kind: string; command?: string | null; required: boolean;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  evidence?: string | null; completed_at?: string | null;
}
export interface VerificationResult {
  dimension: VerificationDimension; passed: boolean; score: number; messages: string[];
  details?: Record<string, unknown>;
}
export interface ExecutionMetrics {
  duration_ms?: number; steps_completed?: number; total_steps?: number;
  memory_peak_mb?: number; cpu_time_ms?: number; network_requests?: number;
}
export interface CompletionReport {
  task_id: string; status: TaskStatus; summary: string;
  artifacts?: string[]; verifications?: string[];
  preflight_checklist?: PreflightCheck[];
  dependency_verification?: Record<string, boolean>;
  resource_validation?: Record<string, unknown>;
  execution_metrics?: ExecutionMetrics; error?: string | null; timestamp: string;
}
export interface TaskCheckpoint {
  task_id: string; status: TaskStatus; position: number; total: number; step: string;
  last_asset_id?: string | null; progress_pct: number;
  created_at: string; updated_at: string; expires_at: string;
  verifications?: VerificationResult[]; error?: string | null;
}
export interface StoredResult {
  task_id: string; checkpoint: TaskCheckpoint; report: CompletionReport;
  storage_backend: StorageBackend; persisted_at: string; checksum: string;
}
export interface ResumeResult { can_resume: boolean; checkpoint?: TaskCheckpoint; message: string; }
export interface VerificationContext {
  required_fields?: string[]; preflight_checks?: PreflightCheck[];
  max_timestamp_drift_ms?: number; expected_artifacts?: string[];
  leader_agent_id?: string; task_id?: string;
}
