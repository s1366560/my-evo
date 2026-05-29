/**
 * Swarm Module Types
 * Multi-agent swarm coordination - task orchestration, agent dispatch, result aggregation.
 *
 * Design Notes:
 * - SwarmTask represents a collaborative goal assigned to multiple agents
 * - Subtasks are individual work units assigned to specific agents
 * - Results are aggregated when all subtasks complete
 */

// Swarm task status enum
export type SwarmTaskStatus =
  | 'pending'    // Created, not yet started
  | 'recruiting' // Recruiting agents
  | 'running'    // Agents working on subtasks
  | 'in_progress' // Subtasks actively being executed
  | 'aggregating' // Aggregating results
  | 'completed'  // Successfully completed
  | 'failed';    // Failed or timed out

// Subtask status enum
export type SubtaskStatus = 'pending' | 'assigned' | 'completed' | 'failed';

// ============================================================
// API Request/Response Types
// ============================================================

/** GET /api/v2/swarm/tasks - List all swarm tasks */
export interface ListSwarmTasksResponse {
  success: boolean;
  swarms: SwarmTaskSummary[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/** GET /api/v2/swarm/tasks/:swarmId - Get task details */
export interface GetSwarmTaskResponse {
  success: boolean;
  swarm: SwarmTaskDetail;
  subtasks: SubtaskDetail[];
}

/** POST /api/v2/swarm/tasks - Create a new swarm task */
export interface CreateSwarmTaskRequest {
  title: string;
  description: string;
  timeout_ms?: number;
  worker_count?: number;
}

export interface CreateSwarmTaskResponse {
  success: boolean;
  swarm: SwarmTaskDetail;
  message: string;
}

/** POST /api/v2/swarm/tasks/:swarmId/subtasks - Create subtask */
export interface CreateSubtaskRequest {
  title: string;
  description: string;
  assigned_to?: string;
}

export interface CreateSubtaskResponse {
  success: boolean;
  subtask: SubtaskDetail;
  message: string;
}

/** POST /api/v2/swarm/tasks/:swarmId/subtasks/:subtaskId/complete - Complete subtask */
export interface CompleteSubtaskRequest {
  result: string;
}

export interface CompleteSubtaskResponse {
  success: boolean;
  subtask: SubtaskDetail;
  swarm_status: SwarmTaskStatus;
  message: string;
}

/** POST /api/v2/swarm/tasks/:swarmId/complete - Complete swarm task */
export interface CompleteSwarmTaskRequest {
  aggregated_output: string;
  quality_score?: number;
}

export interface CompleteSwarmTaskResponse {
  success: boolean;
  swarm: SwarmTaskDetail;
  message: string;
}

/** POST /api/v2/swarm/tasks/:swarmId/fail - Mark swarm as failed */
export interface FailSwarmTaskRequest {
  reason: string;
}

export interface FailSwarmTaskResponse {
  success: boolean;
  swarm: SwarmTaskDetail;
  message: string;
}

// ============================================================
// Domain Types
// ============================================================

/** Swarm task summary for list views */
export interface SwarmTaskSummary {
  swarm_id: string;
  title: string;
  description: string;
  status: SwarmTaskStatus;
  creator_id: string;
  worker_count: number;
  completed_subtasks: number;
  total_subtasks: number;
  cost: number;
  created_at: string;
  completed_at: string | null;
}

/** Detailed swarm task information */
export interface SwarmTaskDetail extends SwarmTaskSummary {
  timeout_ms: number;
  result?: SwarmResult | null;
  subtasks: SubtaskDetail[];
}

/** Subtask detail */
export interface SubtaskDetail {
  subtask_id: string;
  swarm_id: string;
  title: string;
  description: string;
  status: SubtaskStatus;
  assigned_to: string | null;
  result: string | null;
  assigned_at: string | null;
  completed_at: string | null;
}

/** Aggregated swarm result */
export interface SwarmResult {
  swarm_id: string;
  aggregated_output: string;
  subtask_results: SubtaskResultEntry[];
  quality_score: number;
  completed_at: string;
}

/** Individual subtask result entry */
export interface SubtaskResultEntry {
  subtask_id: string;
  result: string;
  worker_id: string;
  completed_at: string;
}

// ============================================================
// Service Layer Types
// ============================================================

/** Input for creating a swarm task */
export interface CreateSwarmTaskInput {
  creator_id: string;
  title: string;
  description: string;
  timeout_ms?: number;
}

/** Input for creating a subtask */
export interface CreateSubtaskInput {
  swarm_id: string;
  title: string;
  description: string;
  assigned_to?: string;
}

/** Input for completing a subtask */
export interface CompleteSubtaskInput {
  subtask_id: string;
  result: string;
  worker_id: string;
}

/** Input for completing a swarm task */
export interface CompleteSwarmTaskInput {
  swarm_id: string;
  aggregated_output: string;
  quality_score?: number;
}

// ============================================================
// Configuration
// ============================================================

/** Swarm coordination parameters */
export interface SwarmConfig {
  defaultTimeoutMs: number;
  maxWorkersPerTask: number;
  minQualityScore: number;
}

export const SWARM_CONFIG: SwarmConfig = {
  defaultTimeoutMs: 3600000, // 1 hour
  maxWorkersPerTask: 10,
  minQualityScore: 0.5,
};
