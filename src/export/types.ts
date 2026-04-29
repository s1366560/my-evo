// Export module types
export type ExportFormat = 'csv' | 'json' | 'xlsx' | 'xml';
export type ExportEntityType = 'asset' | 'node' | 'gene' | 'capsule' | 'recipe' | 'user' | 'transaction';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired' | 'cancelled';
export type ExportDelivery = 'download' | 'email' | 'webhook' | 'storage';

export interface ExportJob {
  job_id: string;
  user_id: string;
  entity_type: ExportEntityType;
  format: ExportFormat;
  filters: ExportFilters;
  status: ExportStatus;
  record_count: number;
  file_size_bytes: number;
  file_path?: string;
  download_url?: string;
  delivery: ExportDelivery;
  delivery_target?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  expires_at?: string;
  error_message?: string;
  scheduled_recurrence?: ExportRecurrence;
  compression?: 'none' | 'gzip' | 'zip';
}

export interface ExportFilters {
  status?: string[];
  asset_type?: string[];
  signals?: string[];
  tags?: string[];
  author_id?: string;
  node_id?: string;
  min_gdi?: number;
  max_gdi?: number;
  date_from?: string;
  date_to?: string;
  reputation_min?: number;
  reputation_max?: number;
  search_query?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  include_metadata?: boolean;
  include_history?: boolean;
}

export interface ExportColumn {
  field: string;
  header: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  width?: number;
  align?: 'left' | 'center' | 'right';
  hidden?: boolean;
  formatter?: string;
}

export interface ExportTemplate {
  template_id: string;
  name: string;
  description: string;
  entity_type: ExportEntityType;
  format: ExportFormat;
  columns: ExportColumn[];
  filters: Partial<ExportFilters>;
  created_by: string;
  is_public: boolean;
  use_count: number;
}

export interface ExportRecurrence {
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  day_of_week?: number; // 0-6 for weekly
  day_of_month?: number; // 1-31 for monthly
  time_of_day?: string; // HH:mm
  retention_count?: number; // keep last N exports
}

export interface ExportPresets {
  daily_gdi_report: ExportTemplate;
  weekly_popular_genes: ExportTemplate;
  monthly_user_activity: ExportTemplate;
  on_demand_snapshot: ExportTemplate;
}

export interface ExportProgress {
  job_id: string;
  total_records: number;
  processed_records: number;
  percentage: number;
  current_phase: string;
  estimated_seconds_remaining?: number;
}

export interface ExportFieldMapping {
  [entityType: string]: {
    [format in ExportFormat]: ExportColumn[];
  };
}
