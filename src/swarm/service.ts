import { v4 as uuidv4 } from 'uuid';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  MAX_SUBTASKS,
  SUBTASK_TIMEOUT_MS,
  SWARM_BASE_COST,
  MAX_WORKERS_PER_SWARM,
} from '../shared/constants';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
  EvoMapError,
} from '../shared/errors';
import type { SwarmStatus, SubtaskStatus } from '../shared/types';
import type {
  CreateSwarmInput,
  DecomposeInput,
  AssignSubtaskInput,
  SubmitSubtaskInput,
  ListSwarmsInput,
} from './types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export { prisma };

export async function createSwarm(
  creatorId: string,
  title: string,
  description: string,
  cost: number,
) {
  const node = await prisma.node.findUnique({
    where: { node_id: creatorId },
  });

  if (!node) {
    throw new NotFoundError('Node', creatorId);
  }

  if (node.credit_balance < cost) {
    throw new InsufficientCreditsError(cost, node.credit_balance);
  }

  const swarmId = uuidv4();
  const now = new Date();

  const [updatedNode, swarm] = await prisma.$transaction([
    prisma.node.update({
      where: { node_id: creatorId },
      data: {
        credit_balance: node.credit_balance - cost,
      },
    }),
    prisma.swarmTask.create({
      data: {
        swarm_id: swarmId,
        title,
        description,
        status: 'pending',
        creator_id: creatorId,
        cost,
        timeout_ms: SUBTASK_TIMEOUT_MS,
        workers: [],
        created_at: now,
      },
    }),
  ]);

  await prisma.creditTransaction.create({
    data: {
      node_id: creatorId,
      amount: -cost,
      type: 'swarm_cost',
      description: `Swarm task creation: ${title}`,
      balance_after: updatedNode.credit_balance,
      timestamp: now,
    },
  });

  return swarm;
}

export async function decomposeTask(
  swarmId: string,
  subtasks: Array<{ title: string; description: string }>,
) {
  const swarm = await prisma.swarmTask.findUnique({
    where: { swarm_id: swarmId },
  });

  if (!swarm) {
    throw new NotFoundError('Swarm', swarmId);
  }

  if (swarm.status !== 'pending') {
    throw new ValidationError('Swarm must be in pending status to decompose');
  }

  if (subtasks.length === 0 || subtasks.length > MAX_SUBTASKS) {
    throw new ValidationError(`Subtasks count must be 1-${MAX_SUBTASKS}`);
  }

  const updatedSwarm = await prisma.swarmTask.update({
    where: { swarm_id: swarmId },
    data: { status: 'decomposing' },
    include: { subtasks: true },
  });

  const subtaskRecords = [];
  for (const subtask of subtasks) {
    const record = await prisma.swarmSubtask.create({
      data: {
        subtask_id: uuidv4(),
        swarm_id: swarmId,
        title: subtask.title,
        description: subtask.description,
        status: 'pending',
      },
    });
    subtaskRecords.push(record);
  }

  await prisma.swarmTask.update({
    where: { swarm_id: swarmId },
    data: { status: 'in_progress' },
  });

  return {
    ...updatedSwarm,
    subtasks: subtaskRecords,
  };
}

export async function assignSubtask(
  subtaskId: string,
  workerId: string,
) {
  const subtask = await prisma.swarmSubtask.findUnique({
    where: { subtask_id: subtaskId },
  });

  if (!subtask) {
    throw new NotFoundError('Subtask', subtaskId);
  }

  if (subtask.status !== 'pending') {
    throw new ValidationError('Subtask must be in pending status to assign');
  }

  const swarm = await prisma.swarmTask.findUnique({
    where: { swarm_id: subtask.swarm_id },
  });

  if (!swarm) {
    throw new NotFoundError('Swarm', subtask.swarm_id);
  }

  const workerCount = swarm.workers.length;
  if (workerCount >= MAX_WORKERS_PER_SWARM) {
    throw new ValidationError(
      `Max workers (${MAX_WORKERS_PER_SWARM}) reached for this swarm`,
    );
  }

  const now = new Date();
  const updatedWorkers = swarm.workers.includes(workerId)
    ? swarm.workers
    : [...swarm.workers, workerId];

  const [updatedSubtask] = await prisma.$transaction([
    prisma.swarmSubtask.update({
      where: { subtask_id: subtaskId },
      data: {
        status: 'assigned' as SubtaskStatus,
        assigned_to: workerId,
        assigned_at: now,
      },
    }),
    prisma.swarmTask.update({
      where: { swarm_id: subtask.swarm_id },
      data: { workers: updatedWorkers },
    }),
  ]);

  return updatedSubtask;
}

export async function submitSubtaskResult(
  subtaskId: string,
  result: string,
) {
  const subtask = await prisma.swarmSubtask.findUnique({
    where: { subtask_id: subtaskId },
  });

  if (!subtask) {
    throw new NotFoundError('Subtask', subtaskId);
  }

  if (subtask.status !== 'assigned') {
    throw new ValidationError('Subtask must be assigned to submit result');
  }

  const now = new Date();
  const updatedSubtask = await prisma.swarmSubtask.update({
    where: { subtask_id: subtaskId },
    data: {
      status: 'completed' as SubtaskStatus,
      result,
      completed_at: now,
    },
  });

  return updatedSubtask;
}

export async function aggregateResults(swarmId: string) {
  const swarm = await prisma.swarmTask.findUnique({
    where: { swarm_id: swarmId },
    include: { subtasks: true },
  });

  if (!swarm) {
    throw new NotFoundError('Swarm', swarmId);
  }

  if (swarm.status !== 'in_progress') {
    throw new ValidationError('Swarm must be in progress to aggregate');
  }

  const allCompleted = swarm.subtasks.every(
    (st: { status: string }) => st.status === 'completed',
  );

  if (!allCompleted) {
    throw new ValidationError('All subtasks must be completed before aggregation');
  }

  const now = new Date();
  const aggregatedOutput = swarm.subtasks
    .map((st) => `[${st.subtask_id}] ${st.result ?? ''}`)
    .join('\n');

  const subtaskResults = swarm.subtasks.map((st) => ({
    subtask_id: st.subtask_id,
    result: st.result ?? '',
    worker_id: st.assigned_to ?? '',
  }));

  const qualityScore = subtaskResults.length > 0
    ? subtaskResults.reduce((acc: number, r: { result: string }) => acc + (r.result.length > 0 ? 1 : 0), 0) /
      subtaskResults.length * 100
    : 0;

  const swarmResult = {
    swarm_id: swarmId,
    aggregated_output: aggregatedOutput,
    subtask_results: subtaskResults,
    quality_score: qualityScore,
  };

  const updatedSwarm = await prisma.swarmTask.update({
    where: { swarm_id: swarmId },
    data: {
      status: 'completed' as SwarmStatus,
      result: swarmResult as unknown as Prisma.InputJsonValue,
      completed_at: now,
    },
  });

  return {
    ...updatedSwarm,
    result: swarmResult,
  };
}

export async function failSwarm(
  swarmId: string,
  reason: string,
) {
  const swarm = await prisma.swarmTask.findUnique({
    where: { swarm_id: swarmId },
  });

  if (!swarm) {
    throw new NotFoundError('Swarm', swarmId);
  }

  const terminalStatuses: SwarmStatus[] = ['completed', 'failed'];
  if (terminalStatuses.includes(swarm.status as SwarmStatus)) {
    throw new ValidationError('Swarm is already in a terminal state');
  }

  const now = new Date();

  if (swarm.cost > 0) {
    const node = await prisma.node.findUnique({
      where: { node_id: swarm.creator_id },
    });

    if (node) {
      const newBalance = node.credit_balance + swarm.cost;
      await prisma.$transaction([
        prisma.node.update({
          where: { node_id: swarm.creator_id },
          data: { credit_balance: newBalance },
        }),
        prisma.creditTransaction.create({
          data: {
            node_id: swarm.creator_id,
            amount: swarm.cost,
            type: 'swarm_reward',
            description: `Swarm refund (failed): ${reason}`,
            balance_after: newBalance,
            timestamp: now,
          },
        }),
      ]);
    }
  }

  const updatedSwarm = await prisma.swarmTask.update({
    where: { swarm_id: swarmId },
    data: {
      status: 'failed' as SwarmStatus,
      completed_at: now,
    },
  });

  return updatedSwarm;
}

export async function getSwarm(swarmId: string) {
  const swarm = await prisma.swarmTask.findUnique({
    where: { swarm_id: swarmId },
    include: { subtasks: true },
  });

  if (!swarm) {
    throw new NotFoundError('Swarm', swarmId);
  }

  return swarm;
}

export async function listSwarms(input: ListSwarmsInput) {
  const { status, limit = 20, offset = 0 } = input;

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }

  const [swarms, total] = await Promise.all([
    prisma.swarmTask.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.swarmTask.count({ where }),
  ]);

  return { swarms, total, limit, offset };
}
