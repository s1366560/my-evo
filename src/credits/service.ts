import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type {
  CreditTransaction,
  CreditTransactionType,
  CreditBalance,
  TransactionFilter,
  SpendCreditsRequest,
} from './types';
import {
  CREDIT_COSTS,
  INITIAL_CREDITS,
  MONTHLY_ALLOWANCE,
  CREDIT_DECAY,
  CREDIT_PACKAGES,
  REFERRAL_BONUS,
} from './types';
import { ValidationError, NotFoundError, InsufficientCreditsError } from '../shared/errors';

// In-memory storage for credits data
const balances = new Map<string, number>();
const transactions = new Map<string, CreditTransaction[]>();
const lastActivity = new Map<string, Date>();

// Track spending this month
const monthlyUsage = new Map<string, { used: number; resetAt: Date }>();

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function getCurrentMonthReset(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

export function setPrisma(_client: PrismaClient): void {
  // Service uses in-memory storage for flexibility
}

// Initialize credits for a new node
export function initializeCredits(nodeId: string, tier: 'free' | 'premium' | 'ultra' = 'free'): CreditBalance {
  const initialAmount = INITIAL_CREDITS[tier];
  balances.set(nodeId, initialAmount);
  lastActivity.set(nodeId, new Date());
  
  // Reset monthly tracking
  monthlyUsage.set(nodeId, { used: 0, resetAt: getCurrentMonthReset() });

  // Record initial transaction
  const tx: CreditTransaction = {
    id: generateId('tx'),
    node_id: nodeId,
    amount: initialAmount,
    type: 'initial_bonus',
    description: `Welcome! ${initialAmount} credits for new ${tier} tier node`,
    balance_after: initialAmount,
    timestamp: new Date().toISOString(),
  };

  const txs = transactions.get(nodeId) ?? [];
  txs.unshift(tx);
  transactions.set(nodeId, txs);

  return {
    node_id: nodeId,
    balance: initialAmount,
    last_updated: tx.timestamp,
    tier,
    monthly_allowance: MONTHLY_ALLOWANCE[tier],
    used_this_month: 0,
    remaining_this_month: MONTHLY_ALLOWANCE[tier],
  };
}

// Get current balance for a node
export function getBalance(nodeId: string): number {
  return balances.get(nodeId) ?? 0;
}

// Get full balance info
export function getBalanceInfo(nodeId: string, tier: 'free' | 'premium' | 'ultra' = 'free'): CreditBalance {
  let balance = balances.get(nodeId);
  
  // Initialize if not exists
  if (balance === undefined) {
    const info = initializeCredits(nodeId, tier);
    return info;
  }

  // Check monthly reset
  const usage = monthlyUsage.get(nodeId);
  if (usage) {
    const now = new Date();
    if (now >= usage.resetAt) {
      // Reset monthly usage
      monthlyUsage.set(nodeId, { used: 0, resetAt: getCurrentMonthReset() });
    }
  }

  const currentUsage = monthlyUsage.get(nodeId);
  
  return {
    node_id: nodeId,
    balance,
    last_updated: lastActivity.get(nodeId)?.toISOString() ?? new Date().toISOString(),
    tier,
    monthly_allowance: MONTHLY_ALLOWANCE[tier],
    used_this_month: currentUsage?.used ?? 0,
    remaining_this_month: MONTHLY_ALLOWANCE[tier] - (currentUsage?.used ?? 0),
  };
}

// Add credits (purchase, bonus, etc.)
export function addCredits(
  nodeId: string,
  amount: number,
  type: CreditTransactionType,
  description: string,
  metadata?: Record<string, unknown>
): CreditTransaction {
  if (amount <= 0) {
    throw new ValidationError('Credit amount must be positive');
  }

  const currentBalance = balances.get(nodeId) ?? 0;
  const newBalance = currentBalance + amount;
  
  balances.set(nodeId, newBalance);
  lastActivity.set(nodeId, new Date());

  const tx: CreditTransaction = {
    id: generateId('tx'),
    node_id: nodeId,
    amount,
    type,
    description,
    balance_after: newBalance,
    timestamp: new Date().toISOString(),
    metadata,
  };

  const txs = transactions.get(nodeId) ?? [];
  txs.unshift(tx);
  transactions.set(nodeId, txs);

  return tx;
}

// Spend credits
export function spendCredits(
  nodeId: string,
  request: SpendCreditsRequest
): CreditTransaction {
  const { amount, type, description, metadata } = request;

  if (amount <= 0) {
    throw new ValidationError('Credit amount must be positive');
  }

  const currentBalance = balances.get(nodeId) ?? 0;

  if (currentBalance < amount) {
    throw new InsufficientCreditsError(
      `Insufficient credits. Required: ${amount}, Available: ${currentBalance}`
    );
  }

  const newBalance = currentBalance - amount;
  balances.set(nodeId, newBalance);
  lastActivity.set(nodeId, new Date());

  // Track monthly usage
  const usage = monthlyUsage.get(nodeId) ?? { used: 0, resetAt: getCurrentMonthReset() };
  usage.used += amount;
  monthlyUsage.set(nodeId, usage);

  const tx: CreditTransaction = {
    id: generateId('tx'),
    node_id: nodeId,
    amount: -amount,
    type,
    description,
    balance_after: newBalance,
    timestamp: new Date().toISOString(),
    metadata,
  };

  const txs = transactions.get(nodeId) ?? [];
  txs.unshift(tx);
  transactions.set(nodeId, txs);

  return tx;
}

// Spend with predefined cost type
export function spendByCostType(
  nodeId: string,
  costType: keyof typeof CREDIT_COSTS,
  description?: string
): CreditTransaction {
  const cost = CREDIT_COSTS[costType];
  
  const defaultDescriptions: Record<keyof typeof CREDIT_COSTS, string> = {
    map_create: 'Creating new map',
    map_export_json: 'Exporting map as JSON',
    map_export_csv: 'Exporting map as CSV',
    map_export_pdf: 'Exporting map as PDF',
    api_call_standard: 'Standard API call',
    api_call_advanced: 'Advanced API call',
    gdi_analysis: 'GDI analysis',
    storage_per_gb_month: 'Monthly storage',
    collaboration_per_member_month: 'Monthly collaboration',
  };

  return spendCredits(nodeId, {
    amount: cost,
    type: mapCostTypeToTransactionType(costType),
    description: description ?? defaultDescriptions[costType],
  });
}

// Map cost type to transaction type
function mapCostTypeToTransactionType(costType: keyof typeof CREDIT_COSTS): CreditTransactionType {
  const mapping: Record<keyof typeof CREDIT_COSTS, CreditTransactionType> = {
    map_create: 'map_create',
    map_export_json: 'map_export',
    map_export_csv: 'map_export',
    map_export_pdf: 'map_export',
    api_call_standard: 'api_call',
    api_call_advanced: 'api_call',
    gdi_analysis: 'gdi_analysis',
    storage_per_gb_month: 'storage',
    collaboration_per_member_month: 'collaboration',
  };
  return mapping[costType];
}

// Refund credits
export function refundCredits(
  nodeId: string,
  originalTransactionId: string,
  amount: number,
  reason: string
): CreditTransaction {
  if (amount <= 0) {
    throw new ValidationError('Refund amount must be positive');
  }

  const currentBalance = balances.get(nodeId) ?? 0;
  const newBalance = currentBalance + amount;
  
  balances.set(nodeId, newBalance);
  lastActivity.set(nodeId, new Date());

  const tx: CreditTransaction = {
    id: generateId('tx'),
    node_id: nodeId,
    amount,
    type: 'refund',
    description: `Refund: ${reason} (ref: ${originalTransactionId})`,
    balance_after: newBalance,
    timestamp: new Date().toISOString(),
    metadata: { original_transaction_id: originalTransactionId },
  };

  const txs = transactions.get(nodeId) ?? [];
  txs.unshift(tx);
  transactions.set(nodeId, txs);

  return tx;
}

// Get transaction history
export function getTransactions(filters: TransactionFilter): CreditTransaction[] {
  let txs = transactions.get(filters.node_id) ?? [];

  // Filter by type
  if (filters.type) {
    txs = txs.filter(tx => tx.type === filters.type);
  }

  // Filter by date range
  if (filters.from) {
    const fromDate = new Date(filters.from);
    txs = txs.filter(tx => new Date(tx.timestamp) >= fromDate);
  }

  if (filters.to) {
    const toDate = new Date(filters.to);
    txs = txs.filter(tx => new Date(tx.timestamp) <= toDate);
  }

  // Sort by timestamp descending
  txs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Apply pagination
  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 50;
  
  return txs.slice(offset, offset + limit);
}

// Get transaction by ID
export function getTransaction(nodeId: string, transactionId: string): CreditTransaction | null {
  const txs = transactions.get(nodeId) ?? [];
  return txs.find(tx => tx.id === transactionId) ?? null;
}

// Grant subscription credits (monthly allowance)
export function grantSubscriptionCredits(
  nodeId: string,
  tier: 'free' | 'premium' | 'ultra'
): CreditTransaction {
  const allowance = MONTHLY_ALLOWANCE[tier];
  
  // Reset monthly usage tracking
  monthlyUsage.set(nodeId, { used: 0, resetAt: getCurrentMonthReset() });

  return addCredits(
    nodeId,
    allowance,
    'subscription_grant',
    `Monthly ${tier} tier allowance`,
    { tier, reset_at: getCurrentMonthReset().toISOString() }
  );
}

// Apply referral bonus
export function applyReferralBonus(
  referrerNodeId: string,
  refereeNodeId: string
): { referrerTx: CreditTransaction; refereeTx: CreditTransaction } {
  // Bonus for referrer
  const referrerTx = addCredits(
    referrerNodeId,
    REFERRAL_BONUS.referrer,
    'referral_bonus',
    `Referral bonus for inviting ${refereeNodeId}`,
    { referee_node_id: refereeNodeId }
  );

  // Bonus for referee
  const refereeTx = addCredits(
    refereeNodeId,
    REFERRAL_BONUS.referee,
    'referral_bonus',
    `Welcome bonus from referral by ${referrerNodeId}`,
    { referrer_node_id: referrerNodeId }
  );

  return { referrerTx, refereeTx };
}

// Check and apply decay (for inactive nodes)
export function checkAndApplyDecay(nodeId: string): CreditTransaction | null {
  const lastActive = lastActivity.get(nodeId);
  if (!lastActive) return null;

  const daysSinceActivity = Math.floor(
    (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceActivity < CREDIT_DECAY.threshold_days) {
    return null;
  }

  const currentBalance = balances.get(nodeId) ?? 0;
  if (currentBalance === 0) return null;

  // Calculate decay
  const monthsInactive = Math.floor(daysSinceActivity / 30);
  let decayRate = CREDIT_DECAY.rate * monthsInactive;
  
  // Cap at max decay
  decayRate = Math.min(decayRate, CREDIT_DECAY.max_decay_percent);

  const decayAmount = Math.floor(currentBalance * decayRate);
  
  if (decayAmount === 0) return null;

  const newBalance = currentBalance - decayAmount;
  balances.set(nodeId, newBalance);

  const tx: CreditTransaction = {
    id: generateId('tx'),
    node_id: nodeId,
    amount: -decayAmount,
    type: 'decay',
    description: `Inactive decay: ${decayRate * 100}% (${monthsInactive} months inactive)`,
    balance_after: newBalance,
    timestamp: new Date().toISOString(),
    metadata: {
      months_inactive: monthsInactive,
      decay_rate: decayRate,
    },
  };

  const txs = transactions.get(nodeId) ?? [];
  txs.unshift(tx);
  transactions.set(nodeId, txs);

  return tx;
}

// Update node tier (called when subscription changes)
export function updateNodeTier(
  nodeId: string,
  newTier: 'free' | 'premium' | 'ultra'
): void {
  // Ensure credits are initialized
  if (!balances.has(nodeId)) {
    initializeCredits(nodeId, newTier);
    return;
  }

  // Grant additional credits if upgrading
  const allowance = MONTHLY_ALLOWANCE[newTier];
  const currentBalance = balances.get(nodeId) ?? 0;
  
  // Ensure minimum balance based on tier
  const minBalance = INITIAL_CREDITS[newTier];
  if (currentBalance < minBalance) {
    const topUp = minBalance - currentBalance;
    addCredits(
      nodeId,
      topUp,
      'subscription_grant',
      `Tier upgrade top-up to ${newTier} minimum`,
      { from_tier: 'unknown', to_tier: newTier }
    );
  }
}

// Get credit packages
export function getCreditPackages() {
  return CREDIT_PACKAGES;
}

// Reset test state
export function _resetTestState(): void {
  balances.clear();
  transactions.clear();
  lastActivity.clear();
  monthlyUsage.clear();
}

// Bulk operations for testing
export function _getAllBalances(): Map<string, number> {
  return new Map(balances);
}

export function _setBalance(nodeId: string, amount: number): void {
  balances.set(nodeId, amount);
  lastActivity.set(nodeId, new Date());
}
