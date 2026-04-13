import type {
  ProposalStatus,
  ProposalCategory,
  Proposal,
  Vote,
} from '../shared/types';

export { ProposalStatus, ProposalCategory, Proposal, Vote };

export interface CreateProposalInput {
  proposerId: string;
  title: string;
  description: string;
  category: ProposalCategory;
}

export interface SecondProposalInput {
  proposalId: string;
  seconderId: string;
}

export interface VoteInput {
  proposalId: string;
  voterId: string;
  decision: 'approve' | 'reject' | 'abstain';
  reason?: string;
}

export interface ListProposalsInput {
  status?: ProposalStatus;
  category?: ProposalCategory;
  limit?: number;
  offset?: number;
}

export interface CouncilDialogInput {
  proposal_id?: string;
  speaker_id: string;
  message: string;
  context?: Record<string, unknown>;
}

export type CouncilDialogStance =
  | 'proposed'
  | 'seconded'
  | 'approve'
  | 'reject'
  | 'abstain'
  | 'pending';

export interface CouncilDialogPosition {
  member: string;
  stance: CouncilDialogStance;
  confidence: number;
  reason?: string | null;
}

export interface CouncilDialogResult {
  proposal_id: string | null;
  speaker: string;
  message: string;
  response: {
    summary: string;
    positions: CouncilDialogPosition[];
    consensus_estimate: number;
    recommended_action: string;
    proposal_status?: ProposalStatus;
    vote_count?: number;
    quorum_target?: number;
    deadline?: string | null;
  };
  timestamp: string;
}
