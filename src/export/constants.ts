// Export module constants
export const EXPORT_CHUNK_SIZE = 500;
export const EXPORT_MAX_RECORDS = 100_000;
export const EXPORT_DEFAULT_LIMIT = 10_000;
export const EXPORT_JOB_TTL_HOURS = 24;
export const EXPORT_COMPRESSION_THRESHOLD_BYTES = 10_000_000;
export const EXPORT_EMAIL_MAX_SIZE_MB = 25;
export const EXPORT_WEBHOOK_TIMEOUT_MS = 30_000;
export const EXPORT_RETENTION_DAYS = 7;
export const EXPORT_MAX_CONCURRENT_JOBS = 5;
export const EXPORT_PROGRESS_UPDATE_INTERVAL_MS = 2_000;

export const EXPORT_FORMATS = ['csv', 'json', 'xlsx', 'xml'] as const;
export const EXPORT_ENTITIES = ['asset', 'node', 'gene', 'capsule', 'recipe', 'user', 'transaction'] as const;
export const EXPORT_DELIVERY_METHODS = ['download', 'email', 'webhook', 'storage'] as const;
export const EXPORT_RECURRENCE_OPTIONS = ['hourly', 'daily', 'weekly', 'monthly'] as const;

export const CSV_COLUMN_LIMIT = 500;
export const JSON_MAX_NESTING_DEPTH = 10;
export const XLSX_ROW_LIMIT = 1_048_576;

export const EXPORT_COMPRESSION_TYPES = {
  none: { extension: '', mime: 'application/octet-stream' },
  gzip: { extension: '.gz', mime: 'application/gzip' },
  zip: { extension: '.zip', mime: 'application/zip' },
} as const;

export const EXPORT_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['completed', 'failed', 'cancelled'],
  completed: ['expired'],
  failed: ['pending'], // retry
  expired: [],
  cancelled: [],
};

export const EXPORT_PERMISSIONS = {
  export_own_data: 'export:own_data',
  export_team_data: 'export:team_data',
  export_all_data: 'export:all_data',
  export_admin_reports: 'export:admin_reports',
  schedule_export: 'export:schedule',
  manage_export_templates: 'export:templates',
} as const;
