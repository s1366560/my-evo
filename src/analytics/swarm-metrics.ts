/**
 * Swarm Efficiency Metrics Module
 *
 * Computes efficiency and productivity metrics for Swarm collaboration sessions.
 */

import type { PrismaClient } from '@prisma/client';

// ─── Efficiency Calculation ──────────────────────────────────────────────────

export interface SwarmEfficiencyMetrics {
  swarmId: string;
  efficiency: number; // 0–100
  completionRate: number; // 0–1
  avgTaskDurationMs: number | null;
  workerUtilization: number; // 0–1
  totalCost: number;
  totalTasks: number;
  completedTasks: number;
  status: string;
}

/**
 * Calculate overall efficiency score for a Swarm.
 *
 * Efficiency = (completion_rate * 0.4) + (worker_utilization * 0.3) +
 *              (cost_efficiency * 0.3), clamped to [0, 100]
 */
export async function calculateSwarmEfficiency(
  swarmId: string,
): Promise<SwarmEfficiencyMetrics> {
  const task = await getPrisma().swarmTask.findUnique({
    where: { swarm_id: swarmId },
    include: { subtasks: true },
  });

  if (!task) {
    return {
      swarmId,
      efficiency: 0,
      completionRate: 0,
      avgTaskDurationMs: null,
      workerUtilization: 0,
      totalCost: 0,
      totalTasks: 0,
      completedTasks: 0,
      status: 'unknown',
    };
  }

  const subtasks = task.subtasks;
  const totalTasks = subtasks.length;
  const completedTasks = subtasks.filter(
    (s) => s.status === 'completed',
  ).length;

  const completionRate =
    totalTasks > 0 ? completedTasks / totalTasks : 0;

  // Worker utilization: ratio of workers with at least one completed subtask
  const workersWithWork = new Set(
    subtasks
      .filter((s) => s.status === 'completed' && s.assigned_to)
      .map((s) => s.assigned_to),
  );
  const workerCount = task.workers.length;
  const workerUtilization =
    workerCount > 0 ? workersWithWork.size / workerCount : 0;

  // Average task duration
  const completedWithDuration = subtasks
    .filter((s) => s.status === 'completed' && s.assigned_at && s.completed_at)
    .map((s) => s.completed_at!.getTime() - s.assigned_at!.getTime());

  const avgTaskDurationMs =
    completedWithDuration.length > 0
      ? completedWithDuration.reduce((a, b) => a + b, 0) /
        completedWithDuration.length
      : null;

  // Cost efficiency: inverse of cost (lower cost = higher efficiency)
  // Normalized: max expected cost is 10000 credits
  const costEfficiency = Math.max(0, 1 - task.cost / 10000);

  const efficiency = Math.round(
    (completionRate * 0.4 + workerUtilization * 0.3 + costEfficiency * 0.3) *
      100,
  );

  return {
    swarmId,
    efficiency,
    completionRate: Math.round(completionRate * 100) / 100,
    avgTaskDurationMs: avgTaskDurationMs !== null
      ? Math.round(avgTaskDurationMs)
      : null,
    workerUtilization: Math.round(workerUtilization * 100) / 100,
    totalCost: task.cost,
    totalTasks,
    completedTasks,
    status: task.status,
  };
}

// ─── Subtask Completion Rate ─────────────────────────────────────────────────

export interface SubtaskCompletionBreakdown {
  swarmId: string;
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  completionRate: number;
  avgDurationMs: number | null;
  longestPendingDurationMs: number | null;
}

/**
 * Get detailed subtask completion rate breakdown for a Swarm.
 */
export async function getSubtaskCompletionRate(
  swarmId: string,
): Promise<SubtaskCompletionBreakdown> {
  const subtasks = await getPrisma().swarmSubtask.findMany({
    where: { swarm_id: swarmId },
  });

  const total = subtasks.length;
  const pending = subtasks.filter((s) => s.status === 'pending').length;
  const in_progress = subtasks.filter((s) => s.status === 'in_progress').length;
  const completed = subtasks.filter((s) => s.status === 'completed').length;
  const failed = subtasks.filter((s) => s.status === 'failed').length;

  const completionRate = total > 0 ? completed / total : 0;

  const completedDurations = subtasks
    .filter((s) => s.status === 'completed' && s.assigned_at && s.completed_at)
    .map((s) => s.completed_at!.getTime() - s.assigned_at!.getTime());

  const avgDurationMs =
    completedDurations.length > 0
      ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length
      : null;

  const pendingDurations = subtasks
    .filter((s) => s.status === 'pending' && s.assigned_at)
    .map((s) => Date.now() - s.assigned_at!.getTime());

  const longestPendingDurationMs =
    pendingDurations.length > 0 ? Math.max(...pendingDurations) : null;

  return {
    swarmId,
    total,
    pending,
    in_progress,
    completed,
    failed,
    completionRate: Math.round(completionRate * 100) / 100,
    avgDurationMs: avgDurationMs !== null ? Math.round(avgDurationMs) : null,
    longestPendingDurationMs:
      longestPendingDurationMs !== null
        ? Math.round(longestPendingDurationMs)
        : null,
  };
}

// ─── Resource Utilization ────────────────────────────────────────────────────

export interface WorkerUtilization {
  workerId: string;
  tasksAssigned: number;
  tasksCompleted: number;
  utilizationRate: number; // 0–1
}

export interface ResourceUtilizationResult {
  swarmId: string;
  totalWorkers: number;
  activeWorkers: number;
  workerDetails: WorkerUtilization[];
  overallUtilization: number; // 0–1
  bottleneckWorkers: string[]; // workers with utilization < 0.3
}

/**
 * Get resource utilization breakdown per worker for a Swarm.
 */
export async function getResourceUtilization(
  swarmId: string,
): Promise<ResourceUtilizationResult> {
  const task = await getPrisma().swarmTask.findUnique({
    where: { swarm_id: swarmId },
  });

  if (!task) {
    return {
      swarmId,
      totalWorkers: 0,
      activeWorkers: 0,
      workerDetails: [],
      overallUtilization: 0,
      bottleneckWorkers: [],
    };
  }

  const subtasks = await getPrisma().swarmSubtask.findMany({
    where: { swarm_id: swarmId },
  });

  const workerMap: Record<string, { assigned: number; completed: number }> = {};

  for (const workerId of task.workers) {
    workerMap[workerId] = { assigned: 0, completed: 0 };
  }

  for (const subtask of subtasks) {
    if (subtask.assigned_to && workerMap[subtask.assigned_to] !== undefined) {
      workerMap[subtask.assigned_to]!.assigned++;
      if (subtask.status === 'completed') {
        workerMap[subtask.assigned_to]!.completed++;
      }
    }
  }

  const workerDetails: WorkerUtilization[] = Object.entries(workerMap).map(
    ([workerId, stats]) => ({
      workerId,
      tasksAssigned: stats.assigned,
      tasksCompleted: stats.completed,
      utilizationRate: stats.assigned > 0
        ? stats.completed / stats.assigned
        : 0,
    }),
  );

  const activeWorkers = workerDetails.filter((w) => w.tasksAssigned > 0).length;

  const overallUtilization =
    workerDetails.length > 0
      ? workerDetails.reduce((s, w) => s + w.utilizationRate, 0) /
        workerDetails.length
      : 0;

  const bottleneckWorkers = workerDetails
    .filter((w) => w.utilizationRate < 0.3)
    .map((w) => w.workerId);

  return {
    swarmId,
    totalWorkers: task.workers.length,
    activeWorkers,
    workerDetails,
    overallUtilization: Math.round(overallUtilization * 100) / 100,
    bottleneckWorkers,
  };
}

// ─── Efficiency Report ───────────────────────────────────────────────────────

export interface EfficiencyReport {
  swarmId: string;
  generatedAt: string;
  overallEfficiency: number;
  completionBreakdown: SubtaskCompletionBreakdown;
  resourceUtilization: ResourceUtilizationResult;
  recommendations: string[];
  riskFlags: string[];
}

/**
 * Generate a comprehensive efficiency report for a Swarm.
 */
export async function generateEfficiencyReport(
  swarmId: string,
): Promise<EfficiencyReport> {
  const [efficiency, completion, resources] = await Promise.all([
    calculateSwarmEfficiency(swarmId),
    getSubtaskCompletionRate(swarmId),
    getResourceUtilization(swarmId),
  ]);

  const recommendations: string[] = [];
  const riskFlags: string[] = [];

  if (completion.completionRate < 0.5) {
    recommendations.push(
      'Low completion rate — consider breaking down remaining tasks into smaller units.',
    );
    riskFlags.push('low_completion_rate');
  }

  if (completion.longestPendingDurationMs !== null &&
      completion.longestPendingDurationMs > 2 * 60 * 60 * 1000) {
    recommendations.push(
      'Some subtasks have been pending for over 2 hours — re-assign or escalate.',
    );
    riskFlags.push('stale_pending_tasks');
  }

  if (resources.overallUtilization < 0.4) {
    recommendations.push(
      'Low worker utilization — redistribute tasks to balance workload.',
    );
    riskFlags.push('low_worker_utilization');
  }

  if (resources.bottleneckWorkers.length > 0) {
    recommendations.push(
      `${resources.bottleneckWorkers.length} worker(s) are underutilized. Consider offloading tasks.`,
    );
    riskFlags.push('worker_bottleneck');
  }

  if (efficiency.efficiency >= 80) {
    recommendations.push('Swarm is performing efficiently — maintain current workflow.');
  } else if (efficiency.efficiency >= 50) {
    recommendations.push('Moderate efficiency — review bottlenecks and task distribution.');
  } else {
    recommendations.push(
      'Low efficiency detected — consider restarting or rebalancing the Swarm.',
    );
    riskFlags.push('critical_low_efficiency');
  }

  return {
    swarmId,
    generatedAt: new Date().toISOString(),
    overallEfficiency: efficiency.efficiency,
    completionBreakdown: completion,
    resourceUtilization: resources,
    recommendations,
    riskFlags,
  };
}

// ─── Prisma accessor ──────────────────────────────────────────────────────────

let _prisma: PrismaClient | null = null;

export function setPrismaForSwarmMetrics(p: PrismaClient): void {
  _prisma = p;
}

function getPrisma(): PrismaClient {
  if (!_prisma) {
    const { PrismaClient } = require('@prisma/client');
    _prisma = new PrismaClient();
  }
  return _prisma!;
}
