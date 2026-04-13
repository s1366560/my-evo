import type { Prisma, PrismaClient } from '@prisma/client';
import { ValidationError } from '../shared/errors';

type BillingPrismaClient = Pick<PrismaClient, 'creditTransaction'>;

const EARNING_TRANSACTION_TYPES = [
  'initial_grant',
  'heartbeat_reward',
  'promotion_reward',
  'ASSET_PROMOTED',
  'bounty_pay',
  'circle_prize',
  'swarm_reward',
  'marketplace_sale',
] as const;

const WITHDRAWAL_TRANSACTION_TYPES = [
  'withdrawal',
  'STAKE_WITHDRAWN',
] as const;

const STAKING_REWARD_DESCRIPTION_PREFIX = 'Staking reward';

function buildEarningsWhere(nodeId: string): Prisma.CreditTransactionWhereInput {
  return {
    node_id: nodeId,
    amount: { gt: 0 },
    OR: [
      { type: { in: [...EARNING_TRANSACTION_TYPES] } },
      {
        type: 'stake_release',
        description: { startsWith: STAKING_REWARD_DESCRIPTION_PREFIX },
      },
    ],
  };
}

function buildWithdrawalsWhere(nodeId: string): Prisma.CreditTransactionWhereInput {
  return {
    node_id: nodeId,
    amount: { gt: 0 },
    OR: [
      { type: { in: [...WITHDRAWAL_TRANSACTION_TYPES] } },
      {
        type: 'stake_release',
        NOT: {
          description: { startsWith: STAKING_REWARD_DESCRIPTION_PREFIX },
        },
      },
    ],
  };
}

export interface EarningsSummary {
  node_id: string;
  period: string;
  total_earned: number;
  total_withdrawn: number;
  pending: number;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    source: string;
    balance_after: number;
    timestamp: string;
  }>;
}

export async function getEarnings(
  prisma: BillingPrismaClient,
  nodeId: string,
): Promise<EarningsSummary> {
  if (!nodeId) {
    throw new ValidationError('node_id is required');
  }

  const earningsWhere = buildEarningsWhere(nodeId);
  const withdrawalsWhere = buildWithdrawalsWhere(nodeId);

  const [transactions, earningsAggregate, withdrawalsAggregate] = await Promise.all([
    prisma.creditTransaction.findMany({
      where: earningsWhere,
      orderBy: { timestamp: 'desc' },
      take: 100,
    }),
    prisma.creditTransaction.aggregate({
      where: earningsWhere,
      _sum: { amount: true },
    }),
    prisma.creditTransaction.aggregate({
      where: withdrawalsWhere,
      _sum: { amount: true },
    }),
  ]);

  const total = earningsAggregate._sum?.amount ?? 0;
  const withdrawn = withdrawalsAggregate._sum?.amount ?? 0;

  return {
    node_id: nodeId,
    period: 'all_time',
    total_earned: total,
    total_withdrawn: withdrawn,
    pending: 0,
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      source: t.description,
      balance_after: t.balance_after,
      timestamp: t.timestamp.toISOString(),
    })),
  };
}
