import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import {
  INITIAL_CREDITS,
  CREDIT_DECAY,
} from '../shared/constants';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
} from '../shared/errors';
import type {
  CreditBalance,
  CreditTransaction,
  CreditTransactionType,
} from '../shared/types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export { prisma };

export async function getBalance(nodeId: string): Promise<CreditBalance> {
  const node = await prisma.node.findUnique({
    where: { node_id: nodeId },
    include: {
      creditTransactions: {
        orderBy: { timestamp: 'desc' },
        take: 1,
      },
    },
  });

  if (!node) {
    throw new NotFoundError('Node', nodeId);
  }

  const earned = await prisma.creditTransaction.aggregate({
    where: { node_id: nodeId, amount: { gt: 0 } },
    _sum: { amount: true },
  });

  const spent = await prisma.creditTransaction.aggregate({
    where: { node_id: nodeId, amount: { lt: 0 } },
    _sum: { amount: true },
  });

  const lifetimeEarned = earned._sum.amount ?? 0;
  const lifetimeSpent = Math.abs(spent._sum.amount ?? 0);

  return {
    node_id: nodeId,
    available: node.credit_balance,
    locked: 0,
    total: node.credit_balance,
    lifetime_earned: lifetimeEarned,
    lifetime_spent: lifetimeSpent,
  };
}

export async function credit(
  nodeId: string,
  amount: number,
  type: CreditTransactionType,
  description: string,
): Promise<CreditTransaction> {
  if (amount <= 0) {
    throw new ValidationError('Credit amount must be positive');
  }

  const node = await prisma.node.findUnique({
    where: { node_id: nodeId },
  });

  if (!node) {
    throw new NotFoundError('Node', nodeId);
  }

  const newBalance = node.credit_balance + amount;

  await prisma.node.update({
    where: { node_id: nodeId },
    data: { credit_balance: newBalance },
  });

  const transaction = await prisma.creditTransaction.create({
    data: {
      node_id: nodeId,
      amount,
      type,
      description,
      balance_after: newBalance,
    },
  });

  return {
    transaction_id: transaction.id,
    node_id: nodeId,
    amount,
    type,
    description,
    balance_after: newBalance,
    timestamp: transaction.timestamp.toISOString(),
  };
}

export async function debit(
  nodeId: string,
  amount: number,
  type: CreditTransactionType,
  description: string,
): Promise<CreditTransaction> {
  if (amount <= 0) {
    throw new ValidationError('Debit amount must be positive');
  }

  const node = await prisma.node.findUnique({
    where: { node_id: nodeId },
  });

  if (!node) {
    throw new NotFoundError('Node', nodeId);
  }

  if (node.credit_balance < amount) {
    throw new InsufficientCreditsError(amount, node.credit_balance);
  }

  const newBalance = node.credit_balance - amount;

  await prisma.node.update({
    where: { node_id: nodeId },
    data: { credit_balance: newBalance },
  });

  const transaction = await prisma.creditTransaction.create({
    data: {
      node_id: nodeId,
      amount: -amount,
      type,
      description,
      balance_after: newBalance,
    },
  });

  return {
    transaction_id: transaction.id,
    node_id: nodeId,
    amount: -amount,
    type,
    description,
    balance_after: newBalance,
    timestamp: transaction.timestamp.toISOString(),
  };
}

export async function transfer(
  fromId: string,
  toId: string,
  amount: number,
): Promise<{ from_transaction: CreditTransaction; to_transaction: CreditTransaction }> {
  if (amount <= 0) {
    throw new ValidationError('Transfer amount must be positive');
  }

  if (fromId === toId) {
    throw new ValidationError('Cannot transfer to self');
  }

  const [fromNode, toNode] = await Promise.all([
    prisma.node.findUnique({ where: { node_id: fromId } }),
    prisma.node.findUnique({ where: { node_id: toId } }),
  ]);

  if (!fromNode) {
    throw new NotFoundError('Node', fromId);
  }
  if (!toNode) {
    throw new NotFoundError('Node', toId);
  }

  if (fromNode.credit_balance < amount) {
    throw new InsufficientCreditsError(amount, fromNode.credit_balance);
  }

  const fromNewBalance = fromNode.credit_balance - amount;
  const toNewBalance = toNode.credit_balance + amount;

  await prisma.node.update({
    where: { node_id: fromId },
    data: { credit_balance: fromNewBalance },
  });

  await prisma.node.update({
    where: { node_id: toId },
    data: { credit_balance: toNewBalance },
  });

  const [fromTx, toTx] = await Promise.all([
    prisma.creditTransaction.create({
      data: {
        node_id: fromId,
        amount: -amount,
        type: 'marketplace_buy',
        description: `Transfer to ${toId}`,
        balance_after: fromNewBalance,
      },
    }),
    prisma.creditTransaction.create({
      data: {
        node_id: toId,
        amount,
        type: 'marketplace_sale',
        description: `Transfer from ${fromId}`,
        balance_after: toNewBalance,
      },
    }),
  ]);

  return {
    from_transaction: {
      transaction_id: fromTx.id,
      node_id: fromId,
      amount: -amount,
      type: 'marketplace_buy',
      description: `Transfer to ${toId}`,
      balance_after: fromNewBalance,
      timestamp: fromTx.timestamp.toISOString(),
    },
    to_transaction: {
      transaction_id: toTx.id,
      node_id: toId,
      amount,
      type: 'marketplace_sale',
      description: `Transfer from ${fromId}`,
      balance_after: toNewBalance,
      timestamp: toTx.timestamp.toISOString(),
    },
  };
}

export async function applyDecay(nodeId: string): Promise<CreditBalance> {
  const node = await prisma.node.findUnique({
    where: { node_id: nodeId },
  });

  if (!node) {
    throw new NotFoundError('Node', nodeId);
  }

  const now = new Date();
  const inactiveMs = now.getTime() - node.last_seen.getTime();
  const inactiveDays = inactiveMs / (1000 * 60 * 60 * 24);

  if (inactiveDays < CREDIT_DECAY.start_days) {
    return getBalance(nodeId);
  }

  if (node.credit_balance <= CREDIT_DECAY.min_balance) {
    return getBalance(nodeId);
  }

  const decayAmount = Math.floor(
    node.credit_balance * CREDIT_DECAY.rate,
  );
  const newBalance = Math.max(
    CREDIT_DECAY.min_balance,
    node.credit_balance - decayAmount,
  );
  const actualDecay = node.credit_balance - newBalance;

  if (actualDecay <= 0) {
    return getBalance(nodeId);
  }

  await prisma.node.update({
    where: { node_id: nodeId },
    data: { credit_balance: newBalance },
  });

  await prisma.creditTransaction.create({
    data: {
      node_id: nodeId,
      amount: -actualDecay,
      type: 'decay',
      description: `Credit decay: ${CREDIT_DECAY.rate * 100}% after ${Math.floor(inactiveDays)} days inactivity`,
      balance_after: newBalance,
    },
  });

  return getBalance(nodeId);
}

export async function getHistory(
  nodeId: string,
  type?: CreditTransactionType,
  limit: number = 20,
  offset: number = 0,
): Promise<{ items: CreditTransaction[]; total: number }> {
  const where: Record<string, unknown> = { node_id: nodeId };
  if (type) {
    where.type = type;
  }

  const [transactions, total] = await Promise.all([
    prisma.creditTransaction.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.creditTransaction.count({ where }),
  ]);

  const items = transactions.map((t: { id: string; node_id: string; amount: number; type: string; description: string; balance_after: number; timestamp: Date }) => ({
    transaction_id: t.id,
    node_id: t.node_id,
    amount: t.amount,
    type: t.type as CreditTransactionType,
    description: t.description,
    balance_after: t.balance_after,
    timestamp: t.timestamp.toISOString(),
  }));

  return { items, total };
}
