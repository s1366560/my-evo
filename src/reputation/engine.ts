/**
 * Reputation & Credit Engine
 * Phase 4: GDI Reputation & Economic System
 */

import * as crypto from 'crypto';
import {
  ReputationScore,
  CreditBalance,
  CreditTransaction,
  ModelTier,
  NodeTier,
  REP_BASE,
  REP_PROMOTION_RATE_WEIGHT,
  REP_USAGE_FACTOR_WEIGHT,
  REP_AVG_GDI_WEIGHT,
  REP_REJECT_RATE_WEIGHT,
  REP_REVOKE_RATE_WEIGHT,
  CREDIT_REGISTRATION_BONUS,
  CREDIT_INITIAL_BALANCE,
  CREDIT_PROMOTION_REWARD,
  CREDIT_REPORT_REWARD_LARGE,
  CREDIT_REPORT_REWARD_MEDIUM,
  CREDIT_REPORT_REWARD_SMALL,
  CREDIT_REFERRAL_REFERRER,
  CREDIT_REFERRAL_REFEREE,
  CREDIT_REVOKE_COST,
  CREDIT_REVOKE_REP_PENALTY,
  TIER_REQUIREMENTS,
  TIER_CAPABILITIES,
} from './types';
import { listAssets, countAssets, getAssetsByOwner } from '../assets/store';
import { getNodeInfo } from '../a2a/node';

// In-memory stores
const reputationScores = new Map<string, ReputationScore>();
const creditBalances = new Map<string, CreditBalance>();

// ============ Reputation Calculation ============

export function calculateReputation(
  nodeId: string,
  options?: {
    publishedCount?: number;
    promotedCount?: number;
    rejectedCount?: number;
    revokedCount?: number;
    usageFactor?: number;
    avgGdi?: number;
  }
): ReputationScore {
  // Get asset stats if not provided
  const assets = getAssetsByOwner(nodeId);
  const publishedCount = options?.publishedCount ?? assets.length;
  const promotedCount = options?.promotedCount ?? assets.filter(a => a.status === 'promoted' || a.status === 'active').length;
  const rejectedCount = options?.rejectedCount ?? assets.filter(a => a.status === 'rejected').length;
  const revokedCount = options?.revokedCount ?? assets.filter(a => a.status === 'archived').length;

  // Calculate rates
  const promotionRate = publishedCount > 0 ? promotedCount / publishedCount : 0;
  const rejectRate = publishedCount > 0 ? rejectedCount / publishedCount : 0;
  const revokeRate = publishedCount > 0 ? revokedCount / publishedCount : 0;

  // Get or compute avg GDI
  const avgGdi = options?.avgGdi ?? computeAvgGdi(assets);
  const usageFactor = options?.usageFactor ?? computeUsageFactor(assets);

  // Positive contributions
  const positive = {
    promotion_rate: Math.round(promotionRate * 100) / 100,
    usage_factor: Math.round(usageFactor * 100) / 100,
    avg_gdi: Math.round(avgGdi * 100) / 100,
  };

  // Negative contributions
  const negative = {
    reject_rate: Math.round(rejectRate * 100) / 100,
    revoke_rate: Math.round(revokeRate * 100) / 100,
    cumulative_penalties: 0,
  };

  // Compute total
  // Note: avg_gdi is on 0-100 scale, normalize to 0-1 for fair weighting
  const normalizedAvgGdi = positive.avg_gdi / 100;
  const positiveScore =
    positive.promotion_rate * REP_PROMOTION_RATE_WEIGHT +
    positive.usage_factor * REP_USAGE_FACTOR_WEIGHT +
    normalizedAvgGdi * REP_AVG_GDI_WEIGHT;

  const negativeScore =
    negative.reject_rate * REP_REJECT_RATE_WEIGHT +
    negative.revoke_rate * REP_REVOKE_RATE_WEIGHT +
    negative.cumulative_penalties;

  const maturityFactor = computeMaturityFactor(nodeId);
  const total = Math.max(0, Math.min(100,
    REP_BASE + positiveScore - negativeScore + maturityFactor
  ));

  const score: ReputationScore = {
    node_id: nodeId,
    total: Math.round(total * 100) / 100,
    positive,
    negative,
    maturity_factor: Math.round(maturityFactor * 100) / 100,
    calculated_at: new Date().toISOString(),
  };

  reputationScores.set(nodeId, score);
  return score;
}

function computeAvgGdi(assets: { gdi?: { total: number } }[]): number {
  const withGdi = assets.filter(a => a.gdi && a.gdi.total > 0);
  if (withGdi.length === 0) return 0;
  return withGdi.reduce((sum, a) => sum + (a.gdi?.total ?? 0), 0) / withGdi.length;
}

function computeUsageFactor(assets: { fetch_count?: number; report_count?: number }[]): number {
  if (assets.length === 0) return 0;
  const totalFetches = assets.reduce((sum, a) => sum + (a.fetch_count ?? 0), 0);
  const totalReports = assets.reduce((sum, a) => sum + (a.report_count ?? 0), 0);
  // Log scale, normalized to 0-1
  const raw = Math.log1p(totalFetches + totalReports * 2) / 10;
  return Math.min(1, raw);
}

function computeMaturityFactor(nodeId: string): number {
  // Get node creation time from a2a/node store
  const nodeInfo = getNodeInfo(nodeId);
  if (!nodeInfo || !nodeInfo.registered_at) return 0;

  // Calculate node age in days
  const registeredAt = new Date(nodeInfo.registered_at).getTime();
  const now = Date.now();
  const ageInDays = (now - registeredAt) / (1000 * 60 * 60 * 24);

  // Maturity grows with age, capped at 30 days for max bonus
  // Max maturity bonus is 10 points
  const ageFactor = Math.min(ageInDays, 30) / 30 * 10;

  return Math.round(ageFactor * 100) / 100;
}

export function getReputation(nodeId: string): ReputationScore | undefined {
  return reputationScores.get(nodeId);
}

// ============ Tier Calculation ============

export function calculateTier(nodeId: string): NodeTier {
  const rep = reputationScores.get(nodeId);
  const total = rep?.total ?? 0;
  const assets = getAssetsByOwner(nodeId);
  const published = assets.length;
  const promoted = assets.filter(a => a.status === 'promoted' || a.status === 'active').length;
  const avgGdi = rep?.positive.avg_gdi ?? 0;

  // Determine tier - use store counts when available, fall back to reputation-based estimates only if reasonable
  let tier: ModelTier = 'Tier 4';
  
  // Only use store counts if they exist; otherwise the node has no track record
  // and should be Tier 4 regardless of reputation score
  if (published === 0) {
    // No assets in store - Tier 4 by default unless avgGdi is extremely high
    if (avgGdi >= 90 && total >= 80) tier = 'Tier 2';
  } else if (total >= 90 && published >= 50 && promoted >= 20 && avgGdi >= 80) {
    tier = 'Tier 1';
  } else if (total >= 75 && published >= 30 && promoted >= 10 && avgGdi >= 70) {
    tier = 'Tier 2';
  } else if (total >= 60 && published >= 15 && promoted >= 5 && avgGdi >= 60) {
    tier = 'Tier 3';
  }

  const requirements = TIER_REQUIREMENTS[tier];
  const capabilities = TIER_CAPABILITIES[tier];

  // Compute upgrade progress to next tier
  let upgrade_progress: number | undefined;
  if (tier === 'Tier 4') {
    const repProgress = Math.min(1, total / 60);
    upgrade_progress = repProgress;
  } else if (tier === 'Tier 3') {
    const repProgress = Math.min(1, (total - 60) / 30);
    upgrade_progress = repProgress;
  } else if (tier === 'Tier 2') {
    const repProgress = Math.min(1, (total - 75) / 15);
    upgrade_progress = repProgress;
  }

  return {
    node_id: nodeId,
    tier,
    capabilities,
    requirements_met: [
      total >= requirements.min_reputation ? `reputation >= ${requirements.min_reputation}` : `reputation < ${requirements.min_reputation}`,
      published >= requirements.min_assets ? `assets >= ${requirements.min_assets}` : `assets < ${requirements.min_assets}`,
      promoted >= requirements.min_promotions ? `promotions >= ${requirements.min_promotions}` : `promotions < ${requirements.min_promotions}`,
      avgGdi >= requirements.min_gdi ? `avg_gdi >= ${requirements.min_gdi}` : `avg_gdi < ${requirements.min_gdi}`,
    ],
    upgrade_progress,
  };
}

// ============ Credit Management ============

export function initializeCreditBalance(nodeId: string): CreditBalance {
  const balance: CreditBalance = {
    node_id: nodeId,
    balance: CREDIT_INITIAL_BALANCE,
    last_updated: new Date().toISOString(),
    transactions: [
      {
        tx_id: crypto.randomUUID(),
        type: 'registration_bonus',
        amount: CREDIT_REGISTRATION_BONUS,
        balance_after: CREDIT_INITIAL_BALANCE,
        description: 'Initial registration bonus',
        created_at: new Date().toISOString(),
      },
    ],
  };
  creditBalances.set(nodeId, balance);
  return balance;
}

export function getCreditBalance(nodeId: string): CreditBalance | undefined {
  return creditBalances.get(nodeId);
}

export function addCreditTransaction(
  nodeId: string,
  type: CreditTransaction['type'],
  amount: number,
  description: string,
  metadata?: { asset_id?: string; swarm_id?: string }
): CreditBalance {
  let balance = creditBalances.get(nodeId);
  if (!balance) {
    balance = initializeCreditBalance(nodeId);
  }

  const tx: CreditTransaction = {
    tx_id: crypto.randomUUID(),
    type,
    amount,
    balance_after: balance.balance + amount,
    description,
    asset_id: metadata?.asset_id,
    swarm_id: metadata?.swarm_id,
    created_at: new Date().toISOString(),
  };

  balance.balance += amount;
  balance.last_updated = tx.created_at;
  balance.transactions.push(tx);

  return balance;
}

export function debitForPublish(nodeId: string, carbonCost: number): CreditBalance {
  return addCreditTransaction(
    nodeId,
    'publish_cost',
    -carbonCost,
    `Asset publish carbon cost`,
  );
}

export function creditForPromotion(nodeId: string, assetId: string): CreditBalance {
  return addCreditTransaction(
    nodeId,
    'asset_promotion',
    CREDIT_PROMOTION_REWARD,
    `Asset ${assetId} promoted`,
    { asset_id: assetId },
  );
}

export function creditForFetch(nodeId: string, assetId: string, tier: 1 | 2 | 3): CreditBalance {
  const rewards = { 1: 12, 2: 8, 3: 3 };
  return addCreditTransaction(
    nodeId,
    'asset_fetch',
    rewards[tier],
    `Asset ${assetId} fetched (Tier ${tier})`,
    { asset_id: assetId },
  );
}

export function creditForReport(
  nodeId: string,
  assetId: string,
  blastRadius: { files: number; lines: number }
): CreditBalance {
  const size = blastRadius.files + blastRadius.lines / 50;
  let reward: number;
  if (size > 20) reward = CREDIT_REPORT_REWARD_LARGE;
  else if (size > 5) reward = CREDIT_REPORT_REWARD_MEDIUM;
  else reward = CREDIT_REPORT_REWARD_SMALL;

  return addCreditTransaction(
    nodeId,
    'validation_report',
    reward,
    `Validation report for ${assetId} (blast_radius: ${size.toFixed(1)})`,
    { asset_id: assetId },
  );
}

export function debitForRevoke(nodeId: string, assetId: string): CreditBalance {
  return addCreditTransaction(
    nodeId,
    'revoke_cost',
    -CREDIT_REVOKE_COST,
    `Revoke asset ${assetId}`,
    { asset_id: assetId },
  );
}

export function creditForBounty(
  nodeId: string,
  swarmId: string,
  amount: number,
  role: string
): CreditBalance {
  return addCreditTransaction(
    nodeId,
    'bounty_reward',
    amount,
    `Bounty reward for ${role} in swarm ${swarmId}`,
    { swarm_id: swarmId },
  );
}

export function debitForBountyPayment(
  nodeId: string,
  swarmId: string,
  amount: number
): CreditBalance {
  return addCreditTransaction(
    nodeId,
    'bounty_payment',
    -amount,
    `Bounty payment for swarm ${swarmId}`,
    { swarm_id: swarmId },
  );
}

export function creditForReferral(
  referrerId: string,
  refereeId: string
): { referrer: CreditBalance; referee: CreditBalance } {
  const referrer = addCreditTransaction(
    referrerId,
    'referral_bonus',
    CREDIT_REFERRAL_REFERRER,
    `Referral bonus for inviting ${refereeId}`,
  );
  const referee = addCreditTransaction(
    refereeId,
    'referral_bonus',
    CREDIT_REFERRAL_REFEREE,
    `Referral bonus from ${referrerId}`,
  );
  return { referrer, referee };
}

// ============ Reputation Penalties ============

export function applyReputationPenalty(
  nodeId: string,
  penalty: number,
  reason: string
): ReputationScore {
  let score = reputationScores.get(nodeId);
  if (!score) {
    score = calculateReputation(nodeId);
  }

  score.negative.cumulative_penalties += penalty;
  score.total = Math.max(0, score.total - penalty);
  score.calculated_at = new Date().toISOString();

  reputationScores.set(nodeId, score);
  return score;
}

// ============ Stats ============

export function getReputationLeaderboard(limit: number = 20): ReputationScore[] {
  return [...reputationScores.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/**
 * Reset all in-memory stores - FOR TESTING ONLY
 */
export function resetStores(): void {
  reputationScores.clear();
  creditBalances.clear();
}
