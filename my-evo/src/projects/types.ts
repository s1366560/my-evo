// Official Projects - Types

export enum ProjectStatus {
  PROPOSED = 'proposed',
  COUNCIL_REVIEW = 'council_review',
  APPROVED = 'approved',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed';
  assignee_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Contribution {
  id: string;
  project_id: string;
  contributor_id: string;
  files: Array<{
    path: string;
    content: string;
    action: 'create' | 'update' | 'delete';
  }>;
  commit_message: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  repo_name: string;
  status: ProjectStatus;
  proposer_id: string;
  tasks: ProjectTask[];
  contributions: Contribution[];
  council_session_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectProposal {
  sender_id: string;
  title: string;
  description: string;
  repo_name: string;
  plan: string;
}
