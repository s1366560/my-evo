/**
 * Council Service Layer
 * Business logic for AI governance council: proposals, voting, and results.
 * 
 * Uses Prisma for persistence. Proposal/Vote models defined in prisma/schema.prisma.
 * Voting weight is derived from node reputation.
 */

import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../shared/errors';
import {
  COUNCIL_CONFIG,
  type ProposalStatus,
  type VoteDecision,
  type ProposalCategory,
  type CreateProposalInput,
  type CastVoteInput,
  type ProposalSummary,
  type ProposalDetail,
  type VoteRecord,
  type ProposalWithStats,
} from './types';

// ============================================================
// Helpers
// ============================================================

/** Calculate voting weight from node reputation (1.0 base + bonus) */
function calculateVoteWeight(reputation: number): number {
  if (reputation >= 80) return 3.0;
  if (reputation >= 60) return 2.0;
  return 1.0;
}

/** Compute default voting deadline from now */
function defaultVotingDeadline(): Date {
  const d = new Date();
  d.setDate(d.getDate() + COUNCIL_CONFIG.defaultVotingPeriodDays);
  return d;
}

/** Map a raw Proposal row to a ProposalSummary */
function toSummary(row: {
  proposal_id: string;
  title: string;
  description: string;
  status: string;
  category: string;
  proposer_id: string;
  deposit: number;
  seconds: string[];
  discussion_deadline: Date | null;
  voting_deadline: Date | null;
  execution_result: string | null;
  created_at: Date;
  updated_at: Date;
  votes: { decision: string; weight: number }[];
}): ProposalSummary {
  const votesFor = row.votes
    .filter((v) => v.decision === 'approve')
    .reduce((s, v) => s + v.weight, 0);
  const votesAgainst = row.votes
    .filter((v) => v.decision === 'reject')
    .reduce((s, v) => s + v.weight, 0);
  const votesAbstain = row.votes
    .filter((v) => v.decision === 'abstain')
    .reduce((s, v) => s + v.weight, 0);

  return {
    proposal_id: row.proposal_id,
    title: row.title,
    description: row.description,
    status: row.status as ProposalStatus,
    category: row.category as ProposalCategory,
    proposer_id: row.proposer_id,
    votes_for: Math.round(votesFor * 100) / 100,
    votes_against: Math.round(votesAgainst * 100) / 100,
    votes_abstain: Math.round(votesAbstain * 100) / 100,
    deposit: row.deposit,
    voting_deadline: row.voting_deadline?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

// ============================================================
// Service Functions
// ============================================================

/**
 * List proposals with pagination and optional status filter.
 */
export async function listProposals(
  prisma: PrismaClient,
  opts: { status?: ProposalStatus; limit?: number; offset?: number } = {}
): Promise<{ proposals: ProposalSummary[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = opts.offset ?? 0;
  const where = opts.status ? { status: opts.status } : {};

  const [rows, total] = await Promise.all([
    prisma.proposal.findMany({
      where,
      include: { votes: true },
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.proposal.count({ where }),
  ]);

  return {
    proposals: rows.map(toSummary),
    total,
  };
}

/**
 * Get a single proposal with full details and vote records.
 */
export async function getProposal(
  prisma: PrismaClient,
  proposalId: string
): Promise<ProposalWithStats | null> {
  const row = await prisma.proposal.findUnique({
    where: { proposal_id: proposalId },
    include: { votes: { orderBy: { cast_at: 'desc' } } },
  });
  if (!row) return null;

  const summary = toSummary(row);
  const detail: ProposalDetail = {
    ...summary,
    seconds: row.seconds,
    discussion_deadline: row.discussion_deadline?.toISOString() ?? null,
    execution_result: row.execution_result,
  };

  const voteRecords: VoteRecord[] = row.votes.map((v) => ({
    voter_id: v.voter_id,
    proposal_id: v.proposal_id,
    decision: v.decision as VoteDecision,
    weight: v.weight,
    reason: v.reason,
    cast_at: v.cast_at.toISOString(),
  }));

  const totalVotes = voteRecords.length;
  const approveWeight = voteRecords
    .filter((v) => v.decision === 'approve')
    .reduce((s, v) => s + v.weight, 0);
  const allWeight = voteRecords.reduce((s, v) => s + v.weight, 0);

  return {
    ...detail,
    votes: voteRecords,
    total_votes: totalVotes,
    approval_rate: allWeight > 0 ? Math.round((approveWeight / allWeight) * 10000) / 100 : 0,
    voter_count: totalVotes,
  };
}

/**
 * Create a new proposal (starts in 'draft' status).
 * Requires proposer to have sufficient reputation and credits for deposit.
 */
export async function createProposal(
  prisma: PrismaClient,
  input: CreateProposalInput
): Promise<ProposalDetail> {
  // Validate proposer reputation
  const node = await prisma.node.findUnique({
    where: { node_id: input.proposer_id },
  });
  if (!node) {
    throw new NotFoundError('Node', input.proposer_id);
  }
  if (node.reputation < COUNCIL_CONFIG.minReputationToPropose) {
    throw new ForbiddenError(
      `Reputation ${COUNCIL_CONFIG.minReputationToPropose} required to propose (yours: ${node.reputation})`
    );
  }
  if (node.credit_balance < COUNCIL_CONFIG.minDeposit) {
    throw new ForbiddenError(
      `Deposit of ${COUNCIL_CONFIG.minDeposit} credits required (balance: ${node.credit_balance})`
    );
  }

  // Deduct deposit
  await prisma.node.update({
    where: { node_id: input.proposer_id },
    data: { credit_balance: { decrement: COUNCIL_CONFIG.minDeposit } },
  });

  // Record credit transaction
  await prisma.creditTransaction.create({
    data: {
      node_id: input.proposer_id,
      amount: -COUNCIL_CONFIG.minDeposit,
      type: 'council_deposit',
      description: `Proposal deposit: ${input.title}`,
      balance_after: node.credit_balance - COUNCIL_CONFIG.minDeposit,
    },
  });

  const proposalId = `prop_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const votingDeadline =
    input.voting_deadline ?? defaultVotingDeadline();

  const row = await prisma.proposal.create({
    data: {
      proposal_id: proposalId,
      title: input.title,
      description: input.description,
      proposer_id: input.proposer_id,
      status: 'draft',
      category: input.category,
      deposit: COUNCIL_CONFIG.minDeposit,
      discussion_deadline: input.discussion_deadline ?? null,
      voting_deadline: votingDeadline,
      seconds: [],
    },
    include: { votes: true },
  });

  const summary = toSummary(row);
  return {
    ...summary,
    seconds: row.seconds,
    discussion_deadline: row.discussion_deadline?.toISOString() ?? null,
    execution_result: row.execution_result,
  };
}

/**
 * Second a proposal (endorse before activation).
 */
export async function secondProposal(
  prisma: PrismaClient,
  proposalId: string,
  seconderId: string
): Promise<{ success: boolean; seconds: string[] }> {
  const row = await prisma.proposal.findUnique({
    where: { proposal_id: proposalId },
  });
  if (!row) throw new NotFoundError('Proposal', proposalId);
  if (row.status !== 'draft') {
    throw new ConflictError('Can only second draft proposals');
  }
  if (row.proposer_id === seconderId) {
    throw new ValidationError('Cannot second your own proposal');
  }
  if (row.seconds.includes(seconderId)) {
    throw new ConflictError('Already seconded this proposal');
  }

  const updatedSeconds = [...row.seconds, seconderId];
  await prisma.proposal.update({
    where: { proposal_id: proposalId },
    data: { seconds: updatedSeconds },
  });

  return { success: true, seconds: updatedSeconds };
}

/**
 * Activate a proposal for voting.
 * Requires minSeconds endorsements.
 */
export async function activateProposal(
  prisma: PrismaClient,
  proposalId: string,
  activatorId: string
): Promise<ProposalDetail> {
  const row = await prisma.proposal.findUnique({
    where: { proposal_id: proposalId },
    include: { votes: true },
  });
  if (!row) throw new NotFoundError('Proposal', proposalId);
  if (row.status !== 'draft') {
    throw new ConflictError('Proposal must be in draft to activate');
  }
  if (row.proposer_id !== activatorId) {
    throw new ForbiddenError('Only the proposer can activate');
  }
  if (row.seconds.length < COUNCIL_CONFIG.minSeconds) {
    throw new ValidationError(
      `Need ${COUNCIL_CONFIG.minSeconds} seconds (have ${row.seconds.length})`
    );
  }

  const updated = await prisma.proposal.update({
    where: { proposal_id: proposalId },
    data: { status: 'active' },
    include: { votes: true },
  });

  const summary = toSummary(updated);
  return {
    ...summary,
    seconds: updated.seconds,
    discussion_deadline: updated.discussion_deadline?.toISOString() ?? null,
    execution_result: updated.execution_result,
  };
}

/**
 * Cast a vote on an active proposal.
 * Weight is based on the voter's node reputation.
 */
export async function castVote(
  prisma: PrismaClient,
  input: CastVoteInput
): Promise<VoteRecord> {
  const row = await prisma.proposal.findUnique({
    where: { proposal_id: input.proposal_id },
  });
  if (!row) throw new NotFoundError('Proposal', input.proposal_id);
  if (row.status !== 'active') {
    throw new ConflictError('Proposal is not open for voting');
  }
  // Check voting deadline
  if (row.voting_deadline && new Date() > row.voting_deadline) {
    throw new ConflictError('Voting deadline has passed');
  }

  // Validate voter reputation
  const voter = await prisma.node.findUnique({
    where: { node_id: input.voter_id },
  });
  if (!voter) throw new NotFoundError('Node', input.voter_id);
  if (voter.reputation < COUNCIL_CONFIG.minReputationToVote) {
    throw new ForbiddenError(
      `Reputation ${COUNCIL_CONFIG.minReputationToVote} required to vote`
    );
  }

  // Check for existing vote (upsert)
  const existing = await prisma.proposalVote.findUnique({
    where: {
      voter_id_proposal_id: {
        voter_id: input.voter_id,
        proposal_id: input.proposal_id,
      },
    },
  });

  const weight = calculateVoteWeight(voter.reputation);

  if (existing) {
    // Update existing vote
    const updated = await prisma.proposalVote.update({
      where: { id: existing.id },
      data: {
        decision: input.decision,
        weight,
        reason: input.reason ?? null,
        cast_at: new Date(),
      },
    });
    return {
      voter_id: updated.voter_id,
      proposal_id: updated.proposal_id,
      decision: updated.decision as VoteDecision,
      weight: updated.weight,
      reason: updated.reason,
      cast_at: updated.cast_at.toISOString(),
    };
  }

  // Create new vote
  const vote = await prisma.proposalVote.create({
    data: {
      voter_id: input.voter_id,
      proposal_id: input.proposal_id,
      decision: input.decision,
      weight,
      reason: input.reason ?? null,
    },
  });

  return {
    voter_id: vote.voter_id,
    proposal_id: vote.proposal_id,
    decision: vote.decision as VoteDecision,
    weight: vote.weight,
    reason: vote.reason,
    cast_at: vote.cast_at.toISOString(),
  };
}

/**
 * Tally votes and finalize a proposal (called after voting deadline).
 * Simple majority: approve_weight > reject_weight → passed.
 */
export async function finalizeProposal(
  prisma: PrismaClient,
  proposalId: string
): Promise<ProposalDetail> {
  const row = await prisma.proposal.findUnique({
    where: { proposal_id: proposalId },
    include: { votes: true },
  });
  if (!row) throw new NotFoundError('Proposal', proposalId);
  if (row.status !== 'active') {
    throw new ConflictError('Only active proposals can be finalized');
  }

  const approveWeight = row.votes
    .filter((v) => v.decision === 'approve')
    .reduce((s, v) => s + v.weight, 0);
  const rejectWeight = row.votes
    .filter((v) => v.decision === 'reject')
    .reduce((s, v) => s + v.weight, 0);

  const newStatus: ProposalStatus = approveWeight > rejectWeight ? 'passed' : 'rejected';

  const updated = await prisma.proposal.update({
    where: { proposal_id: proposalId },
    data: {
      status: newStatus,
      execution_result: `${newStatus}: approve=${approveWeight.toFixed(2)}, reject=${rejectWeight.toFixed(2)}`,
    },
    include: { votes: true },
  });

  // Refund deposit if passed
  if (newStatus === 'passed') {
    const proposer = await prisma.node.findUnique({
      where: { node_id: updated.proposer_id },
    });
    if (proposer) {
      await prisma.node.update({
        where: { node_id: updated.proposer_id },
        data: { credit_balance: { increment: updated.deposit } },
      });
      await prisma.creditTransaction.create({
        data: {
          node_id: updated.proposer_id,
          amount: updated.deposit,
          type: 'council_refund',
          description: `Proposal deposit refund: ${updated.title}`,
          balance_after: proposer.credit_balance + updated.deposit,
        },
      });
    }
  }

  const summary = toSummary(updated);
  return {
    ...summary,
    seconds: updated.seconds,
    discussion_deadline: updated.discussion_deadline?.toISOString() ?? null,
    execution_result: updated.execution_result,
  };
}

/**
 * Cancel a draft proposal (proposer only). Refunds deposit.
 */
export async function cancelProposal(
  prisma: PrismaClient,
  proposalId: string,
  cancellerId: string
): Promise<ProposalDetail> {
  const row = await prisma.proposal.findUnique({
    where: { proposal_id: proposalId },
    include: { votes: true },
  });
  if (!row) throw new NotFoundError('Proposal', proposalId);
  if (row.status !== 'draft') {
    throw new ConflictError('Only draft proposals can be cancelled');
  }
  if (row.proposer_id !== cancellerId) {
    throw new ForbiddenError('Only the proposer can cancel');
  }

  // Refund deposit
  const proposer = await prisma.node.findUnique({
    where: { node_id: row.proposer_id },
  });
  if (proposer) {
    await prisma.node.update({
      where: { node_id: row.proposer_id },
      data: { credit_balance: { increment: row.deposit } },
    });
    await prisma.creditTransaction.create({
      data: {
        node_id: row.proposer_id,
        amount: row.deposit,
        type: 'council_refund',
        description: `Proposal cancelled, deposit refund: ${row.title}`,
        balance_after: proposer.credit_balance + row.deposit,
      },
    });
  }

  const updated = await prisma.proposal.update({
    where: { proposal_id: proposalId },
    data: { status: 'cancelled' },
    include: { votes: true },
  });

  const summary = toSummary(updated);
  return {
    ...summary,
    seconds: updated.seconds,
    discussion_deadline: updated.discussion_deadline?.toISOString() ?? null,
    execution_result: updated.execution_result,
  };
}
