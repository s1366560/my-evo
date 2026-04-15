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

type StakeResult = ValidatorStake & {
  attestation_id: string;
  trust_level: TrustLevel;
};

type ReleaseResult = ValidatorStake & {
  amount_returned: number;
  penalty: number;
  trust_level: TrustLevel;
};

type FailedVerificationResult = {
  status: 'slashed';
  stake_id: string;
  node_id: string;
  validator_id: string;
  amount_returned: number;
  penalty: number;
  trust_level: TrustLevel;
};

const FAILED_VERIFICATION_REPUTATION_PENALTY = 5;

function deriveTrustLevel(activeStakeCount: number, reputation = 0): TrustLevel {
  if (activeStakeCount >= 3 && reputation >= 80) {
    return 'trusted';
  }
  if (activeStakeCount >= 1) {
    return 'verified';
  }
  return 'unverified';
}

async function syncTrustAfterStakeSettlement(
  nodeId: string,
  validatorId: string,
  fallbackLevel: TrustLevel = 'unverified',
): Promise<TrustLevel> {
  await prisma.trustAttestation.deleteMany({
    where: {
      node_id: nodeId,
      validator_id: validatorId,
    },
  });

  const remainingStakeCount = await prisma.validatorStake.count({
    where: {
      node_id: nodeId,
      status: 'active',
    },
  });

  const targetNode = await prisma.node.findFirst({
    where: { node_id: nodeId },
  });
  const trustLevel: TrustLevel = targetNode
    ? deriveTrustLevel(remainingStakeCount, targetNode.reputation)
    : fallbackLevel;

  if (targetNode) {
    await prisma.node.update({
      where: { node_id: nodeId },
      data: { trust_level: trustLevel },
    });
  }

  return trustLevel;
}

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export async function stake(
  nodeId: string,
  validatorId: string,
  amount: number,
): Promise<StakeResult> {
  if (amount < TRUST_STAKE_AMOUNT) {
    throw new ValidationError(
      `Minimum stake amount is ${TRUST_STAKE_AMOUNT} credits`,
    );
  }

  const lockedUntil = new Date(
    Date.now() + TRUST_LOCK_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  );

  const stakeRecord = await prisma.$transaction(async (tx) => {
    const validator = await tx.node.findFirst({
      where: { node_id: validatorId },
    });

    if (!validator) {
      throw new NotFoundError('Validator', validatorId);
    }

    if (validator.trust_level !== 'trusted') {
      throw new TrustLevelError('trusted', validator.trust_level);
    }

    const target = await tx.node.findFirst({
      where: { node_id: nodeId },
    });

    if (!target) {
      throw new NotFoundError('Node', nodeId);
    }

    const existingStake = await tx.validatorStake.findMany({
      where: {
        node_id: nodeId,
        validator_id: validatorId,
        status: 'active',
      },
      orderBy: { staked_at: 'asc' },
      take: 1,
    });

    if (existingStake.length > 0) {
      throw new ValidationError('Validator already has an active stake for this node');
    }

    const debitResult = await tx.node.updateMany({
      where: {
        node_id: validatorId,
        credit_balance: { gte: amount },
      },
      data: { credit_balance: { decrement: amount } },
    });

    if (debitResult.count === 0) {
      throw new InsufficientCreditsError(amount, validator.credit_balance);
    }

    const updatedValidator = await tx.node.findFirst({
      where: { node_id: validatorId },
    });

    await tx.creditTransaction.create({
      data: {
        node_id: validatorId,
        amount: -amount,
        type: 'stake_lock',
        description: `Staked ${amount} credits for node ${nodeId}`,
        balance_after: updatedValidator?.credit_balance ?? (validator.credit_balance - amount),
      },
    });

    const createdStake = await tx.validatorStake.create({
      data: {
        stake_id: crypto.randomUUID(),
        node_id: nodeId,
        validator_id: validatorId,
        amount,
        locked_until: lockedUntil,
        status: 'active',
      },
    });

    const trustLevel: TrustLevel = 'verified';

    await tx.node.update({
      where: { node_id: nodeId },
      data: { trust_level: trustLevel },
    });

    const attestation = await tx.trustAttestation.create({
      data: {
        attestation_id: crypto.randomUUID(),
        validator_id: validatorId,
        node_id: nodeId,
        trust_level: trustLevel,
        stake_amount: amount,
        expires_at: new Date(
          Date.now() + ATTESTATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        ),
        signature: crypto
          .createHash('sha256')
          .update(`${validatorId}:${nodeId}:${createdStake.stake_id}`)
          .digest('hex'),
      },
    });

    return { createdStake, attestation, trustLevel };
  });

  return {
    stake_id: stakeRecord.createdStake.stake_id,
    node_id: stakeRecord.createdStake.node_id,
    validator_id: stakeRecord.createdStake.validator_id,
    amount: stakeRecord.createdStake.amount,
    staked_at: stakeRecord.createdStake.staked_at.toISOString(),
    locked_until: stakeRecord.createdStake.locked_until.toISOString(),
    status: stakeRecord.createdStake.status as ValidatorStake['status'],
    attestation_id: stakeRecord.attestation.attestation_id,
    trust_level: stakeRecord.trustLevel,
  };
}

export async function release(
  stakeId: string,
  actorId: string,
): Promise<ReleaseResult> {
  const stakeRecord = await prisma.validatorStake.findUnique({
    where: { stake_id: stakeId },
  });

  if (!stakeRecord) {
    throw new NotFoundError('Stake', stakeId);
  }

  if (stakeRecord.status !== 'active') {
    throw new ValidationError('Only active stakes can be released');
  }

  if (stakeRecord.validator_id !== actorId) {
    throw new ForbiddenError('Only the staking validator can release this stake');
  }

  if (new Date(stakeRecord.locked_until) > new Date()) {
    throw new ValidationError('Stake is still locked');
  }

  const penalty = Math.ceil(stakeRecord.amount * TRUST_RELEASE_PENALTY);
  const returnAmount = stakeRecord.amount - penalty;

  const node = await prisma.node.findFirst({
    where: { node_id: stakeRecord.validator_id },
  });

  if (node) {
    await prisma.node.update({
      where: { node_id: stakeRecord.validator_id },
      data: { credit_balance: { increment: returnAmount } },
    });

    await prisma.creditTransaction.create({
      data: {
        node_id: stakeRecord.validator_id,
        amount: returnAmount,
        type: 'stake_release',
        description: `Released stake ${stakeId}, penalty: ${penalty}`,
        balance_after: node.credit_balance + returnAmount,
      },
    });
  }

  const updated = await prisma.validatorStake.update({
    where: { stake_id: stakeRecord.stake_id },
    data: { status: 'released' },
  });

  const trustLevel = await syncTrustAfterStakeSettlement(
    stakeRecord.node_id,
    stakeRecord.validator_id,
  );

  return {
    stake_id: updated.stake_id,
    node_id: updated.node_id,
    validator_id: updated.validator_id,
    amount: updated.amount,
    staked_at: updated.staked_at.toISOString(),
    locked_until: updated.locked_until.toISOString(),
    status: updated.status as ValidatorStake['status'],
    amount_returned: returnAmount,
    penalty,
    trust_level: trustLevel,
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

  const validatorNode = await prisma.node.findFirst({
    where: { node_id: stakeRecord.validator_id },
  });

  const returnAmount = stakeRecord.amount - slashAmount;

  if (returnAmount > 0 && validatorNode) {
    await prisma.node.update({
      where: { node_id: stakeRecord.validator_id },
      data: { credit_balance: { increment: returnAmount } },
    });

    await prisma.creditTransaction.create({
      data: {
        node_id: stakeRecord.validator_id,
        amount: returnAmount,
        type: 'stake_slash',
        description: `Slashed stake ${stakeId}, penalty: ${slashAmount}`,
        balance_after: validatorNode.credit_balance + returnAmount,
      },
    });
  }

  const updated = await prisma.validatorStake.update({
    where: { stake_id: stakeRecord.stake_id },
    data: { status: 'slashed' },
  });

  await syncTrustAfterStakeSettlement(
    stakeRecord.node_id,
    stakeRecord.validator_id,
    'unverified',
  );

  return {
    stake_id: updated.stake_id,
    node_id: updated.node_id,
    validator_id: updated.validator_id,
    amount: updated.amount,
    staked_at: updated.staked_at.toISOString(),
    locked_until: updated.locked_until.toISOString(),
    status: updated.status as ValidatorStake['status'],
  };
}

export async function claimReward(
  stakeId: string,
  actorId: string,
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

  if (stakeRecord.validator_id !== actorId) {
    throw new ForbiddenError('Only the staking validator can claim rewards for this stake');
  }

  if (new Date(stakeRecord.locked_until) > new Date()) {
    throw new ValidationError('Stake lock period has not ended');
  }

  const reward = Math.ceil(stakeRecord.amount * TRUST_REWARD_RATE);
  const principal = stakeRecord.amount;
  const totalReturn = principal + reward;

  const node = await prisma.node.findFirst({
    where: { node_id: stakeRecord.validator_id },
  });

  if (node) {
    await prisma.node.update({
      where: { node_id: stakeRecord.validator_id },
      data: { credit_balance: { increment: totalReturn } },
    });

    await prisma.creditTransaction.create({
      data: {
        node_id: stakeRecord.validator_id,
        amount: principal,
        type: 'stake_release',
        description: `Released principal for ${stakeId}`,
        balance_after: node.credit_balance + principal,
      },
    });

    await prisma.creditTransaction.create({
      data: {
        node_id: stakeRecord.validator_id,
        amount: reward,
        type: 'stake_reward',
        description: `Staking reward for ${stakeId}`,
        balance_after: node.credit_balance + totalReturn,
      },
    });
  }

  const updatedStake = await prisma.validatorStake.update({
    where: { stake_id: stakeRecord.stake_id },
    data: { status: 'released' },
  });

  await syncTrustAfterStakeSettlement(
    stakeRecord.node_id,
    stakeRecord.validator_id,
  );

  return {
    reward,
    stake: {
      stake_id: updatedStake.stake_id,
      node_id: updatedStake.node_id,
      validator_id: updatedStake.validator_id,
      amount: updatedStake.amount,
      staked_at: updatedStake.staked_at.toISOString(),
      locked_until: updatedStake.locked_until.toISOString(),
      status: updatedStake.status as ValidatorStake['status'],
    },
  };
}

export async function listPendingStakes(): Promise<ValidatorStake[]> {
  const stakes = await prisma.validatorStake.findMany({
    where: { status: 'active' },
    orderBy: { staked_at: 'asc' },
    take: 50,
  });

  return stakes.map((stake) => ({
    stake_id: stake.stake_id,
    node_id: stake.node_id,
    validator_id: stake.validator_id,
    amount: stake.amount,
    staked_at: stake.staked_at.toISOString(),
    locked_until: stake.locked_until.toISOString(),
    status: stake.status as ValidatorStake['status'],
  }));
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

  const validatorStakes = await prisma.validatorStake.findMany({
    where: {
      node_id: targetId,
      validator_id: validatorId,
      status: 'active',
    },
  });

  if (validatorStakes.length === 0) {
    throw new ValidationError('Validator must have an active stake for this node before verification');
  }

  const activeStakeCount = await prisma.validatorStake.count({
    where: { node_id: targetId, status: 'active' },
  });

  const totalStaked = validatorStakes.reduce((sum: number, s: { amount: number }) => sum + s.amount, 0);
  const newLevel = deriveTrustLevel(activeStakeCount, target.reputation);

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

export async function failVerification(
  validatorId: string,
  targetId: string,
): Promise<FailedVerificationResult> {
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

  const [stakeRecord] = await prisma.validatorStake.findMany({
    where: {
      node_id: targetId,
      validator_id: validatorId,
      status: 'active',
    },
    orderBy: { staked_at: 'asc' },
    take: 1,
  });

  if (!stakeRecord) {
    throw new NotFoundError('Active stake', `${validatorId}:${targetId}`);
  }

  const slashedStake = await slash(stakeRecord.stake_id);
  const penalty = Math.ceil(stakeRecord.amount * TRUST_SLASH_PENALTY);
  const amountReturned = stakeRecord.amount - penalty;

  await prisma.node.update({
    where: { node_id: validatorId },
    data: { reputation: { decrement: FAILED_VERIFICATION_REPUTATION_PENALTY } },
  });

  const refreshedTarget = await prisma.node.findFirst({
    where: { node_id: targetId },
  });

  return {
    status: 'slashed',
    stake_id: slashedStake.stake_id,
    node_id: slashedStake.node_id,
    validator_id: slashedStake.validator_id,
    amount_returned: amountReturned,
    penalty,
    trust_level: (refreshedTarget?.trust_level as TrustLevel | undefined) ?? 'unverified',
  };
}

export async function getTrustLevel(
  nodeId: string,
): Promise<{ node_id: string; trust_level: TrustLevel; attestations: TrustAttestation[] }> {
  const [node, attestations] = await Promise.all([
    prisma.node.findFirst({
      where: { node_id: nodeId },
    }),
    prisma.trustAttestation.findMany({
      where: { node_id: nodeId },
      orderBy: { verified_at: 'desc' },
    }),
  ]);

  if (!node) {
    throw new NotFoundError('Node', nodeId);
  }

  return {
    node_id: nodeId,
    trust_level: node.trust_level as TrustLevel,
    attestations: attestations.map((attestation) => ({
      attestation_id: attestation.attestation_id,
      validator_id: attestation.validator_id,
      node_id: attestation.node_id,
      trust_level: attestation.trust_level as TrustLevel,
      stake_amount: attestation.stake_amount,
      verified_at: attestation.verified_at.toISOString(),
      expires_at: attestation.expires_at.toISOString(),
      signature: attestation.signature,
    })),
  };
}

export async function getStats(): Promise<TrustStats> {
  const [totalStakes, activeStakes, totalAttestations] =
    await Promise.all([
      prisma.validatorStake.count(),
      prisma.validatorStake.count({ where: { status: 'active' } }),
      prisma.trustAttestation.count(),
    ]);

  const [activeStakeRecords, slashedStakeRecords, rewardTransactions] = await Promise.all([
    prisma.validatorStake.findMany({
      where: { status: 'active' },
      select: { amount: true },
    }),
    prisma.validatorStake.findMany({
      where: { status: 'slashed' },
      select: { amount: true },
    }),
    prisma.creditTransaction.findMany({
      where: {
        OR: [
          { type: 'stake_reward' },
          {
            type: 'stake_release',
            description: { startsWith: 'Staking reward for ' },
          },
        ],
      },
      select: { amount: true, type: true, description: true },
    }),
  ]);

  const totalStakedAmount = activeStakeRecords.reduce(
    (sum: number, s: { amount: number }) => sum + s.amount,
    0,
  );
  const totalSlashed = slashedStakeRecords.reduce(
    (sum: number, s: { amount: number }) => sum + Math.ceil(s.amount * TRUST_SLASH_PENALTY),
    0,
  );
  const totalRewardsPaid = rewardTransactions.reduce(
    (sum: number, t: { amount: number }) => sum + Math.max(t.amount, 0),
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
  const verifiedNodes = nodes.filter((node) => node.trust_level === 'verified').length;
  const trustedValidators = nodes.filter((node) => node.trust_level === 'trusted').length;

  return {
    total_stakes: totalStakes,
    total_staked_amount: totalStakedAmount,
    total_staked: totalStakedAmount,
    total_staked_credits: totalStakedAmount,
    active_stakes: activeStakes,
    total_attestations: totalAttestations,
    trust_distribution: trustDistribution,
    verified_nodes: verifiedNodes,
    trusted_validators: trustedValidators,
    total_slashed: totalSlashed,
    total_rewards_paid: totalRewardsPaid,
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
