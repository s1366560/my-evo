/**
 * Sandbox Execution Queue — Type Definitions
 *
 * Defines all types for the sandbox execution queue system including:
 * - Job states and transitions
 * - Rate limiting configuration
 * - Concurrency control
 * - Execution timeouts
 */

export type JobStatus =
  | 'queued'
  | 'dequeued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled';

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

export interface QueueJob<T = unknown> {
  job_id: string;
  sandbox_id: string;
  node_id: string;
  payload: T;
  priority: JobPriority;
  status: JobStatus;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
  expires_at: Date;
  max_retries: number;
  retry_count: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface RateLimitConfig {
  /** Maximum jobs per node per window */
  maxJobsPerNode: number;
  /** Window duration in ms */
  windowMs: number;
  /** Maximum concurrent jobs per node */
  maxConcurrentPerNode: number;
  /** Maximum concurrent jobs across all nodes */
  maxConcurrentGlobal: number;
  /** Minimum interval between jobs from same node in ms */
  minJobIntervalMs: number;
}

export interface ConcurrencySlot {
  job_id: string;
  node_id: string;
  acquired_at: Date;
}

export interface ExecutionResult<T = unknown> {
  job_id: string;
  status: 'completed' | 'failed' | 'timeout';
  result?: T;
  error?: string;
  duration_ms: number;
  started_at: Date;
  completed_at: Date;
}

export interface QueueStats {
  total_queued: number;
  total_running: number;
  total_completed: number;
  total_failed: number;
  total_timeout: number;
  total_cancelled: number;
  by_priority: Record<JobPriority, number>;
  by_node: Record<string, number>;
  oldest_job_age_ms: number;
}

export interface ExecutionHandler<T = unknown, R = unknown> {
  (job: QueueJob<T>, signal: AbortSignal): Promise<R>;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxJobsPerNode: 10,
  windowMs: 60_000,
  maxConcurrentPerNode: 3,
  maxConcurrentGlobal: 50,
  minJobIntervalMs: 1_000,
};

export const DEFAULT_TIMEOUT_MS = 5 * 60_000; // 5 minutes
export const DEFAULT_MAX_RETRIES = 2;
export const PRIORITY_WEIGHTS: Record<JobPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};
