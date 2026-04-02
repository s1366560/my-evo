/**
 * Swarm Engine Tests
 * Phase 3: Swarm Multi-Agent Collaboration
 */

import {
  createSwarm,
  getSwarm,
  updateSwarmState,
  listSwarms,
  createSubtask,
  getSubtask,
  getSubtasksForSwarm,
  updateSubtaskState,
  assignSubtask,
  submitDecomposition,
  getProposal,
  acceptProposal,
  rejectProposal,
  submitAggregatedResult,
  getAggregatedResult,
  distributeBounty,
  getBountyDistribution,
  createSession,
  getSession,
  updateSession,
  areAllSubtasksComplete,
  getSwarmStats,
  tryTransitionToAggregating,
  resetStores,
} from '../src/swarm/engine';
import {
  SwarmState,
  SWARM_DECOMPOSER_BOUNTY_PCT,
  SWARM_SOLVER_BOUNTY_PCT,
  SWARM_AGGREGATOR_BOUNTY_PCT,
} from '../src/swarm/types';

describe('Swarm Engine', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('Swarm CRUD', () => {
    it('should create a swarm with idle state', () => {
      const swarm = createSwarm({
        swarm_id: 'swarm_001',
        title: 'Test Swarm',
        description: 'A test swarm task',
        bounty: 100,
        created_by: 'node_001',
        root_task_id: 'task_001',
        deadline: '2026-04-01T00:00:00Z',
      });

      expect(swarm.swarm_id).toBe('swarm_001');
      expect(swarm.title).toBe('Test Swarm');
      expect(swarm.state).toBe('idle');
      expect(swarm.created_at).toBeDefined();
    });

    it('should get a swarm by id', () => {
      createSwarm({
        swarm_id: 'swarm_002',
        title: 'Get Test',
        description: 'Test get',
        bounty: 50,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      const retrieved = getSwarm('swarm_002');
      expect(retrieved).toBeDefined();
      expect(retrieved?.swarm_id).toBe('swarm_002');
      expect(retrieved?.title).toBe('Get Test');
    });

    it('should return undefined for non-existent swarm', () => {
      const result = getSwarm('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should update swarm state', () => {
      createSwarm({
        swarm_id: 'swarm_003',
        title: 'State Test',
        description: 'Test state update',
        bounty: 75,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      const updated = updateSwarmState('swarm_003', 'decomposition');
      expect(updated?.state).toBe('decomposition');
    });

    it('should list swarms with optional filters', () => {
      createSwarm({
        swarm_id: 'swarm_filter_1',
        title: 'Filter Test 1',
        description: 'Desc 1',
        bounty: 100,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      updateSwarmState('swarm_filter_1', 'solving');

      createSwarm({
        swarm_id: 'swarm_filter_2',
        title: 'Filter Test 2',
        description: 'Desc 2',
        bounty: 200,
        created_by: 'node_002',
        root_task_id: 'task_002',
      });

      const all = listSwarms();
      expect(all.length).toBe(2);

      const byState = listSwarms({ state: 'solving' });
      expect(byState.length).toBe(1);
      expect(byState[0].swarm_id).toBe('swarm_filter_1');

      const byCreator = listSwarms({ created_by: 'node_001' });
      expect(byCreator.length).toBe(1);
    });

    it('should sort swarms by created_at desc', async () => {
      createSwarm({
        swarm_id: 'swarm_old',
        title: 'Old',
        description: 'Old swarm',
        bounty: 50,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      // Wait 10ms to ensure different timestamps (1ms may not be enough in fast environments)
      await new Promise(resolve => setTimeout(resolve, 10));

      createSwarm({
        swarm_id: 'swarm_new',
        title: 'New',
        description: 'New swarm',
        bounty: 100,
        created_by: 'node_001',
        root_task_id: 'task_002',
      });

      const list = listSwarms();
      expect(list[0].swarm_id).toBe('swarm_new');
      expect(list[1].swarm_id).toBe('swarm_old');
    });
  });

  describe('Subtask Operations', () => {
    it('should create a subtask with pending state', () => {
      const subtask = createSubtask({
        subtask_id: 'st_001',
        swarm_id: 'swarm_001',
        description: 'Subtask 1',
        weight: 1.0,
      });

      expect(subtask.subtask_id).toBe('st_001');
      expect(subtask.state).toBe('pending');
      expect(subtask.swarm_id).toBe('swarm_001');
    });

    it('should get subtask by id', () => {
      createSubtask({
        subtask_id: 'st_get',
        swarm_id: 'swarm_001',
        description: 'Get test',
        weight: 1.0,
      });

      const result = getSubtask('st_get');
      expect(result).toBeDefined();
      expect(result?.description).toBe('Get test');
    });

    it('should get subtasks for a swarm', () => {
      createSubtask({
        subtask_id: 'st_multi_1',
        swarm_id: 'swarm_multi',
        description: 'Multi 1',
        weight: 1.0,
      });

      createSubtask({
        subtask_id: 'st_multi_2',
        swarm_id: 'swarm_multi',
        description: 'Multi 2',
        weight: 2.0,
      });

      const subtasks = getSubtasksForSwarm('swarm_multi');
      expect(subtasks.length).toBe(2);
    });

    it('should update subtask state and result', () => {
      createSubtask({
        subtask_id: 'st_state',
        swarm_id: 'swarm_001',
        description: 'State test',
        weight: 1.0,
      });

      const updated = updateSubtaskState('st_state', 'completed', { output: 'result_data' });
      expect(updated?.state).toBe('completed');
      expect(updated?.result).toEqual({ output: 'result_data' });
      expect(updated?.submitted_at).toBeDefined();
    });

    it('should set submitted_at when completed or failed', () => {
      createSubtask({
        subtask_id: 'st_time_1',
        swarm_id: 'swarm_001',
        description: 'Time test 1',
        weight: 1.0,
      });

      createSubtask({
        subtask_id: 'st_time_2',
        swarm_id: 'swarm_001',
        description: 'Time test 2',
        weight: 1.0,
      });

      updateSubtaskState('st_time_1', 'completed');
      updateSubtaskState('st_time_2', 'failed');

      const t1 = getSubtask('st_time_1');
      const t2 = getSubtask('st_time_2');

      expect(t1?.submitted_at).toBeDefined();
      expect(t2?.submitted_at).toBeDefined();
    });

    it('should assign subtask to a node', () => {
      createSubtask({
        subtask_id: 'st_assign',
        swarm_id: 'swarm_001',
        description: 'Assign test',
        weight: 1.0,
      });

      const assigned = assignSubtask('st_assign', 'node_002');
      expect(assigned?.assigned_to).toBe('node_002');
      expect(assigned?.state).toBe('claimed');
    });
  });

  describe('Decomposition Proposals', () => {
    it('should submit a decomposition proposal', () => {
      createSwarm({
        swarm_id: 'swarm_decomp',
        title: 'Decompose Test',
        description: 'Test decomposition',
        bounty: 100,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      const proposal = submitDecomposition({
        swarm_id: 'swarm_decomp',
        proposer: 'node_002',
        subtasks: [
          { id: 'st_d1', description: 'Task 1', weight: 1.0 },
          { id: 'st_d2', description: 'Task 2', weight: 2.0 },
        ],
      });

      expect(proposal.status).toBe('pending');
      expect(proposal.submitted_at).toBeDefined();
      expect(proposal.subtasks.length).toBe(2);
    });

    it('should get proposal for swarm', () => {
      createSwarm({
        swarm_id: 'swarm_prop',
        title: 'Proposal Test',
        description: 'Test proposal',
        bounty: 50,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      submitDecomposition({
        swarm_id: 'swarm_prop',
        proposer: 'node_002',
        subtasks: [{ id: 'st_p1', description: 'Prop task', weight: 1.0 }],
      });

      const prop = getProposal('swarm_prop');
      expect(prop).toBeDefined();
      expect(prop?.proposer).toBe('node_002');
    });

    it('should accept proposal and create subtasks', () => {
      createSwarm({
        swarm_id: 'swarm_accept',
        title: 'Accept Test',
        description: 'Test acceptance',
        bounty: 100,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      submitDecomposition({
        swarm_id: 'swarm_accept',
        proposer: 'node_002',
        subtasks: [
          { id: 'st_a1', description: 'Accept 1', weight: 1.0 },
          { id: 'st_a2', description: 'Accept 2', weight: 1.5 },
        ],
      });

      const accepted = acceptProposal('swarm_accept');
      expect(accepted?.status).toBe('accepted');

      const subtasks = getSubtasksForSwarm('swarm_accept');
      expect(subtasks.length).toBe(2);

      const swarm = getSwarm('swarm_accept');
      expect(swarm?.state).toBe('solving');
    });

    it('should reject proposal', () => {
      createSwarm({
        swarm_id: 'swarm_reject',
        title: 'Reject Test',
        description: 'Test rejection',
        bounty: 50,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      submitDecomposition({
        swarm_id: 'swarm_reject',
        proposer: 'node_002',
        subtasks: [{ id: 'st_r1', description: 'Reject 1', weight: 1.0 }],
      });

      const rejected = rejectProposal('swarm_reject');
      expect(rejected?.status).toBe('rejected');
    });
  });

  describe('Aggregated Results', () => {
    it('should submit aggregated result and complete swarm', () => {
      createSwarm({
        swarm_id: 'swarm_result',
        title: 'Result Test',
        description: 'Test result',
        bounty: 100,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      const result = submitAggregatedResult({
        swarm_id: 'swarm_result',
        aggregator: 'node_agg',
        output: { answer: 42 },
        confidence: 0.95,
        summary: 'Final answer computed',
      });

      expect(result.created_at).toBeDefined();
      expect(result.output).toEqual({ answer: 42 });
      expect(result.confidence).toBe(0.95);

      const swarm = getSwarm('swarm_result');
      expect(swarm?.state).toBe('completed');
    });

    it('should get aggregated result', () => {
      createSwarm({
        swarm_id: 'swarm_get_result',
        title: 'Get Result Test',
        description: 'Test getting result',
        bounty: 50,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      submitAggregatedResult({
        swarm_id: 'swarm_get_result',
        aggregator: 'node_agg',
        output: { data: 'test' },
        confidence: 0.88,
        summary: 'Test completed',
      });

      const result = getAggregatedResult('swarm_get_result');
      expect(result).toBeDefined();
      expect(result?.aggregator).toBe('node_agg');
      expect(result?.output).toEqual({ data: 'test' });
    });
  });

  describe('Bounty Distribution', () => {
    it('should distribute bounty correctly among roles', () => {
      createSwarm({
        swarm_id: 'swarm_bounty',
        title: 'Bounty Test',
        description: 'Test bounty',
        bounty: 100,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      // Create accepted proposal
      submitDecomposition({
        swarm_id: 'swarm_bounty',
        proposer: 'node_decomposer',
        subtasks: [
          { id: 'st_b1', description: 'Bounty 1', weight: 2.0 },
          { id: 'st_b2', description: 'Bounty 2', weight: 3.0 },
        ],
      });
      acceptProposal('swarm_bounty');

      // Assign and complete subtasks
      assignSubtask('st_b1', 'node_solver1');
      assignSubtask('st_b2', 'node_solver2');
      updateSubtaskState('st_b1', 'completed', { result: 'output1' });
      updateSubtaskState('st_b2', 'completed', { result: 'output2' });

      // Submit result
      submitAggregatedResult({
        swarm_id: 'swarm_bounty',
        aggregator: 'node_aggregator',
        output: { final: true },
        confidence: 0.9,
        summary: 'All done',
      });

      const dist = distributeBounty('swarm_bounty', 1000);

      expect(dist.total_bounty).toBe(1000);
      expect(dist.distributions.length).toBeGreaterThan(0);
      expect(dist.settled_at).toBeDefined();

      // Check decomposer share
      const decomposerDist = dist.distributions.find(d => d.role === 'decomposer');
      expect(decomposerDist).toBeDefined();
      expect(decomposerDist?.share).toBe(SWARM_DECOMPOSER_BOUNTY_PCT * 100);

      // Check solver shares sum to solver pct
      const solverDists = dist.distributions.filter(d => d.role === 'solver');
      const solverTotalShare = solverDists.reduce((sum, d) => sum + d.share, 0);
      expect(solverTotalShare).toBeCloseTo(SWARM_SOLVER_BOUNTY_PCT * 100, 0);

      // Check aggregator share
      const aggregatorDist = dist.distributions.find(d => d.role === 'aggregator');
      expect(aggregatorDist).toBeDefined();
      expect(aggregatorDist?.share).toBe(SWARM_AGGREGATOR_BOUNTY_PCT * 100);
    });

    it('should throw for non-existent swarm', () => {
      expect(() => distributeBounty('nonexistent', 100)).toThrow();
    });
  });

  describe('Sessions', () => {
    it('should create and get session', () => {
      const session = createSession({
        session_id: 'sess_001',
        swarm_id: 'swarm_001',
        participants: ['node_001', 'node_002'],
        purpose: 'collaborative solving',
        context: { task: 'analysis' },
      });

      expect(session.session_id).toBe('sess_001');
      expect(session.created_at).toBeDefined();
      expect(session.updated_at).toBeDefined();
      expect(session.participants).toContain('node_001');
      expect(session.participants).toContain('node_002');

      const retrieved = getSession('sess_001');
      expect(retrieved).toBeDefined();
      expect(retrieved?.purpose).toBe('collaborative solving');
    });

    it('should update session context', () => {
      createSession({
        session_id: 'sess_upd',
        swarm_id: 'swarm_001',
        participants: ['node_001'],
        purpose: 'initial',
        context: {},
      });

      const updated = updateSession('sess_upd', {
        context: { progress: '50%', notes: 'test' },
      });
      expect(updated?.context).toEqual({ progress: '50%', notes: 'test' });
      expect(updated?.updated_at).toBeDefined();
    });
  });

  describe('Helpers', () => {
    it('should check if all subtasks are complete', () => {
      createSwarm({
        swarm_id: 'swarm_all_done',
        title: 'All Complete Test',
        description: 'Test all complete',
        bounty: 100,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      createSubtask({
        subtask_id: 'st_all_1',
        swarm_id: 'swarm_all_done',
        description: 'All 1',
        weight: 1.0,
      });

      createSubtask({
        subtask_id: 'st_all_2',
        swarm_id: 'swarm_all_done',
        description: 'All 2',
        weight: 1.0,
      });

      // Not all complete yet
      expect(areAllSubtasksComplete('swarm_all_done')).toBe(false);

      // Complete one
      updateSubtaskState('st_all_1', 'completed');
      expect(areAllSubtasksComplete('swarm_all_done')).toBe(false);

      // Complete both
      updateSubtaskState('st_all_2', 'completed');
      expect(areAllSubtasksComplete('swarm_all_done')).toBe(true);
    });

    it('should return false for swarm with no subtasks', () => {
      createSwarm({
        swarm_id: 'swarm_empty',
        title: 'Empty',
        description: 'No subtasks',
        bounty: 50,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      expect(areAllSubtasksComplete('swarm_empty')).toBe(false);
    });

    it('should get swarm stats', () => {
      createSwarm({
        swarm_id: 'swarm_stats_1',
        title: 'Stats 1',
        description: 'Stats test 1',
        bounty: 100,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      updateSwarmState('swarm_stats_1', 'solving');

      createSwarm({
        swarm_id: 'swarm_stats_2',
        title: 'Stats 2',
        description: 'Stats test 2',
        bounty: 200,
        created_by: 'node_001',
        root_task_id: 'task_002',
      });

      const stats = getSwarmStats();
      expect(stats.total).toBe(2);
      expect(stats.by_state['idle']).toBe(1);
      expect(stats.by_state['solving']).toBe(1);
    });
  });

  describe('State Machine Transitions', () => {
    it('should transition swarm to decomposition when decomposition is submitted', () => {
      createSwarm({
        swarm_id: 'swarm_state_1',
        title: 'State Transition Test',
        description: 'Test state transitions',
        bounty: 100,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      expect(getSwarm('swarm_state_1')?.state).toBe('idle');

      submitDecomposition({
        swarm_id: 'swarm_state_1',
        proposer: 'node_002',
        subtasks: [{ id: 'st_1', description: 'Task 1', weight: 1.0 }],
      });

      expect(getSwarm('swarm_state_1')?.state).toBe('decomposition');
    });

    it('should reset swarm to idle when proposal is rejected', () => {
      createSwarm({
        swarm_id: 'swarm_state_2',
        title: 'Reject Test',
        description: 'Test rejection',
        bounty: 50,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      submitDecomposition({
        swarm_id: 'swarm_state_2',
        proposer: 'node_002',
        subtasks: [{ id: 'st_r1', description: 'Task', weight: 1.0 }],
      });
      expect(getSwarm('swarm_state_2')?.state).toBe('decomposition');

      rejectProposal('swarm_state_2');
      expect(getSwarm('swarm_state_2')?.state).toBe('idle');
    });

    it('should transition swarm through aggregating to completed when result is submitted', () => {
      createSwarm({
        swarm_id: 'swarm_state_3',
        title: 'Aggregate Test',
        description: 'Test aggregation state',
        bounty: 100,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      updateSwarmState('swarm_state_3', 'solving');

      submitAggregatedResult({
        swarm_id: 'swarm_state_3',
        aggregator: 'node_agg',
        output: { answer: 42 },
        confidence: 0.95,
        summary: 'Final',
      });

      // State transitions through aggregating → completed
      expect(getSwarm('swarm_state_3')?.state).toBe('completed');
    });

    it('should auto-transition to aggregating when all subtasks complete', () => {
      createSwarm({
        swarm_id: 'swarm_state_4',
        title: 'Auto Aggregate Test',
        description: 'Test auto transition',
        bounty: 100,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      updateSwarmState('swarm_state_4', 'solving');

      createSubtask({
        subtask_id: 'st_auto_1',
        swarm_id: 'swarm_state_4',
        description: 'Auto 1',
        weight: 1.0,
      });

      createSubtask({
        subtask_id: 'st_auto_2',
        swarm_id: 'swarm_state_4',
        description: 'Auto 2',
        weight: 1.0,
      });

      assignSubtask('st_auto_1', 'node_solver');
      assignSubtask('st_auto_2', 'node_solver');

      // First subtask complete — not all done yet
      updateSubtaskState('st_auto_1', 'completed', { result: 'ok' });
      expect(getSwarm('swarm_state_4')?.state).toBe('solving');

      // Second subtask complete — all done, should auto-transition
      updateSubtaskState('st_auto_2', 'completed', { result: 'ok' });
      expect(getSwarm('swarm_state_4')?.state).toBe('aggregating');
    });

    it('should not transition to aggregating if swarm is not in solving state', () => {
      createSwarm({
        swarm_id: 'swarm_state_5',
        title: 'No Transition Test',
        description: 'Should not transition',
        bounty: 50,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      // Idle state — tryTransitionToAggregating should return undefined
      const result = tryTransitionToAggregating('swarm_state_5');
      expect(result).toBeUndefined();
      expect(getSwarm('swarm_state_5')?.state).toBe('idle');
    });

    it('should not transition to aggregating if not all subtasks are complete', () => {
      createSwarm({
        swarm_id: 'swarm_state_6',
        title: 'Partial Complete Test',
        description: 'Not all complete',
        bounty: 50,
        created_by: 'node_001',
        root_task_id: 'task_001',
      });

      updateSwarmState('swarm_state_6', 'solving');

      createSubtask({
        subtask_id: 'st_partial',
        swarm_id: 'swarm_state_6',
        description: 'Partial',
        weight: 1.0,
      });

      // Only one of two subtasks done — should not transition
      const result = tryTransitionToAggregating('swarm_state_6');
      expect(result).toBeUndefined();
      expect(getSwarm('swarm_state_6')?.state).toBe('solving');
    });
  });
});
