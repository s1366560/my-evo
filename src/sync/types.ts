// ===== Sync Types =====

export type SyncStatus = 'SYNCED' | 'SYNCING' | 'SYNC_ERROR' | 'QUARANTINE';
export type SyncStep = 'FETCH' | 'PUBLISH' | 'CLAIM' | 'CHECK';
export type SyncOperationType = 'full' | 'incremental' | 'delta' | 'resume';
export type ConflictStrategy = 'last_write_wins' | 'node_priority' | 'merge';
export type SyncPriority = 'low' | 'normal' | 'high';

export interface NodeSyncState {
  node_id: string;
  status: SyncStatus;
  last_sync_at: string;
  sync_count: number;
  error_count: number;
  next_sync_at: string;
}

export interface SyncOperation {
  sync_id: string;
  node_id: string;
  type: SyncOperationType;
  status: SyncStatus;
  started_at: string;
  completed_at?: string;
  items_synced: number;
  errors: string[];
}

export interface SyncCheckpoint {
  sync_id: string;
  position: number;
  total: number;
  last_asset_id?: string;
  step: SyncStep;
  created_at: string;
}

export interface IncrementalChange {
  asset_id: string;
  asset_type: string;
  change_type: 'create' | 'update' | 'delete';
  version: number;
  changed_at: string;
  content_hash: string;
}

export interface SyncDelta {
  node_id: string;
  changes: IncrementalChange[];
  last_sync_time: string;
  current_time: string;
  total_changes: number;
}

export interface ConflictRecord {
  asset_id: string;
  local_version: ChangeVersion;
  remote_version: ChangeVersion;
  detected_at: string;
  strategy: ConflictStrategy;
}

export interface ChangeVersion {
  version: number;
  updated_at: string;
  node_id: string;
  content_hash: string;
}

export interface SyncLogEntry {
  id: string;
  node_id: string;
  step: SyncStep;
  status: SyncStatus;
  items_synced: number;
  error?: string;
  synced_at: string;
}

export interface SyncMetrics {
  node_id: string;
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  average_items_per_sync: number;
  average_duration_ms: number;
  last_sync_duration_ms: number;
  last_successful_sync: string;
  sync_success_rate: number;
}

export interface SyncHistoryFilter {
  node_id: string;
  limit?: number;
  offset?: number;
  step?: SyncStep;
  status?: SyncStatus;
  from_date?: string;
  to_date?: string;
}

export interface SyncPattern {
  average_interval_ms: number;
  typical_sync_time: string;
  peak_sync_hour: number;
  activity_level: 'low' | 'medium' | 'high';
  suggested_interval_ms: number;
}

// ===== BullMQ Job Types =====

export interface SyncJobData {
  node_id: string;
  job_id: string;
  priority: SyncPriority;
  force?: boolean;
}

export interface SyncJobResult {
  success: boolean;
  sync_id: string;
  items_synced: number;
  errors: string[];
  duration_ms: number;
}

// ===== Scheduler Types =====

export interface ScheduledSync {
  job_id: string;
  node_id: string;
  interval_ms: number;
  next_run_at: string;
  is_active: boolean;
}

// ===== Service Types =====

export interface TriggerSyncResult {
  sync_id: string;
  status: SyncStatus;
  message: string;
}

export interface SyncStatusResult {
  node_id: string;
  status: SyncStatus;
  last_sync_at: string;
  next_sync_at: string;
  sync_count: number;
  error_count: number;
}
