// Swarm Engine - Multi-node task decomposition and collaborative execution
// Implements DSA (Decompose-Solve-Aggregate) and DC (Diverge-Converge) modes

import {
  SwarmState,
  CollaborationMode,
  SwarmRole,
  SubTaskStatus,
  SwarmTask,
  SubTask,
  SwarmResult,
  DSADecomposition,
  RewardAllocation
} from './types.js';

export class SwarmEngine {
  private swarms: Map<string, SwarmTask> = new Map();
  private readonly REWARD_PROPOSER = 0.05;
  private readonly REWARD_SOLVERS = 0.85;
  private readonly REWARD_AGGREGATOR = 0.10;
  private readonly DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Create a new Swarm task
   */
  createSwarm(params: {
    id: string;
    mode: CollaborationMode;
    title: string;
    description: string;
    proposer_id: string;
    sub_tasks?: DSADecomposition['sub_tasks'];
    auto_approved?: boolean;
    timeout_ms?: number;
    deadline?: string;
  }): SwarmTask {
    const now = new Date().toISOString();
    const sub_tasks: SubTask[] = (params.sub_tasks || []).map((st, i) => ({
      id: `${params.id}-st-${i}`,
      swarm_id: params.id,
      title: st.title,
      description: st.description,
      weight: st.weight,
      status: SubTaskStatus.OPEN,
      created_at: now
    }));

    const swarm: SwarmTask = {
      id: params.id,
      mode: params.mode,
      state: SwarmState.PENDING,
      title: params.title,
      description: params.description,
      proposer_id: params.proposer_id,
      sub_tasks,
      solutions: {},
      created_at: now,
      updated_at: now,
      deadline: params.deadline,
      timeout_ms: params.timeout_ms || this.DEFAULT_TIMEOUT_MS,
      auto_approved: params.auto_approved || false
    };

    this.swarms.set(params.id, swarm);
    return swarm;
  }

  /**
   * Get a swarm by ID
   */
  getSwarm(swarm_id: string): SwarmTask | undefined {
    return this.swarms.get(swarm_id);
  }

  /**
   * Propose decomposition for a swarm (DSA mode)
   */
  proposeDecomposition(swarm_id: string, proposer_id: string, decomposition: DSADecomposition): SwarmTask | null {
    const swarm = this.swarms.get(swarm_id);
    if (!swarm) return null;
    if (swarm.proposer_id !== proposer_id) return null;
    if (swarm.mode !== CollaborationMode.DSA) return null;
    if (swarm.state !== SwarmState.PENDING) return null;

    // Validate: sub_task weights sum ≤ 0.85
    const totalWeight = decomposition.sub_tasks.reduce((sum, st) => sum + st.weight, 0);
    if (totalWeight > 0.85) {
      throw new Error(`Sub-task weights sum to ${totalWeight}, must be ≤ 0.85`);
    }

    // Validate: 2-10 sub-tasks
    if (decomposition.sub_tasks.length < 2 || decomposition.sub_tasks.length > 10) {
      throw new Error(`Must have 2-10 sub-tasks, got ${decomposition.sub_tasks.length}`);
    }

    const now = new Date().toISOString();
    swarm.sub_tasks = decomposition.sub_tasks.map((st, i) => ({
      id: `${swarm_id}-st-${i}`,
      swarm_id,
      title: st.title,
      description: st.description,
      weight: st.weight,
      status: SubTaskStatus.OPEN,
      created_at: now
    }));

    swarm.state = swarm.auto_approved ? SwarmState.DECOMPOSED : SwarmState.PROPOSED;
    swarm.updated_at = now;
    this.swarms.set(swarm_id, swarm);
    return swarm;
  }

  /**
   * Approve proposed decomposition (moves to DECOMPOSED)
   */
  approveDecomposition(swarm_id: string): SwarmTask | null {
    const swarm = this.swarms.get(swarm_id);
    if (!swarm) return null;
    if (swarm.state !== SwarmState.PROPOSED) return null;

    swarm.state = SwarmState.DECOMPOSED;
    swarm.updated_at = new Date().toISOString();
    this.swarms.set(swarm_id, swarm);
    return swarm;
  }

  /**
   * Join swarm as a solver and claim a sub-task
   */
  claimSubTask(swarm_id: string, sub_task_id: string, solver_id: string): SubTask | null {
    const swarm = this.swarms.get(swarm_id);
    if (!swarm) return null;
    if (swarm.state !== SwarmState.DECOMPOSED && swarm.state !== SwarmState.SOLVING) return null;

    const subTask = swarm.sub_tasks.find(st => st.id === sub_task_id);
    if (!subTask) return null;
    if (subTask.status !== SubTaskStatus.OPEN) return null;

    subTask.status = SubTaskStatus.CLAIMED;
    subTask.solver_id = solver_id;
    swarm.state = SwarmState.SOLVING;
    swarm.updated_at = new Date().toISOString();
    this.swarms.set(swarm_id, swarm);
    return subTask;
  }

  /**
   * Complete a sub-task with solution
   */
  completeSubTask(
    swarm_id: string,
    sub_task_id: string,
    solver_id: string,
    solution: string
  ): SwarmTask | null {
    const swarm = this.swarms.get(swarm_id);
    if (!swarm) return null;
    if (swarm.state !== SwarmState.SOLVING) return null;

    const subTask = swarm.sub_tasks.find(st => st.id === sub_task_id);
    if (!subTask) return null;
    if (subTask.solver_id !== solver_id) return null;
    if (subTask.status !== SubTaskStatus.CLAIMED) return null;

    subTask.status = SubTaskStatus.COMPLETED;
    subTask.solution = solution;
    subTask.completed_at = new Date().toISOString();
    swarm.solutions[solver_id] = solution;
    swarm.updated_at = new Date().toISOString();

    // Check if all sub-tasks are completed
    const allDone = swarm.sub_tasks.every(st => st.status === SubTaskStatus.COMPLETED);
    if (allDone) {
      swarm.state = SwarmState.AGGREGATING;
    }

    this.swarms.set(swarm_id, swarm);
    return swarm;
  }

  /**
   * Aggregate results (DSA mode) - by aggregator role
   */
  aggregateResults(
    swarm_id: string,
    aggregator_id: string,
    aggregated_result: string
  ): SwarmResult | null {
    const swarm = this.swarms.get(swarm_id);
    if (!swarm) return null;
    if (swarm.state !== SwarmState.AGGREGATING) return null;

    swarm.aggregated_result = aggregated_result;
    swarm.state = SwarmState.COMPLETED;
    swarm.updated_at = new Date().toISOString();
    this.swarms.set(swarm_id, swarm);

    return this.calculateRewards(swarm_id, aggregator_id);
  }

  /**
   * Diverge-Converge: submit perspective (DC mode)
   */
  submitPerspective(swarm_id: string, solver_id: string, perspective: string): SwarmTask | null {
    const swarm = this.swarms.get(swarm_id);
    if (!swarm) return null;
    if (swarm.mode !== CollaborationMode.DC) return null;
    if (swarm.state !== SwarmState.PENDING && swarm.state !== SwarmState.SOLVING) return null;

    swarm.solutions[solver_id] = perspective;
    swarm.state = SwarmState.SOLVING;
    swarm.updated_at = new Date().toISOString();
    this.swarms.set(swarm_id, swarm);
    return swarm;
  }

  /**
   * Converge: aggregate perspectives (DC mode)
   */
  converge(swarm_id: string, aggregator_id: string, converged_result: string): SwarmResult | null {
    const swarm = this.swarms.get(swarm_id);
    if (!swarm) return null;
    if (swarm.mode !== CollaborationMode.DC) return null;
    if (swarm.state !== SwarmState.SOLVING) return null;

    // Check minimum perspectives (at least 2 for DC)
    if (Object.keys(swarm.solutions).length < 2) {
      throw new Error('At least 2 perspectives required for convergence');
    }

    swarm.aggregated_result = converged_result;
    swarm.state = SwarmState.COMPLETED;
    swarm.updated_at = new Date().toISOString();
    this.swarms.set(swarm_id, swarm);

    return this.calculateRewards(swarm_id, aggregator_id);
  }

  /**
   * Cancel a swarm
   */
  cancel(swarm_id: string, initiator_id: string): boolean {
    const swarm = this.swarms.get(swarm_id);
    if (!swarm) return false;
    if (swarm.proposer_id !== initiator_id) return false;
    if ([SwarmState.COMPLETED, SwarmState.FAILED, SwarmState.CANCELLED].includes(swarm.state)) return false;

    swarm.state = SwarmState.CANCELLED;
    swarm.updated_at = new Date().toISOString();
    this.swarms.set(swarm_id, swarm);
    return true;
  }

  /**
   * Mark swarm as timed out
   */
  timeout(swarm_id: string): boolean {
    const swarm = this.swarms.get(swarm_id);
    if (!swarm) return false;
    if ([SwarmState.COMPLETED, SwarmState.FAILED, SwarmState.CANCELLED].includes(swarm.state)) return false;

    swarm.state = SwarmState.TIMEOUT;
    swarm.updated_at = new Date().toISOString();
    this.swarms.set(swarm_id, swarm);
    return true;
  }

  /**
   * Calculate reward distribution
   */
  calculateRewards(swarm_id: string, aggregator_id: string): SwarmResult | null {
    const swarm = this.swarms.get(swarm_id);
    if (!swarm) return null;

    const totalRewards = 100; // Base points
    const proposerReward = Math.round(totalRewards * this.REWARD_PROPOSER);
    const aggregatorReward = Math.round(totalRewards * this.REWARD_AGGREGATOR);
    const solversPool = totalRewards - proposerReward - aggregatorReward;

    const sub_task_results: SwarmResult['sub_task_results'] = [];
    let remaining = solversPool;

    // Distribute solver rewards by weight
    swarm.sub_tasks.forEach((st, idx) => {
      if (st.status !== SubTaskStatus.COMPLETED) return;
      const isLast = idx === swarm.sub_tasks.filter(s => s.status === SubTaskStatus.COMPLETED).length - 1;
      const reward = isLast ? remaining : Math.round(solversPool * st.weight);
      remaining -= reward;
      sub_task_results.push({
        sub_task_id: st.id,
        solver_id: st.solver_id || '',
        weight: st.weight,
        reward
      });
    });

    const rewards: RewardAllocation = {
      proposer: proposerReward,
      solvers: solversPool - remaining,
      aggregator: aggregatorReward
    };

    return {
      swarm_id,
      state: swarm.state,
      aggregated_result: swarm.aggregated_result,
      rewards,
      sub_task_results
    };
  }

  /**
   * Get available sub-tasks for joining
   */
  getAvailableSubTasks(swarm_id: string): SubTask[] {
    const swarm = this.swarms.get(swarm_id);
    if (!swarm) return [];
    if (swarm.state !== SwarmState.DECOMPOSED && swarm.state !== SwarmState.SOLVING) return [];
    return swarm.sub_tasks.filter(st => st.status === SubTaskStatus.OPEN);
  }

  /**
   * Get swarm status summary
   */
  getStatus(swarm_id: string): {
    state: SwarmState;
    sub_tasks_total: number;
    sub_tasks_completed: number;
    solvers_count: number;
  } | null {
    const swarm = this.swarms.get(swarm_id);
    if (!swarm) return null;
    return {
      state: swarm.state,
      sub_tasks_total: swarm.sub_tasks.length,
      sub_tasks_completed: swarm.sub_tasks.filter(st => st.status === SubTaskStatus.COMPLETED).length,
      solvers_count: new Set(swarm.sub_tasks.map(st => st.solver_id).filter(Boolean)).size
    };
  }

  /**
   * Check and timeout expired swarms
   */
  checkTimeouts(): string[] {
    const now = Date.now();
    const timedOut: string[] = [];
    this.swarms.forEach((swarm, id) => {
      if (swarm.state === SwarmState.COMPLETED ||
          swarm.state === SwarmState.FAILED ||
          swarm.state === SwarmState.CANCELLED ||
          swarm.state === SwarmState.TIMEOUT) return;

      const created = new Date(swarm.created_at).getTime();
      if (now - created > swarm.timeout_ms) {
        this.timeout(id);
        timedOut.push(id);
      }
    });
    return timedOut;
  }

  /**
   * List all swarms (for debugging/admin)
   */
  listSwarms(): SwarmTask[] {
    return Array.from(this.swarms.values());
  }
}

export default SwarmEngine;
