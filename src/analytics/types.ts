/**
 * Analytics Types - Hub Evolution Analytics
 * Chapter 25: Intent Drift Detection, Branching Analysis, Timeline Visualization
 */

import { Asset } from '../assets/types';

// ============ Intent Drift Types ============

export type DriftType = 'signal' | 'capability' | 'goal' | 'style';

export interface DriftReport {
  node_id: string;
  drift_score: number; // 0-1, higher = more drift
  threshold: number;
  status: 'normal' | 'drifting' | 'critical';
  drift_types: {
    signal_drift: number;
    capability_drift: number;
    goal_drift: number;
    style_drift: number;
  };
  top_drift_signals: string[]; // signals that changed most
  baseline_window: {
    start: string;
    end: string;
  };
  current_window: {
    start: string;
    end: string;
  };
  detected_at: string;
  recommendations: string[];
}

export interface SignalDistribution {
  [signal: string]: number; // probability 0-1
}

export interface NodeSignalHistory {
  node_id: string;
  signals: SignalDistribution;
  asset_count: number;
  timestamp: string;
}

// ============ Branching Analysis Types ============

export interface BranchingMetrics {
  total_branches: number;
  avg_branching_factor: number; // avg children per node
  deepest_path: {
    chain_id: string;
    depth: number;
    nodes: string[];
  };
  convergence_clusters: {
    cluster_id: string;
    members: number;
    avg_gdi: number;
    common_ancestor: string;
  }[];
  divergence_hotspots: {
    signal: string;
    branching_factor: number;
    status: 'low' | 'healthy' | 'high_diversity' | 'saturated';
  }[];
}

export interface EvolutionTree {
  root_id: string;
  nodes: {
    [nodeId: string]: {
      id: string;
      type: 'gene' | 'capsule' | 'event';
      parent_id?: string;
      children: string[];
      gdi_score: number;
      created_at: string;
    };
  };
}

// ============ Timeline Types ============

export type TimelineEventType =
  | 'registered'
  | 'asset_published'
  | 'asset_promoted'
  | 'asset_rejected'
  | 'asset_archived'
  | 'reputation_change'
  | 'validation_report'
  | 'council_proposal'
  | 'council_vote'
  | 'swarm_created'
  | 'swarm_completed'
  | 'penalty_applied'
  | 'tier_change';

export interface TimelineEvent {
  timestamp: string;
  event: TimelineEventType;
  description: string;
  details: Record<string, unknown>;
  asset_id?: string;
  delta?: number; // for reputation changes
}

export interface NodeTimeline {
  node_id: string;
  events: TimelineEvent[];
  summary: {
    total_events: number;
    most_active_day: string;
    top_signal: string;
    reputation_delta: number;
    assets_published: number;
    assets_promoted: number;
  };
}

// ============ Forecasting Types ============

export interface SignalForecast {
  signal: string;
  current_rank: number;
  predicted_rank: number;
  confidence: number; // 0-1
  driving_factors: string[];
  predicted_volume_change: number; // percentage
}

export interface ForecastResult {
  forecast_type: 'signal_hotspots' | 'gdi_trend' | 'collaboration_opportunity' | 'risk_alert';
  horizon: string; // e.g., "7d", "14d", "30d"
  predictions: (SignalForecast | GdiForecast | CollaborationOpportunity | RiskAlert)[];
  generated_at: string;
  model_version: string;
}

export interface GdiForecast {
  asset_id: string;
  current_gdi: number;
  predicted_gdi_7d: number;
  predicted_gdi_14d: number;
  predicted_gdi_30d: number;
  confidence: number;
  trend: 'rising' | 'stable' | 'declining';
}

export interface CollaborationOpportunity {
  node_a: string;
  node_b: string;
  complementary_signals: string[];
  potential_synergy: number; // 0-1
  recommended_action: string;
}

export interface RiskAlert {
  alert_id: string;
  type: 'reputation_decline' | 'asset_degradation' | 'quarantine_risk' | 'credit_exhaustion';
  target: string; // node_id or asset_id
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  recommendation: string;
  created_at: string;
}

// ============ Analytics Config ============

export interface AnalyticsConfig {
  drift_threshold: number; // default 0.15
  drift_window_days: number; // default 30
  forecast_horizon_days: number; // default 7
  branching_depth_limit: number; // default 10
}
