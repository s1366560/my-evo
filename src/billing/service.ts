import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
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

export async function getEarnings(nodeId: string): Promise<EarningsSummary> {
  if (!nodeId) {
    throw new ValidationError('node_id is required');
  }

  const transactions = await prisma.creditTransaction.findMany({
    where: {
      node_id: nodeId,
      type: { in: ['reward', 'bounty_won', 'bounty_payment', 'skill_sale'] },
    },
    orderBy: { timestamp: 'desc' },
    take: 100,
  });

  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  const withdrawn = transactions
    .filter((t) => t.type === 'withdrawal')
    .reduce((sum, t) => sum + t.amount, 0);

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
