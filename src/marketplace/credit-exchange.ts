import crypto from 'crypto';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
} from '../shared/errors';

// ─── Prisma singleton ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _prisma: any = null;

export function setPrisma(client: unknown): void {
  _prisma = client;
}

function db() {
  if (!_prisma) {
    throw new Error('Prisma client not initialized. Call setPrisma().');
  }
  return _prisma;
}

// ─── Exchange rate ─────────────────────────────────────────────────────────────

// 1 credit = 1 USD cent (fixed internal rate)
const CREDITS_PER_USD = 100;

export function getExchangeRate(): ExchangeRate {
  return {
    credits_per_usd: CREDITS_PER_USD,
    rate_type: 'fixed',
    updated_at: new Date().toISOString(),
  };
}

export interface ExchangeRate {
  credits_per_usd: number;
  rate_type: 'fixed';
  updated_at: string;
}

// ─── transferCredits ───────────────────────────────────────────────────────────

/**
 * Transfers credits between two nodes. Both nodes must exist.
 * Transfers are atomic — either complete or fail entirely.
 */
export async function transferCredits(
  fromId: string,
  toId: string,
  amount: number,
  description = '',
): Promise<TransferResult> {
  if (amount <= 0) {
    throw new ValidationError('Transfer amount must be positive');
  }

  if (fromId === toId) {
    throw new ValidationError('Cannot transfer credits to self');
  }

  const [fromNode, toNode] = await Promise.all([
    db().node.findFirst({ where: { node_id: fromId } }),
    db().node.findFirst({ where: { node_id: toId } }),
  ]);

  if (!fromNode) {
    throw new NotFoundError('Sender node', fromId);
  }
  if (!toNode) {
    throw new NotFoundError('Recipient node', toId);
  }

  if ((fromNode.credit_balance ?? 0) < amount) {
    throw new InsufficientCreditsError(amount, fromNode.credit_balance ?? 0);
  }

  const transferId = `xfer_${crypto.randomUUID()}`;
  const now = new Date();
  const fromBalanceAfter = (fromNode.credit_balance ?? 0) - amount;
  const toBalanceAfter = (toNode.credit_balance ?? 0) + amount;

  await db().creditTransaction.create({
    data: {
      node_id: fromId,
      amount: -amount,
      type: 'marketplace_buy',
      description: description || `Transfer to ${toId}`,
      balance_after: fromBalanceAfter,
    },
  });

  await db().creditTransaction.create({
    data: {
      node_id: toId,
      amount,
      type: 'marketplace_sale',
      description: description || `Transfer from ${fromId}`,
      balance_after: toBalanceAfter,
    },
  });

  await db().node.update({
    where: { node_id: fromId },
    data: { credit_balance: { decrement: amount } },
  });

  await db().node.update({
    where: { node_id: toId },
    data: { credit_balance: { increment: amount } },
  });

  return {
    transfer_id: transferId,
    from_id: fromId,
    to_id: toId,
    amount,
    from_balance_after: fromBalanceAfter,
    to_balance_after: toBalanceAfter,
    created_at: now.toISOString(),
  };
}

export interface TransferResult {
  transfer_id: string;
  from_id: string;
  to_id: string;
  amount: number;
  from_balance_after: number;
  to_balance_after: number;
  created_at: string;
}

// ─── exchangeCredits ───────────────────────────────────────────────────────────

export interface ExchangeItem {
  goods_type: 'gene' | 'capsule' | 'recipe' | 'skill' | 'service';
  goods_id: string;
  price: number; // credits per unit
  quantity: number;
}

export interface ExchangeResult {
  exchange_id: string;
  user_id: string;
  items: ExchangeItem[];
  total_cost: number;
  balance_after: number;
  created_at: string;
}

/**
 * Atomically exchanges credits for a list of goods (assets or services).
 * All-or-nothing: if any item fails validation the entire exchange is rejected.
 */
export async function exchangeCredits(
  userId: string,
  items: ExchangeItem[],
): Promise<ExchangeResult> {
  if (!items.length) {
    throw new ValidationError('Exchange must include at least one item');
  }

  const totalCost = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  if (totalCost <= 0) {
    throw new ValidationError('Total cost must be positive');
  }

  const user = await db().node.findFirst({
    where: { node_id: userId },
  });

  if (!user) {
    throw new NotFoundError('User node', userId);
  }

  if ((user.credit_balance ?? 0) < totalCost) {
    throw new InsufficientCreditsError(totalCost, user.credit_balance ?? 0);
  }

  // Validate all goods exist
  await Promise.all(
    items.map(async (item) => {
      if (item.goods_type === 'service') return; // services skip DB lookup

      const model =
        item.goods_type === 'gene'
          ? db().gene
          : item.goods_type === 'capsule'
            ? db().capsule
            : item.goods_type === 'recipe'
              ? db().recipe
              : db().skill;

      const record = await model?.findUnique({
        where: { [`${item.goods_type}_id`]: item.goods_id },
      });

      if (!record) {
        throw new NotFoundError(
          `${item.goods_type} ${item.goods_id}`,
          item.goods_id,
        );
      }
    }),
  );

  const exchangeId = `exch_${crypto.randomUUID()}`;
  const now = new Date();
  const balanceAfter = (user.credit_balance ?? 0) - totalCost;

  await db().node.update({
    where: { node_id: userId },
    data: { credit_balance: { decrement: totalCost } },
  });

  await db().creditTransaction.create({
    data: {
      node_id: userId,
      amount: -totalCost,
      type: 'marketplace_buy',
      description: `Credit exchange ${exchangeId}`,
      balance_after: balanceAfter,
    },
  });

  return {
    exchange_id: exchangeId,
    user_id: userId,
    items,
    total_cost: totalCost,
    balance_after: balanceAfter,
    created_at: now.toISOString(),
  };
}

// ─── getCreditBalance ──────────────────────────────────────────────────────────

export async function getCreditBalance(
  nodeId: string,
): Promise<{ node_id: string; balance: number }> {
  const node = await db().node.findFirst({
    where: { node_id: nodeId },
    select: { node_id: true, credit_balance: true },
  });

  if (!node) {
    throw new NotFoundError('Node', nodeId);
  }

  return {
    node_id: node.node_id,
    balance: node.credit_balance ?? 0,
  };
}
