// Batch operations module types
export type BatchOperationType =
  | 'asset_bulk_update'
  | 'asset_bulk_delete'
  | 'asset_bulk_publish'
  | 'asset_bulk_archive'
  | 'node_bulk_reputation_update'
  | 'node_bulk_quarantine'
  | 'credit_bulk_transaction'
  | 'user_bulk_import'
  | 'user_bulk_export'
  | 'asset_bulk_tag'
  | 'asset_bulk_signal'
  | 'asset_bulk_transfer'
  | 'node_bulk_notify'
  | 'gdi_bulk_recalculate';

export type BatchStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
export type BatchConcurrency = 'sequential' | 'parallel' | 'chunked';
export type BatchPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface BatchJob {
  job_id: string;
  user_id: string;
  operation_type: BatchOperationType;
  status: BatchStatus;
  priority: BatchPriority;
  concurrency: BatchConcurrency;
  total_items: number;
  processed_items: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
  item_ids: string[]; // IDs to process
  parameters: Record<string, unknown>;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  estimated_duration_ms?: number;
  actual_duration_ms?: number;
  error_log: BatchError[];
  warnings: BatchWarning[];
  can_rollback: boolean;
  rollback_job_id?: string;
  notification_email?: string;
  webhook_url?: string;
  result_summary?: BatchResultSummary;
}

export interface BatchError {
  item_id: string;
  error_code: string;
  error_message: string;
  timestamp: string;
  retryable: boolean;
}

export interface BatchWarning {
  item_id?: string;
  warning_code: string;
  warning_message: string;
  timestamp: string;
}

export interface BatchResultSummary {
  operation_type: BatchOperationType;
  total_processed: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
  affected_records: number;
  credits_deducted?: number;
  credits_credited?: number;
  execution_time_ms: number;
  rollback_available: boolean;
}

export interface BatchChunk {
  chunk_index: number;
  item_ids: string[];
  start_index: number;
  end_index: number;
}

export interface BatchProgress {
  job_id: string;
  status: BatchStatus;
  total_items: number;
  processed_items: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
  percentage: number;
  current_chunk?: BatchChunk;
  total_chunks: number;
  current_phase: string;
  estimated_seconds_remaining?: number;
  started_at: string;
  elapsed_ms: number;
}

export interface BatchSchedule {
  schedule_id: string;
  user_id: string;
  operation_type: BatchOperationType;
  cron_expression: string;
  parameters: Record<string, unknown>;
  is_enabled: boolean;
  last_run_at?: string;
  next_run_at?: string;
  total_runs: number;
  success_runs: number;
  failure_runs: number;
  created_at: string;
  updated_at: string;
}

export interface BatchConstraints {
  max_batch_size: number;
  max_concurrent_jobs: number;
  max_retry_attempts: number;
  retry_delay_ms: number;
  timeout_per_item_ms: number;
  pause_on_error_threshold: number;
}

export interface BatchTemplate {
  template_id: string;
  name: string;
  description: string;
  operation_type: BatchOperationType;
  default_parameters: Record<string, unknown>;
  required_permissions: string[];
  estimated_duration_per_item_ms: number;
}
