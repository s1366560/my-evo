// Official Projects Engine

import { randomUUID } from 'crypto';
import {
  Project,
  ProjectStatus,
  ProjectProposal,
  ProjectTask,
  Contribution,
} from './types';

export class ProjectEngine {
  private projects: Map<string, Project> = new Map();

  propose(proposal: ProjectProposal): Project {
    const project: Project = {
      id: `proj_${randomUUID().slice(0, 8)}`,
      title: proposal.title,
      description: proposal.description,
      repo_name: proposal.repo_name,
      status: ProjectStatus.PROPOSED,
      proposer_id: proposal.sender_id,
      tasks: [],
      contributions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.projects.set(project.id, project);
    return project;
  }

  getProject(projectId: string): Project | null {
    return this.projects.get(projectId) || null;
  }

  listProjects(status?: ProjectStatus): Project[] {
    const all = Array.from(this.projects.values());
    if (status) {
      return all.filter((p) => p.status === status);
    }
    return all;
  }

  submitToCouncil(projectId: string, councilSessionId: string): Project | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    project.status = ProjectStatus.COUNCIL_REVIEW;
    project.council_session_id = councilSessionId;
    project.updated_at = new Date().toISOString();
    return project;
  }

  approve(projectId: string): Project | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    project.status = ProjectStatus.APPROVED;
    project.updated_at = new Date().toISOString();
    return project;
  }

  activate(projectId: string): Project | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    project.status = ProjectStatus.ACTIVE;
    project.updated_at = new Date().toISOString();
    return project;
  }

  complete(projectId: string): Project | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    project.status = ProjectStatus.COMPLETED;
    project.updated_at = new Date().toISOString();
    return project;
  }

  archive(projectId: string): Project | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    project.status = ProjectStatus.ARCHIVED;
    project.updated_at = new Date().toISOString();
    return project;
  }

  addTask(projectId: string, title: string, description: string): ProjectTask | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const task: ProjectTask = {
      id: `task_${randomUUID().slice(0, 8)}`,
      title,
      description,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    project.tasks.push(task);
    project.updated_at = new Date().toISOString();
    return task;
  }

  contribute(
    projectId: string,
    contributorId: string,
    files: Array<{ path: string; content: string; action: 'create' | 'update' | 'delete' }>,
    commitMessage: string
  ): Contribution | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const contribution: Contribution = {
      id: `contrib_${randomUUID().slice(0, 8)}`,
      project_id: projectId,
      contributor_id: contributorId,
      files,
      commit_message: commitMessage,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    project.contributions.push(contribution);
    project.updated_at = new Date().toISOString();
    return contribution;
  }

  approveContribution(
    projectId: string,
    contributionId: string,
    reviewerId: string
  ): Contribution | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const contribution = project.contributions.find((c) => c.id === contributionId);
    if (!contribution) return null;

    contribution.status = 'approved';
    contribution.reviewed_by = reviewerId;
    contribution.reviewed_at = new Date().toISOString();
    project.updated_at = new Date().toISOString();
    return contribution;
  }

  rejectContribution(
    projectId: string,
    contributionId: string,
    reviewerId: string
  ): Contribution | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const contribution = project.contributions.find((c) => c.id === contributionId);
    if (!contribution) return null;

    contribution.status = 'rejected';
    contribution.reviewed_by = reviewerId;
    contribution.reviewed_at = new Date().toISOString();
    project.updated_at = new Date().toISOString();
    return contribution;
  }

  decompose(
    projectId: string,
    tasks: Array<{ title: string; description: string }>
  ): ProjectTask[] | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const createdTasks: ProjectTask[] = [];
    for (const task of tasks) {
      const created = this.addTask(projectId, task.title, task.description);
      if (created) createdTasks.push(created);
    }
    return createdTasks;
  }
}
