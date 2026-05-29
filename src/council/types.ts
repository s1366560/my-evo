/**
 * Council Module Types
 * AI governance council - proposal submission, voting, and results
 * 
 * Design Notes:
 * - Proposals are governance items that node operators can vote on
 * - Voting weight is based on node reputation (GDI score)
 * - Proposal lifecycle: draft -> active -> passed/rejected -> executed
 */

// Proposal status enum
export type ProposalStatus = 
  | 'draft'      // Created but not yet submitted for voting
  | 'active'     // Open for voting
  | 'passed'     // Approved by the council
  | 'rejected'   // Rejected by the council
  | 'executed'   // Successfully executed
  | 'cancelled'; // Withdrawn by proposer

// Vote decision types
export type VoteDecision = 'approve' | 'reject' | 'abstain';

// Proposal categories
export type ProposalCategory = 
  | 'protocol'    // Protocol changes
  | 'parameter'   // Parameter adjustments
  | 'treasury'    // Fund allocation
  | 'upgrade'     // Software upgrades
  | 'governance'  // Governance process changes
  | 'emergency';  // Emergency actions

// ============================================================
// API Request/Response Types
// ============================================================

/** GET /a2a/council/history - List all proposals */
export interface CouncilProposalsResponse {
  proposals: ProposalSummary[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/** GET /a2a/council/proposal/:proposalId - Single proposal details */
export interface ProposalDetailsResponse {
  proposal: ProposalDetail;
  votes: VoteRecord[];
}

/** POST /a2a/council/proposal - Submit new proposal */
export interface CreateProposalRequest {
  title: string;
  description: string;
  category: ProposalCategory;
  content?: string;          // Optional detailed content/hash
  discussion_deadline?: string; // ISO date string
  voting_deadline?: string;    // ISO date string
}

export interface CreateProposalResponse {
  success: boolean;
  proposal: ProposalDetail;
  message: string;
}

/** POST /a2a/council/proposal/:proposalId/vote - Cast vote */
export interface CastVoteRequest {
  vote: VoteDecision;
  reason?: string;  // Optional vote rationale
}

export interface CastVoteResponse {
  success: boolean;
  vote: VoteRecord;
  message: string;
}

/** POST /a2a/council/proposal/:proposalId/activate - Activate proposal for voting */
export interface ActivateProposalResponse {
  success: boolean;
  proposal: ProposalDetail;
  message: string;
}

// ============================================================
// Domain Types
// ============================================================

/** Proposal summary for list views */
export interface ProposalSummary {
  proposal_id: string;
  title: string;
  description: string;
  status: ProposalStatus;
  category: ProposalCategory;
  proposer_id: string;
  votes_for: number;
  votes_against: number;
  votes_abstain: number;
  deposit: number;
  voting_deadline: string | null;
  created_at: string;
  updated_at: string;
}

/** Detailed proposal information */
export interface ProposalDetail extends ProposalSummary {
  seconds: string[];           // Nodes that seconded the proposal
  discussion_deadline: string | null;
  execution_result: string | null;
}

/** Individual vote record */
export interface VoteRecord {
  voter_id: string;
  proposal_id: string;
  decision: VoteDecision;
  weight: number;  // Calculated based on node reputation
  reason: string | null;
  cast_at: string;
}

// ============================================================
// Service Layer Types
// ============================================================

/** Input for creating a proposal */
export interface CreateProposalInput {
  proposer_id: string;
  title: string;
  description: string;
  category: ProposalCategory;
  content?: string;
  discussion_deadline?: Date;
  voting_deadline?: Date;
}

/** Input for casting a vote */
export interface CastVoteInput {
  voter_id: string;
  proposal_id: string;
  decision: VoteDecision;
  reason?: string;
}

/** Proposal with computed vote statistics */
export interface ProposalWithStats extends ProposalDetail {
  total_votes: number;
  approval_rate: number;  // Percentage of approve votes
  voter_count: number;   // Number of unique voters
}

// ============================================================
// Configuration
// ============================================================

/** Council governance parameters */
export interface CouncilConfig {
  /** Minimum deposit (in credits) to submit a proposal */
  minDeposit: number;
  /** Minimum number of seconds required to activate proposal */
  minSeconds: number;
  /** Default voting period in days */
  defaultVotingPeriodDays: number;
  /** Minimum reputation to submit proposals */
  minReputationToPropose: number;
  /** Minimum reputation to vote */
  minReputationToVote: number;
}

export const COUNCIL_CONFIG: CouncilConfig = {
  minDeposit: 50,           // 50 credits
  minSeconds: 3,            // Need 3 seconders
  defaultVotingPeriodDays: 7,
  minReputationToPropose: 30,
  minReputationToVote: 10,
};

/** Category labels for display */
export const CATEGORY_LABELS: Record<ProposalCategory, string> = {
  protocol: 'Protocol Change',
  parameter: 'Parameter Adjustment',
  treasury: 'Treasury',
  upgrade: 'Software Upgrade',
  governance: 'Governance',
  emergency: 'Emergency',
};

/** Status labels for display */
export const STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  passed: 'Passed',
  rejected: 'Rejected',
  executed: 'Executed',
  cancelled: 'Cancelled',
};
