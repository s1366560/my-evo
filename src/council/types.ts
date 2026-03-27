/**
 * Council Types - AI Council Governance System
 * Phase 5: Governance & Dispute Resolution
 * 
 * The Council is the supreme arbiter for disputes and major protocol decisions.
 * It operates on a weighted voting system based on GDI reputation.
 */

// Council proposal types
export type CouncilProposalType =
  | 'dispute_arbitration'  // Resolve bounty disputes
  | 'parameter_change'     // Protocol parameter changes
  | 'emergency_action'     // Emergency measures
  | 'budget_allocation';   // Treasury decisions

// Proposal status
export type ProposalStatus =
  | 'voting'     // Active voting period
  | 'approved'   // Passed, ready for execution
  | 'rejected'   // Failed to pass
  | 'executed'   // Action completed
  | 'expired';   // Voting period ended without quorum

// Council vote
export interface CouncilVote {
  voter_id: string;        // node_id
  vote: 'approve' | 'reject' | 'abstain';
  weight: number;          // GDI-based voting weight
  reason?: string;         // Optional justification
  timestamp: string;
}

// Council member representation
export interface CouncilMember {
  node_id: string;
  gdi_score: number;       // Used for voting weight
  is_active: boolean;
  joined_at: string;
}

// Council proposal
export interface CouncilProposal {
  proposal_id: string;
  type: CouncilProposalType;
  title: string;
  description: string;
  proposer: string;        // node_id of submitter
  created_at: string;
  expires_at: string;      // Voting deadline
  status: ProposalStatus;
  
  // Target for dispute arbitration
  target_bounty_id?: string;
  target_dispute_reason?: string;
  
  // Voting results
  votes: CouncilVote[];
  approve_count: number;
  reject_count: number;
  abstain_count: number;
  total_weight_approve: number;
  total_weight_reject: number;
  
  // Result
  resolution?: string;
  executed_at?: string;
}

// Dispute arbitration specific payload
export interface DisputeArbitrationPayload {
  bounty_id: string;
  disputed_by: string;
  dispute_reason: string;
  bounty_state: string;
  evidence?: string[];
}

// Council decision for bounty dispute
export interface BountyDisputeDecision {
  proposal_id: string;
  bounty_id: string;
  verdict: 'favor_creator' | 'favor_worker' | 'split' | 'void';
  reward_distribution?: {
    to_creator: number;
    to_worker: number;
    to_council: number;
  };
  reasoning: string;
}

// Council configuration
export interface CouncilConfig {
  voting_period_hours: number;      // Default: 24
  min_quorum_pct: number;           // Default: 50%
  min_approval_pct: number;        // Default: 60%
  max_council_members: number;      // Max active voters
  min_gdi_to_vote: number;         // Minimum GDI threshold
}
