/**
 * Worker Pool Engine
 * Phase 3-4: Distributed task execution across swarm nodes
 *
 * Features:
 * - Worker registration (active, passive, specialist)
 * - Specialist pools by domain
 * - Task-to-worker matchmaking with weighted scoring
 * - Load balancing and availability management
 */

import {
  WorkerPoolWorker,
  WorkerType,
  SpecialistPool,
  SpecialistTask,
  WorkerAssignment,
  WorkerMatchScore,
  WorkerPoolStats,
  WorkerTaskHistory,
  WorkerTier,
  WORKER_MATCH_WEIGHTS,
  WORKER_TIER_THRESHOLDS,
  DEFAULT_MAX_CONCURRENT_TASKS,
  WORKER_INACTIVE_THRESHOLD_MS,
} from './types';

// ============ In-Memory Stores ============
const workers = new Map<string, WorkerPoolWorker>();
const specialistPools = new Map<string, SpecialistPool>();
const specialistTaskQueue = new Map<string, SpecialistTask[]>(); // domain → tasks
const assignments = new Map<string, WorkerAssignment>();
const workerAssignments = new Map<string, Set<string>>(); // worker_id → assignment_ids

// Domain → worker_ids index
const domainWorkerIndex = new Map<string, Set<string>>();

// ============ Worker Registration ============

export function registerWorker(input: {
  worker_id: string;
  type?: WorkerType;
  skills?: string[];
  domain?: string;
  reputation_score?: number;
  avg_response_time_ms?: number;
  max_concurrent_tasks?: number;
}): WorkerPoolWorker {
  const now = new Date().toISOString();
  const existing = workers.get(input.worker_id);

  const worker: WorkerPoolWorker = {
    worker_id: input.worker_id,
    type: input.type ?? (input.domain ? 'specialist' : 'passive'),
    skills: input.skills ?? [],
    domain: input.domain,
    reputation_score: input.reputation_score ?? 50,
    avg_response_time_ms: input.avg_response_time_ms ?? 0,
    task_history: existing?.task_history ?? [],
    registered_at: existing?.registered_at ?? now,
    last_active_at: now,
    max_concurrent_tasks: input.max_concurrent_tasks ?? DEFAULT_MAX_CONCURRENT_TASKS,
    current_load: existing?.current_load ?? 0,
    is_available: existing?.is_available ?? true,
    tier: computeWorkerTier(input.reputation_score ?? existing?.reputation_score ?? 50),
  };

  workers.set(input.worker_id, worker);

  // Index by domain if specialist
  if (worker.domain) {
    if (!domainWorkerIndex.has(worker.domain)) {
      domainWorkerIndex.set(worker.domain, new Set());
    }
    domainWorkerIndex.get(worker.domain)!.add(worker.worker_id);

    // Ensure specialist pool exists
    if (!specialistPools.has(worker.domain)) {
      specialistPools.set(worker.domain, {
        domain: worker.domain,
        workers: new Set(),
        task_queue: [],
        created_at: now,
        total_tasks_completed: 0,
        avg_quality_score: 0,
      });
    }
    specialistPools.get(worker.domain)!.workers.add(worker.worker_id);
  }

  return worker;
}

export function getWorker(workerId: string): WorkerPoolWorker | undefined {
  return workers.get(workerId);
}

export function listWorkers(filter?: {
  type?: WorkerType;
  domain?: string;
  is_available?: boolean;
  min_reputation?: number;
}): WorkerPoolWorker[] {
  let result = [...workers.values()];
  const { type, domain, is_available, min_reputation } = filter ?? {};
  if (type) result = result.filter(w => w.type === type);
  if (domain) result = result.filter(w => w.domain === domain);
  if (is_available !== undefined) result = result.filter(w => w.is_available === is_available);
  if (min_reputation !== undefined) result = result.filter(w => w.reputation_score >= min_reputation);
  return result.sort((a, b) => b.reputation_score - a.reputation_score);
}

export function updateWorkerAvailability(workerId: string, available: boolean): WorkerPoolWorker | undefined {
  const worker = workers.get(workerId);
  if (!worker) return undefined;
  worker.is_available = available;
  worker.last_active_at = new Date().toISOString();
  return worker;
}

export function updateWorkerReputation(workerId: string, score: number): WorkerPoolWorker | undefined {
  const worker = workers.get(workerId);
  if (!worker) return undefined;
  worker.reputation_score = score;
  worker.tier = computeWorkerTier(score);
  return worker;
}

export function setWorkerOffline(workerId: string): void {
  const worker = workers.get(workerId);
  if (!worker) return;
  worker.is_available = false;
  worker.last_active_at = new Date().toISOString();
}

// ============ Specialist Pools ============

export function getSpecialistPool(domain: string): SpecialistPool | undefined {
  return specialistPools.get(domain);
}

export function listSpecialistPools(): SpecialistPool[] {
  return [...specialistPools.values()];
}

export function addTaskToSpecialistPool(task: Omit<SpecialistTask, 'status' | 'created_at'>): SpecialistTask {
  const now = new Date().toISOString();
  const t: SpecialistTask = {
    ...task,
    status: 'queued',
    created_at: now,
  };

  if (!specialistTaskQueue.has(task.domain)) {
    specialistTaskQueue.set(task.domain, []);
  }
  specialistTaskQueue.get(task.domain)!.push(t);

  // Update pool stats
  if (specialistPools.has(task.domain)) {
    const pool = specialistPools.get(task.domain)!;
    // Maintain sorted queue by priority
    const queue = specialistTaskQueue.get(task.domain)!;
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    queue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  return t;
}

export function getSpecialistTaskQueue(domain: string): SpecialistTask[] {
  return specialistTaskQueue.get(domain) ?? [];
}

export function claimSpecialistTask(
  taskId: string,
  domain: string,
  workerId: string
): SpecialistTask | undefined {
  const queue = specialistTaskQueue.get(domain);
  if (!queue) return undefined;
  const idx = queue.findIndex(t => t.task_id === taskId);
  if (idx === -1) return undefined;
  const task = queue[idx];
  if (task.assigned_to) return undefined; // already claimed

  task.assigned_to = workerId;
  task.status = 'assigned';

  // Increment worker load
  const worker = workers.get(workerId);
  if (worker) worker.current_load += 1;

  return task;
}

// ============ Task Assignment ============

export function assignTask(input: {
  task_id: string;
  worker_id: string;
  pool_type: 'specialist' | 'bounty' | 'swarm';
}): WorkerAssignment {
  const now = new Date().toISOString();
  const assignment: WorkerAssignment = {
    assignment_id: `asgn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    task_id: input.task_id,
    worker_id: input.worker_id,
    pool_type: input.pool_type,
    assigned_at: now,
    started_at: now,
  };

  assignments.set(assignment.assignment_id, assignment);

  if (!workerAssignments.has(input.worker_id)) {
    workerAssignments.set(input.worker_id, new Set());
  }
  workerAssignments.get(input.worker_id)!.add(assignment.assignment_id);

  // Update worker load
  const worker = workers.get(input.worker_id);
  if (worker) {
    worker.current_load += 1;
    worker.last_active_at = now;
  }

  return assignment;
}

export function completeAssignment(
  assignmentId: string,
  outcome: 'success' | 'failed' | 'partial',
  quality_score?: number,
  response_time_ms?: number
): WorkerAssignment | undefined {
  const assignment = assignments.get(assignmentId);
  if (!assignment) return undefined;

  assignment.completed_at = new Date().toISOString();
  assignment.outcome = outcome;
  assignment.quality_score = quality_score;
  assignment.response_time_ms = response_time_ms;

  // Update worker load and history
  const worker = workers.get(assignment.worker_id);
  if (worker) {
    worker.current_load = Math.max(0, worker.current_load - 1);
    worker.last_active_at = new Date().toISOString();

    const historyEntry: WorkerTaskHistory = {
      task_id: assignment.task_id,
      task_type: assignment.pool_type,
      outcome,
      completed_at: assignment.completed_at!,
      score: quality_score,
      response_time_ms: response_time_ms ?? 0,
    };
    worker.task_history.push(historyEntry);

    // Keep only last 100 entries
    if (worker.task_history.length > 100) {
      worker.task_history = worker.task_history.slice(-100);
    }

    // Update average response time (exponential moving average)
    if (response_time_ms !== undefined) {
      const alpha = 0.2;
      worker.avg_response_time_ms = Math.round(
        alpha * response_time_ms + (1 - alpha) * worker.avg_response_time_ms
      );
    }

    // Update specialist pool stats if applicable
    if (assignment.pool_type === 'specialist') {
      updateSpecialistPoolStats(worker.domain);
    }
  }

  return assignment;
}

export function getAssignment(assignmentId: string): WorkerAssignment | undefined {
  return assignments.get(assignmentId);
}

export function getWorkerAssignments(workerId: string): WorkerAssignment[] {
  const ids = workerAssignments.get(workerId);
  if (!ids) return [];
  return [...ids].map(id => assignments.get(id)!).filter(Boolean);
}

// ============ Matchmaking ============

/**
 * Find the best worker for a task based on weighted scoring
 * Score = 0.30*skill_match + 0.25*success_rate + 0.20*response_time + 0.15*reputation
 */
export function matchWorkerToTask(
  taskId: string,
  requiredSkills: string[],
  bounty?: number
): WorkerMatchScore[] {
  const candidates = listWorkers({
    type: 'specialist',
    is_available: true,
  }).filter(w => w.current_load < w.max_concurrent_tasks);

  // Filter by skill overlap
  const scored: WorkerMatchScore[] = candidates.map(worker => {
    const skillMatch = calculateSkillMatch(worker.skills, requiredSkills);
    const successRate = calculateSuccessRate(worker);
    const responseScore = calculateResponseTimeScore(worker.avg_response_time_ms);
    const repScore = worker.reputation_score / 100;

    const finalScore =
      WORKER_MATCH_WEIGHTS.skill_match * skillMatch +
      WORKER_MATCH_WEIGHTS.success_rate * successRate +
      WORKER_MATCH_WEIGHTS.response_time * responseScore +
      WORKER_MATCH_WEIGHTS.reputation * repScore;

    return {
      worker_id: worker.worker_id,
      task_id: taskId,
      skill_match_score: Math.round(skillMatch * 100) / 100,
      success_rate_score: Math.round(successRate * 100) / 100,
      response_time_score: Math.round(responseScore * 100) / 100,
      reputation_score: Math.round(repScore * 100) / 100,
      final_match_score: Math.round(finalScore * 100) / 100,
      is_available: worker.is_available && worker.current_load < worker.max_concurrent_tasks,
    };
  });

  return scored.sort((a, b) => b.final_match_score - a.final_match_score);
}

/**
 * Auto-assign best available worker to a specialist task
 */
export function autoAssignSpecialistTask(taskId: string, domain: string): WorkerAssignment | undefined {
  const queue = specialistTaskQueue.get(domain);
  if (!queue) return undefined;
  const task = queue.find(t => t.task_id === taskId && t.status === 'queued');
  if (!task) return undefined;

  const matches = matchWorkerToTask(taskId, task.required_skills, task.bounty);
  const best = matches.find(m => m.is_available);
  if (!best) return undefined;

  // Update task status
  claimSpecialistTask(taskId, domain, best.worker_id);

  // Create assignment
  return assignTask({
    task_id: taskId,
    worker_id: best.worker_id,
    pool_type: 'specialist',
  });
}

function calculateSkillMatch(workerSkills: string[], requiredSkills: string[]): number {
  if (requiredSkills.length === 0) return 1.0;
  const matchCount = requiredSkills.filter(s =>
    workerSkills.some(ws => ws.toLowerCase() === s.toLowerCase())
  ).length;
  return matchCount / requiredSkills.length;
}

function calculateSuccessRate(worker: WorkerPoolWorker): number {
  if (worker.task_history.length === 0) return 0.5; // default for new workers
  const successCount = worker.task_history.filter(h => h.outcome === 'success').length;
  const partialCount = worker.task_history.filter(h => h.outcome === 'partial').length * 0.5;
  return (successCount + partialCount) / worker.task_history.length;
}

function calculateResponseTimeScore(avgMs: number): number {
  // Assume 5min (300000ms) is poor, 0ms is perfect
  // Using exponential decay: score = e^(-ms / 300000)
  if (avgMs === 0) return 1.0;
  return Math.exp(-avgMs / 300000);
}

function computeWorkerTier(reputationScore: number): WorkerTier {
  if (reputationScore >= WORKER_TIER_THRESHOLDS.platinum) return 'platinum';
  if (reputationScore >= WORKER_TIER_THRESHOLDS.gold) return 'gold';
  if (reputationScore >= WORKER_TIER_THRESHOLDS.silver) return 'silver';
  return 'bronze';
}

function updateSpecialistPoolStats(domain: string | undefined): void {
  if (!domain) return;
  const pool = specialistPools.get(domain);
  if (!pool) return;

  const allHistory: WorkerTaskHistory[] = [];
  for (const workerId of pool.workers) {
    const worker = workers.get(workerId);
    if (worker) allHistory.push(...worker.task_history);
  }

  pool.total_tasks_completed = allHistory.filter(h => h.outcome !== 'failed').length;
  const scored = allHistory.filter(h => h.score !== undefined);
  pool.avg_quality_score = scored.length > 0
    ? scored.reduce((sum, h) => sum + (h.score ?? 0), 0) / scored.length
    : 0;
}

// ============ Statistics ============

export function getWorkerPoolStats(): WorkerPoolStats {
  const allWorkers = [...workers.values()];

  const activeWorkers = allWorkers.filter(w => w.is_available && w.current_load < w.max_concurrent_tasks);
  const passiveWorkers = allWorkers.filter(w => w.type === 'passive');
  const specialistWorkers = allWorkers.filter(w => w.type === 'specialist');

  const assignmentsByDomain: Record<string, number> = {};
  for (const [, assignment] of assignments) {
    if (assignment.pool_type === 'specialist') {
      const worker = workers.get(assignment.worker_id);
      if (worker?.domain) {
        assignmentsByDomain[worker.domain] = (assignmentsByDomain[worker.domain] ?? 0) + 1;
      }
    }
  }

  // Top domains by worker count
  const domainCounts: Record<string, { worker_count: number; tasks_completed: number }> = {};
  for (const worker of specialistWorkers) {
    if (!domainCounts[worker.domain!]) {
      domainCounts[worker.domain!] = { worker_count: 0, tasks_completed: 0 };
    }
    domainCounts[worker.domain!].worker_count++;
  }
  for (const [domain, pool] of specialistPools) {
    if (!domainCounts[domain]) {
      domainCounts[domain] = { worker_count: 0, tasks_completed: 0 };
    }
    domainCounts[domain].tasks_completed = pool.total_tasks_completed;
  }

  const topDomains = Object.entries(domainCounts)
    .map(([domain, counts]) => ({ domain, worker_count: counts.worker_count, tasks_completed: counts.tasks_completed }))
    .sort((a, b) => b.worker_count - a.worker_count)
    .slice(0, 10);

  const allScores = allWorkers.map(w => w.reputation_score);
  const allResponseTimes = allWorkers.map(w => w.avg_response_time_ms).filter(t => t > 0);

  return {
    total_workers: allWorkers.length,
    active_workers: activeWorkers.length,
    passive_workers: passiveWorkers.length,
    specialist_workers: specialistWorkers.length,
    total_assignments: assignments.size,
    assignments_by_domain: assignmentsByDomain,
    avg_quality_score: allWorkers.length > 0
      ? Math.round((allScores.reduce((a, b) => a + b, 0) / allWorkers.length / 100) * 100) / 100
      : 0,
    avg_response_time_ms: allResponseTimes.length > 0
      ? Math.round(allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length)
      : 0,
    top_domains: topDomains,
  };
}

// ============ Cleanup ============

/**
 * Mark inactive workers as unavailable
 * Should be called periodically (e.g., every heartbeat cycle)
 */
export function pruneInactiveWorkers(): number {
  const now = Date.now();
  let pruned = 0;
  for (const worker of workers.values()) {
    const lastActive = new Date(worker.last_active_at).getTime();
    if (!worker.is_available && now - lastActive > WORKER_INACTIVE_THRESHOLD_MS) {
      // Already offline, fine
      continue;
    }
    if (worker.is_available && now - lastActive > WORKER_INACTIVE_THRESHOLD_MS) {
      worker.is_available = false;
      pruned++;
    }
  }
  return pruned;
}

export function getWorkersByDomain(domain: string): WorkerPoolWorker[] {
  return [...workers.values()].filter(w => w.domain === domain && w.is_available);
}

// ============ Test Support ============

export function resetWorkerPoolStores(): void {
  workers.clear();
  specialistPools.clear();
  specialistTaskQueue.clear();
  assignments.clear();
  workerAssignments.clear();
  domainWorkerIndex.clear();
}
