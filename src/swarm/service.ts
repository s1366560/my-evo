/**
 * Swarm Service Layer
 * Business logic for multi-agent swarm coordination: task orchestration,
 * agent dispatch, subtask management, and result aggregation.
 *
 * Uses Prisma for persistence. SwarmTask/SwarmSubtask models in prisma/schema.prisma.
 */

import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from '../shared/errors';
import {
  SWARM_CONFIG,
  type SwarmTaskStatus,
  type SubtaskStatus,
  type CreateSwarmTaskInput,
  type CreateSubtaskInput,
  type CompleteSubtaskInput,
  type CompleteSwarmTaskInput,
  type SwarmTaskSummary,
  type SwarmTaskDetail,
  type SubtaskDetail,
  type SwarmResult,
} from './types';

// ============================================================
// Helpers
// ============================================================

/** Generate a human-readable swarm ID */
function generateSwarmId(): string {
  return `swarm_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
}

/** Generate a human-readable subtask ID */
function generateSubtaskId(): string {
  return `sub_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
}

/** Map a raw SwarmTask + subtasks row to a SwarmTaskSummary */
function toTaskSummary(
  row: {
    swarm_id: string;
    title: string;
    description: string;
    status: string;
    creator_id: string;
    workers: string[];
    cost: number;
    created_at: Date;
    completed_at: Date | null;
    subtasks: { status: string }[];
  }
): SwarmTaskSummary {
  const completed = row.subtasks.filter(
    (s) => s.status === 'completed'
  ).length;
  return {
    swarm_id: row.swarm_id,
    title: row.title,
    description: row.description,
    status: row.status as SwarmTaskStatus,
    creator_id: row.creator_id,
    worker_count: row.workers.length,
    completed_subtasks: completed,
    total_subtasks: row.subtasks.length,
    cost: row.cost,
    created_at: row.created_at.toISOString(),
    completed_at: row.completed_at?.toISOString() ?? null,
  };
}

/** Map a raw SwarmSubtask to SubtaskDetail */
function toSubtaskDetail(row: {
  subtask_id: string;
  swarm_id: string;
  title: string;
  description: string;
  status: string;
  assigned_to: string | null;
  result: string | null;
  assigned_at: Date | null;
  completed_at: Date | null;
}): SubtaskDetail {
  return {
    subtask_id: row.subtask_id,
    swarm_id: row.swarm_id,
    title: row.title,
    description: row.description,
    status: row.status as SubtaskStatus,
    assigned_to: row.assigned_to,
    result: row.result,
    assigned_at: row.assigned_at?.toISOString() ?? null,
    completed_at: row.completed_at?.toISOString() ?? null,
  };
}

// ============================================================
// Service Functions
// ============================================================

/**
 * List swarm tasks with pagination and optional status filter.
 */
export async function listSwarmTasks(
  prisma: PrismaClient,
  opts: { status?: SwarmTaskStatus; limit?: number; offset?: number } = {}
): Promise<{ tasks: SwarmTaskSummary[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = opts.offset ?? 0;
  const where = opts.status ? { status: opts.status } : {};

  const [rows, total] = await Promise.all([
    prisma.swarmTask.findMany({
      where,
      include: { subtasks: { select: { status: true } } },
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.swarmTask.count({ where }),
  ]);

  return {
    tasks: rows.map(toTaskSummary),
    total,
  };
}

/**
 * Get a single swarm task with full details and subtasks.
 */
export async function getSwarmTask(
  prisma: PrismaClient,
  swarmId: string
): Promise<SwarmTaskDetail | null> {
  const row = await prisma.swarmTask.findUnique({
    where: { swarm_id: swarmId },
    include: { subtasks: { orderBy: { assigned_at: 'asc' } } },
  });
  if (!row) return null;

  const summary = toTaskSummary(row);
  const subtaskDetails = row.subtasks.map(toSubtaskDetail);

  let result: SwarmResult | null = null;
  if (row.result && typeof row.result === 'object') {
    result = row.result as unknown as SwarmResult;
  }

  return {
    ...summary,
    timeout_ms: row.timeout_ms,
    result,
    subtasks: subtaskDetails,
  };
}

/**
 * Create a new swarm task (starts in 'pending' status).
 */
export async function createSwarmTask(
  prisma: PrismaClient,
  input: CreateSwarmTaskInput
): Promise<SwarmTaskDetail> {
  if (!input.title || input.title.trim().length < 3) {
    throw new ValidationError('Title must be at least 3 characters');
  }
  if (!input.description || input.description.trim().length < 5) {
    throw new ValidationError('Description must be at least 5 characters');
  }

  // Validate creator exists
  const node = await prisma.node.findUnique({
    where: { node_id: input.creator_id },
  });
  if (!node) {
    throw new NotFoundError('Node', input.creator_id);
  }

  const swarmId = generateSwarmId();
  const timeout = input.timeout_ms ?? SWARM_CONFIG.defaultTimeoutMs;

  const row = await prisma.swarmTask.create({
    data: {
      swarm_id: swarmId,
      title: input.title.trim(),
      description: input.description.trim(),
      status: 'pending',
      creator_id: input.creator_id,
      workers: [],
      cost: 0,
      timeout_ms: timeout,
    },
    include: { subtasks: true },
  });

  const summary = toTaskSummary(row);
  return {
    ...summary,
    timeout_ms: row.timeout_ms,
    result: null,
    subtasks: [],
  };
}

/**
 * Create a subtask under an existing swarm task.
 * Automatically transitions task to 'recruiting' if pending.
 */
export async function createSubtask(
  prisma: PrismaClient,
  input: CreateSubtaskInput
): Promise<SubtaskDetail> {
  const task = await prisma.swarmTask.findUnique({
    where: { swarm_id: input.swarm_id },
  });
  if (!task) throw new NotFoundError('SwarmTask', input.swarm_id);

  if (task.status === 'completed' || task.status === 'failed') {
    throw new ConflictError(
      `Cannot add subtasks to ${task.status} swarm task`
    );
  }

  if (!input.title || input.title.trim().length < 2) {
    throw new ValidationError('Subtask title must be at least 2 characters');
  }

  // Transition to recruiting if still pending
  let newStatus: string = task.status;
  if (task.status === 'pending') {
    newStatus = 'recruiting';
  }

  const subtaskId = generateSubtaskId();
  const now = new Date();

  const row = await prisma.swarmSubtask.create({
    data: {
      subtask_id: subtaskId,
      swarm_id: input.swarm_id,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      status: input.assigned_to ? 'assigned' : 'pending',
      assigned_to: input.assigned_to ?? null,
      assigned_at: input.assigned_to ? now : null,
    },
  });

  // Update task status and workers list
  const workers = [...task.workers];
  if (input.assigned_to && !workers.includes(input.assigned_to)) {
    workers.push(input.assigned_to);
  }

  await prisma.swarmTask.update({
    where: { swarm_id: input.swarm_id },
    data: {
      status: newStatus,
      workers,
    },
  });

  return toSubtaskDetail(row);
}

/**
 * Complete a subtask by submitting its result.
 * Transitions task to 'aggregating' if all subtasks are completed.
 */
export async function completeSubtask(
  prisma: PrismaClient,
  input: CompleteSubtaskInput
): Promise<{ subtask: SubtaskDetail; swarmStatus: SwarmTaskStatus }> {
  const subtask = await prisma.swarmSubtask.findUnique({
    where: { subtask_id: input.subtask_id },
  });
  if (!subtask) throw new NotFoundError('SwarmSubtask', input.subtask_id);

  if (subtask.status === 'completed') {
    throw new ConflictError('Subtask is already completed');
  }

  const now = new Date();
  const updated = await prisma.swarmSubtask.update({
    where: { subtask_id: input.subtask_id },
    data: {
      status: 'completed',
      result: input.result,
      completed_at: now,
    },
  });

  // Check if all subtasks for the swarm are completed
  const allSubtasks = await prisma.swarmSubtask.findMany({
    where: { swarm_id: subtask.swarm_id },
  });

  const allDone = allSubtasks.every((s) => s.status === 'completed');
  const anyFailed = allSubtasks.some((s) => s.status === 'failed');

  let swarmStatus: SwarmTaskStatus;
  if (allDone) {
    swarmStatus = 'aggregating';
    await prisma.swarmTask.update({
      where: { swarm_id: subtask.swarm_id },
      data: { status: 'aggregating' },
    });
  } else if (anyFailed) {
    swarmStatus = 'running';
  } else {
    // Ensure task is running
    const task = await prisma.swarmTask.findUnique({
      where: { swarm_id: subtask.swarm_id },
    });
    if (task && task.status === 'recruiting') {
      swarmStatus = 'running';
      await prisma.swarmTask.update({
        where: { swarm_id: subtask.swarm_id },
        data: { status: 'running' },
      });
    } else {
      swarmStatus = (task?.status ?? 'running') as SwarmTaskStatus;
    }
  }

  return {
    subtask: toSubtaskDetail(updated),
    swarmStatus,
  };
}

/**
 * Complete a swarm task by providing the aggregated result.
 */
export async function completeSwarmTask(
  prisma: PrismaClient,
  input: CompleteSwarmTaskInput
): Promise<SwarmTaskDetail> {
  const task = await prisma.swarmTask.findUnique({
    where: { swarm_id: input.swarm_id },
    include: { subtasks: true },
  });
  if (!task) throw new NotFoundError('SwarmTask', input.swarm_id);

  if (task.status === 'completed') {
    throw new ConflictError('Swarm task is already completed');
  }
  if (task.status === 'failed') {
    throw new ConflictError('Cannot complete a failed swarm task');
  }

  const qualityScore = input.quality_score ?? SWARM_CONFIG.minQualityScore;
  const now = new Date();

  // Build result object
  const completedSubtasks = task.subtasks.filter(
    (s) => s.status === 'completed'
  );
  const result: SwarmResult = {
    swarm_id: input.swarm_id,
    aggregated_output: input.aggregated_output,
    subtask_results: completedSubtasks.map((s) => ({
      subtask_id: s.subtask_id,
      result: s.result ?? '',
      worker_id: s.assigned_to ?? '',
      completed_at: s.completed_at?.toISOString() ?? now.toISOString(),
    })),
    quality_score: qualityScore,
    completed_at: now.toISOString(),
  };

  const updated = await prisma.swarmTask.update({
    where: { swarm_id: input.swarm_id },
    data: {
      status: 'completed',
      result: result as any,
      completed_at: now,
    },
    include: { subtasks: true },
  });

  const summary = toTaskSummary(updated);
  return {
    ...summary,
    timeout_ms: updated.timeout_ms,
    result,
    subtasks: updated.subtasks.map(toSubtaskDetail),
  };
}

/**
 * Mark a swarm task as failed.
 */
export async function failSwarmTask(
  prisma: PrismaClient,
  swarmId: string,
  reason: string
): Promise<SwarmTaskDetail> {
  const task = await prisma.swarmTask.findUnique({
    where: { swarm_id: swarmId },
    include: { subtasks: true },
  });
  if (!task) throw new NotFoundError('SwarmTask', swarmId);

  if (task.status === 'completed') {
    throw new ConflictError('Cannot fail a completed swarm task');
  }

  const now = new Date();
  const result: SwarmResult = {
    swarm_id: swarmId,
    aggregated_output: `FAILED: ${reason}`,
    subtask_results: task.subtasks
      .filter((s) => s.status === 'completed')
      .map((s) => ({
        subtask_id: s.subtask_id,
        result: s.result ?? '',
        worker_id: s.assigned_to ?? '',
        completed_at: s.completed_at?.toISOString() ?? now.toISOString(),
      })),
    quality_score: 0,
    completed_at: now.toISOString(),
  };

  const updated = await prisma.swarmTask.update({
    where: { swarm_id: swarmId },
    data: {
      status: 'failed',
      result: result as any,
      completed_at: now,
    },
    include: { subtasks: true },
  });

  const summary = toTaskSummary(updated);
  return {
    ...summary,
    timeout_ms: updated.timeout_ms,
    result,
    subtasks: updated.subtasks.map(toSubtaskDetail),
  };
}

/**
 * Delete/cancel a swarm task that is still in pending or recruiting.
 */
export async function cancelSwarmTask(
  prisma: PrismaClient,
  swarmId: string,
  cancellerId: string
): Promise<{ success: boolean; message: string }> {
  const task = await prisma.swarmTask.findUnique({
    where: { swarm_id: swarmId },
  });
  if (!task) throw new NotFoundError('SwarmTask', swarmId);

  if (task.creator_id !== cancellerId) {
    throw new ConflictError('Only the creator can cancel a swarm task');
  }

  if (
    task.status !== 'pending' &&
    task.status !== 'recruiting'
  ) {
    throw new ConflictError(
      `Cannot cancel swarm task in '${task.status}' status`
    );
  }

  await prisma.swarmTask.update({
    where: { swarm_id: swarmId },
    data: { status: 'failed' },
  });

  return {
    success: true,
    message: `Swarm task ${swarmId} cancelled`,
  };
}
