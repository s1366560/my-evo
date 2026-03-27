/**
 * EvoMap GEP Protocol - AI Council Governance
 * Based on evomap-architecture-v5.md Chapter 8
 */

import { COUNCIL, COUNCIL_THRESHOLDS, PROJECT_STATES, QUARANTINE_LEVELS } from '../core/constants.js';

export type ProposalType = 'project_proposal' | 'code_review' | 'general' | 'policy_change' | 'emergency_sanction';
export type CouncilMemberRole = 'proposer' | 'seconder' | 'challenger' | 'voter';
export type DecisionStatus = 'proposed' | 'seconded' | 'diverge' | 'challenge' | 'voting' | 'converge' | 'executed' | 'rejected';

// Council member
export interface CouncilMember {
  node_id: string;
  reputation: number;
  selected_at: string;
  term_ends_at: string;
  sessions_count: number;
}

// Proposal
export interface Proposal {
  id: string;
  type: ProposalType;
  title: string;
  description: string;
  proposer_id: string;
  status: DecisionStatus;
  seconders: string[];
  created_at: string;
  discussion_ends_at?: string;
  votes: Map<string, Vote>;
  decision?: string;
  executed_at?: string;
}

// Vote
export interface Vote {
  voter_id: string;
  vote: 'approve' | 'reject' | 'abstain';
  reason?: string;
  voted_at: string;
}

// Quarantine state
export interface QuarantineState {
  node_id: string;
  level: 1 | 2 | 3;
  violations: number;
  reputation_penalty: number;
  cooldown_until?: string;
  violations_history: Array<{
    timestamp: string;
    type: 'timeout' | 'report' | 'violation';
    details: string;
  }>;
}

// Council service
export class CouncilService {
  private members: Map<string, CouncilMember> = new Map();
  private proposals: Map<string, Proposal> = new Map();
  private quorumSize: number;

  constructor(quorumSize: number = COUNCIL.MIN_SIZE) {
    this.quorumSize = quorumSize;
  }

  /**
   * Select council members based on reputation and random selection
   * 60% from top reputation, 40% random
   */
  selectMembers(
    eligibleNodes: Array<{ node_id: string; reputation: number }>,
    count: number = COUNCIL.MAX_SIZE
  ): CouncilMember[] {
    // Sort by reputation descending
    const sorted = [...eligibleNodes].sort((a, b) => b.reputation - a.reputation);
    
    // 60% from top reputation
    const reputationCount = Math.floor(count * COUNCIL.REPUTATION_TOP_PERCENT);
    const randomCount = count - reputationCount;
    
    const selected: CouncilMember[] = [];
    const now = new Date();
    const termEnds = new Date(now.getTime() + COUNCIL.COUNCIL_TERM_DAYS * 24 * 60 * 60 * 1000);

    // Select top reputation members
    for (let i = 0; i < Math.min(reputationCount, sorted.length); i++) {
      selected.push({
        node_id: sorted[i].node_id,
        reputation: sorted[i].reputation,
        selected_at: now.toISOString(),
        term_ends_at: termEnds.toISOString(),
        sessions_count: 0,
      });
    }

    // Select random members
    const remaining = sorted.slice(reputationCount);
    this.shuffleArray(remaining);
    for (let i = 0; i < Math.min(randomCount, remaining.length); i++) {
      selected.push({
        node_id: remaining[i].node_id,
        reputation: remaining[i].reputation,
        selected_at: now.toISOString(),
        term_ends_at: termEnds.toISOString(),
        sessions_count: 0,
      });
    }

    // Store members
    for (const member of selected) {
      this.members.set(member.node_id, member);
    }

    return selected;
  }

  /**
   * Check if term has expired
   */
  isTermExpired(member: CouncilMember): boolean {
    return new Date(member.term_ends_at) < new Date();
  }

  /**
   * Check if session limit exceeded
   */
  isSessionLimitExceeded(member: CouncilMember): boolean {
    return member.sessions_count >= COUNCIL.COUNCIL_MAX_SESSIONS;
  }

  /**
   * Submit a proposal
   */
  submitProposal(
    id: string,
    type: ProposalType,
    title: string,
    description: string,
    proposerId: string
  ): Proposal {
    const proposal: Proposal = {
      id,
      type,
      title,
      description,
      proposer_id: proposerId,
      status: 'proposed',
      seconders: [],
      created_at: new Date().toISOString(),
      votes: new Map(),
    };
    
    this.proposals.set(id, proposal);
    return proposal;
  }

  /**
   * Second a proposal (requires 2 seconders)
   */
  secondProposal(proposalId: string, seconderId: string): boolean {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'proposed') {
      return false;
    }

    if (proposal.seconders.includes(seconderId)) {
      return false; // Already seconded
    }

    proposal.seconders.push(seconderId);
    
    if (proposal.seconders.length >= COUNCIL.SECONDING_REQUIRED) {
      proposal.status = 'seconded';
    }

    return true;
  }

  /**
   * Start discussion phase
   */
  startDiscussion(proposalId: string, daysMin: number = COUNCIL.DISCUSSION_MIN_DAYS): boolean {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'seconded') {
      return false;
    }

    proposal.status = 'diverge';
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + daysMin);
    proposal.discussion_ends_at = endsAt.toISOString();
    
    return true;
  }

  /**
   * Submit a vote
   */
  submitVote(
    proposalId: string,
    voterId: string,
    vote: 'approve' | 'reject' | 'abstain',
    reason?: string
  ): boolean {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || !['diverge', 'challenge', 'voting'].includes(proposal.status)) {
      return false;
    }

    const member = this.members.get(voterId);
    if (!member) {
      return false;
    }

    proposal.votes.set(voterId, {
      voter_id: voterId,
      vote,
      reason,
      voted_at: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Get vote threshold based on proposal type
   */
  getVoteThreshold(proposalType: ProposalType): number {
    switch (proposalType) {
      case 'policy_change':
        return COUNCIL_THRESHOLDS.POLICY_CHANGE;
      case 'emergency_sanction':
        return COUNCIL_THRESHOLDS.EMERGENCY_SANCTION;
      case 'project_proposal':
      case 'code_review':
      case 'general':
      default:
        return COUNCIL_THRESHOLDS.PARAMETER_ADJUSTMENT;
    }
  }

  /**
   * Finalize voting and execute decision
   */
  finalizeVoting(proposalId: string): { approved: boolean; decision: string } | null {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'voting') {
      return null;
    }

    const totalVotes = proposal.votes.size;
    const approveVotes = [...proposal.votes.values()].filter(v => v.vote === 'approve').length;
    const threshold = this.getVoteThreshold(proposal.type);
    
    const approved = (approveVotes / totalVotes) >= threshold;
    
    proposal.status = approved ? 'converge' : 'rejected';
    proposal.decision = approved ? 'approved' : 'rejected';
    
    if (approved) {
      proposal.executed_at = new Date().toISOString();
    }

    return { approved, decision: proposal.decision };
  }

  /**
   * Get current council members
   */
  getMembers(): CouncilMember[] {
    return [...this.members.values()];
  }

  /**
   * Get proposal by ID
   */
  getProposal(id: string): Proposal | undefined {
    return this.proposals.get(id);
  }
}
