import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../shared/errors';
import { MAX_SUBTASKS, TITLE_MAX_LENGTH } from '../shared/constants';
import { addPoints } from '../reputation/service';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export interface ProjectTaskOutput {
  id: string;
  task_id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectContributionOutput {
  id: string;
  contribution_id: string;
  project_id: string;
  contributor_id: string;
  files: unknown[];
  commit_message: string;
  status: string;
  reviewed_by: string | null;
  created_at: string;
  reviewed_at: string | null;
}

// ---- Tasks ----

export async function listTasks(projectId: string): Promise<ProjectTaskOutput[]> {
  const tasks = await prisma.projectTask.findMany({
    where: projectId !== '__all__' ? { project_id: projectId } : undefined,
    orderBy: { created_at: 'asc' },
  });
  return tasks.map(mapTask);
}

export async function getTask(projectId: string, taskId: string): Promise<ProjectTaskOutput | null> {
  const task = await prisma.projectTask.findFirst({
    where: { task_id: taskId, project_id: projectId },
  });
  return task ? mapTask(task) : null;
}

export async function createTask(
  projectId: string,
  title: string,
  description: string,
  creatorId: string,
): Promise<ProjectTaskOutput> {
  if (!title || title.trim().length === 0) {
    throw new ValidationError('Task title is required');
  }
  const taskId = crypto.randomUUID();
  const task = await prisma.projectTask.create({
    data: {
      task_id: taskId,
      project_id: projectId,
      title,
      description,
      status: 'open',
      assignee_id: null,
    },
  });
  return mapTask(task);
}

export async function updateTask(
  projectId: string,
  taskId: string,
  actorId: string,
  updates: { title?: string; description?: string; status?: string; assignee_id?: string | null },
): Promise<ProjectTaskOutput> {
  if (updates.assignee_id !== undefined) {
    throw new ValidationError('assignee_id cannot be updated via this endpoint');
  }
  if (updates.status !== undefined) {
    throw new ValidationError('status changes must use claim, complete, or release endpoints');
  }
  const updatedTask = await prisma.projectTask.updateMany({
    where: {
      task_id: taskId,
      project_id: projectId,
      assignee_id: actorId,
    },
    data: {
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.description !== undefined && { description: updates.description }),
    },
  });
  if (updatedTask.count === 0) {
    const task = await prisma.projectTask.findFirst({
      where: { task_id: taskId, project_id: projectId },
    });
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }
    throw new ForbiddenError('Only the task assignee can update this task');
  }
  const updated = await prisma.projectTask.findFirst({
    where: { task_id: taskId, project_id: projectId },
  });
  if (!updated) {
    throw new NotFoundError('Task', taskId);
  }
  return mapTask(updated);
}

export async function claimTask(
  projectId: string,
  taskId: string,
  nodeId: string,
): Promise<ProjectTaskOutput> {
  const task = await prisma.projectTask.findFirst({
    where: { task_id: taskId, project_id: projectId },
  });
  if (!task) {
    throw new NotFoundError('Task', taskId);
  }
  if (task.assignee_id) {
    throw new ValidationError('Task is already assigned');
  }
  const claimed = await prisma.projectTask.updateMany({
    where: { id: task.id, assignee_id: null, status: 'open' },
    data: { assignee_id: nodeId, status: 'in_progress' },
  });
  if (claimed.count === 0) {
    throw new ConflictError('Task state changed; retry');
  }
  const updated = await prisma.projectTask.findFirst({
    where: { id: task.id },
  });
  if (!updated) {
    throw new NotFoundError('Task', taskId);
  }
  return mapTask(updated);
}

export async function completeTask(
  projectId: string,
  taskId: string,
  nodeId: string,
): Promise<ProjectTaskOutput> {
  const task = await prisma.projectTask.findFirst({
    where: { task_id: taskId, project_id: projectId },
  });
  if (!task) {
    throw new NotFoundError('Task', taskId);
  }
  if (task.assignee_id !== nodeId) {
    throw new ValidationError('Only the assignee can complete this task');
  }
  if (task.status !== 'in_progress') {
    throw new ValidationError('Task is not in progress');
  }
  const completed = await prisma.projectTask.updateMany({
    where: { id: task.id, assignee_id: nodeId, status: 'in_progress' },
    data: { status: 'completed' },
  });
  if (completed.count === 0) {
    throw new ConflictError('Task state changed; retry');
  }
  const updated = await prisma.projectTask.findFirst({
    where: { id: task.id },
  });
  if (!updated) {
    throw new NotFoundError('Task', taskId);
  }
  return mapTask(updated);
}

// ---- Contributions ----

export async function listContributions(projectId: string): Promise<ProjectContributionOutput[]> {
  const contributions = await prisma.projectContribution.findMany({
    where: { project_id: projectId },
    orderBy: { created_at: 'desc' },
  });
  return contributions.map(mapContribution);
}

export async function submitContribution(
  projectId: string,
  contributorId: string,
  files: unknown[],
  commitMessage: string,
): Promise<ProjectContributionOutput> {
  if (!commitMessage || commitMessage.trim().length === 0) {
    throw new ValidationError('Commit message is required');
  }
  const contributionId = crypto.randomUUID();
  const contribution = await prisma.projectContribution.create({
    data: {
      contribution_id: contributionId,
      project_id: projectId,
      contributor_id: contributorId,
      files: files as object[],
      commit_message: commitMessage,
      status: 'pending',
    },
  });
  return mapContribution(contribution);
}

// ---- Task release ----

export async function releaseTask(
  projectId: string,
  taskId: string,
  nodeId: string,
): Promise<ProjectTaskOutput> {
  const task = await prisma.projectTask.findFirst({
    where: { task_id: taskId, project_id: projectId },
  });
  if (!task) {
    throw new NotFoundError('Task', taskId);
  }
  if (task.assignee_id !== nodeId) {
    throw new ValidationError('Only the assignee can release this task');
  }
  if (task.status !== 'in_progress') {
    throw new ValidationError('Task is not in progress');
  }
  const released = await prisma.projectTask.updateMany({
    where: { id: task.id, assignee_id: nodeId, status: 'in_progress' },
    data: { assignee_id: null, status: 'open' },
  });
  if (released.count === 0) {
    throw new ConflictError('Task state changed; retry');
  }
  const updated = await prisma.projectTask.findFirst({
    where: { id: task.id },
  });
  if (!updated) {
    throw new NotFoundError('Task', taskId);
  }
  return mapTask(updated);
}

// ---- Submissions ----

export interface SubmissionOutput {
  id: string;
  submission_id: string;
  task_id: string;
  submitter_id: string;
  asset_id: string | null;
  node_id: string | null;
  status: string;
  created_at: string;
}

export async function submitTaskAnswer(
  taskId: string,
  nodeId: string,
  assetId?: string,
  submitterNodeId?: string,
): Promise<SubmissionOutput> {
  const { projectId, scopedTaskId } = parseCompositeTaskId(taskId);
  const normalizedAssetId = assetId?.trim() || undefined;
  const normalizedNodeId = submitterNodeId?.trim() || undefined;

  if (!normalizedAssetId && !normalizedNodeId) {
    throw new ValidationError('Submission requires asset_id or node_id');
  }

  const task = await prisma.projectTask.findFirst({
    where: { task_id: scopedTaskId, project_id: projectId },
  });
  if (!task) {
    throw new NotFoundError('Task', scopedTaskId);
  }
  if (!['in_progress', 'completed'].includes(task.status)) {
    throw new ValidationError('Task must be in progress or completed before submitting an answer');
  }
  const submissionId = crypto.randomUUID();
  const submission = await prisma.taskSubmission.create({
    data: {
      submission_id: submissionId,
      task_id: scopedTaskId,
      submitter_id: nodeId,
      asset_id: normalizedAssetId ?? null,
      node_id: normalizedNodeId ?? null,
      status: 'pending',
    },
  });
  return mapSubmission(submission);
}

export async function acceptSubmission(
  taskId: string,
  submissionId: string,
  actorId: string,
): Promise<SubmissionOutput> {
  const { projectId, scopedTaskId } = parseCompositeTaskId(taskId);
  return prisma.$transaction(async (tx) => {
    await touchAssignedTask(
      tx,
      projectId,
      scopedTaskId,
      actorId,
      'Only the task assignee can accept submissions',
      new Date(),
    );
    const updated = await tx.taskSubmission.updateMany({
      where: {
        submission_id: submissionId,
        task_id: scopedTaskId,
        status: 'pending',
      },
      data: { status: 'accepted' },
    });
    if (updated.count === 0) {
      const submission = await tx.taskSubmission.findFirst({
        where: { submission_id: submissionId, task_id: scopedTaskId },
      });
      if (!submission) {
        throw new NotFoundError('Submission', submissionId);
      }
      throw new ConflictError('Submission state changed; retry');
    }
    const acceptedSubmission = await tx.taskSubmission.findFirst({
      where: { submission_id: submissionId, task_id: scopedTaskId },
    });
    if (!acceptedSubmission) {
      throw new NotFoundError('Submission', submissionId);
    }
    await addPoints(
      acceptedSubmission.submitter_id,
      'worker_task_completed',
      tx as unknown as PrismaClient,
    );
    return mapSubmission(acceptedSubmission);
  });
}

export async function rejectSubmission(
  taskId: string,
  submissionId: string,
  actorId: string,
): Promise<SubmissionOutput> {
  const { projectId, scopedTaskId } = parseCompositeTaskId(taskId);
  return prisma.$transaction(async (tx) => {
    await touchAssignedTask(
      tx,
      projectId,
      scopedTaskId,
      actorId,
      'Only the task assignee can reject submissions',
      new Date(),
    );
    const updated = await tx.taskSubmission.updateMany({
      where: {
        submission_id: submissionId,
        task_id: scopedTaskId,
        status: 'pending',
      },
      data: { status: 'rejected' },
    });
    if (updated.count === 0) {
      const submission = await tx.taskSubmission.findFirst({
        where: { submission_id: submissionId, task_id: scopedTaskId },
      });
      if (!submission) {
        throw new NotFoundError('Submission', submissionId);
      }
      throw new ConflictError('Submission state changed; retry');
    }
    const rejectedSubmission = await tx.taskSubmission.findFirst({
      where: { submission_id: submissionId, task_id: scopedTaskId },
    });
    if (!rejectedSubmission) {
      throw new NotFoundError('Submission', submissionId);
    }
    await addPoints(
      rejectedSubmission.submitter_id,
      'worker_task_failed',
      tx as unknown as PrismaClient,
    );
    return mapSubmission(rejectedSubmission);
  });
}

export async function getSubmissions(taskId: string): Promise<SubmissionOutput[]> {
  const parts = taskId.split(':');
  if (parts.length !== 2) {
    throw new ValidationError('Invalid taskId format, expected projectId:taskId');
  }
  const [, tId] = parts;
  const submissions = await prisma.taskSubmission.findMany({
    where: { task_id: tId },
  });
  return submissions.map(mapSubmission);
}

// ---- Eligible count ----

export async function getEligibleNodeCount(minReputation?: number): Promise<number> {
  const where: Record<string, unknown> = {};
  if (minReputation !== undefined) {
    where.reputation = { gte: minReputation };
  }
  const count = await prisma.node.count({ where });
  return count;
}

// ---- Asset lookup ----

export async function getAssetById(assetId: string): Promise<{ asset_id: string } | null> {
  const asset = await prisma.asset.findUnique({
    where: { asset_id: assetId },
    select: { asset_id: true },
  });
  return asset;
}

export interface TaskDecompositionOutput {
  original_task_id: string;
  decomposition_id: string;
  sub_tasks: Array<{
    sub_task_id: string;
    title: string;
    status: string;
    proposed_by: string;
  }>;
  estimated_parallelism: number;
  proposed_at: string;
}

export interface TaskCommitmentOutput {
  task_id: string;
  node_id: string;
  deadline: string;
  committed_by: string;
  committed_at: string;
}

export async function proposeTaskDecomposition(
  taskId: string,
  proposerId: string,
  subTaskTitles: string[],
  estimatedParallelism?: number,
): Promise<TaskDecompositionOutput> {
  const { projectId, scopedTaskId } = parseCompositeTaskId(taskId);
  const normalizedSubtasks = subTaskTitles
    .map((title) => title.trim())
    .filter((title) => title.length > 0);

  if (normalizedSubtasks.length === 0) {
    throw new ValidationError('At least one subtask title is required');
  }
  if (normalizedSubtasks.length > MAX_SUBTASKS) {
    throw new ValidationError(`Subtasks count must be 1-${MAX_SUBTASKS}`);
  }
  if (normalizedSubtasks.some((title) => title.length > TITLE_MAX_LENGTH)) {
    throw new ValidationError(`Subtask titles must be <= ${TITLE_MAX_LENGTH} characters`);
  }
  if (
    estimatedParallelism !== undefined
    && (!Number.isInteger(estimatedParallelism) || estimatedParallelism < 1)
  ) {
    throw new ValidationError('estimated_parallelism must be a positive integer');
  }

  const swarmId = crypto.randomUUID();
  const proposedAt = new Date();
  const resolvedParallelism = Math.max(
    1,
    Math.min(
      estimatedParallelism ?? normalizedSubtasks.length,
      normalizedSubtasks.length,
    ),
  );

  const created = await prisma.$transaction(async (tx) => {
    const task = await touchAssignedTask(
      tx,
      projectId,
      scopedTaskId,
      proposerId,
      'Only the task assignee can propose a decomposition',
      proposedAt,
      'Task must be in progress before proposing a decomposition',
    );
    const swarm = await tx.swarmTask.create({
      data: {
        swarm_id: swarmId,
        title: `Decomposition for ${task.title}`,
        description: task.description,
        status: 'in_progress',
        creator_id: proposerId,
        workers: [],
        cost: 0,
        timeout_ms: 60 * 60 * 1000,
        result: {
          source_task_id: taskId,
          estimated_parallelism: resolvedParallelism,
          proposed_by: proposerId,
        },
        created_at: proposedAt,
      },
    });

    const subtasks = await Promise.all(
      normalizedSubtasks.map((title) => tx.swarmSubtask.create({
        data: {
          subtask_id: crypto.randomUUID(),
          swarm_id: swarmId,
          title,
          description: `Subtask for ${taskId}`,
          status: 'pending',
        },
      })),
    );
    return { swarm, subtasks };
  });

  return {
    original_task_id: taskId,
    decomposition_id: swarmId,
    sub_tasks: created.subtasks.map((subtask) => ({
      sub_task_id: subtask.subtask_id,
      title: subtask.title,
      status: subtask.status,
      proposed_by: proposerId,
    })),
    estimated_parallelism: resolvedParallelism,
    proposed_at: proposedAt.toISOString(),
  };
}

export async function setTaskCommitment(
  taskId: string,
  nodeId: string,
  deadline: string,
): Promise<TaskCommitmentOutput> {
  const { projectId, scopedTaskId } = parseCompositeTaskId(taskId);
  const normalizedDeadline = new Date(deadline);
  if (Number.isNaN(normalizedDeadline.getTime())) {
    throw new ValidationError('deadline must be a valid ISO-8601 timestamp');
  }

  const committedAt = new Date();
  const questionId = `task-commitment:${taskId}:${nodeId}`;
  const record = await prisma.$transaction(async (tx) => {
    const task = await touchAssignedTask(
      tx,
      projectId,
      scopedTaskId,
      nodeId,
      'Only the task assignee can commit to this task',
      committedAt,
      'Task must be in progress before setting a commitment',
    );
    const title = `Task commitment for ${task.title}`;
    const body = JSON.stringify({
      task_id: taskId,
      node_id: nodeId,
      deadline: normalizedDeadline.toISOString(),
      committed_by: nodeId,
      committed_at: committedAt.toISOString(),
    });

    return tx.question.upsert({
      where: { question_id: questionId },
      update: {
        title,
        body,
        tags: ['task_commitment', `task_commitment:${taskId}`],
        author: nodeId,
        state: 'hidden',
        safety_flags: [],
      },
      create: {
        question_id: questionId,
        title,
        body,
        tags: ['task_commitment', `task_commitment:${taskId}`],
        author: nodeId,
        state: 'hidden',
        safety_score: 1,
        safety_flags: [],
        bounty: 0,
        views: 0,
        answer_count: 0,
      },
    });
  });

  return {
    task_id: taskId,
    node_id: nodeId,
    deadline: normalizedDeadline.toISOString(),
    committed_by: nodeId,
    committed_at: ('updated_at' in record && record.updated_at instanceof Date
      ? record.updated_at
      : committedAt).toISOString(),
  };
}

// ---- Mappers ----

function parseCompositeTaskId(taskId: string): { projectId: string; scopedTaskId: string } {
  const parts = taskId.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new ValidationError('Invalid taskId format, expected projectId:taskId');
  }

  return {
    projectId: parts[0],
    scopedTaskId: parts[1],
  };
}

async function touchAssignedTask(
  tx: Pick<PrismaClient, 'projectTask'>,
  projectId: string,
  scopedTaskId: string,
  actorId: string,
  forbiddenMessage: string,
  touchedAt: Date,
  invalidStatusMessage = 'Task must be in progress',
) {
  const touched = await tx.projectTask.updateMany({
    where: {
      project_id: projectId,
      task_id: scopedTaskId,
      assignee_id: actorId,
      status: 'in_progress',
    },
    data: {
      updated_at: touchedAt,
    },
  });

  if (touched.count === 0) {
    const task = await tx.projectTask.findFirst({
      where: { project_id: projectId, task_id: scopedTaskId },
    });
    if (!task) {
      throw new NotFoundError('Task', scopedTaskId);
    }
    if (task.assignee_id !== actorId) {
      throw new ForbiddenError(forbiddenMessage);
    }
    if (task.status !== 'in_progress') {
      throw new ValidationError(invalidStatusMessage);
    }
    throw new ConflictError('Task state changed; retry');
  }

  const task = await tx.projectTask.findFirst({
    where: { project_id: projectId, task_id: scopedTaskId },
  });
  if (!task) {
    throw new NotFoundError('Task', scopedTaskId);
  }
  return task;
}

function mapTask(t: {
  id: string;
  task_id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  assignee_id: string | null;
  created_at: Date;
  updated_at: Date;
}): ProjectTaskOutput {
  return {
    id: t.id,
    task_id: t.task_id,
    project_id: t.project_id,
    title: t.title,
    description: t.description,
    status: t.status,
    assignee_id: t.assignee_id,
    created_at: t.created_at.toISOString(),
    updated_at: t.updated_at.toISOString(),
  };
}

function mapContribution(c: {
  id: string;
  contribution_id: string;
  project_id: string;
  contributor_id: string;
  files: unknown;
  commit_message: string;
  status: string;
  reviewed_by: string | null;
  created_at: Date;
  reviewed_at: Date | null;
}): ProjectContributionOutput {
  return {
    id: c.id,
    contribution_id: c.contribution_id,
    project_id: c.project_id,
    contributor_id: c.contributor_id,
    files: c.files as unknown[],
    commit_message: c.commit_message,
    status: c.status,
    reviewed_by: c.reviewed_by,
    created_at: c.created_at.toISOString(),
    reviewed_at: c.reviewed_at ? c.reviewed_at.toISOString() : null,
  };
}

function mapSubmission(s: {
  id: string;
  submission_id: string;
  task_id: string;
  submitter_id: string;
  asset_id: string | null;
  node_id: string | null;
  status: string;
  created_at: Date;
}): SubmissionOutput {
  return {
    id: s.id,
    submission_id: s.submission_id,
    task_id: s.task_id,
    submitter_id: s.submitter_id,
    asset_id: s.asset_id,
    node_id: s.node_id,
    status: s.status,
    created_at: s.created_at.toISOString(),
  };
}
