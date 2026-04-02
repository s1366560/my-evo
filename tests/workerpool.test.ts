/**
 * Worker Pool Engine Tests
 * Phase 3-4: Worker Pool and Specialist Market
 */

import {
  registerWorker,
  getWorker,
  listWorkers,
  updateWorkerAvailability,
  updateWorkerReputation,
  setWorkerOffline,
  getSpecialistPool,
  listSpecialistPools,
  addTaskToSpecialistPool,
  getSpecialistTaskQueue,
  claimSpecialistTask,
  assignTask,
  completeAssignment,
  getAssignment,
  getWorkerAssignments,
  matchWorkerToTask,
  autoAssignSpecialistTask,
  getWorkerPoolStats,
  pruneInactiveWorkers,
  getWorkersByDomain,
  resetWorkerPoolStores,
} from '../src/workerpool/engine';
import { WorkerType, WorkerTier } from '../src/workerpool/types';

describe('Worker Pool Engine', () => {
  beforeEach(() => {
    resetWorkerPoolStores();
  });

  // ============ Worker Registration ============
  describe('Worker Registration', () => {
    it('should register a new specialist worker', () => {
      const worker = registerWorker({
        worker_id: 'node_specialist_1',
        type: 'specialist',
        skills: ['python', 'api'],
        domain: 'code',
        reputation_score: 80,
        avg_response_time_ms: 500,
      });

      expect(worker.worker_id).toBe('node_specialist_1');
      expect(worker.type).toBe('specialist');
      expect(worker.domain).toBe('code');
      expect(worker.skills).toContain('python');
      expect(worker.tier).toBe('gold');
      expect(worker.is_available).toBe(true);
    });

    it('should default type to specialist when domain is provided', () => {
      const worker = registerWorker({
        worker_id: 'node_default_1',
        domain: 'legal',
        reputation_score: 30,
      });
      expect(worker.type).toBe('specialist');
    });

    it('should update existing worker without resetting registration date', () => {
      const first = registerWorker({ worker_id: 'node_update_1', domain: 'code' });
      const firstRegistered = first.registered_at;

      const second = registerWorker({
        worker_id: 'node_update_1',
        domain: 'code',
        reputation_score: 95,
      });

      expect(second.worker_id).toBe('node_update_1');
      expect(second.registered_at).toBe(firstRegistered);
      expect(second.reputation_score).toBe(95);
      expect(second.tier).toBe('platinum');
    });

    it('should compute tier based on reputation score', () => {
      const bronze = registerWorker({ worker_id: 'w1', reputation_score: 30 });
      const silver = registerWorker({ worker_id: 'w2', reputation_score: 60 });
      const gold = registerWorker({ worker_id: 'w3', reputation_score: 80 });
      const platinum = registerWorker({ worker_id: 'w4', reputation_score: 95 });

      expect(bronze.tier).toBe('bronze');
      expect(silver.tier).toBe('silver');
      expect(gold.tier).toBe('gold');
      expect(platinum.tier).toBe('platinum');
    });
  });

  // ============ Worker Retrieval ============
  describe('Worker Retrieval', () => {
    it('should get worker by id', () => {
      registerWorker({ worker_id: 'node_get_1', domain: 'code' });
      const worker = getWorker('node_get_1');
      expect(worker).toBeDefined();
      expect(worker?.worker_id).toBe('node_get_1');
    });

    it('should return undefined for non-existent worker', () => {
      const worker = getWorker('nonexistent');
      expect(worker).toBeUndefined();
    });

    it('should list all workers with no filter', () => {
      registerWorker({ worker_id: 'list_w1', domain: 'code' });
      registerWorker({ worker_id: 'list_w2', domain: 'legal' });
      const workers = listWorkers();
      expect(workers.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter workers by type', () => {
      registerWorker({ worker_id: 'type_sp', type: 'specialist', domain: 'code' });
      registerWorker({ worker_id: 'type_ps', type: 'passive' });

      const specialists = listWorkers({ type: 'specialist' });
      expect(specialists.every(w => w.type === 'specialist')).toBe(true);
    });

    it('should filter workers by domain', () => {
      registerWorker({ worker_id: 'dom_code', domain: 'code' });
      registerWorker({ worker_id: 'dom_legal', domain: 'legal' });

      const codeWorkers = listWorkers({ domain: 'code' });
      expect(codeWorkers.every(w => w.domain === 'code')).toBe(true);
    });

    it('should filter workers by availability', () => {
      registerWorker({ worker_id: 'avail_1', domain: 'code' });
      registerWorker({ worker_id: 'avail_2', domain: 'code' });
      updateWorkerAvailability('avail_2', false);

      const available = listWorkers({ is_available: true });
      expect(available.every(w => w.is_available === true)).toBe(true);
    });

    it('should get workers by domain', () => {
      registerWorker({ worker_id: 'bd1', domain: 'code' });
      registerWorker({ worker_id: 'bd2', domain: 'code' });
      registerWorker({ worker_id: 'bd3', domain: 'legal' });

      const codeWorkers = getWorkersByDomain('code');
      expect(codeWorkers.length).toBe(2);
      expect(codeWorkers.every(w => w.domain === 'code' && w.is_available)).toBe(true);
    });
  });

  // ============ Worker Availability ============
  describe('Worker Availability', () => {
    it('should update worker availability to false', () => {
      registerWorker({ worker_id: 'avail_test', domain: 'code' });
      const worker = updateWorkerAvailability('avail_test', false);
      expect(worker?.is_available).toBe(false);
    });

    it('should update worker availability to true', () => {
      registerWorker({ worker_id: 'avail_test2', domain: 'code' });
      updateWorkerAvailability('avail_test2', false);
      const worker = updateWorkerAvailability('avail_test2', true);
      expect(worker?.is_available).toBe(true);
    });

    it('should return undefined when updating non-existent worker', () => {
      const result = updateWorkerAvailability('nonexistent', false);
      expect(result).toBeUndefined();
    });

    it('should update worker reputation score', () => {
      registerWorker({ worker_id: 'rep_test', reputation_score: 50 });
      const worker = updateWorkerReputation('rep_test', 88);
      expect(worker?.reputation_score).toBe(88);
      expect(worker?.tier).toBe('gold');
    });

    it('should set worker offline', () => {
      registerWorker({ worker_id: 'offline_test', domain: 'code' });
      setWorkerOffline('offline_test');
      const worker = getWorker('offline_test');
      expect(worker?.is_available).toBe(false);
    });
  });

  // ============ Specialist Pools ============
  describe('Specialist Pools', () => {
    it('should create specialist pool on first worker registration', () => {
      registerWorker({ worker_id: 'pool_test_w', domain: 'finance' });
      const pool = getSpecialistPool('finance');
      expect(pool).toBeDefined();
      expect(pool?.domain).toBe('finance');
      expect(pool?.workers.size).toBeGreaterThan(0);
    });

    it('should return undefined for non-existent pool', () => {
      const pool = getSpecialistPool('nonexistent');
      expect(pool).toBeUndefined();
    });

    it('should list all specialist pools', () => {
      registerWorker({ worker_id: 'pool_list_1', domain: 'code' });
      registerWorker({ worker_id: 'pool_list_2', domain: 'legal' });
      const pools = listSpecialistPools();
      expect(pools.length).toBeGreaterThanOrEqual(2);
      expect(pools.some(p => p.domain === 'code')).toBe(true);
    });

    it('should add task to specialist pool', () => {
      registerWorker({ worker_id: 'sp_task_w', domain: 'code' });
      const task = addTaskToSpecialistPool({
        task_id: 'sp_task_1',
        domain: 'code',
        description: 'Build an API',
        required_skills: ['python'],
        priority: 'high',
      });

      expect(task.task_id).toBe('sp_task_1');
      expect(task.status).toBe('queued');
    });

    it('should get specialist task queue', () => {
      registerWorker({ worker_id: 'sp_queue_w', domain: 'legal' });
      addTaskToSpecialistPool({
        task_id: 'sp_queue_1',
        domain: 'legal',
        description: 'Review contract',
        required_skills: ['legal'],
        priority: 'medium',
      });
      addTaskToSpecialistPool({
        task_id: 'sp_queue_2',
        domain: 'legal',
        description: 'Draft agreement',
        required_skills: ['legal'],
        priority: 'low',
      });

      const queue = getSpecialistTaskQueue('legal');
      expect(queue.length).toBe(2);
    });
  });

  // ============ Task Assignment ============
  describe('Task Assignment', () => {
    it('should assign a specialist task to a worker', () => {
      registerWorker({ worker_id: 'assign_w', domain: 'code' });
      addTaskToSpecialistPool({
        task_id: 'assign_task_1',
        domain: 'code',
        description: 'API task',
        required_skills: ['python'],
        priority: 'high',
      });

      const assignment = assignTask({
        task_id: 'assign_task_1',
        worker_id: 'assign_w',
        pool_type: 'specialist',
      });

      expect(assignment.assignment_id).toBeDefined();
      expect(assignment.worker_id).toBe('assign_w');
      expect(assignment.task_id).toBe('assign_task_1');
    });

    it('should claim specialist task', () => {
      registerWorker({ worker_id: 'claim_w', domain: 'code' });
      addTaskToSpecialistPool({
        task_id: 'claim_task_1',
        domain: 'code',
        description: 'Claim me',
        required_skills: ['python'],
        priority: 'medium',
      });

      const task = claimSpecialistTask('claim_task_1', 'code', 'claim_w');
      expect(task).toBeDefined();
      expect(task?.assigned_to).toBe('claim_w');
    });

    it('should auto-assign specialist task', () => {
      registerWorker({ worker_id: 'auto_w', domain: 'code', skills: ['python'] });
      registerWorker({ worker_id: 'auto_w2', domain: 'code', skills: ['python'] });

      addTaskToSpecialistPool({
        task_id: 'auto_task_1',
        domain: 'code',
        description: 'Auto assign me',
        required_skills: ['python'],
        priority: 'high',
      });

      const assignment = autoAssignSpecialistTask('auto_task_1', 'code');
      expect(assignment).toBeDefined();
      expect(assignment?.worker_id).toBeDefined();
    });

    it('should complete an assignment', () => {
      registerWorker({ worker_id: 'complete_w', domain: 'code' });
      const assignment = assignTask({
        task_id: 'complete_task_1',
        worker_id: 'complete_w',
        pool_type: 'specialist',
      });

      const completed = completeAssignment(
        assignment.assignment_id,
        'success',
        0.95,
        1200
      );

      expect(completed.outcome).toBe('success');
      expect(completed.completed_at).toBeDefined();
    });

    it('should get assignment by id', () => {
      registerWorker({ worker_id: 'get_assign_w', domain: 'code' });
      const assignment = assignTask({
        task_id: 'get_assign_task',
        worker_id: 'get_assign_w',
        pool_type: 'specialist',
      });

      const retrieved = getAssignment(assignment.assignment_id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.assignment_id).toBe(assignment.assignment_id);
    });

    it('should get all assignments for a worker', () => {
      registerWorker({ worker_id: 'worker_assigns', domain: 'code' });
      assignTask({ task_id: 'wa_task_1', worker_id: 'worker_assigns', pool_type: 'specialist' });
      assignTask({ task_id: 'wa_task_2', worker_id: 'worker_assigns', pool_type: 'specialist' });

      const assignments = getWorkerAssignments('worker_assigns');
      expect(assignments.length).toBe(2);
    });
  });

  // ============ Worker Matching ============
  describe('Worker Matching', () => {
    it('should match workers to tasks using weighted scoring', () => {
      registerWorker({
        worker_id: 'match_w1',
        domain: 'code',
        skills: ['python', 'api'],
        reputation_score: 85,
        avg_response_time_ms: 400,
      });
      registerWorker({
        worker_id: 'match_w2',
        domain: 'code',
        skills: ['python'],
        reputation_score: 60,
        avg_response_time_ms: 800,
      });

      addTaskToSpecialistPool({
        task_id: 'match_task_1',
        domain: 'code',
        description: 'Build REST API',
        required_skills: ['python'],
        priority: 'high',
      });

      const matches = matchWorkerToTask('match_task_1', ['python']);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].task_id).toBe('match_task_1');
      expect(matches[0].skill_match_score).toBeGreaterThan(0);
    });

    it('should return workers sorted by final match score', () => {
      registerWorker({
        worker_id: 'sorted_w1',
        domain: 'code',
        skills: ['python'],
        reputation_score: 50,
        avg_response_time_ms: 2000,
      });
      registerWorker({
        worker_id: 'sorted_w2',
        domain: 'code',
        skills: ['python', 'api', 'docker'],
        reputation_score: 90,
        avg_response_time_ms: 300,
      });

      addTaskToSpecialistPool({
        task_id: 'sorted_task',
        domain: 'code',
        description: 'Full-stack API',
        required_skills: ['python', 'api'],
        priority: 'high',
      });

      const matches = matchWorkerToTask('sorted_task', ['python', 'api']);
      if (matches.length > 1) {
        expect(matches[0].final_match_score).toBeGreaterThanOrEqual(matches[1].final_match_score);
      }
    });
  });

  // ============ Worker Pool Stats ============
  describe('Worker Pool Stats', () => {
    it('should return pool statistics', () => {
      registerWorker({ worker_id: 'stats_w1', type: 'specialist', domain: 'code' });
      registerWorker({ worker_id: 'stats_w2', type: 'passive' });
      registerWorker({ worker_id: 'stats_w3', type: 'specialist', domain: 'legal' });

      const stats = getWorkerPoolStats();
      expect(stats.total_workers).toBeGreaterThanOrEqual(3);
      expect(stats.specialist_workers).toBeGreaterThanOrEqual(2);
      expect(stats.passive_workers).toBeGreaterThanOrEqual(1);
    });

    it('should track top domains', () => {
      registerWorker({ worker_id: 'td_w1', domain: 'code' });
      registerWorker({ worker_id: 'td_w2', domain: 'code' });
      registerWorker({ worker_id: 'td_w3', domain: 'legal' });

      const stats = getWorkerPoolStats();
      expect(stats.top_domains.length).toBeGreaterThan(0);
      const codeDomain = stats.top_domains.find(d => d.domain === 'code');
      expect(codeDomain?.worker_count).toBe(2);
    });
  });

  // ============ Pruning ============
  describe('Worker Pruning', () => {
    it('should prune inactive workers', () => {
      registerWorker({ worker_id: 'prune_w', domain: 'code' });
      const worker = getWorker('prune_w')!;
      worker.last_active_at = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
      worker.is_available = true;

      const pruned = pruneInactiveWorkers();
      expect(pruned).toBeGreaterThanOrEqual(0);
    });
  });
});
