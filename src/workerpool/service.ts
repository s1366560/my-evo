import { PrismaClient } from '@prisma/client';
import {
  WORKER_HEARTBEAT_MS,
  WORKER_TIMEOUT_MS,
  MAX_CONCURRENT_TASKS,
} from '../shared/constants';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../shared/errors';

let prisma = new PrismaClient();

const WORKER_MATCH_WEIGHTS = {
  skill_match: 0.30,
  success_rate: 0.25,
  response_time: 0.20,
  reputation: 0.15,
  load_headroom: 0.10,
} as const;

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export async function registerWorker(
  nodeId: string,
  specialties: string[],
  maxConcurrent: number,
) {
  const existing = await prisma.worker.findUnique({
    where: { node_id: nodeId },
  });

  if (existing) {
    throw new ValidationError('Node is already registered as a worker');
  }

  if (specialties.length === 0) {
    throw new ValidationError('Worker must have at least one specialty');
  }

  if (maxConcurrent < 1 || maxConcurrent > MAX_CONCURRENT_TASKS) {
    throw new ValidationError(
      `maxConcurrent must be between 1 and ${MAX_CONCURRENT_TASKS}`,
    );
  }

  const worker = await prisma.worker.create({
    data: {
      node_id: nodeId,
      specialties,
      max_concurrent: maxConcurrent,
      current_tasks: 0,
      total_completed: 0,
      success_rate: 0,
      is_available: true,
      last_heartbeat: new Date(),
    },
  });

  return worker;
}

export async function updateHeartbeat(nodeId: string) {
  const worker = await prisma.worker.findUnique({
    where: { node_id: nodeId },
  });

  if (!worker) {
    throw new NotFoundError('Worker', nodeId);
  }

  const now = new Date();
  const updated = await prisma.worker.update({
    where: { node_id: nodeId },
    data: {
      last_heartbeat: now,
      is_available: true,
    },
  });

  return updated;
}

export async function findAvailableWorkers(
  skills: string[],
  count: number,
) {
  if (skills.length === 0) {
    throw new ValidationError('At least one skill is required');
  }

  const allWorkers = await prisma.worker.findMany({
    where: {
      is_available: true,
    },
  });

  const cutoff = new Date(Date.now() - WORKER_TIMEOUT_MS);
  const eligible = allWorkers.filter((w: { last_heartbeat: Date; current_tasks: number; max_concurrent: number; specialties: string[] }) => {
    const hasHeartbeat = new Date(w.last_heartbeat) > cutoff;
    const hasCapacity = w.current_tasks < w.max_concurrent;
    const hasSkill = w.specialties.some(
      (s: string) => skills.includes(s),
    );
    return hasHeartbeat && hasCapacity && hasSkill;
  });

  const sorted = [...eligible].sort((a, b) => {
    const aCapacity = a.max_concurrent - a.current_tasks;
    const bCapacity = b.max_concurrent - b.current_tasks;
    if (bCapacity !== aCapacity) return bCapacity - aCapacity;
    return b.success_rate - a.success_rate;
  });

  return sorted.slice(0, count);
}

export async function assignTask(
  workerId: string,
  taskId: string,
) {
  return prisma.$transaction(async (tx) => {
    const [worker, task] = await Promise.all([
      tx.worker.findUnique({
        where: { node_id: workerId },
      }),
      tx.workerTask.findUnique({
        where: { task_id: taskId },
      }),
    ]);

    if (!worker) {
      throw new NotFoundError('Worker', workerId);
    }

    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    if (!worker.is_available) {
      throw new ValidationError('Worker is not available');
    }

    if (worker.current_tasks >= worker.max_concurrent) {
      throw new ValidationError('Worker has reached max concurrent tasks');
    }

    if (task.status !== 'available' || task.assigned_to) {
      throw new ValidationError('Task is not available');
    }

    const reserved = await tx.worker.updateMany({
      where: {
        node_id: workerId,
        is_available: true,
        current_tasks: worker.current_tasks,
      },
      data: {
        current_tasks: { increment: 1 },
      },
    });

    if (reserved.count === 0) {
      throw new ConflictError('Worker state changed; retry');
    }

    const assigned = await tx.workerTask.updateMany({
      where: {
        task_id: taskId,
        status: 'available',
        assigned_to: null,
      },
      data: {
        assigned_to: workerId,
        status: 'assigned',
      },
    });

    if (assigned.count === 0) {
      throw new ConflictError('Task state changed; retry');
    }

    const updatedWorker = await tx.worker.findUnique({
      where: { node_id: workerId },
    });

    if (!updatedWorker) {
      throw new NotFoundError('Worker', workerId);
    }

    return updatedWorker;
  });
}

export async function completeTask(
  workerId: string,
  taskId: string,
  success: boolean,
) {
  return prisma.$transaction(async (tx) => {
    const [worker, task] = await Promise.all([
      tx.worker.findUnique({
        where: { node_id: workerId },
      }),
      tx.workerTask.findUnique({
        where: { task_id: taskId },
      }),
    ]);

    if (!worker) {
      throw new NotFoundError('Worker', workerId);
    }

    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    if (worker.current_tasks <= 0) {
      throw new ValidationError('Worker has no tasks to complete');
    }

    if (task.assigned_to !== workerId || task.status !== 'assigned') {
      throw new ValidationError('Task is not assigned to this worker');
    }

    const newTotal = worker.total_completed + 1;
    const newSuccessCount = success
      ? Math.round(worker.success_rate * worker.total_completed / 100) + 1
      : Math.round(worker.success_rate * worker.total_completed / 100);
    const newRate = (newSuccessCount / newTotal) * 100;

    const completedWorker = await tx.worker.updateMany({
      where: {
        node_id: workerId,
        current_tasks: worker.current_tasks,
        total_completed: worker.total_completed,
      },
      data: {
        current_tasks: { decrement: 1 },
        total_completed: { increment: 1 },
        success_rate: newRate,
      },
    });

    if (completedWorker.count === 0) {
      throw new ConflictError('Worker state changed; retry');
    }

    const updatedTask = await tx.workerTask.updateMany({
      where: {
        task_id: taskId,
        assigned_to: workerId,
        status: 'assigned',
      },
      data: success
        ? {
          status: 'completed',
          completed_at: new Date(),
        }
        : {
          status: 'available',
          assigned_to: null,
          completed_at: null,
        },
    });

    if (updatedTask.count === 0) {
      throw new ConflictError('Task state changed; retry');
    }

    const updatedWorker = await tx.worker.findUnique({
      where: { node_id: workerId },
    });

    if (!updatedWorker) {
      throw new NotFoundError('Worker', workerId);
    }

    return updatedWorker;
  });
}

export async function deregisterWorker(nodeId: string) {
  const worker = await prisma.worker.findUnique({
    where: { node_id: nodeId },
  });

  if (!worker) {
    throw new NotFoundError('Worker', nodeId);
  }

  if (worker.current_tasks > 0) {
    throw new ValidationError(
      'Cannot deregister worker with active tasks',
    );
  }

  await prisma.worker.delete({
    where: { node_id: nodeId },
  });

  return { success: true, node_id: nodeId };
}

export async function getWorker(nodeId: string) {
  const worker = await prisma.worker.findUnique({
    where: { node_id: nodeId },
  });

  if (!worker) {
    throw new NotFoundError('Worker', nodeId);
  }

  return worker;
}

export async function listWorkers(input: { q?: string; skill?: string; available?: boolean; limit?: number; offset?: number }) {
  const { q, skill, available, limit = 20, offset = 0 } = input;

  const where: Record<string, unknown> = {};
  if (available !== undefined) {
    where.is_available = available;
  }
  if (q && q.trim()) {
    const lower = q.trim().toLowerCase();
    where.specialties = { has: lower };
  } else if (skill) {
    where.specialties = { has: skill };
  }

  const [workers, total] = await Promise.all([
    prisma.worker.findMany({
      where,
      orderBy: { success_rate: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.worker.count({ where }),
  ]);

  return { workers, total, limit, offset };
}

// ---- Specialist endpoints (Part 4 additions) ----

function workerToSpecialist(w: { node_id: string; specialties: string[]; max_concurrent: number; current_tasks: number; total_completed: number; success_rate: number; is_available: boolean; last_heartbeat: Date }): Record<string, unknown> {
  return {
    node_id: w.node_id,
    specialties: w.specialties,
    max_concurrent: w.max_concurrent,
    current_tasks: w.current_tasks,
    total_completed: w.total_completed,
    success_rate: w.success_rate,
    is_available: w.is_available,
    last_heartbeat: w.last_heartbeat.toISOString(),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function calculateResponseTimeScore(lastHeartbeat: Date): number {
  const ageMs = Date.now() - new Date(lastHeartbeat).getTime();
  return clamp01(1 - ageMs / WORKER_TIMEOUT_MS);
}

function calculateLoadHeadroomScore(worker: {
  current_tasks: number;
  max_concurrent: number;
}): number {
  if (worker.max_concurrent <= 0) {
    return 0;
  }

  return clamp01((worker.max_concurrent - worker.current_tasks) / worker.max_concurrent);
}

function calculateFinalMatchScore(input: {
  skill_match_score: number;
  success_rate_score: number;
  response_time_score: number;
  reputation_score: number;
  load_headroom_score: number;
}): number {
  return roundMetric(
    input.skill_match_score * WORKER_MATCH_WEIGHTS.skill_match
      + input.success_rate_score * WORKER_MATCH_WEIGHTS.success_rate
      + input.response_time_score * WORKER_MATCH_WEIGHTS.response_time
      + input.reputation_score * WORKER_MATCH_WEIGHTS.reputation
      + input.load_headroom_score * WORKER_MATCH_WEIGHTS.load_headroom,
  );
}

async function getWorkerReputationMap(workerIds: string[]): Promise<Map<string, number>> {
  if (workerIds.length === 0) {
    return new Map();
  }

  const nodes = await prisma.node.findMany({
    where: { node_id: { in: workerIds } },
    select: { node_id: true, reputation: true },
  });

  return new Map(nodes.map((node) => [node.node_id, node.reputation]));
}

export async function listSpecialists(
  specialty?: string,
  availableOnly?: boolean,
  limit = 20,
  offset = 0,
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
  const where: Record<string, unknown> = {};
  if (availableOnly !== undefined) {
    where.is_available = availableOnly;
  }
  if (specialty) {
    where.specialties = { has: specialty };
  }

  const [workers, total] = await Promise.all([
    prisma.worker.findMany({
      where,
      orderBy: { success_rate: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.worker.count({ where }),
  ]);

  return { items: workers.map(workerToSpecialist), total };
}

export async function getSpecialist(nodeId: string): Promise<Record<string, unknown>> {
  const worker = await prisma.worker.findUnique({
    where: { node_id: nodeId },
  });
  if (!worker) {
    throw new NotFoundError('Worker', nodeId);
  }
  return workerToSpecialist(worker);
}

export async function listSpecialistPools(): Promise<Array<{
  name: string;
  worker_count: number;
  avg_reputation: number;
}>> {
  const workers = await prisma.worker.findMany({
    orderBy: { node_id: 'asc' },
  });
  const reputations = await getWorkerReputationMap(workers.map((worker) => worker.node_id));
  const pools = new Map<string, { name: string; worker_count: number; reputation_sum: number }>();

  for (const worker of workers) {
    const reputation = reputations.get(worker.node_id) ?? 50;
    for (const specialty of worker.specialties) {
      const current = pools.get(specialty) ?? {
        name: specialty,
        worker_count: 0,
        reputation_sum: 0,
      };
      current.worker_count += 1;
      current.reputation_sum += reputation;
      pools.set(specialty, current);
    }
  }

  return Array.from(pools.values())
    .map((pool) => ({
      name: pool.name,
      worker_count: pool.worker_count,
      avg_reputation: roundMetric(pool.reputation_sum / pool.worker_count),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function matchWorkers(
  taskSignals: string[],
  minReputation = 0,
  limit = 10,
): Promise<Array<{
  worker_id: string;
  match_score: number;
  skill_match_score: number;
  success_rate_score: number;
  response_time_score: number;
  reputation_score: number;
  load_headroom_score: number;
  price: null;
}>> {
  if (taskSignals.length === 0) {
    throw new ValidationError('task_signals must contain at least one signal');
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - WORKER_TIMEOUT_MS);
  const workers = await prisma.worker.findMany({
    where: { is_available: true },
  });
  const reputations = await getWorkerReputationMap(workers.map((worker) => worker.node_id));

  return workers
    .map((worker) => {
      const matchedSignals = worker.specialties.filter((specialty) => taskSignals.includes(specialty));
      const reputation = reputations.get(worker.node_id) ?? 50;
      const skillMatchScore = clamp01(matchedSignals.length / taskSignals.length);
      const successRateScore = clamp01(worker.success_rate / 100);
      const responseTimeScore = calculateResponseTimeScore(worker.last_heartbeat);
      const reputationScore = clamp01(reputation / 100);
      const loadHeadroomScore = calculateLoadHeadroomScore(worker);
      const available =
        worker.current_tasks < worker.max_concurrent
        && new Date(worker.last_heartbeat) > cutoff
        && reputation >= minReputation
        && skillMatchScore > 0;

      return {
        worker_id: worker.node_id,
        match_score: calculateFinalMatchScore({
          skill_match_score: skillMatchScore,
          success_rate_score: successRateScore,
          response_time_score: responseTimeScore,
          reputation_score: reputationScore,
          load_headroom_score: loadHeadroomScore,
        }),
        skill_match_score: roundMetric(skillMatchScore),
        success_rate_score: roundMetric(successRateScore),
        response_time_score: roundMetric(responseTimeScore),
        reputation_score: roundMetric(reputationScore),
        load_headroom_score: roundMetric(loadHeadroomScore),
        price: null,
        available,
      };
    })
    .filter((worker) => worker.available)
    .sort((left, right) => right.match_score - left.match_score)
    .slice(0, limit)
    .map(({ available: _available, ...worker }) => worker);
}

export async function getWorkerPoolStats(): Promise<{
  total_workers: number;
  active_workers: number;
  total_tasks_completed: number;
  avg_match_score: number;
  specialist_pools: number;
}> {
  const workers = await prisma.worker.findMany();
  const reputations = await getWorkerReputationMap(workers.map((worker) => worker.node_id));
  const cutoff = new Date(Date.now() - WORKER_TIMEOUT_MS);
  const activeWorkers = workers.filter(
    (worker) => worker.is_available && new Date(worker.last_heartbeat) > cutoff,
  );
  const uniquePools = new Set(workers.flatMap((worker) => worker.specialties));
  const avgMatchScore = activeWorkers.length === 0
    ? 0
    : roundMetric(
      activeWorkers.reduce((sum, worker) => {
        const reputation = reputations.get(worker.node_id) ?? 50;
        return sum + calculateFinalMatchScore({
          skill_match_score: 1,
          success_rate_score: clamp01(worker.success_rate / 100),
          response_time_score: calculateResponseTimeScore(worker.last_heartbeat),
          reputation_score: clamp01(reputation / 100),
          load_headroom_score: calculateLoadHeadroomScore(worker),
        });
      }, 0) / activeWorkers.length,
    );

  return {
    total_workers: workers.length,
    active_workers: activeWorkers.length,
    total_tasks_completed: workers.reduce((sum, worker) => sum + worker.total_completed, 0),
    avg_match_score: avgMatchScore,
    specialist_pools: uniquePools.size,
  };
}

export async function rateSpecialist(
  workerId: string,
  taskId: string,
  _raterId: string,
  rating: number,
  _review?: string,
): Promise<void> {
  if (rating < 1 || rating > 5) {
    throw new ValidationError('Rating must be between 1 and 5');
  }
  if (!taskId || taskId.trim().length === 0) {
    throw new ValidationError('task_id is required');
  }

  // WorkerTask does not currently track who requested/owns the task, so we
  // cannot safely authorize third-party ratings yet.
  throw new ValidationError(
    'Specialist ratings require requester-linked worker tasks and are not yet supported for current tasks',
  );
}

// ---- Worker Task endpoints ----

export async function getMyTasks(
  workerId: string,
  status?: string,
  limit = 20,
  offset = 0,
) {
  const where: Record<string, unknown> = { assigned_to: workerId };
  if (status) {
    where.status = status;
  }

  const [tasks, total] = await Promise.all([
    prisma.workerTask.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.workerTask.count({ where }),
  ]);

  return { tasks, total };
}
