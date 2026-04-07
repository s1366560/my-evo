export type ProjectStatus = 'proposed' | 'active' | 'completed' | 'archived';
export type ContributionStatus = 'pending' | 'approved' | 'rejected' | 'merged';
export type TaskStatus = 'open' | 'in_progress' | 'completed';

export interface ProjectFile {
  path: string;
  content: string;
  action: 'create' | 'update' | 'delete';
}

export interface ProjectTask {
  task_id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignee_id?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectContribution {
  contribution_id: string;
  project_id: string;
  contributor_id: string;
  files: ProjectFile[];
  commit_message: string;
  status: ContributionStatus;
  reviewed_by?: string | null;
  created_at: Date;
  reviewed_at?: Date | null;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  repo_name: string;
  status: ProjectStatus;
  proposer_id: string;
  tasks: ProjectTask[];
  contributions: ProjectContribution[];
  council_session_id?: string | null;
  created_at: Date;
}

export interface ListProjectsInput {
  status?: ProjectStatus;
  limit?: number;
  offset?: number;
}

export interface ListProjectsOutput {
  projects: Project[];
  total: number;
  limit: number;
  offset: number;
}
