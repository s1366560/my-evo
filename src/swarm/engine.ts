/**
 * Swarm Engine - In-memory store and state machine
 * Phase 3: Swarm Multi-Agent Collaboration
 */

import {
  SwarmTask,
  SubTask,
  DecompositionProposal,
  AggregatedResult,
  SwarmSession,
  SwarmState,
  BountyDistribution,
  SWARM_DECOMPOSER_BOUNTY_PCT,
  SWARM_SOLVER_BOUNTY_PCT,
  SWARM_AGGREGATOR_BOUNTY_PCT,
} from './types';

// In-memory stores
const swarms = new Map<string, SwarmTask>();
const subtasks = new Map<string, SubTask>();
const proposals = new Map<string, DecompositionProposal>();
const results = new Map<string, AggregatedResult>();
const sessions = new Map<string, SwarmSession>();
const bountyDistributions = new Map<string, BountyDistribution>();

// ============ Swarm CRUD ============

export function createSwarm(task: Omit<SwarmTask, 'state' | 'created_at'>): SwarmTask {
  const now = new Date().toISOString();
  const swarm: SwarmTask = {
    ...task,
    state: 'idle',
    created_at: now,
  };
  swarms.set(swarm.swarm_id, swarm);
  return swarm;
}

export function getSwarm(swarmId: string): SwarmTask | undefined {
  return swarms.get(swarmId);
}

export function updateSwarmState(swarmId: string, state: SwarmState): SwarmTask | undefined {
  const swarm = swarms.get(swarmId);
  if (!swarm) return undefined;
  swarm.state = state;
  return swarm;
}

export function listSwarms(filter?: {
  state?: SwarmState;
  created_by?: string;
}): SwarmTask[] {
  let all = [...swarms.values()];
  if (filter?.state) all = all.filter(s => s.state === filter.state);
  if (filter?.created_by) all = all.filter(s => s.created_by === filter.created_by);
  return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ============ Subtask CRUD ============

export function createSubtask(subtask: Omit<SubTask, 'state'>): SubTask {
  const s: SubTask = { ...subtask, state: 'pending' };
  subtasks.set(s.subtask_id, s);
  return s;
}

export function getSubtask(subtaskId: string): SubTask | undefined {
  return subtasks.get(subtaskId);
}

export function getSubtasksForSwarm(swarmId: string): SubTask[] {
  return [...subtasks.values()].filter(s => s.swarm_id === swarmId);
}

export function updateSubtaskState(
  subtaskId: string,
  state: SubTask['state'],
  result?: unknown
): SubTask | undefined {
  const subtask = subtasks.get(subtaskId);
  if (!subtask) return undefined;
  subtask.state = state;
  if (result !== undefined) subtask.result = result;
  if (state === 'completed' || state === 'failed') {
    subtask.submitted_at = new Date().toISOString();
  }
  return subtask;
}

export function assignSubtask(subtaskId: string, nodeId: string): SubTask | undefined {
  const subtask = subtasks.get(subtaskId);
  if (!subtask) return undefined;
  subtask.assigned_to = nodeId;
  subtask.state = 'claimed';
  return subtask;
}

// ============ Decomposition Proposals ============

export function submitDecomposition(
  proposal: Omit<DecompositionProposal, 'submitted_at' | 'status'>
): DecompositionProposal {
  const p: DecompositionProposal = {
    ...proposal,
    submitted_at: new Date().toISOString(),
    status: 'pending',
  };
  proposals.set(proposal.swarm_id, p);
  return p;
}

export function getProposal(swarmId: string): DecompositionProposal | undefined {
  return proposals.get(swarmId);
}

export function acceptProposal(swarmId: string): DecompositionProposal | undefined {
  const p = proposals.get(swarmId);
  if (!p) return undefined;
  p.status = 'accepted';

  // Create subtasks from proposal
  for (const st of p.subtasks) {
    createSubtask({
      subtask_id: st.id,
      swarm_id: swarmId,
      description: st.description,
      weight: st.weight,
    });
  }

  // Transition swarm to solving
  updateSwarmState(swarmId, 'solving');
  return p;
}

export function rejectProposal(swarmId: string): DecompositionProposal | undefined {
  const p = proposals.get(swarmId);
  if (!p) return undefined;
  p.status = 'rejected';
  return p;
}

// ============ Results ============

export function submitAggregatedResult(
  result: Omit<AggregatedResult, 'created_at'>
): AggregatedResult {
  const r: AggregatedResult = {
    ...result,
    created_at: new Date().toISOString(),
  };
  results.set(result.swarm_id, r);
  updateSwarmState(result.swarm_id, 'completed');
  return r;
}

export function getAggregatedResult(swarmId: string): AggregatedResult | undefined {
  return results.get(swarmId);
}

// ============ Bounty Distribution ============

export function distributeBounty(swarmId: string, totalBounty: number): BountyDistribution {
  const swarm = swarms.get(swarmId);
  if (!swarm) throw new Error(`Swarm ${swarmId} not found`);

  const proposal = proposals.get(swarmId);
  const allSubtasks = getSubtasksForSwarm(swarmId);

  const distributions: BountyDistribution['distributions'] = [];

  // Decomposer share
  if (proposal) {
    distributions.push({
      node_id: proposal.proposer,
      role: 'decomposer',
      share: SWARM_DECOMPOSER_BOUNTY_PCT * 100,
      amount: Math.floor(totalBounty * SWARM_DECOMPOSER_BOUNTY_PCT),
    });
  }

  // Solver shares (distributed by weight)
  const completedSubtasks = allSubtasks.filter(s => s.state === 'completed' && s.assigned_to);
  const totalWeight = completedSubtasks.reduce((sum, s) => sum + s.weight, 0);

  for (const st of completedSubtasks) {
    if (!st.assigned_to) continue;
    const weightShare = totalWeight > 0 ? st.weight / totalWeight : 1 / completedSubtasks.length;
    distributions.push({
      node_id: st.assigned_to,
      role: 'solver',
      share: Math.round(weightShare * SWARM_SOLVER_BOUNTY_PCT * 100),
      amount: Math.floor(totalBounty * SWARM_SOLVER_BOUNTY_PCT * weightShare),
    });
  }

  // Aggregator share - find who submitted the result
  const result = results.get(swarmId);
  if (result) {
    distributions.push({
      node_id: result.aggregator,
      role: 'aggregator',
      share: SWARM_AGGREGATOR_BOUNTY_PCT * 100,
      amount: Math.floor(totalBounty * SWARM_AGGREGATOR_BOUNTY_PCT),
    });
  }

  const dist: BountyDistribution = {
    swarm_id: swarmId,
    total_bounty: totalBounty,
    distributions,
    settled_at: new Date().toISOString(),
  };

  bountyDistributions.set(swarmId, dist);
  return dist;
}

export function getBountyDistribution(swarmId: string): BountyDistribution | undefined {
  return bountyDistributions.get(swarmId);
}

// ============ Sessions ============

export function createSession(session: Omit<SwarmSession, 'created_at' | 'updated_at'>): SwarmSession {
  const now = new Date().toISOString();
  const s: SwarmSession = { ...session, created_at: now, updated_at: now };
  sessions.set(s.session_id, s);
  return s;
}

export function getSession(sessionId: string): SwarmSession | undefined {
  return sessions.get(sessionId);
}

export function updateSession(sessionId: string, updates: Partial<SwarmSession>): SwarmSession | undefined {
  const s = sessions.get(sessionId);
  if (!s) return undefined;
  Object.assign(s, updates);
  s.updated_at = new Date().toISOString();
  return s;
}

// ============ Helpers ============

export function areAllSubtasksComplete(swarmId: string): boolean {
  const stasks = getSubtasksForSwarm(swarmId);
  if (stasks.length === 0) return false;
  return stasks.every(s => s.state === 'completed' || s.state === 'failed');
}

export function getSwarmStats(): {
  total: number;
  by_state: Record<string, number>;
} {
  const by_state: Record<string, number> = {};
  for (const s of swarms.values()) {
    by_state[s.state] = (by_state[s.state] ?? 0) + 1;
  }
  return { total: swarms.size, by_state };
}

/**
 * Reset all in-memory stores - FOR TESTING ONLY
 */
export function resetStores(): void {
  swarms.clear();
  subtasks.clear();
  proposals.clear();
  results.clear();
  sessions.clear();
  bountyDistributions.clear();
}
