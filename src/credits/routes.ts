import type { FastifyInstance } from 'fastify';
import { requireNodeSecretAuth } from '../shared/auth';
import { ValidationError } from '../shared/errors';
import * as creditService from './service';
import {
  CREDIT_COSTS,
  CREDIT_PACKAGES,
  INITIAL_CREDITS,
  MONTHLY_ALLOWANCE,
  CREDIT_DECAY,
  REFERRAL_BONUS,
} from './types';
import type { CreditTransactionType } from './types';

function ensureNodeSecretAuth(
  auth: NonNullable<import('fastify').FastifyRequest['auth']>,
): void {
  if (auth.auth_type !== 'node_secret') {
    throw new ValidationError('Node secret credentials are required for credit operations');
  }
  if (!auth.node_id) {
    throw new ValidationError('Node ID not found in authentication context');
  }
}

export async function creditRoutes(app: FastifyInstance): Promise<void> {
  // === Public Routes ===

  // Get credit costs/pricing
  app.get('/costs', {
    schema: { tags: ['Credits'] },
  }, async (_request, reply) => {
    void reply.send({
      success: true,
      data: {
        costs: CREDIT_COSTS,
        initial_credits: INITIAL_CREDITS,
        monthly_allowance: MONTHLY_ALLOWANCE,
        decay: CREDIT_DECAY,
        referral_bonus: REFERRAL_BONUS,
      },
    });
  });

  // Get credit packages
  app.get('/packages', {
    schema: { tags: ['Credits'] },
  }, async (_request, reply) => {
    void reply.send({
      success: true,
      data: { packages: CREDIT_PACKAGES, currency: 'USD' },
    });
  });

  // Get credit economics summary
  app.get('/economics', {
    schema: { tags: ['Credits'] },
  }, async (_request, reply) => {
    void reply.send({
      success: true,
      data: {
        description: 'Credits-based economy for EvoMap Hub',
        overview: {
          new_node_credits: INITIAL_CREDITS.free,
          free_tier_monthly: MONTHLY_ALLOWANCE.free,
          premium_tier_monthly: MONTHLY_ALLOWANCE.premium,
        },
        operations: {
          creating_map: { cost: CREDIT_COSTS.map_create, description: 'Creating a new map' },
          exporting_json: { cost: CREDIT_COSTS.map_export_json },
          api_call: { cost: CREDIT_COSTS.api_call_standard },
          gdi_analysis: { cost: CREDIT_COSTS.gdi_analysis },
        },
        decay: {
          enabled: CREDIT_DECAY.enabled,
          threshold_days: CREDIT_DECAY.threshold_days,
          rate: `${CREDIT_DECAY.rate * 100}% per month after threshold`,
        },
        referral: { referrer_bonus: REFERRAL_BONUS.referrer, referee_bonus: REFERRAL_BONUS.referee },
      },
    });
  });

  // === Authenticated Routes ===

  // Get current credit balance
  app.get('/balance', {
    schema: { tags: ['Credits'] },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const balanceInfo = creditService.getBalanceInfo(auth.node_id!, 'free');
    void reply.send({ success: true, data: balanceInfo });
  });

  // Get balance with tier
  app.get<{ Params: { tier: string } }>('/balance/:tier', {
    schema: { tags: ['Credits'], params: { type: 'object', properties: { tier: { type: 'string', enum: ['free', 'premium', 'ultra'] } } } },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const tier = request.params.tier as 'free' | 'premium' | 'ultra';
    const balanceInfo = creditService.getBalanceInfo(auth.node_id!, tier);
    void reply.send({ success: true, data: balanceInfo });
  });

  // Initialize credits
  app.post('/initialize', {
    schema: {
      tags: ['Credits'],
      body: { type: 'object', properties: { tier: { type: 'string', enum: ['free', 'premium', 'ultra'] } } },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const { tier = 'free' } = request.body as { tier?: 'free' | 'premium' | 'ultra' };
    const existingBalance = creditService.getBalance(auth.node_id!);
    if (existingBalance > 0) {
      void reply.status(400).send({ success: false, error: 'ALREADY_INITIALIZED', message: 'Credits already initialized', data: { current_balance: existingBalance } });
      return;
    }
    const balanceInfo = creditService.initializeCredits(auth.node_id!, tier);
    void reply.status(201).send({ success: true, data: balanceInfo, message: `Initialized ${balanceInfo.balance} credits` });
  });

  // Spend credits
  app.post('/spend', {
    schema: {
      tags: ['Credits'],
      body: {
        type: 'object',
        required: ['amount', 'type', 'description'],
        properties: { amount: { type: 'number', minimum: 1 }, type: { type: 'string' }, description: { type: 'string' }, metadata: { type: 'object' } },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const { amount, type, description, metadata } = request.body as { amount: number; type: string; description: string; metadata?: Record<string, unknown> };
    try {
      const transaction = creditService.spendCredits(auth.node_id!, { amount, type: type as CreditTransactionType, description, metadata });
      void reply.send({ success: true, data: transaction });
    } catch (error) {
      if ((error as Error).message.includes('Insufficient')) {
        void reply.status(402).send({ success: false, error: 'INSUFFICIENT_CREDITS', message: (error as Error).message });
        return;
      }
      if (error instanceof ValidationError) {
        void reply.status(400).send({ success: false, error: 'VALIDATION_ERROR', message: error.message });
        return;
      }
      throw error;
    }
  });

  // Spend by cost type
  app.post<{ Params: { costType: string } }>('/spend/:costType', {
    schema: {
      tags: ['Credits'],
      params: { type: 'object', properties: { costType: { type: 'string' } } },
      body: { type: 'object', properties: { description: { type: 'string' } } },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const { costType } = request.params;
    const { description } = request.body as { description?: string };
    const validCostTypes = Object.keys(CREDIT_COSTS) as Array<keyof typeof CREDIT_COSTS>;
    if (!validCostTypes.includes(costType as keyof typeof CREDIT_COSTS)) {
      void reply.status(400).send({ success: false, error: 'VALIDATION_ERROR', message: `Invalid cost type. Valid: ${validCostTypes.join(', ')}` });
      return;
    }
    try {
      const transaction = creditService.spendByCostType(auth.node_id!, costType as keyof typeof CREDIT_COSTS, description);
      void reply.send({ success: true, data: transaction });
    } catch (error) {
      if ((error as Error).message.includes('Insufficient')) {
        const currentBalance = creditService.getBalance(auth.node_id!);
        const cost = CREDIT_COSTS[costType as keyof typeof CREDIT_COSTS];
        void reply.status(402).send({ success: false, error: 'INSUFFICIENT_CREDITS', message: `Insufficient credits. Cost: ${cost}, Available: ${currentBalance}`, data: { required: cost, available: currentBalance } });
        return;
      }
      throw error;
    }
  });

  // Get transaction history
  app.get('/transactions', {
    schema: {
      tags: ['Credits'],
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          from: { type: 'string' },
          to: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const { type, from, to, limit, offset } = request.query as { type?: string; from?: string; to?: string; limit?: number; offset?: number };
    const transactions = creditService.getTransactions({ node_id: auth.node_id!, type: type as CreditTransactionType | undefined, from, to, limit, offset });
    void reply.send({ success: true, data: { transactions, count: transactions.length, pagination: { limit: limit ?? 50, offset: offset ?? 0 } } });
  });

  // Get specific transaction
  app.get<{ Params: { transactionId: string } }>('/transactions/:transactionId', {
    schema: { tags: ['Credits'], params: { type: 'object', properties: { transactionId: { type: 'string' } } } },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const { transactionId } = request.params;
    const transaction = creditService.getTransaction(auth.node_id!, transactionId);
    if (!transaction) {
      void reply.status(404).send({ success: false, error: 'NOT_FOUND', message: 'Transaction not found' });
      return;
    }
    void reply.send({ success: true, data: transaction });
  });

  // Purchase credits (simulated)
  app.post('/purchase', {
    schema: {
      tags: ['Credits'],
      body: { type: 'object', required: ['package_id'], properties: { package_id: { type: 'string' }, payment_method_id: { type: 'string' } } },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const { package_id } = request.body as { package_id: string; payment_method_id?: string };
    const pkg = CREDIT_PACKAGES.find(p => p.id === package_id);
    if (!pkg) {
      void reply.status(400).send({ success: false, error: 'VALIDATION_ERROR', message: `Invalid package ID. Valid IDs: ${CREDIT_PACKAGES.map(p => p.id).join(', ')}` });
      return;
    }
    const transaction = creditService.addCredits(auth.node_id!, pkg.total_credits, 'purchase', `Purchased ${pkg.name}: ${pkg.credits} + ${pkg.bonus_credits} bonus`, { package_id: pkg.id, price_cents: pkg.price_cents });
    void reply.status(201).send({ success: true, data: { transaction, package: pkg }, message: 'Purchase successful! Credits added.' });
  });

  // Refund credits
  app.post('/refund', {
    schema: {
      tags: ['Credits'],
      body: { type: 'object', required: ['transaction_id', 'amount', 'reason'], properties: { transaction_id: { type: 'string' }, amount: { type: 'number', minimum: 1 }, reason: { type: 'string' } } },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const { transaction_id, amount, reason } = request.body as { transaction_id: string; amount: number; reason: string };
    try {
      const transaction = creditService.refundCredits(auth.node_id!, transaction_id, amount, reason);
      void reply.send({ success: true, data: transaction, message: 'Refund processed' });
    } catch (error) {
      if (error instanceof ValidationError) {
        void reply.status(400).send({ success: false, error: 'VALIDATION_ERROR', message: error.message });
        return;
      }
      throw error;
    }
  });

  // Apply referral bonus
  app.post<{ Params: { refereeNodeId: string } }>('/referral/:refereeNodeId', {
    schema: { tags: ['Credits'], params: { type: 'object', properties: { refereeNodeId: { type: 'string' } } } },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const { refereeNodeId } = request.params;
    if (refereeNodeId === auth.node_id) {
      void reply.status(400).send({ success: false, error: 'VALIDATION_ERROR', message: 'Cannot refer yourself' });
      return;
    }
    try {
      const result = creditService.applyReferralBonus(auth.node_id!, refereeNodeId);
      void reply.send({ success: true, data: { referrer_transaction: result.referrerTx, referee_transaction: result.refereeTx }, message: 'Referral bonus applied' });
    } catch (error) {
      if (error instanceof ValidationError) {
        void reply.status(400).send({ success: false, error: 'VALIDATION_ERROR', message: error.message });
        return;
      }
      throw error;
    }
  });

  // Check decay status
  app.get('/decay-status', {
    schema: { tags: ['Credits'] },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const balanceInfo = creditService.getBalanceInfo(auth.node_id!, 'free');
    void reply.send({
      success: true,
      data: {
        decay_enabled: CREDIT_DECAY.enabled,
        threshold_days: CREDIT_DECAY.threshold_days,
        current_balance: balanceInfo.balance,
        monthly_allowance: balanceInfo.monthly_allowance,
        remaining_this_month: balanceInfo.remaining_this_month,
        note: CREDIT_DECAY.enabled ? `Decay will apply after ${CREDIT_DECAY.threshold_days} days of inactivity` : 'Decay is disabled',
      },
    });
  });

  // Admin: Add credits
  app.post<{ Params: { nodeId: string } }>('/admin/add/:nodeId', {
    schema: {
      tags: ['Credits', 'Admin'],
      params: { type: 'object', properties: { nodeId: { type: 'string' } } },
      body: { type: 'object', required: ['amount', 'type', 'description'], properties: { amount: { type: 'number', minimum: 1 }, type: { type: 'string' }, description: { type: 'string' }, metadata: { type: 'object' } } },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const { nodeId } = request.params;
    const { amount, type, description, metadata } = request.body as { amount: number; type: string; description: string; metadata?: Record<string, unknown> };
    const transaction = creditService.addCredits(nodeId, amount, type as CreditTransactionType, description, metadata);
    void reply.send({ success: true, data: transaction, message: `Added ${amount} credits to node ${nodeId}` });
  });

  // Admin: Set balance
  app.post<{ Params: { nodeId: string } }>('/admin/set/:nodeId', {
    schema: {
      tags: ['Credits', 'Admin'],
      params: { type: 'object', properties: { nodeId: { type: 'string' } } },
      body: { type: 'object', required: ['amount'], properties: { amount: { type: 'number', minimum: 0 } } },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const { nodeId } = request.params;
    const { amount } = request.body as { amount: number };
    creditService._setBalance(nodeId, amount);
    const balanceInfo = creditService.getBalanceInfo(nodeId, 'free');
    void reply.send({ success: true, data: balanceInfo, message: `Set balance to ${amount}` });
  });
}
