import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../shared/auth';
import { ValidationError } from '../shared/errors';
import * as service from './service';

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

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  // GET /billing/earnings/:nodeId — query earnings for a node
  app.get('/earnings/:nodeId', {
    schema: { tags: ['Billing'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const earnings = await service.getEarnings(nodeId);
    return reply.send({ success: true, data: earnings });
  });

  // GET /billing/earnings — alias for /billing/earnings/:nodeId using auth node_id
  app.get('/earnings', {
    schema: { tags: ['Billing'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const earnings = await service.getEarnings(auth.node_id);
    return reply.send({ success: true, data: earnings });
  });

  // POST /billing/stake — Stake credits to become a validator
  app.post('/stake', {
    schema: { tags: ['Billing'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as { node_id?: string };
    const { node_id } = body;
    if (!node_id) return reply.status(400).send({ error: 'node_id required' });

    const STAKE_AMOUNT = 500;
    const MIN_STAKE = 100;

    const node = await prisma.node.findUnique({ where: { node_id } });
    if (!node) return reply.status(404).send({ error: 'Node not found' });
    if (node.credit_balance < STAKE_AMOUNT) {
      return reply.status(402).send({
        error: 'insufficient_balance',
        required: STAKE_AMOUNT,
        available: node.credit_balance,
      });
    }

    const existing = await prisma.validatorStake.findUnique({ where: { node_id } });
    if (existing && existing.status === 'active') {
      return reply.status(409).send({ error: 'already_staked', stakedAmount: existing.amount });
    }

    // Deduct credits from node
    const updated = await prisma.node.update({
      where: { node_id },
      data: { credit_balance: { decrement: STAKE_AMOUNT } },
    });
    await prisma.creditTransaction.create({
      data: {
        node_id,
        type: 'STAKE_DEPOSITED',
        amount: -STAKE_AMOUNT,
        description: 'Validator stake deposited',
        balance_after: updated.credit_balance,
      },
    });

    const stake = await prisma.validatorStake.upsert({
      where: { node_id },
      create: {
        stake_id: crypto.randomUUID(),
        node_id,
        amount: STAKE_AMOUNT,
        locked_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'active',
      },
      update: { amount: { increment: STAKE_AMOUNT }, status: 'active' },
    });

    return {
      status: 'staked',
      nodeId: node_id,
      stakedAmount: stake.amount,
      minRequired: MIN_STAKE,
    };
  });

  // POST /billing/unstake — Withdraw stake
  app.post('/unstake', {
    schema: { tags: ['Billing'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as { node_id?: string };
    const { node_id } = body;
    if (!node_id) return reply.status(400).send({ error: 'node_id required' });

    const stake = await prisma.validatorStake.findUnique({ where: { node_id } });
    if (!stake || stake.status !== 'active') {
      return reply.status(404).send({ error: 'no_active_stake' });
    }

    const withdrawAmount = stake.amount;
    const updated = await prisma.node.update({
      where: { node_id },
      data: { credit_balance: { increment: withdrawAmount } },
    });
    await prisma.creditTransaction.create({
      data: {
        node_id,
        type: 'STAKE_WITHDRAWN',
        amount: withdrawAmount,
        description: 'Validator stake withdrawn',
        balance_after: updated.credit_balance,
      },
    });
    await prisma.validatorStake.update({
      where: { node_id },
      data: { status: 'withdrawn', amount: 0 },
    });

    return { status: 'withdrawn', nodeId: node_id, amountReturned: withdrawAmount };
  });

  // GET /billing/stake/:nodeId — Check stake status (no auth required)
  app.get('/stake/:nodeId', {
    schema: { tags: ['Billing'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const stake = await prisma.validatorStake.findUnique({ where: { node_id: nodeId } });
    if (!stake) return { nodeId, status: 'not_staked', stakedAmount: 0 };

    const node = await prisma.node.findUnique({ where: { node_id: nodeId } });
    return {
      nodeId,
      status: stake.status,
      stakedAmount: stake.amount,
      eligibleForValidation: stake.status === 'active' && stake.amount >= 100,
      createdAt: stake.created_at,
      updatedAt: stake.updated_at,
      nodeReputation: node?.reputation ?? 0,
    };
  });
}
