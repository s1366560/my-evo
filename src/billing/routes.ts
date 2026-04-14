import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../shared/auth';
import { ForbiddenError } from '../shared/errors';
import * as service from './service';

const TRANSACTION_RETRY_LIMIT = 3;

class RetryableStakeConflictError extends Error {}

function isRetryableTransactionError(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && (
      (error as { code?: unknown }).code === 'P2034'
      || (error as { code?: unknown }).code === 'P2002'
    )
  ) || error instanceof RetryableStakeConflictError;
}

async function runSerializableTransaction<T>(
  prisma: FastifyInstance['prisma'],
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < TRANSACTION_RETRY_LIMIT; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === TRANSACTION_RETRY_LIMIT - 1) {
        throw error;
      }
    }
  }

  throw new RetryableStakeConflictError('Stake state changed during transaction');
}

function resolveSelfNodeId(authNodeId: string, requestedNodeId?: string): string {
  const nodeId = requestedNodeId ?? authNodeId;
  if (nodeId !== authNodeId) {
    throw new ForbiddenError('Cannot access billing for another node');
  }
  return nodeId;
}

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  // GET /billing/earnings/:nodeId — query earnings for a node
  app.get('/earnings/:nodeId', {
    schema: { tags: ['Billing'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { nodeId } = request.params as { nodeId: string };
    const earnings = await service.getEarnings(app.prisma, resolveSelfNodeId(auth.node_id, nodeId));
    return reply.send({ success: true, data: earnings });
  });

  // GET /billing/earnings — alias for /billing/earnings/:nodeId using auth node_id
  app.get('/earnings', {
    schema: { tags: ['Billing'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const earnings = await service.getEarnings(app.prisma, auth.node_id);
    return reply.send({ success: true, data: earnings });
  });

  // POST /billing/stake — Stake credits to become a validator
  app.post('/stake', {
    schema: { tags: ['Billing'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = (request.body as { node_id?: string } | undefined) ?? {};
    const nodeId = resolveSelfNodeId(auth.node_id, body.node_id);

    const STAKE_AMOUNT = 500;
    const MIN_STAKE = 100;

    let result;
    try {
      result = await runSerializableTransaction(app.prisma, async (tx) => {
        const node = await tx.node.findUnique({ where: { node_id: nodeId } });
        if (!node) {
          return {
            kind: 'error' as const,
            statusCode: 404,
            payload: { error: 'Node not found' },
          };
        }

        const existing = await tx.validatorStake.findUnique({ where: { node_id: nodeId } });
        if (existing?.status === 'active') {
          return {
            kind: 'error' as const,
            statusCode: 409,
            payload: { error: 'already_staked', stakedAmount: existing.amount },
          };
        }

        const debit = await tx.node.updateMany({
          where: {
            node_id: nodeId,
            credit_balance: { gte: STAKE_AMOUNT },
          },
          data: { credit_balance: { decrement: STAKE_AMOUNT } },
        });

        if (debit.count === 0) {
          const currentNode = await tx.node.findUnique({ where: { node_id: nodeId } });
          return {
            kind: 'error' as const,
            statusCode: 402,
            payload: {
              error: 'insufficient_balance',
              required: STAKE_AMOUNT,
              available: currentNode?.credit_balance ?? 0,
            },
          };
        }

        const lockedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        if (existing) {
          const reactivated = await tx.validatorStake.updateMany({
            where: {
              node_id: nodeId,
              status: { not: 'active' },
            },
            data: {
              amount: existing.amount + STAKE_AMOUNT,
              locked_until: lockedUntil,
              status: 'active',
            },
          });

          if (reactivated.count !== 1) {
            throw new RetryableStakeConflictError('Stake state changed during activation');
          }
        } else {
          await tx.validatorStake.create({
            data: {
              stake_id: crypto.randomUUID(),
              node_id: nodeId,
              validator_id: nodeId,
              amount: STAKE_AMOUNT,
              locked_until: lockedUntil,
              status: 'active',
            },
          });
        }

        const updatedNode = await tx.node.findUnique({ where: { node_id: nodeId } });
        const stake = await tx.validatorStake.findUnique({ where: { node_id: nodeId } });

        if (!stake || stake.status !== 'active') {
          throw new RetryableStakeConflictError('Stake state changed before commit');
        }

        await tx.creditTransaction.create({
          data: {
            node_id: nodeId,
            type: 'STAKE_DEPOSITED',
            amount: -STAKE_AMOUNT,
            description: 'Validator stake deposited',
            balance_after: updatedNode?.credit_balance ?? 0,
          },
        });

        return {
          kind: 'success' as const,
          stakedAmount: stake.amount,
        };
      });
    } catch (error) {
      if (isRetryableTransactionError(error)) {
        const currentStake = await app.prisma.validatorStake.findUnique({ where: { node_id: nodeId } });
        if (currentStake?.status === 'active') {
          return reply.status(409).send({
            error: 'already_staked',
            stakedAmount: currentStake.amount,
          });
        }
      }
      throw error;
    }

    if (result.kind === 'error') {
      return reply.status(result.statusCode).send(result.payload);
    }

    return {
      status: 'staked',
      nodeId,
      stakedAmount: result.stakedAmount,
      minRequired: MIN_STAKE,
    };
  });

  // POST /billing/unstake — Withdraw stake
  app.post('/unstake', {
    schema: { tags: ['Billing'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = (request.body as { node_id?: string } | undefined) ?? {};
    const nodeId = resolveSelfNodeId(auth.node_id, body.node_id);

    const result = await app.prisma.$transaction(async (tx) => {
      const stake = await tx.validatorStake.findUnique({ where: { node_id: nodeId } });
      if (!stake || stake.status !== 'active') {
        return {
          kind: 'error' as const,
          statusCode: 404,
          payload: { error: 'no_active_stake' },
        };
      }

      const withdrawAmount = stake.amount;
      const release = await tx.validatorStake.updateMany({
        where: { node_id: nodeId, status: 'active' },
        data: { status: 'withdrawn', amount: 0 },
      });

      if (release.count === 0) {
        return {
          kind: 'error' as const,
          statusCode: 404,
          payload: { error: 'no_active_stake' },
        };
      }

      const updatedNode = await tx.node.update({
        where: { node_id: nodeId },
        data: { credit_balance: { increment: withdrawAmount } },
      });

      await tx.creditTransaction.create({
        data: {
          node_id: nodeId,
          type: 'STAKE_WITHDRAWN',
          amount: withdrawAmount,
          description: 'Validator stake withdrawn',
          balance_after: updatedNode.credit_balance,
        },
      });

      return {
        kind: 'success' as const,
        amountReturned: withdrawAmount,
      };
    });

    if (result.kind === 'error') {
      return reply.status(result.statusCode).send(result.payload);
    }

    return { status: 'withdrawn', nodeId, amountReturned: result.amountReturned };
  });

  // GET /billing/stake/:nodeId — Check stake status (no auth required)
  app.get('/stake/:nodeId', {
    schema: { tags: ['Billing'] },
  }, async (request) => {
    const { nodeId } = request.params as { nodeId: string };
    const stake = await app.prisma.validatorStake.findUnique({ where: { node_id: nodeId } });
    if (!stake) return { nodeId, status: 'not_staked', stakedAmount: 0 };

    const node = await app.prisma.node.findUnique({ where: { node_id: nodeId } });
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
