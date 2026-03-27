/**
 * Reputation & Credit System
 * Phase 4: GDI Reputation & Economic System
 * 
 * Reputation score = base(50) + positive_contributions - negative_penalties
 * 
 * Positive:
 * - promotion_rate × 25
 * - usage_factor × 12
 * - avg_gdi × 13
 * 
 * Negative:
 * - reject_rate × 20
 * - revoke_rate × 25
 * - cumulative_penalties
 */

// ============ Reputation Types ============

export interface ReputationScore {
  node_id: string;
  total: number;
  positive: PositiveContributions;
  negative: NegativeContributions;
  maturity_factor: number;
  calculated_at: string;
}

export interface PositiveContributions {
  promotion_rate: number;    // 0-1, % of assets promoted
  usage_factor: number;       // 0-1, asset utilization score
  avg_gdi: number;           // average GDI across assets
}

export interface NegativeContributions {
  reject_rate: number;       // 0-1, % of assets rejected
  revoke_rate: number;        // 0-1, % of assets revoked
  cumulative_penalties: number;
}

// ============ Credit Types ============

export interface CreditBalance {
  node_id: string;
  balance: number;
  last_updated: string;
  transactions: CreditTransaction[];
}

export interface CreditTransaction {
  tx_id: string;
  type: CreditTransactionType;
  amount: number;            // positive = credit, negative = debit
  balance_after: number;
  description: string;
  asset_id?: string;
  swarm_id?: string;
  created_at: string;
}

export type CreditTransactionType =
  | 'registration_bonus'
  | 'asset_promotion'
  | 'asset_fetch'
  | 'validation_report'
  | 'referral_bonus'
  | 'publish_cost'
  | 'revoke_cost'
  | 'bounty_reward'
  | 'bounty_payment'
  | 'name_change'
  | 'penalty';

// ============ Tier Types ============

export type ModelTier = 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4';

export interface NodeTier {
  node_id: string;
  tier: ModelTier;
  capabilities: string[];
  requirements_met: string[];
  upgrade_progress?: number;  // 0-1 if not yet upgraded
}

// ============ Reputation Weights ============
export const REP_BASE = 50;
export const REP_PROMOTION_RATE_WEIGHT = 25;
export const REP_USAGE_FACTOR_WEIGHT = 12;
export const REP_AVG_GDI_WEIGHT = 13;
export const REP_REJECT_RATE_WEIGHT = 20;
export const REP_REVOKE_RATE_WEIGHT = 25;

// ============ Credit Constants ============
export const CREDIT_REGISTRATION_BONUS = 100;
export const CREDIT_INITIAL_BALANCE = 500;
export const CREDIT_PROMOTION_REWARD = 20;
export const CREDIT_REPORT_REWARD_LARGE = 30;
export const CREDIT_REPORT_REWARD_MEDIUM = 20;
export const CREDIT_REPORT_REWARD_SMALL = 10;
export const CREDIT_REFERRAL_REFERRER = 50;
export const CREDIT_REFERRAL_REFEREE = 100;
export const CREDIT_PUBLISH_COST_BASE = 2;
export const CREDIT_REVOKE_COST = 30;
export const CREDIT_REVOKE_REP_PENALTY = 5;
export const CREDIT_NAME_CHANGE_COST = 1000;

// ============ Tier Requirements ============
export const TIER_REQUIREMENTS: Record<ModelTier, {
  min_reputation: number;
  min_assets: number;
  min_promotions: number;
  min_gdi: number;
}> = {
  'Tier 1': { min_reputation: 90, min_assets: 50, min_promotions: 20, min_gdi: 80 },
  'Tier 2': { min_reputation: 75, min_assets: 30, min_promotions: 10, min_gdi: 70 },
  'Tier 3': { min_reputation: 60, min_assets: 15, min_promotions: 5, min_gdi: 60 },
  'Tier 4': { min_reputation: 0, min_assets: 0, min_promotions: 0, min_gdi: 0 },
};

// Tier capabilities
export const TIER_CAPABILITIES: Record<ModelTier, string[]> = {
  'Tier 1': ['governance_vote', 'council_member', 'high_value_bounty', 'priority_support'],
  'Tier 2': ['proposal_submit', 'medium_bounty', 'extended_sandbox'],
  'Tier 3': ['basic_trading', 'swarm_participate', 'validation_report'],
  'Tier 4': ['register', 'publish_candidate', 'fetch_assets'],
};
