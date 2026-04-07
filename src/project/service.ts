import { PrismaClient, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../shared/errors';
import type {
  ProjectStatus,
  ContributionStatus,
  ListProjectsInput,
  ListProjectsOutput,
  ProjectFile,
} from './types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export { prisma };

export async function proposeProject(
  senderId: string,
  title: string,
  description: string,
  repoName?: string,
  plan?: string,
) {
  const node = await prisma.node.findUnique({
    where: { node_id: senderId },
  });

  if (!node) {
    throw new NotFoundError('Node', senderId);
  }

  const projectId = uuidv4();
  const now = new Date();

  const project = await prisma.project.create({
    data: {
      title,
      description,
      repo_name: repoName ?? `project-${projectId.slice(0, 8)}`,
      status: 'proposed',
      proposer_id: senderId,
      tasks: [],
      contributions: [],
      created_at: now,
    },
  });

  return project;
}

export async function getProject(projectId: string) {
  const project = await (prisma.project.findUnique as any)({
    where: { id: projectId },
    include: { ProjectTask: true, ProjectContribution: true },
  });

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  return project;
}

export async function listProjects(input: ListProjectsInput): Promise<ListProjectsOutput> {
  const { status, limit = 20, offset = 0 } = input;

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.project.count({ where }),
  ]);

  return { projects: projects as any[], total, limit, offset };
}

export async function getProjectTasks(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  const tasks = await prisma.projectTask.findMany({
    where: { project_id: projectId },
    orderBy: { created_at: 'asc' },
  });

  return tasks;
}

export async function getProjectContributions(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  const contributions = await prisma.projectContribution.findMany({
    where: { project_id: projectId },
    orderBy: { created_at: 'desc' },
  });

  return contributions;
}

export async function submitContribution(
  projectId: string,
  contributorId: string,
  files: ProjectFile[],
  taskId?: string,
  commitMessage?: string,
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  if (project.status === 'archived' || project.status === 'completed') {
    throw new ValidationError('Cannot contribute to an archived or completed project');
  }

  if (taskId) {
    const task = await prisma.projectTask.findUnique({
      where: { task_id: taskId },
    });
    if (!task) {
      throw new NotFoundError('ProjectTask', taskId);
    }
    if (task.project_id !== projectId) {
      throw new ValidationError('Task does not belong to this project');
    }
  }

  const contributionId = uuidv4();
  const now = new Date();

  const contribution = await prisma.projectContribution.create({
    data: {
      contribution_id: contributionId,
      project_id: projectId,
      contributor_id: contributorId,
      files: files as unknown as Prisma.InputJsonValue,
      commit_message: commitMessage ?? 'Contribution',
      status: 'pending',
      created_at: now,
    },
  });

  return contribution;
}

export async function createPullRequest(
  projectId: string,
  senderId: string,
  contributionId: string,
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  const contribution = await prisma.projectContribution.findUnique({
    where: { contribution_id: contributionId },
  });

  if (!contribution) {
    throw new NotFoundError('ProjectContribution', contributionId);
  }

  if (contribution.project_id !== projectId) {
    throw new ValidationError('Contribution does not belong to this project');
  }

  const prNumber = Math.floor(Math.random() * 9000) + 1000;
  const prResult = {
    pr_number: prNumber,
    project_id: projectId,
    contribution_id: contributionId,
    status: 'open',
    url: `https://github.com/${project.repo_name}/pull/${prNumber}`,
    created_at: new Date().toISOString(),
  };

  return prResult;
}

export async function requestReview(
  projectId: string,
  senderId: string,
  prNumber: number,
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  const reviewResult = {
    project_id: projectId,
    pr_number: prNumber,
    reviewer_id: senderId,
    status: 'review_requested',
    requested_at: new Date().toISOString(),
  };

  return reviewResult;
}

export async function mergePullRequest(
  projectId: string,
  senderId: string,
  prNumber: number,
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  if (project.proposer_id !== senderId) {
    throw new ForbiddenError('Only the project proposer can merge pull requests');
  }

  const mergeResult = {
    project_id: projectId,
    pr_number: prNumber,
    merged_by: senderId,
    status: 'merged',
    merged_at: new Date().toISOString(),
  };

  return mergeResult;
}

export async function decomposeIntoTasks(
  projectId: string,
  senderId: string,
  plan: string,
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  if (project.proposer_id !== senderId) {
    throw new ForbiddenError('Only the project proposer can decompose the project');
  }

  const planLines = plan.split('\n').filter((line) => line.trim());
  const now = new Date();
  const tasks = [];

  for (const line of planLines) {
    const taskId = uuidv4();
    const [rawTitle, ...descParts] = line.split(':');
    const taskTitle = rawTitle!.trim();
    const taskDesc = descParts.join(':').trim() || taskTitle;
    const task = await prisma.projectTask.create({
      data: {
        task_id: taskId,
        project_id: projectId,
        title: taskTitle,
        description: taskDesc,
        status: 'open',
        created_at: now,
        updated_at: now,
      },
    });
    tasks.push(task);
  }

  return tasks;
}
