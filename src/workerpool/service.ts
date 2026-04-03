import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import {
  WORKER_HEARTBEAT_MS,
  WORKER_TIMEOUT_MS,
  MAX_CONCURRENT_TASKS,
} from '../shared/constants';
import {
  NotFoundError,
  ValidationError,
} from '../shared/errors';
import type {
  RegisterWorkerInput,
  FindWorkersInput,
  WorkerTaskInput,
  CompleteTaskInput,
  ListWorkersInput,
} from './types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export { prisma };

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
  const worker = await prisma.worker.findUnique({
    where: { node_id: workerId },
  });

  if (!worker) {
    throw new NotFoundError('Worker', workerId);
  }

  if (!worker.is_available) {
    throw new ValidationError('Worker is not available');
  }

  if (worker.current_tasks >= worker.max_concurrent) {
    throw new ValidationError('Worker has reached max concurrent tasks');
  }

  const updated = await prisma.worker.update({
    where: { node_id: workerId },
    data: {
      current_tasks: worker.current_tasks + 1,
    },
  });

  return updated;
}

export async function completeTask(
  workerId: string,
  taskId: string,
  success: boolean,
) {
  const worker = await prisma.worker.findUnique({
    where: { node_id: workerId },
  });

  if (!worker) {
    throw new NotFoundError('Worker', workerId);
  }

  if (worker.current_tasks <= 0) {
    throw new ValidationError('Worker has no tasks to complete');
  }

  const newTotal = worker.total_completed + 1;
  const newSuccessCount = success
    ? Math.round(worker.success_rate * worker.total_completed / 100) + 1
    : Math.round(worker.success_rate * worker.total_completed / 100);
  const newRate = (newSuccessCount / newTotal) * 100;

  const updated = await prisma.worker.update({
    where: { node_id: workerId },
    data: {
      current_tasks: worker.current_tasks - 1,
      total_completed: newTotal,
      success_rate: newRate,
    },
  });

  return updated;
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

export async function listWorkers(input: ListWorkersInput) {
  const { skill, available, limit = 20, offset = 0 } = input;

  const where: Record<string, unknown> = {};
  if (available !== undefined) {
    where.is_available = available;
  }
  if (skill) {
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
