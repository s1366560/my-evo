import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import type {
  ValidatorStake,
  TrustAttestation,
  TrustLevel,
} from '../shared/types';
import type { TrustStats } from './types';
import {
  TRUST_STAKE_AMOUNT,
  TRUST_LOCK_PERIOD_DAYS,
  TRUST_SLASH_PENALTY,
  TRUST_REWARD_RATE,
  TRUST_RELEASE_PENALTY,
  ATTESTATION_EXPIRY_DAYS,
} from '../shared/constants';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  InsufficientCreditsError,
  TrustLevelError,
} from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export async function stake(
  nodeId: string,
  validatorId: string,
  amount: number,
): Promise<ValidatorStake> {
  if (amount < TRUST_STAKE_AMOUNT) {
    throw new ValidationError(
      `Minimum stake amount is ${TRUST_STAKE_AMOUNT} credits`,
    );
  }

  const validator = await prisma.node.findFirst({
    where: { node_id: validatorId },
  });

  if (!validator) {
    throw new NotFoundError('Validator', validatorId);
  }

  if (validator.credit_balance < amount) {
    throw new InsufficientCreditsError(amount, validator.credit_balance);
  }

  await prisma.node.update({
    where: { node_id: validatorId },
    data: { credit_balance: { decrement: amount } },
  });

  await prisma.creditTransaction.create({
    data: {
      node_id: validatorId,
      amount: -amount,
      type: 'stake_lock',
      description: `Staked ${amount} credits for node ${nodeId}`,
      balance_after: validator.credit_balance - amount,
    },
  });

  const lockedUntil = new Date(
    Date.now() + TRUST_LOCK_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  );

  const stakeRecord = await prisma.validatorStake.create({
    data: {
      stake_id: crypto.randomUUID(),
      node_id: nodeId,
      target_id: validatorId,
      amount,
      locked_until: lockedUntil,
      status: 'active',
    },
  });

  return {
    stake_id: stakeRecord.stake_id,
    node_id: stakeRecord.node_id,
    target_id: stakeRecord.target_id,
    amount: stakeRecord.amount,
    staked_at: stakeRecord.staked_at.toISOString(),
    locked_until: stakeRecord.locked_until.toISOString(),
    status: stakeRecord.status as ValidatorStake['status'],
  };
}

export async function release(
  stakeId: string,
): Promise<ValidatorStake> {
  const stakeRecord = await prisma.validatorStake.findUnique({
    where: { stake_id: stakeId },
  });

  if (!stakeRecord) {
    throw new NotFoundError('Stake', stakeId);
  }

  if (stakeRecord.status !== 'active') {
    throw new ValidationError('Only active stakes can be released');
  }

  if (new Date(stakeRecord.locked_until) > new Date()) {
    throw new ValidationError('Stake is still locked');
  }

  const penalty = Math.ceil(stakeRecord.amount * TRUST_RELEASE_PENALTY);
  const returnAmount = stakeRecord.amount - penalty;

  const target = await prisma.node.findFirst({
    where: { node_id: stakeRecord.target_id },
  });

  if (target) {
    await prisma.node.update({
      where: { node_id: stakeRecord.target_id },
      data: { credit_balance: { increment: returnAmount } },
    });

    await prisma.creditTransaction.create({
      data: {
        node_id: stakeRecord.target_id,
        amount: returnAmount,
        type: 'stake_release',
        description: `Released stake ${stakeId}, penalty: ${penalty}`,
        balance_after: target.credit_balance + returnAmount,
      },
    });
  }

  const updated = await prisma.validatorStake.update({
    where: { stake_id: stakeId },
    data: { status: 'released' },
  });

  return {
    stake_id: updated.stake_id,
    node_id: updated.node_id,
    target_id: updated.target_id,
    amount: updated.amount,
    staked_at: updated.staked_at.toISOString(),
    locked_until: updated.locked_until.toISOString(),
    status: updated.status as ValidatorStake['status'],
  };
}

export async function slash(
  stakeId: string,
): Promise<ValidatorStake> {
  const stakeRecord = await prisma.validatorStake.findUnique({
    where: { stake_id: stakeId },
  });

  if (!stakeRecord) {
    throw new NotFoundError('Stake', stakeId);
  }

  if (stakeRecord.status !== 'active') {
    throw new ValidationError('Only active stakes can be slashed');
  }

  const slashAmount = Math.ceil(
    stakeRecord.amount * TRUST_SLASH_PENALTY,
  );

  const node = await prisma.node.findFirst({
    where: { node_id: stakeRecord.node_id },
  });

  if (node) {
    const levelOrder: Record<string, number> = {
      unverified: 0,
      verified: 1,
      trusted: 2,
    };

    const currentLevel = node.trust_level as string;
    if (levelOrder[currentLevel] !== undefined && levelOrder[currentLevel]! > 0) {
      const downgrade: Record<number, string> = {
        1: 'unverified',
        2: 'verified',
      };
      await prisma.node.update({
        where: { node_id: stakeRecord.node_id },
        data: {
          trust_level: downgrade[levelOrder[currentLevel]!],
        },
      });
    }
  }

  const returnAmount = stakeRecord.amount - slashAmount;

  if (returnAmount > 0) {
    const target = await prisma.node.findFirst({
      where: { node_id: stakeRecord.target_id },
    });

    if (target) {
      await prisma.node.update({
        where: { node_id: stakeRecord.target_id },
        data: { credit_balance: { increment: returnAmount } },
      });
    }
  }

  const updated = await prisma.validatorStake.update({
    where: { stake_id: stakeId },
    data: { status: 'slashed' },
  });

  return {
    stake_id: updated.stake_id,
    node_id: updated.node_id,
    target_id: updated.target_id,
    amount: updated.amount,
    staked_at: updated.staked_at.toISOString(),
    locked_until: updated.locked_until.toISOString(),
    status: updated.status as ValidatorStake['status'],
  };
}

export async function claimReward(
  stakeId: string,
): Promise<{ reward: number; stake: ValidatorStake }> {
  const stakeRecord = await prisma.validatorStake.findUnique({
    where: { stake_id: stakeId },
  });

  if (!stakeRecord) {
    throw new NotFoundError('Stake', stakeId);
  }

  if (stakeRecord.status !== 'active') {
    throw new ValidationError('Only active stakes can claim rewards');
  }

  if (new Date(stakeRecord.locked_until) > new Date()) {
    throw new ValidationError('Stake lock period has not ended');
  }

  const reward = Math.ceil(stakeRecord.amount * TRUST_REWARD_RATE);

  const target = await prisma.node.findFirst({
    where: { node_id: stakeRecord.target_id },
  });

  if (target) {
    await prisma.node.update({
      where: { node_id: stakeRecord.target_id },
      data: { credit_balance: { increment: reward } },
    });

    await prisma.creditTransaction.create({
      data: {
        node_id: stakeRecord.target_id,
        amount: reward,
        type: 'stake_release',
        description: `Staking reward for ${stakeId}`,
        balance_after: target.credit_balance + reward,
      },
    });
  }

  return {
    reward,
    stake: {
      stake_id: stakeRecord.stake_id,
      node_id: stakeRecord.node_id,
      target_id: stakeRecord.target_id,
      amount: stakeRecord.amount,
      staked_at: stakeRecord.staked_at.toISOString(),
      locked_until: stakeRecord.locked_until.toISOString(),
      status: stakeRecord.status as ValidatorStake['status'],
    },
  };
}

export async function verifyNode(
  validatorId: string,
  targetId: string,
  notes: string,
): Promise<TrustAttestation> {
  const validator = await prisma.node.findFirst({
    where: { node_id: validatorId },
  });

  if (!validator) {
    throw new NotFoundError('Validator', validatorId);
  }

  if (validator.trust_level !== 'trusted') {
    throw new TrustLevelError('trusted', validator.trust_level);
  }

  const target = await prisma.node.findFirst({
    where: { node_id: targetId },
  });

  if (!target) {
    throw new NotFoundError('Target node', targetId);
  }

  const stakes = await prisma.validatorStake.findMany({
    where: { node_id: targetId, target_id: validatorId, status: 'active' },
  });

  const totalStaked = stakes.reduce((sum: number, s: { amount: number }) => sum + s.amount, 0);

  const newLevel: TrustLevel =
    totalStaked >= 500
      ? 'trusted'
      : totalStaked >= 100
        ? 'verified'
        : 'verified';

  await prisma.node.update({
    where: { node_id: targetId },
    data: { trust_level: newLevel },
  });

  const attestation = await prisma.trustAttestation.create({
    data: {
      attestation_id: crypto.randomUUID(),
      validator_id: validatorId,
      node_id: targetId,
      trust_level: newLevel,
      stake_amount: totalStaked,
      expires_at: new Date(
        Date.now() + ATTESTATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      ),
      signature: crypto
        .createHash('sha256')
        .update(`${validatorId}:${targetId}:${Date.now()}`)
        .digest('hex'),
    },
  });

  return {
    attestation_id: attestation.attestation_id,
    validator_id: attestation.validator_id,
    node_id: attestation.node_id,
    trust_level: attestation.trust_level as TrustLevel,
    stake_amount: attestation.stake_amount,
    verified_at: attestation.verified_at.toISOString(),
    expires_at: attestation.expires_at.toISOString(),
    signature: attestation.signature,
  };
}

export async function getTrustLevel(
  nodeId: string,
): Promise<{ node_id: string; trust_level: TrustLevel }> {
  const node = await prisma.node.findFirst({
    where: { node_id: nodeId },
  });

  if (!node) {
    throw new NotFoundError('Node', nodeId);
  }

  return {
    node_id: nodeId,
    trust_level: node.trust_level as TrustLevel,
  };
}

export async function getStats(): Promise<TrustStats> {
  const [totalStakes, activeStakes, totalAttestations] =
    await Promise.all([
      prisma.validatorStake.count(),
      prisma.validatorStake.count({ where: { status: 'active' } }),
      prisma.trustAttestation.count(),
    ]);

  const activeStakeRecords = await prisma.validatorStake.findMany({
    where: { status: 'active' },
    select: { amount: true },
  });

  const totalStakedAmount = activeStakeRecords.reduce(
    (sum: number, s: { amount: number }) => sum + s.amount,
    0,
  );

  const nodes = await prisma.node.findMany({
    select: { trust_level: true },
  });

  const trustDistribution: Record<string, number> = {};
  for (const node of nodes) {
    trustDistribution[node.trust_level] =
      (trustDistribution[node.trust_level] ?? 0) + 1;
  }

  return {
    total_stakes: totalStakes,
    total_staked_amount: totalStakedAmount,
    active_stakes: activeStakes,
    total_attestations: totalAttestations,
    trust_distribution: trustDistribution,
  };
}

export async function listAttestations(
  nodeId?: string,
): Promise<TrustAttestation[]> {
  const where: Record<string, unknown> = {};
  if (nodeId) {
    where.node_id = nodeId;
  }

  const attestations = await prisma.trustAttestation.findMany({
    where,
    orderBy: { verified_at: 'desc' },
    take: 50,
  });

  return attestations.map((a: { attestation_id: string; validator_id: string; node_id: string; trust_level: string; stake_amount: number; verified_at: Date; expires_at: Date; signature: string }) => ({
    attestation_id: a.attestation_id,
    validator_id: a.validator_id,
    node_id: a.node_id,
    trust_level: a.trust_level as TrustLevel,
    stake_amount: a.stake_amount,
    verified_at: a.verified_at.toISOString(),
    expires_at: a.expires_at.toISOString(),
    signature: a.signature,
  }));
}
