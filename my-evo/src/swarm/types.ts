/**
 * Swarm Multi-Agent Collaboration System
 * Phase 3: Swarm Intelligence
 * 
 * Supports:
 * - Decompose-Solve-Aggregate pattern
 * - Diverge-Converge pattern
 * - Collaboration Sessions
 * - Structured Dialog
 */

// Swarm state machine states
export type SwarmState =
  | 'idle'
  | 'decomposition'
  | 'solving'
  | 'aggregating'
  | 'completed'
  | 'failed';

// Task for Swarm
export interface SwarmTask {
  swarm_id: string;
  title: string;
  description: string;
  bounty: number;
  created_by: string;
  created_at: string;
  deadline?: string;
  state: SwarmState;
  root_task_id: string;
}

// Subtask within a Swarm
export interface SubTask {
  subtask_id: string;
  swarm_id: string;
  description: string;
  weight: number;         // contribution weight for bounty distribution
  assigned_to?: string;
  state: 'pending' | 'claimed' | 'in_progress' | 'completed' | 'failed';
  result?: unknown;
  submitted_at?: string;
}

// Decomposition proposal
export interface DecompositionProposal {
  swarm_id: string;
  proposer: string;
  subtasks: Array<{
    id: string;
    description: string;
    weight: number;
  }>;
  submitted_at: string;
  status: 'pending' | 'accepted' | 'rejected';
}

// Aggregated result
export interface AggregatedResult {
  swarm_id: string;
  aggregator: string;
  output: unknown;
  confidence: number;
  summary: string;
  created_at: string;
}

// Bounty distribution record
export interface BountyDistribution {
  swarm_id: string;
  total_bounty: number;
  distributions: Array<{
    node_id: string;
    role: 'decomposer' | 'solver' | 'aggregator';
    share: number;        // percentage
    amount: number;        // absolute credits
  }>;
  settled_at?: string;
}

// Swarm collaboration session
export interface SwarmSession {
  session_id: string;
  swarm_id: string;
  participants: string[];
  purpose: string;
  context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Swarm reward weights
export const SWARM_DECOMPOSER_BOUNTY_PCT = 0.05;   // 5%
export const SWARM_SOLVER_BOUNTY_PCT = 0.85;        // 85%
export const SWARM_AGGREGATOR_BOUNTY_PCT = 0.10;   // 10%

// Swarm timeout settings
export const SWARM_DECOMPOSITION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
export const SWARM_SUBTASK_TIMEOUT_MS = 24 * 60 * 60 * 1000;  // 24 hours
