import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import {
  SECONDING_REQUIRED,
  SECONDING_MIN_REP,
  DISCUSSION_PERIOD_H,
  VOTING_PERIOD_H,
  QUORUM_PERCENTAGE,
  DRAFT_EXPIRY_DAYS,
  PROPOSAL_DEPOSIT,
  VOTE_WEIGHT_MULTIPLIERS,
} from '../shared/constants';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
  ForbiddenError,
} from '../shared/errors';
import type { ProposalStatus, ProposalCategory } from '../shared/types';
import type {
  CreateProposalInput,
  SecondProposalInput,
  VoteInput,
  ListProposalsInput,
} from './types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export { prisma };

function getVoteWeight(reputation: number): number {
  for (const tier of VOTE_WEIGHT_MULTIPLIERS) {
    if (reputation >= tier.min && reputation <= tier.max) {
      return tier.multiplier;
    }
  }
  return 1.0;
}

export async function createProposal(
  proposerId: string,
  title: string,
  description: string,
  category: ProposalCategory,
) {
  const node = await prisma.node.findUnique({
    where: { node_id: proposerId },
  });

  if (!node) {
    throw new NotFoundError('Node', proposerId);
  }

  if (node.credit_balance < PROPOSAL_DEPOSIT) {
    throw new InsufficientCreditsError(PROPOSAL_DEPOSIT, node.credit_balance);
  }

  const proposalId = uuidv4();
  const now = new Date();

  const [updatedNode, proposal] = await prisma.$transaction([
    prisma.node.update({
      where: { node_id: proposerId },
      data: {
        credit_balance: node.credit_balance - PROPOSAL_DEPOSIT,
      },
    }),
    prisma.proposal.create({
      data: {
        proposal_id: proposalId,
        title,
        description,
        proposer_id: proposerId,
        status: 'draft',
        category,
        seconds: [],
        deposit: PROPOSAL_DEPOSIT,
        created_at: now,
        updated_at: now,
      },
    }),
  ]);

  await prisma.creditTransaction.create({
    data: {
      node_id: proposerId,
      amount: -PROPOSAL_DEPOSIT,
      type: 'proposal_deposit',
      description: `Proposal deposit: ${title}`,
      balance_after: updatedNode.credit_balance,
      timestamp: now,
    },
  });

  return proposal;
}

export async function secondProposal(
  proposalId: string,
  seconderId: string,
) {
  const proposal = await prisma.proposal.findUnique({
    where: { proposal_id: proposalId },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal', proposalId);
  }

  if (proposal.status !== 'draft') {
    throw new ValidationError('Proposal must be in draft status to second');
  }

  if (proposal.proposer_id === seconderId) {
    throw new ValidationError('Proposer cannot second their own proposal');
  }

  if (proposal.seconds.includes(seconderId)) {
    throw new ValidationError('Node has already seconded this proposal');
  }

  const seconder = await prisma.node.findUnique({
    where: { node_id: seconderId },
  });

  if (!seconder) {
    throw new NotFoundError('Node', seconderId);
  }

  if (seconder.reputation < SECONDING_MIN_REP) {
    throw new ForbiddenError(
      `Reputation ${SECONDING_MIN_REP} required to second proposals`,
    );
  }

  const updatedSeconds = [...proposal.seconds, seconderId];
  const now = new Date();
  const hasEnoughSeconds = updatedSeconds.length >= SECONDING_REQUIRED;

  const newStatus: ProposalStatus = hasEnoughSeconds ? 'discussion' : 'seconded';
  const discussionDeadline = hasEnoughSeconds
    ? new Date(now.getTime() + DISCUSSION_PERIOD_H * 3600_000)
    : null;
  const votingDeadline = hasEnoughSeconds
    ? new Date(now.getTime() + (DISCUSSION_PERIOD_H + VOTING_PERIOD_H) * 3600_000)
    : null;

  const updated = await prisma.proposal.update({
    where: { proposal_id: proposalId },
    data: {
      seconds: updatedSeconds,
      status: newStatus,
      discussion_deadline: discussionDeadline,
      voting_deadline: votingDeadline,
      updated_at: now,
    },
  });

  return updated;
}

export async function vote(
  proposalId: string,
  voterId: string,
  decision: 'approve' | 'reject' | 'abstain',
  reason?: string,
) {
  const proposal = await prisma.proposal.findUnique({
    where: { proposal_id: proposalId },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal', proposalId);
  }

  if (proposal.status !== 'discussion' && proposal.status !== 'voting') {
    throw new ValidationError('Proposal is not in a votable state');
  }

  const existingVote = await prisma.proposalVote.findUnique({
    where: {
      voter_id_proposal_id: {
        voter_id: voterId,
        proposal_id: proposalId,
      },
    },
  });

  if (existingVote) {
    throw new ValidationError('Node has already voted on this proposal');
  }

  const voter = await prisma.node.findUnique({
    where: { node_id: voterId },
  });

  if (!voter) {
    throw new NotFoundError('Node', voterId);
  }

  const weight = getVoteWeight(voter.reputation);
  const now = new Date();

  if (proposal.status === 'discussion') {
    await prisma.proposal.update({
      where: { proposal_id: proposalId },
      data: { status: 'voting' as ProposalStatus, updated_at: now },
    });
  }

  const voteRecord = await prisma.proposalVote.create({
    data: {
      voter_id: voterId,
      proposal_id: proposalId,
      decision,
      weight,
      reason: reason ?? null,
      cast_at: now,
    },
  });

  return voteRecord;
}

export async function executeDecision(proposalId: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { proposal_id: proposalId },
    include: { votes: true },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal', proposalId);
  }

  if (proposal.status !== 'voting') {
    throw new ValidationError('Proposal must be in voting status to execute');
  }

  const totalVoters = proposal.votes.length;
  const totalEligible = await prisma.node.count();
  const quorum = Math.ceil(totalEligible * QUORUM_PERCENTAGE);

  if (totalVoters < quorum) {
    const updated = await prisma.proposal.update({
      where: { proposal_id: proposalId },
      data: {
        status: 'rejected' as ProposalStatus,
        execution_result: `Quorum not met: ${totalVoters}/${quorum}`,
        updated_at: new Date(),
      },
    });
    return updated;
  }

  const weightedApprove = proposal.votes
    .filter((v: { decision: string }) => v.decision === 'approve')
    .reduce((sum: number, v: { weight: number }) => sum + v.weight, 0);
  const weightedReject = proposal.votes
    .filter((v: { decision: string }) => v.decision === 'reject')
    .reduce((sum: number, v: { weight: number }) => sum + v.weight, 0);
  const totalWeight = weightedApprove + weightedReject;

  const approved = totalWeight > 0 && weightedApprove > totalWeight / 2;
  const now = new Date();

  const updated = await prisma.proposal.update({
    where: { proposal_id: proposalId },
    data: {
      status: approved ? ('approved' as ProposalStatus) : ('rejected' as ProposalStatus),
      execution_result: approved
        ? `Approved: ${weightedApprove.toFixed(1)} vs ${weightedReject.toFixed(1)}`
        : `Rejected: ${weightedApprove.toFixed(1)} vs ${weightedReject.toFixed(1)}`,
      updated_at: now,
    },
  });

  if (approved) {
    await prisma.creditTransaction.create({
      data: {
        node_id: proposal.proposer_id,
        amount: proposal.deposit,
        type: 'proposal_deposit',
        description: 'Proposal approved - deposit returned',
        balance_after: 0,
        timestamp: now,
      },
    });
  }

  return updated;
}

export async function getProposal(proposalId: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { proposal_id: proposalId },
    include: { votes: true },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal', proposalId);
  }

  return proposal;
}

export async function listProposals(input: ListProposalsInput) {
  const { status, category, limit = 20, offset = 0 } = input;

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }
  if (category) {
    where.category = category;
  }

  const [proposals, total] = await Promise.all([
    prisma.proposal.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.proposal.count({ where }),
  ]);

  return { proposals, total, limit, offset };
}

export async function getVotes(proposalId: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { proposal_id: proposalId },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal', proposalId);
  }

  const votes = await prisma.proposalVote.findMany({
    where: { proposal_id: proposalId },
    orderBy: { cast_at: 'desc' },
  });

  return votes;
}
