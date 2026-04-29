import type { AssetType, AssetStatus } from '../shared/types';

export type FeedbackType = 
  | 'general'
  | 'bug_report'
  | 'feature_request'
  | 'ui_feedback'
  | 'performance_feedback'
  | 'documentation_feedback';

export type FeedbackStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export type FeedbackCategory =
  | 'navigation'
  | 'map_interaction'
  | 'editor'
  | 'search'
  | 'marketplace'
  | 'community'
  | 'authentication'
  | 'performance'
  | 'other';

export interface UserFeedback {
  feedback_id: string;
  user_id: string | null;
  node_id: string | null;
  type: FeedbackType;
  rating: number | null;
  category: FeedbackCategory | null;
  title: string | null;
  content: string;
  metadata: FeedbackMetadata;
  status: FeedbackStatus;
  resolved_at: string | null;
  created_at: string;
}

export interface FeedbackMetadata {
  browser?: string;
  os?: string;
  page_url?: string;
  user_agent?: string;
  asset_id?: string;
  asset_type?: AssetType;
  session_id?: string;
  error_stack?: string;
  screenshots?: string[];
  [key: string]: unknown;
}

export interface CreateFeedbackInput {
  type?: FeedbackType;
  rating?: number;
  category?: FeedbackCategory;
  title?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ListFeedbackInput {
  type?: FeedbackType;
  status?: FeedbackStatus;
  category?: FeedbackCategory;
  limit?: number;
  offset?: number;
}

export interface UpdateFeedbackStatusInput {
  status: FeedbackStatus;
}

// UX Analytics Types
export type UxEventType =
  | 'page_view'
  | 'button_click'
  | 'form_submit'
  | 'search_query'
  | 'asset_publish'
  | 'asset_fork'
  | 'asset_download'
  | 'session_start'
  | 'session_end'
  | 'error_occurred';

export interface UxEvent {
  event_id: string;
  user_id: string | null;
  node_id: string | null;
  event_type: UxEventType;
  page: string | null;
  component: string | null;
  action: string | null;
  duration: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TrackEventInput {
  event_type: UxEventType;
  page?: string;
  component?: string;
  action?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface UxAnalyticsSummary {
  total_events: number;
  unique_users: number;
  unique_nodes: number;
  events_by_type: Record<UxEventType, number>;
  events_by_page: Record<string, number>;
  avg_session_duration: number;
  top_actions: Array<{ action: string; count: number }>;
  period_start: string;
  period_end: string;
}

export interface SessionMetric {
  metric_id: string;
  user_id: string | null;
  node_id: string | null;
  session_type: string;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  event_count: number;
  action_count: number;
  outcome: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateSessionMetricInput {
  session_type: string;
  user_id?: string;
  node_id?: string;
  metadata?: Record<string, unknown>;
}

export interface EndSessionMetricInput {
  outcome?: string;
  metadata?: Record<string, unknown>;
}
