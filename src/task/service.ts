import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { NotFoundError, ValidationError } from '../shared/errors';

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
  updates: { title?: string; description?: string; status?: string; assignee_id?: string | null },
): Promise<ProjectTaskOutput> {
  const task = await prisma.projectTask.findFirst({
    where: { task_id: taskId, project_id: projectId },
  });
  if (!task) {
    throw new NotFoundError('Task', taskId);
  }
  const updated = await prisma.projectTask.update({
    where: { id: task.id },
    data: {
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.assignee_id !== undefined && { assignee_id: updates.assignee_id }),
    },
  });
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
  const updated = await prisma.projectTask.update({
    where: { id: task.id },
    data: { assignee_id: nodeId, status: 'in_progress' },
  });
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
  const updated = await prisma.projectTask.update({
    where: { id: task.id },
    data: { status: 'completed' },
  });
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
  const updated = await prisma.projectTask.update({
    where: { id: task.id },
    data: { assignee_id: null, status: 'open' },
  });
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
  const parts = taskId.split(':');
  if (parts.length !== 2) {
    throw new ValidationError('Invalid taskId format, expected projectId:taskId');
  }
  const [projectId, tId] = parts;
  if (!tId) {
    throw new ValidationError('Invalid taskId format, expected projectId:taskId');
  }
  const task = await prisma.projectTask.findFirst({
    where: { task_id: tId, project_id: projectId },
  });
  if (!task) {
    throw new NotFoundError('Task', tId);
  }
  const submissionId = crypto.randomUUID();
  const submission = await prisma.taskSubmission.create({
    data: {
      submission_id: submissionId,
      task_id: tId,
      submitter_id: nodeId,
      asset_id: assetId ?? null,
      node_id: submitterNodeId ?? null,
      status: 'pending',
    },
  });
  return mapSubmission(submission);
}

export async function acceptSubmission(
  taskId: string,
  submissionId: string,
): Promise<SubmissionOutput> {
  const parts = taskId.split(':');
  if (parts.length !== 2) {
    throw new ValidationError('Invalid taskId format, expected projectId:taskId');
  }
  const [, tId] = parts;
  const submission = await prisma.taskSubmission.findFirst({
    where: { submission_id: submissionId, task_id: tId },
  });
  if (!submission) {
    throw new NotFoundError('Submission', submissionId);
  }
  const updated = await prisma.taskSubmission.update({
    where: { id: submission.id },
    data: { status: 'accepted' },
  });
  return mapSubmission(updated);
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

// ---- Mappers ----

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
