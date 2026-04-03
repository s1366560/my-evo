import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import type {
  Circle,
  CircleRound,
  CircleSubmission,
  CircleVote,
  CircleOutcome,
} from '../shared/types';
import {
  CIRCLE_ENTRY_FEE,
  CIRCLE_MIN_PARTICIPANTS,
  CIRCLE_MAX_PARTICIPANTS,
  CIRCLE_WINNER_PRIZE,
  CIRCLE_ELIMINATION_RATE,
  CIRCLE_MAX_ROUNDS,
} from '../shared/constants';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  InsufficientCreditsError,
} from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function toCircle(record: Record<string, unknown>): Circle {
  return {
    circle_id: record.circle_id as string,
    name: record.name as string,
    description: record.description as string,
    theme: record.theme as string,
    status: record.status as Circle['status'],
    creator_id: record.creator_id as string,
    participant_count: record.participant_count as number,
    rounds: (record.rounds as unknown as CircleRound[]) ?? [],
    rounds_completed: record.rounds_completed as number,
    outcomes: (record.outcomes as CircleOutcome[]) ?? [],
    entry_fee: record.entry_fee as number,
    prize_pool: record.prize_pool as number,
    created_at: (record.created_at as Date).toISOString(),
  };
}

function getParticipants(circle: { members?: unknown }): string[] {
  const members = circle.members as Array<{ node_id: string }> | undefined;
  if (!members) return [];
  return members.map((m) => m.node_id);
}

export async function createCircle(
  creatorId: string,
  name: string,
  description: string,
  theme: string,
): Promise<Circle> {
  if (!name || name.trim().length === 0) {
    throw new ValidationError('Circle name is required');
  }

  const node = await prisma.node.findFirst({
    where: { node_id: creatorId },
  });

  if (!node) {
    throw new NotFoundError('Node', creatorId);
  }

  if (node.credit_balance < CIRCLE_ENTRY_FEE) {
    throw new InsufficientCreditsError(
      CIRCLE_ENTRY_FEE,
      node.credit_balance,
    );
  }

  await prisma.node.update({
    where: { node_id: creatorId },
    data: {
      credit_balance: { decrement: CIRCLE_ENTRY_FEE },
    },
  });

  await prisma.creditTransaction.create({
    data: {
      node_id: creatorId,
      amount: -CIRCLE_ENTRY_FEE,
      type: 'circle_entry',
      description: `Entry fee for circle: ${name}`,
      balance_after: node.credit_balance - CIRCLE_ENTRY_FEE,
    },
  });

  const circleId = crypto.randomUUID();

  const circle = await prisma.circle.create({
    data: {
      circle_id: circleId,
      name,
      description,
      theme,
      creator_id: creatorId,
      participant_count: 1,
      rounds: [],
      outcomes: [],
      entry_fee: CIRCLE_ENTRY_FEE,
      prize_pool: CIRCLE_ENTRY_FEE,
    },
  });

  return toCircle(circle as unknown as Record<string, unknown>);
}

export async function joinCircle(
  circleId: string,
  nodeId: string,
): Promise<Circle> {
  const circle = await prisma.circle.findUnique({
    where: { circle_id: circleId },
  });

  if (!circle) {
    throw new NotFoundError('Circle', circleId);
  }

  if (circle.status !== 'active') {
    throw new ValidationError('Circle is not active');
  }

  const rounds = circle.rounds as unknown as CircleRound[];
  if (rounds.length > 0) {
    throw new ValidationError('Cannot join a circle that has started');
  }

  const node = await prisma.node.findFirst({
    where: { node_id: nodeId },
  });

  if (!node) {
    throw new NotFoundError('Node', nodeId);
  }

  if (node.credit_balance < CIRCLE_ENTRY_FEE) {
    throw new InsufficientCreditsError(
      CIRCLE_ENTRY_FEE,
      node.credit_balance,
    );
  }

  const currentCount = circle.participant_count;

  if (currentCount >= CIRCLE_MAX_PARTICIPANTS) {
    throw new ValidationError(
      `Circle has reached the maximum of ${CIRCLE_MAX_PARTICIPANTS} participants`,
    );
  }

  const creatorId = circle.creator_id;
  if (nodeId === creatorId) {
    throw new ValidationError('Creator is already a participant');
  }

  await prisma.node.update({
    where: { node_id: nodeId },
    data: {
      credit_balance: { decrement: CIRCLE_ENTRY_FEE },
    },
  });

  await prisma.creditTransaction.create({
    data: {
      node_id: nodeId,
      amount: -CIRCLE_ENTRY_FEE,
      type: 'circle_entry',
      description: `Entry fee for circle: ${circle.name}`,
      balance_after: node.credit_balance - CIRCLE_ENTRY_FEE,
    },
  });

  const updated = await prisma.circle.update({
    where: { circle_id: circleId },
    data: {
      participant_count: currentCount + 1,
      prize_pool: circle.prize_pool + CIRCLE_ENTRY_FEE,
    },
  });

  return toCircle(updated as unknown as Record<string, unknown>);
}

export async function startRound(
  circleId: string,
): Promise<Circle> {
  const circle = await prisma.circle.findUnique({
    where: { circle_id: circleId },
  });

  if (!circle) {
    throw new NotFoundError('Circle', circleId);
  }

  if (circle.creator_id !== circle.creator_id) {
    throw new ForbiddenError('Only the creator can start rounds');
  }

  if (circle.participant_count < CIRCLE_MIN_PARTICIPANTS) {
    throw new ValidationError(
      `Need at least ${CIRCLE_MIN_PARTICIPANTS} participants`,
    );
  }

  const rounds = (circle.rounds as unknown as CircleRound[]) ?? [];
  const roundNumber = rounds.length + 1;

  if (roundNumber > CIRCLE_MAX_ROUNDS) {
    throw new ValidationError('Maximum rounds reached');
  }

  const deadline = new Date(
    Date.now() + 48 * 60 * 60 * 1000,
  ).toISOString();

  const newRound: CircleRound = {
    round_number: roundNumber,
    status: 'ongoing',
    submissions: [],
    votes: [],
    eliminated: [],
    deadline,
  };

  const updatedRounds = [...rounds, newRound];

  const updated = await prisma.circle.update({
    where: { circle_id: circleId },
    data: { rounds: updatedRounds as unknown as Prisma.InputJsonValue },
  });

  return toCircle(updated as unknown as Record<string, unknown>);
}

export async function submitAsset(
  circleId: string,
  roundNumber: number,
  nodeId: string,
  assetId: string,
): Promise<Circle> {
  const circle = await prisma.circle.findUnique({
    where: { circle_id: circleId },
  });

  if (!circle) {
    throw new NotFoundError('Circle', circleId);
  }

  const rounds = (circle.rounds as unknown as CircleRound[]) ?? [];
  const round = rounds.find((r) => r.round_number === roundNumber);

  if (!round) {
    throw new NotFoundError('Round', String(roundNumber));
  }

  if (round.status !== 'ongoing') {
    throw new ValidationError('Round is not accepting submissions');
  }

  const existingSubmission = round.submissions.find(
    (s) => s.node_id === nodeId,
  );
  if (existingSubmission) {
    throw new ValidationError('Already submitted an asset for this round');
  }

  const submission: CircleSubmission = {
    node_id: nodeId,
    asset_id: assetId,
    submitted_at: new Date().toISOString(),
  };

  const updatedSubmissions = [...round.submissions, submission];
  const updatedRounds = rounds.map((r) =>
    r.round_number === roundNumber
      ? { ...r, submissions: updatedSubmissions }
      : r,
  );

  const updated2 = await prisma.circle.update({
    where: { circle_id: circleId },
    data: { rounds: updatedRounds as unknown as Prisma.InputJsonValue },
  });

  return toCircle(updated2 as unknown as Record<string, unknown>);
}

export async function vote(
  circleId: string,
  roundNumber: number,
  voterId: string,
  targetId: string,
  score: number,
): Promise<Circle> {
  if (score < 1 || score > 10) {
    throw new ValidationError('Score must be between 1 and 10');
  }

  if (voterId === targetId) {
    throw new ValidationError('Cannot vote for yourself');
  }

  const circle = await prisma.circle.findUnique({
    where: { circle_id: circleId },
  });

  if (!circle) {
    throw new NotFoundError('Circle', circleId);
  }

  const rounds = (circle.rounds as unknown as CircleRound[]) ?? [];
  const round = rounds.find((r) => r.round_number === roundNumber);

  if (!round) {
    throw new NotFoundError('Round', String(roundNumber));
  }

  const existingVote = round.votes.find(
    (v) => v.voter_id === voterId && v.target_id === targetId,
  );
  if (existingVote) {
    throw new ValidationError('Already voted for this target');
  }

  const newVote: CircleVote = {
    voter_id: voterId,
    target_id: targetId,
    score,
    cast_at: new Date().toISOString(),
  };

  const updatedVotes = [...round.votes, newVote];
  const updatedRounds = rounds.map((r) =>
    r.round_number === roundNumber
      ? { ...r, votes: updatedVotes }
      : r,
  );

  const updated3 = await prisma.circle.update({
    where: { circle_id: circleId },
    data: { rounds: updatedRounds as unknown as Prisma.InputJsonValue },
  });

  return toCircle(updated3 as unknown as Record<string, unknown>);
}

export async function advanceRound(
  circleId: string,
): Promise<Circle> {
  const circle = await prisma.circle.findUnique({
    where: { circle_id: circleId },
  });

  if (!circle) {
    throw new NotFoundError('Circle', circleId);
  }

  const rounds = (circle.rounds as unknown as CircleRound[]) ?? [];
  const currentRound = rounds[rounds.length - 1];

  if (!currentRound || currentRound.status !== 'ongoing') {
    throw new ValidationError('No ongoing round to advance');
  }

  const scoresByTarget: Record<string, number> = {};
  for (const v of currentRound.votes) {
    scoresByTarget[v.target_id] =
      (scoresByTarget[v.target_id] ?? 0) + v.score;
  }

  const sorted = Object.entries(scoresByTarget).sort(
    ([, a], [, b]) => b - a,
  );

  const eliminateCount = Math.max(
    1,
    Math.ceil(sorted.length * CIRCLE_ELIMINATION_RATE),
  );
  const eliminated = sorted.slice(-eliminateCount).map(([id]) => id);

  const completedRound: CircleRound = {
    ...currentRound,
    status: 'completed',
    eliminated,
  };

  const updatedRounds = rounds.map((r, i) =>
    i === rounds.length - 1 ? completedRound : r,
  );

  const updated4 = await prisma.circle.update({
    where: { circle_id: circleId },
    data: {
      rounds: updatedRounds as unknown as Prisma.InputJsonValue,
      rounds_completed: circle.rounds_completed + 1,
    },
  });

  return toCircle(updated4 as unknown as Record<string, unknown>);
}

export async function completeCircle(
  circleId: string,
): Promise<Circle> {
  const circle = await prisma.circle.findUnique({
    where: { circle_id: circleId },
  });

  if (!circle) {
    throw new NotFoundError('Circle', circleId);
  }

  const rounds = (circle.rounds as unknown as CircleRound[]) ?? [];
  const finalRound = rounds[rounds.length - 1];

  if (!finalRound) {
    throw new ValidationError('No rounds have been played');
  }

  const scoresByTarget: Record<string, number> = {};
  for (const round of rounds) {
    for (const v of round.votes) {
      scoresByTarget[v.target_id] =
        (scoresByTarget[v.target_id] ?? 0) + v.score;
    }
  }

  const ranked = Object.entries(scoresByTarget)
    .sort(([, a], [, b]) => b - a);

  const outcomes: CircleOutcome[] = ranked.map(([nodeId, totalScore], idx) => ({
    node_id: nodeId,
    final_rank: idx + 1,
    total_score: totalScore,
    prize_earned: idx === 0 ? CIRCLE_WINNER_PRIZE : 0,
  }));

  if (outcomes.length > 0) {
    const winnerId = outcomes[0]!.node_id;
    await prisma.node.update({
      where: { node_id: winnerId },
      data: {
        credit_balance: { increment: CIRCLE_WINNER_PRIZE },
      },
    });

    const winner = await prisma.node.findFirst({
      where: { node_id: winnerId },
    });

    await prisma.creditTransaction.create({
      data: {
        node_id: winnerId,
        amount: CIRCLE_WINNER_PRIZE,
        type: 'circle_prize',
        description: `Circle "${circle.name}" winner prize`,
        balance_after: (winner?.credit_balance ?? 0) + CIRCLE_WINNER_PRIZE,
      },
    });
  }

  const updated5 = await prisma.circle.update({
    where: { circle_id: circleId },
    data: {
      status: 'completed',
      outcomes: outcomes as unknown as Prisma.InputJsonValue,
    },
  });

  return toCircle(updated5 as unknown as Record<string, unknown>);
}
