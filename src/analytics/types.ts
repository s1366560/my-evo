export type {
  DriftReport,
  DriftType,
  BranchingMetrics,
  ConvergenceCluster,
  DivergenceHotspot,
  TimelineEvent,
  TimelineEventType,
  SignalForecast,
  GdiForecast,
} from '../shared/types';

export interface RiskAlert {
  alert_id: string;
  node_id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  detected_at: string;
}
