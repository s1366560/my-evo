/**
 * Worker Pool Types
 * Phase 3-4: Worker Pool Engine for distributed task execution
 *
 * Worker Pool enables:
 * - Active Workers: actively bid on bounties
 * - Passive Workers: register capabilities, wait for system-assigned tasks
 * - Specialist Pools: workers grouped by domain/skill tags
 */

// Worker type enum
export type WorkerType = 'active' | 'passive' | 'specialist';

// Worker registration in the pool
export interface WorkerPoolWorker {
  worker_id: string;          // node_id of the worker
  type: WorkerType;
  skills: string[];          // e.g. ['python', 'api', 'legal', 'finance']
  domain?: string;            // specialist domain label
  reputation_score: number;   // snapshot from reputation engine
  avg_response_time_ms: number;
  task_history: WorkerTaskHistory[];
  registered_at: string;
  last_active_at: string;
  max_concurrent_tasks: number;  // max parallel tasks
  current_load: number;          // currently running tasks
  is_available: boolean;
  tier: WorkerTier;
}

// Track historical performance per worker
export interface WorkerTaskHistory {
  task_id: string;
  task_type: string;
  outcome: 'success' | 'failed' | 'partial';
  completed_at: string;
  score?: number;            // quality score 0-1
  response_time_ms: number;
}

// Specialist pool - workers grouped by domain
export interface SpecialistPool {
  domain: string;             // e.g. 'legal', 'finance', 'code'
  workers: Set<string>;       // worker_ids
  task_queue: SpecialistTask[];
  created_at: string;
  total_tasks_completed: number;
  avg_quality_score: number;
}

// A task submitted to a specialist pool
export interface SpecialistTask {
  task_id: string;
  domain: string;
  description: string;
  required_skills: string[];
  bounty?: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline?: string;
  created_at: string;
  assigned_to?: string;
  status: 'queued' | 'assigned' | 'in_progress' | 'completed' | 'failed';
}

// Worker assignment record
export interface WorkerAssignment {
  assignment_id: string;
  task_id: string;
  worker_id: string;
  pool_type: 'specialist' | 'bounty' | 'swarm';
  assigned_at: string;
  started_at?: string;
  completed_at?: string;
  outcome?: 'success' | 'failed' | 'partial';
  quality_score?: number;
  response_time_ms?: number;
}

// Worker pool statistics
export interface WorkerPoolStats {
  total_workers: number;
  active_workers: number;
  passive_workers: number;
  specialist_workers: number;
  total_assignments: number;
  assignments_by_domain: Record<string, number>;
  avg_quality_score: number;
  avg_response_time_ms: number;
  top_domains: Array<{ domain: string; worker_count: number; tasks_completed: number }>;
}

// Match score for task-worker pairing
export interface WorkerMatchScore {
  worker_id: string;
  task_id: string;
  skill_match_score: number;      // 0-1
  success_rate_score: number;     // 0-1
  response_time_score: number;     // 0-1
  reputation_score: number;        // 0-1
  final_match_score: number;       // weighted sum
  is_available: boolean;
}

// Weights for match scoring (sum = 1.0)
export const WORKER_MATCH_WEIGHTS = {
  skill_match: 0.30,
  success_rate: 0.25,
  response_time: 0.20,
  reputation: 0.15,
  // price competitiveness: 0.10 (implicit via task bounty affinity)
} as const;

// Worker tier based on reputation
export type WorkerTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export const WORKER_TIER_THRESHOLDS = {
  platinum: 90,
  gold: 75,
  silver: 50,
  bronze: 0,
} as const;

// Default limits
export const DEFAULT_MAX_CONCURRENT_TASKS = 3;
export const WORKER_INACTIVE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
