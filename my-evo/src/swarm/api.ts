// Swarm API Endpoints for EvoMap
// POST /a2a/swarm/create - Create a new swarm
// POST /a2a/swarm/:id/join - Join a swarm as solver
// POST /a2a/swarm/:id/complete - Mark swarm as complete
// GET  /a2a/swarm/:id - Get swarm status
// POST /a2a/swarm/:id/propose - Propose decomposition (DSA)
// POST /a2a/swarm/:id/approve - Approve decomposition
// POST /a2a/swarm/:id/claim - Claim a sub-task
// POST /a2a/swarm/:id/solve - Submit sub-task solution
// POST /a2a/swarm/:id/aggregate - Aggregate results
// POST /a2a/swarm/:id/timeout - Mark as timed out

import { SwarmEngine } from './engine.js';
import { SwarmState, CollaborationMode, DSADecomposition } from './types.js';

export interface CreateSwarmRequest {
  title: string;
  description: string;
  mode: CollaborationMode;
  sub_tasks?: DSADecomposition['sub_tasks'];
  auto_approved?: boolean;
  timeout_ms?: number;
  deadline?: string;
}

export interface ProposeDecompositionRequest {
  decomposition: DSADecomposition;
}

export interface ClaimSubTaskRequest {
  sub_task_id: string;
  solver_id: string;
}

export interface SolveSubTaskRequest {
  sub_task_id: string;
  solver_id: string;
  solution: string;
}

export interface AggregateResultsRequest {
  aggregator_id: string;
  aggregated_result: string;
}

export interface SubmitPerspectiveRequest {
  solver_id: string;
  perspective: string;
}

export interface ConvergeRequest {
  aggregator_id: string;
  converged_result: string;
}

export class SwarmAPI {
  constructor(private engine: SwarmEngine) {}

  /**
   * Create a new Swarm task
   * POST /a2a/swarm/create
   */
  createSwarm(swarm_id: string, proposer_id: string, req: CreateSwarmRequest): any {
    const swarm = this.engine.createSwarm({
      id: swarm_id,
      mode: req.mode,
      title: req.title,
      description: req.description,
      proposer_id,
      sub_tasks: req.sub_tasks,
      auto_approved: req.auto_approved,
      timeout_ms: req.timeout_ms,
      deadline: req.deadline
    });

    return {
      protocol: 'gep-a2a',
      protocol_version: '1.0.0',
      message_type: 'swarm_created',
      message_id: `swarm_create_${Date.now()}`,
      sender_id: 'hub',
      timestamp: new Date().toISOString(),
      payload: {
        swarm_id: swarm.id,
        state: swarm.state,
        mode: swarm.mode,
        title: swarm.title,
        sub_tasks_count: swarm.sub_tasks.length,
        auto_approved: swarm.auto_approved
      }
    };
  }

  /**
   * Get swarm status
   * GET /a2a/swarm/:id
   */
  getSwarm(swarm_id: string): any {
    const swarm = this.engine.getSwarm(swarm_id);
    if (!swarm) {
      return { error: 'swarm_not_found', message: `Swarm ${swarm_id} not found` };
    }
    const status = this.engine.getStatus(swarm_id);
    return {
      protocol: 'gep-a2a',
      message_type: 'swarm_status',
      payload: {
        swarm_id: swarm.id,
        mode: swarm.mode,
        state: swarm.state,
        title: swarm.title,
        description: swarm.description,
        proposer_id: swarm.proposer_id,
        sub_tasks: swarm.sub_tasks.map(st => ({
          id: st.id,
          title: st.title,
          weight: st.weight,
          status: st.status,
          solver_id: st.solver_id,
          completed_at: st.completed_at
        })),
        aggregated_result: swarm.aggregated_result,
        available_sub_tasks: this.engine.getAvailableSubTasks(swarm_id).map(st => ({
          id: st.id,
          title: st.title,
          weight: st.weight
        })),
        ...status
      }
    };
  }

  /**
   * Propose decomposition (DSA mode)
   * POST /a2a/swarm/:id/propose
   */
  proposeDecomposition(swarm_id: string, proposer_id: string, req: ProposeDecompositionRequest): any {
    try {
      const swarm = this.engine.proposeDecomposition(
        swarm_id,
        proposer_id,
        req.decomposition
      );
      if (!swarm) {
        return { error: 'swarm_not_found', message: `Swarm ${swarm_id} not found` };
      }
      return {
        protocol: 'gep-a2a',
        message_type: 'decomposition_proposed',
        payload: {
          swarm_id: swarm.id,
          state: swarm.state,
          sub_tasks: swarm.sub_tasks.map(st => ({
            id: st.id,
            title: st.title,
            weight: st.weight
          }))
        }
      };
    } catch (e: any) {
      return { error: 'invalid_decomposition', message: e.message };
    }
  }

  /**
   * Approve decomposition (DSA mode)
   * POST /a2a/swarm/:id/approve
   */
  approveDecomposition(swarm_id: string): any {
    const swarm = this.engine.approveDecomposition(swarm_id);
    if (!swarm) {
      return { error: 'swarm_not_found', message: `Swarm ${swarm_id} not found or not in PROPOSED state` };
    }
    return {
      protocol: 'gep-a2a',
      message_type: 'decomposition_approved',
      payload: { swarm_id, state: swarm.state }
    };
  }

  /**
   * Join swarm and claim a sub-task
   * POST /a2a/swarm/:id/join
   */
  joinSwarm(swarm_id: string, req: ClaimSubTaskRequest): any {
    const subTask = this.engine.claimSubTask(
      swarm_id,
      req.sub_task_id,
      req.solver_id
    );
    if (!subTask) {
      return {
        error: 'claim_failed',
        message: 'Sub-task not found, already claimed, or swarm not in correct state'
      };
    }
    return {
      protocol: 'gep-a2a',
      message_type: 'sub_task_claimed',
      payload: {
        swarm_id,
        sub_task_id: subTask.id,
        solver_id: req.solver_id,
        swarm_state: this.engine.getStatus(swarm_id)?.state
      }
    };
  }

  /**
   * Submit sub-task solution
   * POST /a2a/swarm/:id/solve
   */
  solveSubTask(swarm_id: string, req: SolveSubTaskRequest): any {
    const swarm = this.engine.completeSubTask(
      swarm_id,
      req.sub_task_id,
      req.solver_id,
      req.solution
    );
    if (!swarm) {
      return { error: 'solve_failed', message: 'Sub-task not found or not in correct state' };
    }
    const status = this.engine.getStatus(swarm_id);
    return {
      protocol: 'gep-a2a',
      message_type: 'sub_task_completed',
      payload: {
        swarm_id,
        sub_task_id: req.sub_task_id,
        state: status?.state,
        all_completed: status?.sub_tasks_total === status?.sub_tasks_completed
      }
    };
  }

  /**
   * Aggregate results (DSA mode)
   * POST /a2a/swarm/:id/aggregate
   */
  aggregate(swarm_id: string, req: AggregateResultsRequest): any {
    const result = this.engine.aggregateResults(
      swarm_id,
      req.aggregator_id,
      req.aggregated_result
    );
    if (!result) {
      return { error: 'aggregate_failed', message: 'Swarm not found or not in AGGREGATING state' };
    }
    return {
      protocol: 'gep-a2a',
      message_type: 'swarm_completed',
      payload: result
    };
  }

  /**
   * Submit perspective (DC mode)
   * POST /a2a/swarm/:id/perspective
   */
  submitPerspective(swarm_id: string, req: SubmitPerspectiveRequest): any {
    const swarm = this.engine.submitPerspective(swarm_id, req.solver_id, req.perspective);
    if (!swarm) {
      return { error: 'perspective_failed', message: 'Swarm not found or not in correct state for DC mode' };
    }
    return {
      protocol: 'gep-a2a',
      message_type: 'perspective_submitted',
      payload: { swarm_id, solver_id: req.solver_id, state: swarm.state }
    };
  }

  /**
   * Converge perspectives (DC mode)
   * POST /a2a/swarm/:id/converge
   */
  converge(swarm_id: string, req: ConvergeRequest): any {
    try {
      const result = this.engine.converge(swarm_id, req.aggregator_id, req.converged_result);
      if (!result) {
        return { error: 'converge_failed', message: 'Swarm not found or insufficient perspectives' };
      }
      return {
        protocol: 'gep-a2a',
        message_type: 'swarm_completed',
        payload: result
      };
    } catch (e: any) {
      return { error: 'converge_failed', message: e.message };
    }
  }

  /**
   * Cancel swarm
   * POST /a2a/swarm/:id/cancel
   */
  cancelSwarm(swarm_id: string, initiator_id: string): any {
    const success = this.engine.cancel(swarm_id, initiator_id);
    if (!success) {
      return { error: 'cancel_failed', message: 'Swarm not found or not cancellable' };
    }
    return {
      protocol: 'gep-a2a',
      message_type: 'swarm_cancelled',
      payload: { swarm_id }
    };
  }

  /**
   * Check timeouts and return timed out swarm IDs
   */
  checkTimeouts(): string[] {
    return this.engine.checkTimeouts();
  }
}

export default SwarmAPI;
