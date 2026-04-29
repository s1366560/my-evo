// Batch operations module constants
export const BATCH_DEFAULT_CHUNK_SIZE = 50;
export const BATCH_MAX_CHUNK_SIZE = 500;
export const BATCH_DEFAULT_CONCURRENCY = 10;
export const BATCH_MAX_CONCURRENT_JOBS = 3;
export const BATCH_MAX_JOB_SIZE = 10_000;
export const BATCH_DEFAULT_TIMEOUT_MS = 300_000; // 5 min
export const BATCH_MAX_RETRY_ATTEMPTS = 3;
export const BATCH_RETRY_DELAY_MS = 5_000;
export const BATCH_PROGRESS_UPDATE_INTERVAL_MS = 1_000;
export const BATCH_ERROR_THRESHOLD_PERCENT = 0.5; // 50% error rate pauses job
export const BATCH_RESULT_RETENTION_DAYS = 7;
export const BATCH_MAX_SCHEDULED_JOBS = 20;
export const BATCH_WEBHOOK_TIMEOUT_MS = 10_000;

export const BATCH_OPERATION_TYPES = [
  'asset_bulk_update',
  'asset_bulk_delete',
  'asset_bulk_publish',
  'asset_bulk_archive',
  'node_bulk_reputation_update',
  'node_bulk_quarantine',
  'credit_bulk_transaction',
  'user_bulk_import',
  'user_bulk_export',
  'asset_bulk_tag',
  'asset_bulk_signal',
  'asset_bulk_transfer',
  'node_bulk_notify',
  'gdi_bulk_recalculate',
] as const;

export const BATCH_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const BATCH_CONCURRENCY_MODES = ['sequential', 'parallel', 'chunked'] as const;
export const BATCH_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled', 'paused'] as const;

export const BATCH_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['running', 'cancelled'],
  running: ['completed', 'failed', 'paused', 'cancelled'],
  completed: [],
  failed: ['pending', 'cancelled'],
  paused: ['running', 'cancelled'],
  cancelled: [],
};

export const BATCH_OPERATION_PERMISSIONS: Record<string, string[]> = {
  asset_bulk_update: ['asset:write'],
  asset_bulk_delete: ['asset:delete'],
  asset_bulk_publish: ['asset:publish'],
  asset_bulk_archive: ['asset:archive'],
  node_bulk_reputation_update: ['admin:reputation'],
  node_bulk_quarantine: ['admin:quarantine'],
  credit_bulk_transaction: ['credit:admin'],
  user_bulk_import: ['admin:user_import'],
  user_bulk_export: ['export:all_data'],
  asset_bulk_tag: ['asset:write'],
  asset_bulk_signal: ['asset:write'],
  asset_bulk_transfer: ['asset:transfer'],
  node_bulk_notify: ['admin:notify'],
  gdi_bulk_recalculate: ['admin:gdi'],
};

export const BATCH_ESTIMATED_DURATION_MS: Record<string, number> = {
  asset_bulk_update: 200,
  asset_bulk_delete: 100,
  asset_bulk_publish: 300,
  asset_bulk_archive: 200,
  node_bulk_reputation_update: 500,
  node_bulk_quarantine: 1000,
  credit_bulk_transaction: 150,
  user_bulk_import: 1000,
  user_bulk_export: 500,
  asset_bulk_tag: 100,
  asset_bulk_signal: 100,
  asset_bulk_transfer: 1000,
  node_bulk_notify: 50,
  gdi_bulk_recalculate: 2000,
};
