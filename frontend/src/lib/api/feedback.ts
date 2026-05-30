/**
 * Feedback API Client
 * 
 * Provides methods for:
 * - Submitting user feedback
 * - Tracking UX events
 * - Managing session metrics
 */

import { apiClient } from './client';

export interface UserFeedback {
  feedback_id: string;
  user_id: string | null;
  node_id: string | null;
  type: 'general' | 'bug_report' | 'feature_request' | 'ui_feedback' | 'performance_feedback' | 'documentation_feedback';
  rating: number | null;
  category: string | null;
  title: string | null;
  content: string;
  metadata: Record<string, unknown>;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  resolved_at: string | null;
  created_at: string;
}

export interface CreateFeedbackInput {
  type?: UserFeedback['type'];
  rating?: number;
  category?: string;
  title?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface FeedbackStats {
  total: number;
  pending: number;
  reviewed: number;
  resolved: number;
  avg_rating: number | null;
  by_type: Record<string, number>;
  by_category: Record<string, number>;
}

export interface UxEvent {
  event_id: string;
  user_id: string | null;
  node_id: string | null;
  event_type: string;
  page: string | null;
  component: string | null;
  action: string | null;
  duration: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TrackEventInput {
  event_type: string;
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
  events_by_type: Record<string, number>;
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

// ── Feedback API ─────────────────────────────────────────────────────────────

export async function submitFeedback(input: CreateFeedbackInput): Promise<{ feedback_id: string; created_at: string }> {
  const response = await apiClient.post<{ success: boolean; feedback_id: string; created_at: string }>(
    '/api/v2/feedback/feedback',
    input,
  );
  return {
    feedback_id: response.feedback_id,
    created_at: response.created_at,
  };
}

export async function getFeedbackStats(): Promise<FeedbackStats> {
  const response = await apiClient.get<{ success: boolean; stats: FeedbackStats }>(
    '/api/v2/feedback/feedback/stats',
  );
  return response.stats;
}

export async function listFeedback(filters?: {
  type?: string;
  status?: string;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: UserFeedback[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.type) params.set('type', filters.type);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  
  const query = params.toString();
  const response = await apiClient.get<{ success: boolean; feedback: UserFeedback[]; total: number }>(
    `/api/v2/feedback/feedback${query ? `?${query}` : ''}`,
  );
  return { items: response.feedback, total: response.total };
}

// ── UX Event API ─────────────────────────────────────────────────────────────

export async function trackEvent(input: TrackEventInput): Promise<{ event_id: string }> {
  const response = await apiClient.post<{ success: boolean; event_id: string }>(
    '/api/v2/feedback/events/track',
    input,
  );
  return { event_id: response.event_id };
}

export async function getUxAnalytics(days: number = 7): Promise<UxAnalyticsSummary> {
  const response = await apiClient.get<{ success: boolean; analytics: UxAnalyticsSummary }>(
    `/api/v2/feedback/analytics/ux?days=${days}`,
  );
  return response.analytics;
}

export async function listUxEvents(filters?: {
  event_type?: string;
  user_id?: string;
  node_id?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: UxEvent[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.event_type) params.set('event_type', filters.event_type);
  if (filters?.user_id) params.set('user_id', filters.user_id);
  if (filters?.node_id) params.set('node_id', filters.node_id);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  
  const query = params.toString();
  const response = await apiClient.get<{ success: boolean; events: UxEvent[]; total: number }>(
    `/api/v2/feedback/events${query ? `?${query}` : ''}`,
  );
  return { items: response.events, total: response.total };
}

// ── Session Metrics API ──────────────────────────────────────────────────────

export async function startSessionMetric(
  session_type: string,
  metadata?: Record<string, unknown>,
): Promise<{ metric_id: string; start_time: string }> {
  const response = await apiClient.post<{ success: boolean; metric_id: string; start_time: string }>(
    '/api/v2/feedback/sessions/start',
    { session_type, metadata },
  );
  return {
    metric_id: response.metric_id,
    start_time: response.start_time,
  };
}

export async function updateSessionMetric(
  metricId: string,
  updates: {
    event_count_increment?: number;
    action_count_increment?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<SessionMetric> {
  const response = await apiClient.patch<{ success: boolean; metric: SessionMetric }>(
    `/api/v2/feedback/sessions/${metricId}`,
    updates,
  );
  return response.metric;
}

export async function endSessionMetric(
  metricId: string,
  input?: {
    outcome?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<SessionMetric> {
  const response = await apiClient.post<{ success: boolean; metric: SessionMetric }>(
    `/api/v2/feedback/sessions/${metricId}/end`,
    input ?? {},
  );
  return response.metric;
}

export async function listSessionMetrics(filters?: {
  session_type?: string;
  user_id?: string;
  outcome?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: SessionMetric[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.session_type) params.set('session_type', filters.session_type);
  if (filters?.user_id) params.set('user_id', filters.user_id);
  if (filters?.outcome) params.set('outcome', filters.outcome);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  
  const query = params.toString();
  const response = await apiClient.get<{ success: boolean; sessions: SessionMetric[]; total: number }>(
    `/api/v2/feedback/sessions${query ? `?${query}` : ''}`,
  );
  return { items: response.sessions, total: response.total };
}

// ── React Hooks for Feedback ─────────────────────────────────────────────────

export function createFeedbackTracker() {
  let currentMetricId: string | null = null;
  
  return {
    async startSession(session_type: string, metadata?: Record<string, unknown>) {
      const result = await startSessionMetric(session_type, metadata);
      currentMetricId = result.metric_id;
      return result;
    },
    
    async trackPageView(page: string, metadata?: Record<string, unknown>) {
      return trackEvent({ event_type: 'page_view', page, metadata });
    },
    
    async trackButtonClick(component: string, action: string, metadata?: Record<string, unknown>) {
      return trackEvent({ event_type: 'button_click', component, action, metadata });
    },
    
    async trackFormSubmit(page: string, formName: string, metadata?: Record<string, unknown>) {
      return trackEvent({ event_type: 'form_submit', page, action: formName, metadata });
    },
    
    async trackSearch(page: string, query: string, resultCount?: number) {
      return trackEvent({
        event_type: 'search_query',
        page,
        action: query,
        metadata: resultCount !== undefined ? { resultCount } : undefined,
      });
    },
    
    async trackAssetAction(action: 'publish' | 'fork' | 'download', assetId: string, metadata?: Record<string, unknown>) {
      return trackEvent({
        event_type: `asset_${action}`,
        action: assetId,
        metadata,
      });
    },
    
    async updateSession(eventIncrement: number = 1, actionIncrement: number = 0) {
      if (currentMetricId) {
        return updateSessionMetric(currentMetricId, {
          event_count_increment: eventIncrement,
          action_count_increment: actionIncrement,
        });
      }
    },
    
    async endSession(outcome?: string, metadata?: Record<string, unknown>) {
      if (currentMetricId) {
        const result = await endSessionMetric(currentMetricId, { outcome, metadata });
        currentMetricId = null;
        return result;
      }
    },
  };
}
