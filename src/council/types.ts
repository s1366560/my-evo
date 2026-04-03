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
