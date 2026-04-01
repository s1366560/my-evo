/**
 * Council Engine - AI Council Governance Logic
 * Phase 5: Governance & Dispute Resolution
 */

import * as crypto from 'crypto';
import type {
  CouncilProposal,
  CouncilVote,
  CouncilMember,
  DisputeArbitrationPayload,
  BountyDisputeDecision,
  CouncilConfig,
  ProposalStatus,
  CouncilTerm,
  CouncilSession,
} from './types';

// Default council configuration
const DEFAULT_CONFIG: CouncilConfig = {
  voting_period_hours: 24,
  min_quorum_pct: 50,
  min_approval_pct: 60,
  max_council_members: 100,
  min_gdi_to_vote: 100,
};

// In-memory proposal store (in production, persist to DB)
const proposals = new Map<string, CouncilProposal>();

// Active council members (in production, query from reputation system)
const councilMembers = new Map<string, CouncilMember>();

/**
 * Initialize council with default members
 */
export function initializeCouncil(members: CouncilMember[]): void {
  councilMembers.clear();
  for (const m of members) {
    councilMembers.set(m.node_id, m);
  }
}

/**
 * Get current council config
 */
export function getConfig(): CouncilConfig {
  return { ...DEFAULT_CONFIG };
}

/**
 * Create a new council proposal
 */
export function createProposal(
  type: CouncilProposal['type'],
  title: string,
  description: string,
  proposer: string,
  options: Partial<CouncilProposal> = {}
): CouncilProposal {
  const proposal_id = `council_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date();
  const expires = new Date(now.getTime() + DEFAULT_CONFIG.voting_period_hours * 60 * 60 * 1000);

  const proposal: CouncilProposal = {
    proposal_id,
    type,
    title,
    description,
    proposer,
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
    status: 'voting',
    votes: [],
    approve_count: 0,
    reject_count: 0,
    abstain_count: 0,
    total_weight_approve: 0,
    total_weight_reject: 0,
    ...options,
  };

  proposals.set(proposal_id, proposal);
  return proposal;
}

/**
 * Submit a dispute for council arbitration
 */
export function submitDisputeArbitration(
  payload: DisputeArbitrationPayload
): CouncilProposal {
  const { bounty_id, disputed_by, dispute_reason } = payload;

  return createProposal(
    'dispute_arbitration',
    `Dispute Resolution: Bounty ${bounty_id}`,
    `Dispute raised by ${disputed_by}: ${dispute_reason}`,
    disputed_by,
    {
      target_bounty_id: bounty_id,
      target_dispute_reason: dispute_reason,
    }
  );
}

/**
 * Cast a vote on a council proposal
 */
export function castVote(
  proposal_id: string,
  voter_id: string,
  vote: 'approve' | 'reject' | 'abstain',
  reason?: string
): CouncilVote | null {
  const proposal = proposals.get(proposal_id);
  if (!proposal) {
    throw new Error(`Proposal ${proposal_id} not found`);
  }

  if (proposal.status !== 'voting') {
    throw new Error(`Proposal is not in voting status: ${proposal.status}`);
  }

  // Check if proposal has expired
  if (new Date() > new Date(proposal.expires_at)) {
    finalizeProposal(proposal_id);
    throw new Error('Voting period has ended');
  }

  // Get voter's weight from GDI (mock for now)
  const member = councilMembers.get(voter_id);
  const weight = member?.gdi_score ?? calculateMockGDI(voter_id);

  // Check if voter already voted
  const existingVote = proposal.votes.find(v => v.voter_id === voter_id);
  if (existingVote) {
    throw new Error('Already voted on this proposal');
  }

  const councilVote: CouncilVote = {
    voter_id,
    vote,
    weight,
    reason,
    timestamp: new Date().toISOString(),
  };

  proposal.votes.push(councilVote);

  // Update counts
  switch (vote) {
    case 'approve':
      proposal.approve_count++;
      proposal.total_weight_approve += weight;
      break;
    case 'reject':
      proposal.reject_count++;
      proposal.total_weight_reject += weight;
      break;
    case 'abstain':
      proposal.abstain_count++;
      break;
  }

  return councilVote;
}

/**
 * Finalize a proposal and determine outcome
 */
export function finalizeProposal(proposal_id: string): ProposalStatus {
  const proposal = proposals.get(proposal_id);
  if (!proposal) {
    throw new Error(`Proposal ${proposal_id} not found`);
  }

  if (proposal.status !== 'voting') {
    return proposal.status;
  }

  const config = getConfig();
  const totalVotes = proposal.approve_count + proposal.reject_count + proposal.abstain_count;
  const totalWeight = proposal.total_weight_approve + proposal.total_weight_reject;
  
  // Calculate quorum
  const activeMembers = Math.min(councilMembers.size, config.max_council_members);
  const quorumWeight = activeMembers * (config.min_gdi_to_vote + 200) / 2; // Mock avg GDI
  const quorumPct = (totalWeight / quorumWeight) * 100;

  if (quorumPct < config.min_quorum_pct && new Date() >= new Date(proposal.expires_at)) {
    proposal.status = 'expired';
    return 'expired';
  }

  // Calculate approval percentage by weight
  const totalVotingWeight = proposal.total_weight_approve + proposal.total_weight_reject;
  const approvalPct = totalVotingWeight > 0 
    ? (proposal.total_weight_approve / totalVotingWeight) * 100 
    : 0;

  if (approvalPct >= config.min_approval_pct) {
    proposal.status = 'approved';
  } else {
    proposal.status = 'rejected';
  }

  return proposal.status;
}

/**
 * Execute an approved proposal
 */
export function executeProposal(proposal_id: string): boolean {
  const proposal = proposals.get(proposal_id);
  if (!proposal) {
    throw new Error(`Proposal ${proposal_id} not found`);
  }

  if (proposal.status !== 'approved') {
    throw new Error(`Proposal must be approved before execution: ${proposal.status}`);
  }

  proposal.status = 'executed';
  proposal.executed_at = new Date().toISOString();
  
  // Execute based on type (in production, this would trigger actual state changes)
  switch (proposal.type) {
    case 'dispute_arbitration':
      executeDisputeResolution(proposal);
      break;
    case 'parameter_change':
      // Implement parameter changes
      break;
    case 'emergency_action':
      // Implement emergency actions
      break;
    case 'budget_allocation':
      // Implement budget changes
      break;
  }

  return true;
}

/**
 * Execute dispute resolution for approved bounty dispute
 */
function executeDisputeResolution(proposal: CouncilProposal): BountyDisputeDecision {
  // Mock decision logic - in production, use votes and evidence
  const decision: BountyDisputeDecision = {
    proposal_id: proposal.proposal_id,
    bounty_id: proposal.target_bounty_id!,
    verdict: 'favor_creator', // Default
    reasoning: `Council decision based on ${proposal.votes.length} votes`,
  };

  proposal.resolution = JSON.stringify(decision);
  return decision;
}

/**
 * Get proposal by ID
 */
export function getProposal(proposal_id: string): CouncilProposal | undefined {
  return proposals.get(proposal_id);
}

/**
 * List proposals with optional filters
 */
export function listProposals(options: {
  status?: ProposalStatus;
  type?: CouncilProposal['type'];
  limit?: number;
} = {}): CouncilProposal[] {
  let result = Array.from(proposals.values());

  if (options.status) {
    result = result.filter(p => p.status === options.status);
  }
  if (options.type) {
    result = result.filter(p => p.type === options.type);
  }

  // Sort by created_at descending
  result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (options.limit) {
    result = result.slice(0, options.limit);
  }

  return result;
}

/**
 * Mock GDI calculation for a node (in production, query reputation system)
 */
function calculateMockGDI(node_id: string): number {
  // Simple hash-based mock GDI
  let hash = 0;
  for (let i = 0; i < node_id.length; i++) {
    hash = ((hash << 5) - hash) + node_id.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash % 500) + 100; // 100-600 range
}

/**
 * Resolve a bounty dispute through council arbitration
 */
export function resolveBountyDispute(
  bounty_id: string,
  vote: 'favor_creator' | 'favor_worker' | 'split' | 'void'
): BountyDisputeDecision {
  // Find the active dispute proposal for this bounty
  const disputeProposal = listProposals({ type: 'dispute_arbitration' })
    .find(p => p.target_bounty_id === bounty_id && p.status === 'voting');

  if (!disputeProposal) {
    throw new Error(`No active dispute proposal found for bounty ${bounty_id}`);
  }

  // Finalize the vote
  finalizeProposal(disputeProposal.proposal_id);

  // Create decision
  const decision: BountyDisputeDecision = {
    proposal_id: disputeProposal.proposal_id,
    bounty_id,
    verdict: vote,
    reasoning: `Resolved by council vote: ${disputeProposal.approve_count} approve, ${disputeProposal.reject_count} reject`,
  };

  // Set reward distribution based on verdict
  switch (vote) {
    case 'favor_creator':
      decision.reward_distribution = { to_creator: 100, to_worker: 0, to_council: 0 };
      break;
    case 'favor_worker':
      decision.reward_distribution = { to_creator: 0, to_worker: 100, to_council: 0 };
      break;
    case 'split':
      decision.reward_distribution = { to_creator: 50, to_worker: 50, to_council: 0 };
      break;
    case 'void':
      decision.reward_distribution = { to_creator: 0, to_worker: 0, to_council: 100 };
      break;
  }

  disputeProposal.resolution = JSON.stringify(decision);
  disputeProposal.status = 'executed';
  disputeProposal.executed_at = new Date().toISOString();

  return decision;
}

// In-memory term and session stores
const councilTerms = new Map<string, CouncilTerm>();
const councilSessions = new Map<string, CouncilSession>();

/**
 * Initialize mock council data for testing
 */
export function initializeCouncilData(): void {
  const now = new Date();
  const weekOfYear = getWeekOfYear(now);
  const termId = `term_2026w${weekOfYear}`;

  // Create current term
  const termStart = new Date(now);
  termStart.setDate(termStart.getDate() - termStart.getDay()); // Start of week
  const termEnd = new Date(termStart);
  termEnd.setDate(termEnd.getDate() + 7);

  const currentTerm: CouncilTerm = {
    term_id: termId,
    start_at: termStart.toISOString(),
    end_at: termEnd.toISOString(),
    status: 'active',
    members: Array.from(councilMembers.values()),
    proposal_count: listProposals().filter(p => {
      const created = new Date(p.created_at);
      return created >= termStart && created < termEnd;
    }).length,
    resolved_count: listProposals({ status: 'executed' }).filter(p => {
      const executed = p.executed_at ? new Date(p.executed_at) : null;
      return executed && executed >= termStart && executed < termEnd;
    }).length,
  };
  councilTerms.set(termId, currentTerm);

  // Create sample sessions for current term
  for (let i = 1; i <= 3; i++) {
    const sessionId = `council_session_${termId}_${String(i).padStart(2, '0')}`;
    const session: CouncilSession = {
      session_id: sessionId,
      term_id: termId,
      sequence: i,
      phase: i < 3 ? 'completed' : 'challenge',
      topic: i === 1 ? 'Initial proposal review' : i === 2 ? 'Budget allocation discussion' : 'Parameter change vote',
      proposal_id: i === 3 ? listProposals()[0]?.proposal_id : undefined,
      participants: Array.from(councilMembers.keys()),
      started_at: new Date(termStart.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
      ended_at: i < 3 ? new Date(termStart.getTime() + i * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString() : undefined,
      outcome: i < 3 ? (i === 1 ? 'approved' : 'rejected') : undefined,
      summary: i < 3 ? `Council session ${i} completed with outcome: ${i === 1 ? 'approved' : 'rejected'}` : undefined,
    };
    councilSessions.set(sessionId, session);
  }
}

/**
 * Get current active term
 */
export function getCurrentTerm(): CouncilTerm | undefined {
  const now = new Date();
  for (const term of councilTerms.values()) {
    const start = new Date(term.start_at);
    const end = new Date(term.end_at);
    if (now >= start && now < end) {
      return term;
    }
  }
  // Return most recent term if no active term found
  const terms = Array.from(councilTerms.values()).sort(
    (a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
  );
  return terms[0];
}

/**
 * Get term history
 */
export function getTermHistory(limit: number = 10): CouncilTerm[] {
  return Array.from(councilTerms.values())
    .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
    .slice(0, limit);
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): CouncilSession | undefined {
  return councilSessions.get(sessionId);
}

/**
 * Get sessions by term
 */
export function getSessionsByTerm(termId: string): CouncilSession[] {
  return Array.from(councilSessions.values())
    .filter(s => s.term_id === termId)
    .sort((a, b) => a.sequence - b.sequence);
}

/**
 * Get all council history (sessions)
 */
export function getCouncilHistory(limit: number = 20): CouncilSession[] {
  return Array.from(councilSessions.values())
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, limit);
}

function getWeekOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.ceil((diff + start.getDay() * 24 * 60 * 60 * 1000) / oneWeek);
}
