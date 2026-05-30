export type { Metric, AlertRule } from '../shared/types';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    queue: ComponentHealth;
  };
  uptime_seconds: number;
  version: string;
}

export interface ComponentHealth {
  status: 'up' | 'down';
  latency_ms?: number;
  message?: string;
}

export interface MetricQuery {
  names?: string[];
  start?: string;
  end?: string;
  limit?: number;
  offset?: number;
}
