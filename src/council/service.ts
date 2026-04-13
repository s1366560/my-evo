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
  CouncilDialogInput,
  CouncilDialogResult,
  CouncilDialogPosition,
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

function isProposalStatus(value: string): value is ProposalStatus {
  return [
    'draft',
    'seconded',
    'discussion',
    'voting',
    'approved',
    'rejected',
    'executed',
  ].includes(value);
}

function isVoteDecision(value: string): value is VoteInput['decision'] {
  return ['approve', 'reject', 'abstain'].includes(value);
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function normalizeTimestamp(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildDialogPositions(
  proposerId: string,
  seconders: string[],
  votes: Array<{
    voter_id: string;
    decision: 'approve' | 'reject' | 'abstain';
    weight: number;
    reason?: string | null;
    cast_at: Date | string;
  }>,
): CouncilDialogPosition[] {
  if (votes.length > 0) {
    return [...votes]
      .sort((left, right) => {
        const leftTime = new Date(left.cast_at).getTime();
        const rightTime = new Date(right.cast_at).getTime();
        return rightTime - leftTime;
      })
      .slice(0, 5)
      .map((vote) => ({
        member: vote.voter_id,
        stance: vote.decision,
        confidence: roundMetric(Math.max(0.3, Math.min(1, vote.weight / 1.5))),
        reason: vote.reason ?? null,
      }));
  }

  const positions: CouncilDialogPosition[] = [
    {
      member: proposerId,
      stance: 'proposed',
      confidence: 0.65,
    },
  ];

  for (const seconderId of seconders.slice(0, 4)) {
    positions.push({
      member: seconderId,
      stance: 'seconded',
      confidence: 0.55,
    });
  }

  return positions;
}

function buildDialogSummary(
  speakerId: string,
  proposal: {
    title: string;
    status: ProposalStatus;
    seconds: string[];
  },
  totalVotes: number,
  quorum: number,
  weightedApprove: number,
  weightedReject: number,
): string {
  const prefix = `Recorded ${speakerId}'s input for "${proposal.title}".`;

  switch (proposal.status) {
    case 'draft':
      return `${prefix} The proposal is still in draft with ${proposal.seconds.length}/${SECONDING_REQUIRED} seconders secured.`;
    case 'seconded':
      return `${prefix} The proposal has early backing and is waiting for enough support to move into discussion.`;
    case 'discussion':
      return `${prefix} The proposal is in discussion with ${proposal.seconds.length} seconders and ${totalVotes} vote signal(s) already on record.`;
    case 'voting':
      if (totalVotes < quorum) {
        return `${prefix} Voting is active, but quorum is not met yet at ${totalVotes}/${quorum} votes.`;
      }

      if (weightedApprove === weightedReject) {
        return `${prefix} Voting is active and currently tied on weighted support.`;
      }

      return weightedApprove > weightedReject
        ? `${prefix} Voting is active with weighted support leading ${weightedApprove.toFixed(1)} to ${weightedReject.toFixed(1)}.`
        : `${prefix} Voting is active with weighted opposition leading ${weightedReject.toFixed(1)} to ${weightedApprove.toFixed(1)}.`;
    case 'approved':
      return `${prefix} The council has already approved the proposal and is waiting for execution follow-through.`;
    case 'rejected':
      return `${prefix} The council has rejected the proposal; further discussion should focus on what would need to change for resubmission.`;
    case 'executed':
      return `${prefix} The proposal has already been executed, so the discussion should focus on outcomes and follow-up adjustments.`;
    default:
      return `${prefix} The council has the proposal under active review.`;
  }
}

function buildRecommendedAction(
  proposal: {
    status: ProposalStatus;
    seconds: string[];
  },
  totalVotes: number,
  quorum: number,
  weightedApprove: number,
  weightedReject: number,
): string {
  switch (proposal.status) {
    case 'draft': {
      const secondersNeeded = Math.max(SECONDING_REQUIRED - proposal.seconds.length, 0);
      return secondersNeeded > 0
        ? `Secure ${secondersNeeded} more eligible seconder(s) to move this proposal into discussion.`
        : 'Move the draft into structured discussion and collect implementation feedback.';
    }
    case 'seconded':
      return 'Gather one more qualified seconder so the proposal can enter discussion.';
    case 'discussion':
      return 'Address the strongest objections and encourage members to convert discussion into formal votes.';
    case 'voting':
      if (totalVotes < quorum) {
        return `Increase participation: ${quorum - totalVotes} more vote(s) are needed to reach quorum.`;
      }

      if (weightedApprove > weightedReject) {
        return 'Prepare the execution plan and keep supporters aligned until voting closes.';
      }

      if (weightedReject > weightedApprove) {
        return 'Respond to the main objections or revise the proposal before the council finalizes rejection.';
      }

      return 'Break the tie by clarifying tradeoffs and collecting additional votes.';
    case 'approved':
      return 'Execute the approved proposal and publish the implementation result back to the council.';
    case 'rejected':
      return 'Revise the proposal with stronger evidence or a narrower scope before resubmitting.';
    case 'executed':
      return 'Monitor post-execution outcomes and capture any follow-up work in a new proposal.';
    default:
      return 'Continue dialogue or submit a vote.';
  }
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

export async function generateDialogResponse(
  input: CouncilDialogInput,
): Promise<CouncilDialogResult> {
  const timestamp = new Date().toISOString();

  if (!input.proposal_id) {
    return {
      proposal_id: null,
      speaker: input.speaker_id,
      message: input.message,
      response: {
        summary: `Recorded ${input.speaker_id}'s council note. No proposal was attached, so the discussion remains advisory until a concrete proposal is referenced.`,
        positions: [],
        consensus_estimate: 0,
        recommended_action: 'Reference a proposal_id or submit a new proposal so the council can deliberate against concrete governance state.',
      },
      timestamp,
    };
  }

  const proposal = await prisma.proposal.findUnique({
    where: { proposal_id: input.proposal_id },
    include: { votes: true },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal', input.proposal_id);
  }

  if (!isProposalStatus(proposal.status)) {
    throw new ValidationError(`Proposal ${proposal.proposal_id} has invalid status`);
  }

  const votes = proposal.votes.map((vote) => {
    if (!isVoteDecision(vote.decision)) {
      throw new ValidationError(`Proposal ${proposal.proposal_id} has invalid vote decision`);
    }

    return {
      ...vote,
      decision: vote.decision,
    };
  });

  const proposalState = {
    ...proposal,
    status: proposal.status,
    votes,
  };

  const totalEligible = await prisma.node.count();
  const quorum = Math.max(Math.ceil(totalEligible * QUORUM_PERCENTAGE), 1);
  const weightedApprove = votes
    .filter((vote) => vote.decision === 'approve')
    .reduce((sum, vote) => sum + vote.weight, 0);
  const weightedReject = votes
    .filter((vote) => vote.decision === 'reject')
    .reduce((sum, vote) => sum + vote.weight, 0);
  const decisiveWeight = weightedApprove + weightedReject;
  const consensusEstimate = decisiveWeight > 0 ? weightedApprove / decisiveWeight : 0;
  const deadline =
    proposalState.status === 'discussion'
      ? normalizeTimestamp(proposalState.discussion_deadline)
      : normalizeTimestamp(proposalState.voting_deadline);

  return {
    proposal_id: proposalState.proposal_id,
    speaker: input.speaker_id,
    message: input.message,
    response: {
      summary: buildDialogSummary(
        input.speaker_id,
        proposalState,
        votes.length,
        quorum,
        weightedApprove,
        weightedReject,
      ),
      positions: buildDialogPositions(proposalState.proposer_id, proposalState.seconds, votes),
      consensus_estimate: roundMetric(consensusEstimate),
      recommended_action: buildRecommendedAction(
        proposalState,
        votes.length,
        quorum,
        weightedApprove,
        weightedReject,
      ),
      proposal_status: proposalState.status,
      vote_count: votes.length,
      quorum_target: quorum,
      deadline,
    },
    timestamp,
  };
}
