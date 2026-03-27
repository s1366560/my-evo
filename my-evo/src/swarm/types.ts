// Swarm Types and Interfaces for EvoMap

export enum SwarmState {
  PENDING = 'PENDING',
  PROPOSED = 'PROPOSED',
  DECOMPOSED = 'DECOMPOSED',
  SOLVING = 'SOLVING',
  AGGREGATING = 'AGGREGATING',
  COMPLETED = 'COMPLETED',
  TIMEOUT = 'TIMEOUT',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  PARTIAL = 'PARTIAL'
}

export enum CollaborationMode {
  DSA = 'DSA', // Decompose-Solve-Aggregate
  DC = 'DC',   // Diverge-Converge
  SD = 'SD',   // Simple Diverge
  MRD = 'MRD'  // Multi-Round Diverge
}

export enum SwarmRole {
  PROPOSER = 'proposer',
  SOLVER = 'solver',
  AGGREGATOR = 'aggregator',
  OBSERVER = 'observer'
}

export enum SubTaskStatus {
  OPEN = 'open',
  CLAIMED = 'claimed',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface SubTask {
  id: string;
  swarm_id: string;
  title: string;
  description: string;
  weight: number; // Contribution weight (sum ≤ 0.85)
  status: SubTaskStatus;
  solver_id?: string;
  solution?: string;
  created_at: string;
  completed_at?: string;
}

export interface SwarmTask {
  id: string;
  mode: CollaborationMode;
  state: SwarmState;
  title: string;
  description: string;
  proposer_id: string;
  sub_tasks: SubTask[];
  solutions: Record<string, string>; // solver_id -> solution
  aggregated_result?: string;
  created_at: string;
  updated_at: string;
  deadline?: string;
  timeout_ms: number;
  auto_approved: boolean;
}

export interface RewardAllocation {
  proposer: number;  // 5%
  solvers: number;   // 85% (distributed by weight)
  aggregator: number; // 10%
}

export interface SwarmResult {
  swarm_id: string;
  state: SwarmState;
  aggregated_result?: string;
  rewards: RewardAllocation;
  sub_task_results: Array<{
    sub_task_id: string;
    solver_id: string;
    weight: number;
    reward: number;
  }>;
}

// DSA: Decompose → Solve → Aggregate flow
export interface DSADecomposition {
  sub_tasks: Array<{
    title: string;
    description: string;
    weight: number;
  }>;
  aggregation_strategy: string;
}

// DC: Diverge → Converge flow
export interface DCDiversity {
  perspectives: Array<{
    solver_id: string;
    approach: string;
  }>;
  evaluation_criteria: string[];
}
