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
  ConflictError,
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
    gene_pool: (record.gene_pool as string[]) ?? [],
    rounds: (record.rounds as unknown as CircleRound[]) ?? [],
    rounds_completed: record.rounds_completed as number,
    outcomes: (record.outcomes as CircleOutcome[]) ?? [],
    entry_fee: record.entry_fee as number,
    prize_pool: record.prize_pool as number,
    created_at: (record.created_at as Date).toISOString(),
  };
}

function wasEliminatedBeforeRound(
  rounds: CircleRound[],
  roundNumber: number,
  nodeId: string,
): boolean {
  return rounds.some(
    (round) => round.round_number < roundNumber && round.eliminated.includes(nodeId),
  );
}

function getCircleMemberIds(circle: { members?: unknown; creator_id: string }): string[] {
  if (Array.isArray(circle.members)) {
    const members = circle.members.filter(
      (member): member is string => typeof member === 'string' && member.length > 0,
    );
    if (members.length > 0) {
      return members;
    }
  }

  return [circle.creator_id];
}

function hasAuthoritativeMemberRoster(
  circle: { members?: unknown; creator_id: string; participant_count: number },
): boolean {
  return getCircleMemberIds(circle).length >= circle.participant_count;
}

function getGenePool(circle: { gene_pool?: unknown }): string[] {
  if (!Array.isArray(circle.gene_pool)) {
    return [];
  }

  return circle.gene_pool.filter(
    (geneId): geneId is string => typeof geneId === 'string' && geneId.length > 0,
  );
}

function isSerializationFailure(error: unknown): error is { code: string } {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'P2034';
}

async function runSerializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializationFailure(error) || attempt === 2) {
        throw error;
      }
    }
  }

  throw new ConflictError('Circle state changed; retry');
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

  const circleId = crypto.randomUUID();
  const circle = await runSerializableTransaction(async (tx) => {
    const node = await tx.node.findFirst({
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

    const updatedNode = await tx.node.update({
      where: { node_id: creatorId },
      data: {
        credit_balance: { decrement: CIRCLE_ENTRY_FEE },
      },
      select: { credit_balance: true },
    });

    await tx.creditTransaction.create({
      data: {
        node_id: creatorId,
        amount: -CIRCLE_ENTRY_FEE,
        type: 'circle_entry',
        description: `Entry fee for circle: ${name}`,
        balance_after: updatedNode.credit_balance,
      },
    });

    return tx.circle.create({
      data: {
        circle_id: circleId,
        name,
        description,
        theme,
        creator_id: creatorId,
        participant_count: 1,
        members: [creatorId] as unknown as Prisma.InputJsonValue,
        gene_pool: [],
        rounds: [],
        outcomes: [],
        entry_fee: CIRCLE_ENTRY_FEE,
        prize_pool: CIRCLE_ENTRY_FEE,
      },
    });
  });

  return toCircle(circle as unknown as Record<string, unknown>);
}

export async function joinCircle(
  circleId: string,
  nodeId: string,
): Promise<Circle> {
  const updated = await runSerializableTransaction(async (tx) => {
    const circle = await tx.circle.findUnique({
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

    const currentCount = circle.participant_count;
    const memberIds = getCircleMemberIds(circle);

    if (!hasAuthoritativeMemberRoster(circle)) {
      throw new ConflictError('Circle member roster requires migration backfill before accepting joins');
    }

    if (currentCount >= CIRCLE_MAX_PARTICIPANTS) {
      throw new ValidationError(
        `Circle has reached the maximum of ${CIRCLE_MAX_PARTICIPANTS} participants`,
      );
    }

    const creatorId = circle.creator_id;
    if (nodeId === creatorId) {
      throw new ValidationError('Creator is already a participant');
    }

    if (memberIds.includes(nodeId)) {
      throw new ValidationError('Node has already joined this circle');
    }

    const node = await tx.node.findFirst({
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

    const updatedNode = await tx.node.update({
      where: { node_id: nodeId },
      data: {
        credit_balance: { decrement: CIRCLE_ENTRY_FEE },
      },
      select: { credit_balance: true },
    });

    await tx.creditTransaction.create({
      data: {
        node_id: nodeId,
        amount: -CIRCLE_ENTRY_FEE,
        type: 'circle_entry',
        description: `Entry fee for circle: ${circle.name}`,
        balance_after: updatedNode.credit_balance,
      },
    });

    return tx.circle.update({
      where: { circle_id: circleId },
      data: {
        participant_count: currentCount + 1,
        members: [...memberIds, nodeId] as unknown as Prisma.InputJsonValue,
        prize_pool: circle.prize_pool + CIRCLE_ENTRY_FEE,
      },
    });
  });

  return toCircle(updated as unknown as Record<string, unknown>);
}

export async function startRound(
  circleId: string,
  requesterId: string,
): Promise<Circle> {
  const circle = await prisma.circle.findUnique({
    where: { circle_id: circleId },
  });

  if (!circle) {
    throw new NotFoundError('Circle', circleId);
  }

  if (circle.creator_id !== requesterId) {
    throw new ForbiddenError('Only the creator can start rounds');
  }

  if (circle.status !== 'active') {
    throw new ValidationError('Circle is not active');
  }

  if (!hasAuthoritativeMemberRoster(circle)) {
    throw new ConflictError('Circle member roster requires migration backfill before starting rounds');
  }

  if (circle.participant_count < CIRCLE_MIN_PARTICIPANTS) {
    throw new ValidationError(
      `Need at least ${CIRCLE_MIN_PARTICIPANTS} participants`,
    );
  }

  const rounds = (circle.rounds as unknown as CircleRound[]) ?? [];
  const lastRound = rounds[rounds.length - 1];
  const roundNumber = rounds.length + 1;

  if (roundNumber > CIRCLE_MAX_ROUNDS) {
    throw new ValidationError('Maximum rounds reached');
  }

  if (lastRound?.status === 'ongoing') {
    throw new ValidationError('Cannot start a new round while another round is ongoing');
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

export async function contributeGene(
  circleId: string,
  nodeId: string,
  geneId: string,
): Promise<Circle> {
  const updated = await runSerializableTransaction(async (tx) => {
    const circle = await tx.circle.findUnique({
      where: { circle_id: circleId },
    });

    if (!circle) {
      throw new NotFoundError('Circle', circleId);
    }

    if (circle.status !== 'active') {
      throw new ValidationError('Circle is not active');
    }

    if (!hasAuthoritativeMemberRoster(circle)) {
      throw new ConflictError(
        'Circle member roster requires migration backfill before accepting gene contributions',
      );
    }

    const memberIds = getCircleMemberIds(circle);
    if (!memberIds.includes(nodeId)) {
      throw new ForbiddenError('Only circle participants can contribute genes');
    }

    const asset = await tx.asset.findUnique({
      where: { asset_id: geneId },
      select: { author_id: true, asset_type: true },
    });

    if (!asset) {
      throw new NotFoundError('Asset', geneId);
    }

    if (asset.author_id !== nodeId) {
      throw new ForbiddenError('Can only contribute genes you authored');
    }

    if (asset.asset_type.toLowerCase() !== 'gene') {
      throw new ValidationError('Only gene assets can be contributed to the circle gene pool');
    }

    const genePool = getGenePool(circle);
    if (genePool.includes(geneId)) {
      throw new ConflictError('Gene is already in the circle gene pool');
    }

    return tx.circle.update({
      where: { circle_id: circleId },
      data: {
        gene_pool: [...genePool, geneId] as unknown as Prisma.InputJsonValue,
      },
    });
  });

  return toCircle(updated as unknown as Record<string, unknown>);
}

export async function submitAsset(
  circleId: string,
  roundNumber: number,
  nodeId: string,
  assetId: string,
): Promise<Circle> {
  const updated2 = await runSerializableTransaction(async (tx) => {
    const circle = await tx.circle.findUnique({
      where: { circle_id: circleId },
    });

    if (!circle) {
      throw new NotFoundError('Circle', circleId);
    }

    if (circle.status !== 'active') {
      throw new ValidationError('Circle is not active');
    }

    const rounds = (circle.rounds as unknown as CircleRound[]) ?? [];
    const memberIds = getCircleMemberIds(circle);
    const round = rounds.find((r) => r.round_number === roundNumber);

    if (!round) {
      throw new NotFoundError('Round', String(roundNumber));
    }

    if (round.status !== 'ongoing') {
      throw new ValidationError('Round is not accepting submissions');
    }

    if (!hasAuthoritativeMemberRoster(circle)) {
      throw new ConflictError(
        'Circle member roster requires migration backfill before accepting submissions',
      );
    }

    if (!memberIds.includes(nodeId)) {
      throw new ForbiddenError('Only circle participants can submit assets');
    }

    if (wasEliminatedBeforeRound(rounds, roundNumber, nodeId)) {
      throw new ValidationError('Eliminated participants cannot submit assets');
    }

    const existingSubmission = round.submissions.find(
      (s) => s.node_id === nodeId,
    );
    if (existingSubmission) {
      throw new ValidationError('Already submitted an asset for this round');
    }

    const asset = await tx.asset.findUnique({
      where: { asset_id: assetId },
      select: { author_id: true },
    });

    if (!asset) {
      throw new NotFoundError('Asset', assetId);
    }

    if (asset.author_id !== nodeId) {
      throw new ForbiddenError('Can only submit assets you authored');
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

    return tx.circle.update({
      where: { circle_id: circleId },
      data: { rounds: updatedRounds as unknown as Prisma.InputJsonValue },
    });
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

  const updated3 = await runSerializableTransaction(async (tx) => {
    const circle = await tx.circle.findUnique({
      where: { circle_id: circleId },
    });

    if (!circle) {
      throw new NotFoundError('Circle', circleId);
    }

    if (circle.status !== 'active') {
      throw new ValidationError('Circle is not active');
    }

    const rounds = (circle.rounds as unknown as CircleRound[]) ?? [];
    const memberIds = getCircleMemberIds(circle);
    const round = rounds.find((r) => r.round_number === roundNumber);

    if (!round) {
      throw new NotFoundError('Round', String(roundNumber));
    }

    if (round.status !== 'ongoing') {
      throw new ValidationError('Round is not accepting votes');
    }

    if (!hasAuthoritativeMemberRoster(circle)) {
      throw new ConflictError(
        'Circle member roster requires migration backfill before accepting votes',
      );
    }

    if (!memberIds.includes(voterId)) {
      throw new ForbiddenError('Only circle participants can vote');
    }

    if (!memberIds.includes(targetId)) {
      throw new ValidationError('Can only vote for circle participants');
    }

    if (wasEliminatedBeforeRound(rounds, roundNumber, voterId)) {
      throw new ValidationError('Eliminated participants cannot vote');
    }

    if (wasEliminatedBeforeRound(rounds, roundNumber, targetId)) {
      throw new ValidationError('Cannot vote for an eliminated participant');
    }

    const voterSubmitted = round.submissions.some((submission) => submission.node_id === voterId);
    if (!voterSubmitted) {
      throw new ValidationError('Only round participants can vote');
    }

    const targetSubmitted = round.submissions.some((submission) => submission.node_id === targetId);
    if (!targetSubmitted) {
      throw new ValidationError('Can only vote for nodes that submitted in this round');
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

    return tx.circle.update({
      where: { circle_id: circleId },
      data: { rounds: updatedRounds as unknown as Prisma.InputJsonValue },
    });
  });

  return toCircle(updated3 as unknown as Record<string, unknown>);
}

export async function advanceRound(
  circleId: string,
  requesterId: string,
): Promise<Circle> {
  const circle = await prisma.circle.findUnique({
    where: { circle_id: circleId },
  });

  if (!circle) {
    throw new NotFoundError('Circle', circleId);
  }

  if (circle.creator_id !== requesterId) {
    throw new ForbiddenError('Only the creator can advance rounds');
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
  requesterId: string,
): Promise<Circle> {
  const circle = await prisma.circle.findUnique({
    where: { circle_id: circleId },
  });

  if (!circle) {
    throw new NotFoundError('Circle', circleId);
  }

  if (circle.creator_id !== requesterId) {
    throw new ForbiddenError('Only the creator can complete circles');
  }

  if (circle.status === 'completed') {
    throw new ValidationError('Circle is already completed');
  }

  const rounds = (circle.rounds as unknown as CircleRound[]) ?? [];
  const finalRound = rounds[rounds.length - 1];

  if (!finalRound) {
    throw new ValidationError('No rounds have been played');
  }

  if (finalRound.status !== 'completed') {
    throw new ValidationError('Cannot complete circle while the final round is still ongoing');
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

  const updated5 = await prisma.$transaction(async (tx) => {
    const completion = await tx.circle.updateMany({
      where: {
        circle_id: circleId,
        status: { not: 'completed' },
      },
      data: {
        status: 'completed',
        outcomes: outcomes as unknown as Prisma.InputJsonValue,
      },
    });

    if (completion.count !== 1) {
      throw new ValidationError('Circle is already completed');
    }

    if (outcomes.length > 0) {
      const winnerId = outcomes[0]!.node_id;
      const updatedWinner = await tx.node.update({
        where: { node_id: winnerId },
        data: {
          credit_balance: { increment: CIRCLE_WINNER_PRIZE },
        },
        select: { credit_balance: true },
      });

      await tx.creditTransaction.create({
        data: {
          node_id: winnerId,
          amount: CIRCLE_WINNER_PRIZE,
          type: 'circle_prize',
          description: `Circle "${circle.name}" winner prize`,
          balance_after: updatedWinner.credit_balance,
        },
      });
    }

    return {
      ...circle,
      status: 'completed',
      outcomes,
    };
  });

  return toCircle(updated5 as unknown as Record<string, unknown>);
}
