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
