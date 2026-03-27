// Swarm Engine Tests - Comprehensive test suite for multi-node collaboration

import { describe, test, expect, beforeEach } from 'vitest';
import { SwarmEngine } from '../src/swarm/engine.js';
import {
  SwarmState,
  CollaborationMode,
  SwarmRole,
  SubTaskStatus
} from '../src/swarm/types.js';

describe('SwarmEngine', () => {
  let engine: SwarmEngine;

  beforeEach(() => {
    engine = new SwarmEngine();
  });

  describe('createSwarm', () => {
    test('creates a DSA swarm with pending state', () => {
      const swarm = engine.createSwarm({
        id: 'swarm-1',
        mode: CollaborationMode.DSA,
        title: 'Test Swarm',
        description: 'A test swarm',
        proposer_id: 'node-1',
        auto_approved: true
      });

      expect(swarm.id).toBe('swarm-1');
      expect(swarm.mode).toBe(CollaborationMode.DSA);
      expect(swarm.state).toBe(SwarmState.PENDING);
      expect(swarm.proposer_id).toBe('node-1');
    });

    test('creates swarm with pre-defined sub-tasks', () => {
      const swarm = engine.createSwarm({
        id: 'swarm-2',
        mode: CollaborationMode.DSA,
        title: 'Pre-defined Tasks',
        description: 'With sub-tasks',
        proposer_id: 'node-1',
        sub_tasks: [
          { title: 'Task 1', description: 'First', weight: 0.4 },
          { title: 'Task 2', description: 'Second', weight: 0.4 }
        ]
      });

      expect(swarm.sub_tasks).toHaveLength(2);
      expect(swarm.sub_tasks[0].weight).toBe(0.4);
      expect(swarm.sub_tasks[0].status).toBe(SubTaskStatus.OPEN);
    });
  });

  describe('proposeDecomposition (DSA mode)', () => {
    test('proposes decomposition and sets state to DECOMPOSED if auto_approved', () => {
      engine.createSwarm({
        id: 'swarm-1',
        mode: CollaborationMode.DSA,
        title: 'Test',
        description: 'Test',
        proposer_id: 'node-1',
        auto_approved: true
      });

      const result = engine.proposeDecomposition('swarm-1', 'node-1', {
        sub_tasks: [
          { title: 'Task 1', description: 'First', weight: 0.4 },
          { title: 'Task 2', description: 'Second', weight: 0.4 }
        ],
        aggregation_strategy: 'merge'
      });

      expect(result).not.toBeNull();
      expect(result!.state).toBe(SwarmState.DECOMPOSED);
      expect(result!.sub_tasks).toHaveLength(2);
    });

    test('throws error if weight sum exceeds 0.85', () => {
      engine.createSwarm({
        id: 'swarm-1',
        mode: CollaborationMode.DSA,
        title: 'Test',
        description: 'Test',
        proposer_id: 'node-1',
        auto_approved: true
      });

      expect(() =>
        engine.proposeDecomposition('swarm-1', 'node-1', {
          sub_tasks: [
            { title: 'Task 1', description: 'First', weight: 0.5 },
            { title: 'Task 2', description: 'Second', weight: 0.4 }
          ],
          aggregation_strategy: 'merge'
        })
      ).toThrow('weights sum to 0.9, must be ≤ 0.85');
    });

    test('throws error if less than 2 sub-tasks', () => {
      engine.createSwarm({
        id: 'swarm-1',
        mode: CollaborationMode.DSA,
        title: 'Test',
        description: 'Test',
        proposer_id: 'node-1',
        auto_approved: true
      });

      expect(() =>
        engine.proposeDecomposition('swarm-1', 'node-1', {
          sub_tasks: [
            { title: 'Task 1', description: 'Only one', weight: 0.5 }
          ],
          aggregation_strategy: 'merge'
        })
      ).toThrow('Must have 2-10 sub-tasks');
    });
  });

  describe('claimSubTask', () => {
    test('allows solver to claim an open sub-task', () => {
      engine.createSwarm({
        id: 'swarm-1',
        mode: CollaborationMode.DSA,
        title: 'Test',
        description: 'Test',
        proposer_id: 'node-1',
        auto_approved: true,
        sub_tasks: [
          { title: 'Task 1', description: 'First', weight: 0.4 },
          { title: 'Task 2', description: 'Second', weight: 0.4 }
        ]
      });

      // Propose decomposition first
      engine.proposeDecomposition('swarm-1', 'node-1', {
        sub_tasks: [
          { title: 'Task 1', description: 'First', weight: 0.4 },
          { title: 'Task 2', description: 'Second', weight: 0.4 }
        ],
        aggregation_strategy: 'merge'
      });

      const subTask = engine.claimSubTask('swarm-1', 'swarm-1-st-0', 'node-2');

      expect(subTask).not.toBeNull();
      expect(subTask!.status).toBe(SubTaskStatus.CLAIMED);
      expect(subTask!.solver_id).toBe('node-2');
    });

    test('returns null if sub-task already claimed', () => {
      engine.createSwarm({
        id: 'swarm-1',
        mode: CollaborationMode.DSA,
        title: 'Test',
        description: 'Test',
        proposer_id: 'node-1',
        auto_approved: true,
        sub_tasks: [
          { title: 'Task 1', description: 'First', weight: 0.4 },
          { title: 'Task 2', description: 'Second', weight: 0.4 }
        ]
      });

      engine.proposeDecomposition('swarm-1', 'node-1', {
        sub_tasks: [
          { title: 'Task 1', description: 'First', weight: 0.4 },
          { title: 'Task 2', description: 'Second', weight: 0.4 }
        ],
        aggregation_strategy: 'merge'
      });

      engine.claimSubTask('swarm-1', 'swarm-1-st-0', 'node-2');
      const secondClaim = engine.claimSubTask('swarm-1', 'swarm-1-st-0', 'node-3');

      expect(secondClaim).toBeNull();
    });
  });

  describe('completeSubTask', () => {
    test('marks sub-task as completed and stores solution', () => {
      engine.createSwarm({
        id: 'swarm-1',
        mode: CollaborationMode.DSA,
        title: 'Test',
        description: 'Test',
        proposer_id: 'node-1',
        auto_approved: true,
        sub_tasks: [
          { title: 'Task 1', description: 'First', weight: 0.4 },
          { title: 'Task 2', description: 'Second', weight: 0.4 }
        ]
      });

      engine.proposeDecomposition('swarm-1', 'node-1', {
        sub_tasks: [
          { title: 'Task 1', description: 'First', weight: 0.4 },
          { title: 'Task 2', description: 'Second', weight: 0.4 }
        ],
        aggregation_strategy: 'merge'
      });

      engine.claimSubTask('swarm-1', 'swarm-1-st-0', 'node-2');
      const result = engine.completeSubTask(
        'swarm-1',
        'swarm-1-st-0',
        'node-2',
        'Solution for task 1'
      );

      expect(result).not.toBeNull();
      expect(result!.sub_tasks[0].status).toBe(SubTaskStatus.COMPLETED);
      expect(result!.sub_tasks[0].solution).toBe('Solution for task 1');
    });

    test('transitions to AGGREGATING when all sub-tasks complete', () => {
      engine.createSwarm({
        id: 'swarm-1',
        mode: CollaborationMode.DSA,
        title: 'Test',
        description: 'Test',
        proposer_id: 'node-1',
        auto_approved: true,
        sub_tasks: [
          { title: 'Task 1', description: 'First', weight: 0.4 },
          { title: 'Task 2', description: 'Second', weight: 0.4 }
        ]
      });

      engine.proposeDecomposition('swarm-1', 'node-1', {
        sub_tasks: [
          { title: 'Task 1', description: 'First', weight: 0.4 },
          { title: 'Task 2', description: 'Second', weight: 0.4 }
        ],
        aggregation_strategy: 'merge'
      });

      engine.claimSubTask('swarm-1', 'swarm-1-st-0', 'node-2');
      engine.completeSubTask('swarm-1', 'swarm-1-st-0', 'node-2', 'Solution 1');

      engine.claimSubTask('swarm-1', 'swarm-1-st-1', 'node-3');
      const result = engine.completeSubTask(
        'swarm-1',
        'swarm-1-st-1',
        'node-3',
        'Solution 2'
      );

      expect(result!.state).toBe(SwarmState.AGGREGATING);
    });
  });

  describe('aggregateResults', () => {
    test('completes swarm and calculates correct rewards', () => {
      engine.createSwarm({
        id: 'swarm-1',
        mode: CollaborationMode.DSA,
        title: 'Test',
        description: 'Test',
        proposer_id: 'node-1',
        auto_approved: true,
        sub_tasks: [
          { title: 'Task 1', description: 'First', weight: 0.4 },
          { title: 'Task 2', description: 'Second', weight: 0.4 }
        ]
      });

      engine.proposeDecomposition('swarm-1', 'node-1', {
        sub_tasks: [
          { title: 'Task 1', description: 'First', weight: 0.4 },
          { title: 'Task 2', description: 'Second', weight: 0.4 }
        ],
        aggregation_strategy: 'merge'
      });

      engine.claimSubTask('swarm-1', 'swarm-1-st-0', 'node-2');
      engine.completeSubTask('swarm-1', 'swarm-1-st-0', 'node-2', 'Solution 1');

      engine.claimSubTask('swarm-1', 'swarm-1-st-1', 'node-3');
      engine.completeSubTask('swarm-1', 'swarm-1-st-1', 'node-3', 'Solution 2');

      const result = engine.aggregateResults(
        'swarm-1',
        'node-4',
        'Aggregated Result'
      );

      expect(result).not.toBeNull();
      expect(result!.state).toBe(SwarmState.COMPLETED);
      expect(result!.rewards.proposer).toBe(5);  // 5%
      expect(result!.rewards.aggregator).toBe(10); // 10%
      expect(result!.rewards.solvers).toBe(85);   // 85%
      expect(result!.aggregated_result).toBe('Aggregated Result');
    });
  });

  describe('DC mode (Diverge-Converge)', () => {
    test('creates DC mode swarm', () => {
      const swarm = engine.createSwarm({
        id: 'swarm-dc-1',
        mode: CollaborationMode.DC,
        title: 'DC Test',
        description: 'DC mode test',
        proposer_id: 'node-1'
      });

      expect(swarm.mode).toBe(CollaborationMode.DC);
      expect(swarm.state).toBe(SwarmState.PENDING);
    });

    test('submits perspectives and converges', () => {
      engine.createSwarm({
        id: 'swarm-dc-1',
        mode: CollaborationMode.DC,
        title: 'DC Test',
        description: 'DC mode test',
        proposer_id: 'node-1'
      });

      engine.submitPerspective('swarm-dc-1', 'node-2', 'Perspective A');
      engine.submitPerspective('swarm-dc-1', 'node-3', 'Perspective B');

      const result = engine.converge('swarm-dc-1', 'node-4', 'Converged Result');

      expect(result).not.toBeNull();
      expect(result!.state).toBe(SwarmState.COMPLETED);
      expect(result!.aggregated_result).toBe('Converged Result');
    });

    test('throws error if converging with less than 2 perspectives', () => {
      engine.createSwarm({
        id: 'swarm-dc-1',
        mode: CollaborationMode.DC,
        title: 'DC Test',
        description: 'DC mode test',
        proposer_id: 'node-1'
      });

      engine.submitPerspective('swarm-dc-1', 'node-2', 'Only one perspective');

      expect(() =>
        engine.converge('swarm-dc-1', 'node-3', 'Converged')
      ).toThrow('At least 2 perspectives required');
    });
  });

  describe('timeout handling', () => {
    test('marks swarm as timed out after timeout period', () => {
      engine.createSwarm({
        id: 'swarm-timeout',
        mode: CollaborationMode.DSA,
        title: 'Timeout Test',
        description: 'Test',
        proposer_id: 'node-1',
        timeout_ms: 1 // 1ms timeout for testing
      });

      // Wait for timeout
      setTimeout(() => {
        const timedOut = engine.checkTimeouts();
        expect(timedOut).toContain('swarm-timeout');

        const swarm = engine.getSwarm('swarm-timeout');
        expect(swarm!.state).toBe(SwarmState.TIMEOUT);
      }, 10);
    });
  });

  describe('cancel', () => {
    test('allows proposer to cancel swarm', () => {
      engine.createSwarm({
        id: 'swarm-cancel',
        mode: CollaborationMode.DSA,
        title: 'Cancel Test',
        description: 'Test',
        proposer_id: 'node-1'
      });

      const success = engine.cancel('swarm-cancel', 'node-1');
      expect(success).toBe(true);

      const swarm = engine.getSwarm('swarm-cancel');
      expect(swarm!.state).toBe(SwarmState.CANCELLED);
    });

    test('prevents non-proposer from cancelling', () => {
      engine.createSwarm({
        id: 'swarm-cancel',
        mode: CollaborationMode.DSA,
        title: 'Cancel Test',
        description: 'Test',
        proposer_id: 'node-1'
      });

      const success = engine.cancel('swarm-cancel', 'node-2');
      expect(success).toBe(false);
    });
  });

  describe('getStatus', () => {
    test('returns correct status summary', () => {
      engine.createSwarm({
        id: 'swarm-status',
        mode: CollaborationMode.DSA,
        title: 'Status Test',
        description: 'Test',
        proposer_id: 'node-1',
        auto_approved: true,
        sub_tasks: [
          { title: 'Task 1', description: 'First', weight: 0.4 },
          { title: 'Task 2', description: 'Second', weight: 0.4 }
        ]
      });

      engine.proposeDecomposition('swarm-status', 'node-1', {
        sub_tasks: [
          { title: 'Task 1', description: 'First', weight: 0.4 },
          { title: 'Task 2', description: 'Second', weight: 0.4 }
        ],
        aggregation_strategy: 'merge'
      });

      engine.claimSubTask('swarm-status', 'swarm-status-st-0', 'node-2');
      engine.completeSubTask('swarm-status', 'swarm-status-st-0', 'node-2', 'Solution');

      const status = engine.getStatus('swarm-status');

      expect(status).not.toBeNull();
      expect(status!.state).toBe(SwarmState.SOLVING);
      expect(status!.sub_tasks_total).toBe(2);
      expect(status!.sub_tasks_completed).toBe(1);
      expect(status!.solvers_count).toBe(1);
    });
  });
});
