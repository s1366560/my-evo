/**
 * Reputation & Credit Engine — Unit Tests
 * Phase 4: GDI Reputation & Economic System
 */

import {
  calculateReputation,
  getReputation,
  calculateTier,
  initializeCreditBalance,
  getCreditBalance,
  addCreditTransaction,
  creditForPromotion,
  creditForFetch,
  creditForReport,
  debitForPublish,
  debitForRevoke,
  creditForBounty,
  debitForBountyPayment,
  creditForReferral,
  applyReputationPenalty,
  getReputationLeaderboard,
  resetStores,
} from '../src/reputation/engine';
import {
  REP_BASE,
  CREDIT_INITIAL_BALANCE,
  CREDIT_REGISTRATION_BONUS,
  CREDIT_PROMOTION_REWARD,
} from '../src/reputation/types';
import { AssetStatus } from '../src/assets/types';

// Mock dependencies
jest.mock('../src/assets/store', () => ({
  listAssets: jest.fn(),
  countAssets: jest.fn(),
  getAssetsByOwner: jest.fn(),
}));

jest.mock('../src/a2a/node', () => ({
  getNodeInfo: jest.fn(),
}));

import { getAssetsByOwner } from '../src/assets/store';
import { getNodeInfo } from '../src/a2a/node';

const mockGetAssetsByOwner = getAssetsByOwner as jest.MockedFunction<typeof getAssetsByOwner>;
const mockGetNodeInfo = getNodeInfo as jest.MockedFunction<typeof getNodeInfo>;

describe('Reputation Engine — Phase 4', () => {
  beforeEach(() => {
    resetStores();
    jest.clearAllMocks();
  });

  // ===== Reputation Calculation =====

  describe('calculateReputation', () => {
    it('returns base reputation of 50 for a new node with no assets', () => {
      mockGetAssetsByOwner.mockReturnValue([]);
      mockGetNodeInfo.mockReturnValue(null);

      const score = calculateReputation('node_new');
      expect(score.total).toBe(50);
      expect(score.node_id).toBe('node_new');
      expect(score.positive.promotion_rate).toBe(0);
      expect(score.positive.usage_factor).toBe(0);
      expect(score.positive.avg_gdi).toBe(0);
      expect(score.negative.reject_rate).toBe(0);
      expect(score.negative.revoke_rate).toBe(0);
      expect(score.negative.cumulative_penalties).toBe(0);
    });

    it('calculates promotion rate correctly', () => {
      // 2 promoted + 1 active out of 4 total = 0.75 rate
      // (engine counts 'active' as promoted in the promotedCount calculation)
      mockGetAssetsByOwner.mockReturnValue([
        { asset: { id: 'a1', type: 'Gene' } as any, status: 'promoted', owner_id: 'node_test', fetch_count: 0, report_count: 0, published_at: '', updated_at: '', version: 1 },
        { asset: { id: 'a2', type: 'Gene' } as any, status: 'promoted', owner_id: 'node_test', fetch_count: 0, report_count: 0, published_at: '', updated_at: '', version: 1 },
        { asset: { id: 'a3', type: 'Gene' } as any, status: 'active', owner_id: 'node_test', fetch_count: 0, report_count: 0, published_at: '', updated_at: '', version: 1 },
        { asset: { id: 'a4', type: 'Gene' } as any, status: 'rejected', owner_id: 'node_test', fetch_count: 0, report_count: 0, published_at: '', updated_at: '', version: 1 },
      ]);
      mockGetNodeInfo.mockReturnValue(null);

      const score = calculateReputation('node_test');
      // promotedCount = 2 'promoted' + 1 'active' = 3; publishedCount = 4
      // promotion_rate = 3/4 = 0.75
      // positiveScore = 0.75*25 + 0*12 + 0*13 = 18.75
      // reject_rate = 1/4 = 0.25; negativeScore = 0.25*20 = 5
      // total = 50 + 18.75 - 5 = 63.75
      expect(score.positive.promotion_rate).toBe(0.75);
      expect(score.negative.reject_rate).toBe(0.25);
      expect(score.total).toBeCloseTo(63.75, 1);
    });

    it('accepts override options for publishedCount, promotedCount etc.', () => {
      mockGetAssetsByOwner.mockReturnValue([]);
      mockGetNodeInfo.mockReturnValue(null);

      // Override: 10 published, 8 promoted, 1 rejected, avg_gdi=75
      const score = calculateReputation('node_override', {
        publishedCount: 10,
        promotedCount: 8,
        rejectedCount: 1,
        avgGdi: 75,
        usageFactor: 0.5,
      });

      expect(score.positive.promotion_rate).toBe(0.8);  // 8/10
      expect(score.negative.reject_rate).toBe(0.1);    // 1/10
      expect(score.positive.avg_gdi).toBe(75);
      expect(score.positive.usage_factor).toBe(0.5);
    });

    it('clamps total reputation to [0, 100]', () => {
      mockGetAssetsByOwner.mockReturnValue([]);
      mockGetNodeInfo.mockReturnValue(null);

      // Force extreme values via overrides
      const score = calculateReputation('node_clamp', {
        publishedCount: 100,
        promotedCount: 100,
        rejectedCount: 0,
        avgGdi: 95,
        usageFactor: 1.0,
      });

      expect(score.total).toBeLessThanOrEqual(100);
    });

    it('applies maturity factor for older nodes', () => {
      mockGetAssetsByOwner.mockReturnValue([]);
      mockGetNodeInfo.mockReturnValue({
        node_id: 'node_old',
        registered_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      } as any);

      const score = calculateReputation('node_old');
      // At 30 days, maturity factor should be max = 10
      expect(score.maturity_factor).toBeCloseTo(10, 1);
    });

    it('applies partial maturity factor for young nodes', () => {
      mockGetAssetsByOwner.mockReturnValue([]);
      mockGetNodeInfo.mockReturnValue({
        node_id: 'node_young',
        registered_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
      } as any);

      const score = calculateReputation('node_young');
      // At 15 days (half of 30), maturity should be ~5
      expect(score.maturity_factor).toBeCloseTo(5, 1);
    });

    it('caches reputation score', () => {
      mockGetAssetsByOwner.mockReturnValue([]);
      mockGetNodeInfo.mockReturnValue(null);

      const score1 = calculateReputation('node_cache');
      const score2 = getReputation('node_cache');
      expect(score2).toBe(score1);
    });
  });

  describe('getReputation', () => {
    it('returns undefined for unknown node', () => {
      expect(getReputation('unknown_node')).toBeUndefined();
    });
  });

  // ===== Tier Calculation =====

  describe('calculateTier', () => {
    beforeEach(() => {
      mockGetAssetsByOwner.mockReturnValue([]);
      mockGetNodeInfo.mockReturnValue(null);
    });

    it('defaults to Tier 4 for new node with no assets', () => {
      calculateReputation('node_t4'); // populate store
      const tier = calculateTier('node_t4');
      expect(tier.tier).toBe('Tier 4');
      expect(tier.capabilities).toContain('register');
      expect(tier.capabilities).toContain('publish_candidate');
    });

    it('returns Tier 2 for high-reputation node with sufficient assets', () => {
      // Tier 2: reputation >= 75, published >= 30, promoted+active >= 10, avg_gdi >= 70
      // Mock store: 30 published, 20 promoted (for calculateTier counts)
      const t2Assets: any[] = Array.from({ length: 30 }, (_, i) => ({
        asset: { id: `t2_${i}`, type: 'Gene' },
        status: (i < 20 ? 'promoted' : 'rejected') as AssetStatus,
        owner_id: 'node_t2',
        fetch_count: 0,
        report_count: 0,
        published_at: '',
        updated_at: '',
        version: 1,
      }));
      mockGetAssetsByOwner.mockReturnValue(t2Assets);
      mockGetNodeInfo.mockReturnValue(null);

      // With store counts: promotion_rate=20/30=0.667, avgGdi from override=80, usageFactor=0.5
      // total = 50 + 0.667*25 + 0.5*12 + 0.8*13 = 50 + 16.67 + 6 + 10.4 = 83.07 >= 75
      calculateReputation('node_t2', { avgGdi: 80, usageFactor: 0.5 });
      const tier = calculateTier('node_t2');
      expect(tier.tier).toBe('Tier 2');
      expect(tier.capabilities).toContain('proposal_submit');
      expect(tier.capabilities).toContain('medium_bounty');
    });

    it('returns Tier 1 for top performers', () => {
      // Tier 1: reputation >= 90, published >= 50, promoted+active >= 20, avg_gdi >= 80
      // Mock store: 55 published, 50 promoted/active (very high promotion rate)
      const t1Assets: any[] = Array.from({ length: 55 }, (_, i) => ({
        asset: { id: `t1_${i}`, type: 'Gene' },
        status: (i < 25 ? 'promoted' : i < 50 ? 'active' : 'rejected') as AssetStatus,
        owner_id: 'node_t1',
        fetch_count: 10,
        report_count: 5,
        published_at: '',
        updated_at: '',
        version: 1,
      }));
      mockGetAssetsByOwner.mockReturnValue(t1Assets);
      mockGetNodeInfo.mockReturnValue(null);

      // With store counts: published=55, promoted+active=50
      // promotion_rate=50/55=0.909, avgGdi=100, usageFactor=0.8
      // total = 50 + 0.909*25 + 0.8*12 + 1.0*13 = 50 + 22.73 + 9.6 + 13 = 95.33 >= 90
      calculateReputation('node_t1', { avgGdi: 100, usageFactor: 0.8 });
      const tier = calculateTier('node_t1');
      expect(tier.tier).toBe('Tier 1');
      expect(tier.capabilities).toContain('governance_vote');
      expect(tier.capabilities).toContain('council_member');
    });

    it('returns Tier 3 for mid-tier node', () => {
      // Tier 3: reputation >= 60, published >= 15, promoted+active >= 5, avg_gdi >= 60
      // Mock store: 20 published, 8 promoted
      const t3Assets: any[] = Array.from({ length: 20 }, (_, i) => ({
        asset: { id: `t3_${i}`, type: 'Gene' },
        status: (i < 8 ? 'promoted' : 'rejected') as AssetStatus,
        owner_id: 'node_t3',
        fetch_count: 0,
        report_count: 0,
        published_at: '',
        updated_at: '',
        version: 1,
      }));
      mockGetAssetsByOwner.mockReturnValue(t3Assets);
      mockGetNodeInfo.mockReturnValue(null);

      // promotion_rate=8/20=0.4, avgGdi=75, usageFactor=0.4
      // total = 50 + 0.4*25 + 0.4*12 + 0.75*13 = 50 + 10 + 4.8 + 9.75 = 74.55 >= 60 ✓
      calculateReputation('node_t3', { avgGdi: 75, usageFactor: 0.4 });
      const tier = calculateTier('node_t3');
      expect(tier.tier).toBe('Tier 3');
      expect(tier.capabilities).toContain('swarm_participate');
      expect(tier.capabilities).toContain('validation_report');
    });

    it('computes upgrade_progress for Tier 4 node', () => {
      calculateReputation('node_progress', { publishedCount: 0, avgGdi: 0 });
      const tier = calculateTier('node_progress');
      expect(tier.upgrade_progress).toBeDefined();
      expect(tier.upgrade_progress).toBeGreaterThanOrEqual(0);
      expect(tier.upgrade_progress).toBeLessThanOrEqual(1);
    });

    it('lists requirements_met with human-readable strings', () => {
      calculateReputation('node_reqs', {
        publishedCount: 5,
        promotedCount: 0,
        avgGdi: 30,
      });
      const tier = calculateTier('node_reqs');
      expect(tier.requirements_met.length).toBeGreaterThan(0);
      expect(tier.requirements_met[0]).toMatch(/reputation/);
    });
  });

  // ===== Credit Balance Initialization =====

  describe('initializeCreditBalance', () => {
    it('creates balance with initial credits and registration bonus', () => {
      const balance = initializeCreditBalance('node_new');

      expect(balance.node_id).toBe('node_new');
      expect(balance.balance).toBe(CREDIT_INITIAL_BALANCE);
      expect(balance.transactions.length).toBe(1);
      expect(balance.transactions[0].type).toBe('registration_bonus');
      expect(balance.transactions[0].amount).toBe(CREDIT_REGISTRATION_BONUS);
      expect(balance.transactions[0].balance_after).toBe(CREDIT_INITIAL_BALANCE);
    });
  });

  describe('getCreditBalance', () => {
    it('returns undefined for unknown node', () => {
      expect(getCreditBalance('unknown')).toBeUndefined();
    });

    it('returns the initialized balance', () => {
      const created = initializeCreditBalance('node_get');
      const retrieved = getCreditBalance('node_get');
      expect(retrieved).toBe(created);
    });
  });

  // ===== Credit Transactions =====

  describe('addCreditTransaction', () => {
    it('adds a positive transaction and updates balance', () => {
      initializeCreditBalance('node_tx');
      const balance = addCreditTransaction('node_tx', 'asset_promotion', 20, 'Test promotion');

      expect(balance.balance).toBe(CREDIT_INITIAL_BALANCE + 20);
      expect(balance.transactions.length).toBe(2);
      expect(balance.transactions[1].type).toBe('asset_promotion');
      expect(balance.transactions[1].amount).toBe(20);
    });

    it('adds a negative transaction and updates balance', () => {
      initializeCreditBalance('node_tx_neg');
      const balance = addCreditTransaction('node_tx_neg', 'publish_cost', -5, 'Test cost');

      expect(balance.balance).toBe(CREDIT_INITIAL_BALANCE - 5);
      expect(balance.transactions[1].amount).toBe(-5);
    });

    it('records tx_id, description, and timestamps', () => {
      initializeCreditBalance('node_tx_meta');
      const balance = addCreditTransaction('node_tx_meta', 'validation_report', 15, 'Validating asset X');

      const tx = balance.transactions[1];
      expect(tx.tx_id).toBeDefined();
      expect(tx.description).toBe('Validating asset X');
      expect(tx.created_at).toBeDefined();
    });

    it('auto-initializes balance if node does not exist', () => {
      // addCreditTransaction auto-initializes with CREDIT_INITIAL_BALANCE (500)
      // then adds the transaction amount (+100)
      const balance = addCreditTransaction('node_auto_init', 'registration_bonus', 100, 'Auto init');
      expect(balance.balance).toBe(600); // 500 initial + 100 transaction
    });
  });

  // ===== Specialized Credit Operations =====

  describe('creditForPromotion', () => {
    it('adds promotion reward and sets asset_id metadata', () => {
      initializeCreditBalance('node_promo');
      const balance = creditForPromotion('node_promo', 'capsule_001');

      expect(balance.balance).toBe(CREDIT_INITIAL_BALANCE + CREDIT_PROMOTION_REWARD);
      const tx = balance.transactions[1];
      expect(tx.type).toBe('asset_promotion');
      expect(tx.asset_id).toBe('capsule_001');
    });
  });

  describe('creditForFetch', () => {
    it('awards correct tier 1 reward (12 credits)', () => {
      initializeCreditBalance('node_fetch');
      const balance = creditForFetch('node_fetch', 'capsule_high', 1);
      expect(balance.balance).toBe(CREDIT_INITIAL_BALANCE + 12);
    });

    it('awards correct tier 2 reward (8 credits)', () => {
      initializeCreditBalance('node_fetch2');
      const balance = creditForFetch('node_fetch2', 'capsule_mid', 2);
      expect(balance.balance).toBe(CREDIT_INITIAL_BALANCE + 8);
    });

    it('awards correct tier 3 reward (3 credits)', () => {
      initializeCreditBalance('node_fetch3');
      const balance = creditForFetch('node_fetch3', 'capsule_low', 3);
      expect(balance.balance).toBe(CREDIT_INITIAL_BALANCE + 3);
    });
  });

  describe('creditForReport', () => {
    it('awards large reward for blast_radius > 20', () => {
      initializeCreditBalance('node_report');
      const blastRadius = { files: 15, lines: 500 }; // 15 + 500/50 = 25 > 20 → LARGE
      const balance = creditForReport('node_report', 'capsule_large', blastRadius);
      // size = 15 + 500/50 = 25 > 20 → CREDIT_REPORT_REWARD_LARGE = 30
      expect(balance.balance).toBe(CREDIT_INITIAL_BALANCE + 30);
    });

    it('awards medium reward for blast_radius 5-20', () => {
      initializeCreditBalance('node_report2');
      const blastRadius = { files: 10, lines: 100 }; // 10 + 100/50 = 12 → MEDIUM (between 5 and 20)
      const balance = creditForReport('node_report2', 'capsule_med', blastRadius);
      // size = 10 + 2 = 12 → CREDIT_REPORT_REWARD_MEDIUM = 20
      expect(balance.balance).toBe(CREDIT_INITIAL_BALANCE + 20);
    });

    it('awards small reward for blast_radius ≤ 5', () => {
      initializeCreditBalance('node_report3');
      const blastRadius = { files: 2, lines: 50 }; // 2 + 50/50 = 3 → SMALL (≤ 5)
      const balance = creditForReport('node_report3', 'capsule_small', blastRadius);
      // size = 2 + 1 = 3 → CREDIT_REPORT_REWARD_SMALL = 10
      expect(balance.balance).toBe(CREDIT_INITIAL_BALANCE + 10);
    });
  });

  describe('debitForPublish', () => {
    it('debits carbon cost from balance', () => {
      initializeCreditBalance('node_pub');
      const balance = debitForPublish('node_pub', 5);
      expect(balance.balance).toBe(CREDIT_INITIAL_BALANCE - 5);
    });
  });

  describe('debitForRevoke', () => {
    it('debits revoke cost and records asset_id', () => {
      initializeCreditBalance('node_revoke');
      const balance = debitForRevoke('node_revoke', 'capsule_bad');
      expect(balance.balance).toBe(CREDIT_INITIAL_BALANCE - 30);
      const tx = balance.transactions[1];
      expect(tx.type).toBe('revoke_cost');
      expect(tx.asset_id).toBe('capsule_bad');
    });
  });

  describe('creditForBounty / debitForBountyPayment', () => {
    it('credits bounty reward with swarm_id', () => {
      initializeCreditBalance('node_bounty');
      const balance = creditForBounty('node_bounty', 'swarm_abc', 100, 'solver');
      expect(balance.balance).toBe(CREDIT_INITIAL_BALANCE + 100);
      const tx = balance.transactions[1];
      expect(tx.swarm_id).toBe('swarm_abc');
      expect(tx.description).toContain('solver');
    });

    it('debits bounty payment', () => {
      initializeCreditBalance('node_bounty_pay');
      const balance = debitForBountyPayment('node_bounty_pay', 'swarm_xyz', 250);
      expect(balance.balance).toBe(CREDIT_INITIAL_BALANCE - 250);
    });
  });

  describe('creditForReferral', () => {
    it('credits both referrer and referee on top of their existing balances', () => {
      // Each node starts with 500 initial balance
      initializeCreditBalance('node_ref');
      initializeCreditBalance('node_new');

      const { referrer, referee } = creditForReferral('node_ref', 'node_new');

      expect(referrer.balance).toBe(550);  // 500 initial + 50 referral bonus
      expect(referee.balance).toBe(600);   // 500 initial + 100 referral bonus

      const refTx = referrer.transactions[referrer.transactions.length - 1];
      expect(refTx.type).toBe('referral_bonus');
      expect(refTx.description).toContain('node_new');

      const newTx = referee.transactions[referee.transactions.length - 1];
      expect(newTx.type).toBe('referral_bonus');
      expect(newTx.description).toContain('node_ref');
    });
  });

  // ===== Reputation Penalties =====

  describe('applyReputationPenalty', () => {
    it('reduces total reputation score by penalty amount', () => {
      mockGetAssetsByOwner.mockReturnValue([]);
      mockGetNodeInfo.mockReturnValue(null);

      calculateReputation('node_penalty');
      const penalized = applyReputationPenalty('node_penalty', 10, 'Quarantine violation');

      expect(penalized.negative.cumulative_penalties).toBe(10);
      expect(penalized.total).toBe(40); // 50 - 10
    });

    it('accumulates multiple penalties', () => {
      mockGetAssetsByOwner.mockReturnValue([]);
      mockGetNodeInfo.mockReturnValue(null);

      calculateReputation('node_multi_penalty');
      applyReputationPenalty('node_multi_penalty', 5, 'First violation');
      const second = applyReputationPenalty('node_multi_penalty', 8, 'Second violation');

      expect(second.negative.cumulative_penalties).toBe(13);
      expect(second.total).toBe(37); // 50 - 13
    });

    it('clamps total to 0 at minimum', () => {
      mockGetAssetsByOwner.mockReturnValue([]);
      mockGetNodeInfo.mockReturnValue(null);

      calculateReputation('node_extreme_penalty');
      const result = applyReputationPenalty('node_extreme_penalty', 100, 'Extreme violation');
      expect(result.total).toBe(0);
    });
  });

  // ===== Leaderboard =====

  describe('getReputationLeaderboard', () => {
    it('returns empty list when no nodes registered', () => {
      expect(getReputationLeaderboard()).toEqual([]);
    });

    it('returns sorted list by total descending', () => {
      mockGetAssetsByOwner.mockReturnValue([]);
      mockGetNodeInfo.mockReturnValue(null);

      calculateReputation('node_top', {
        publishedCount: 100,
        promotedCount: 90,
        avgGdi: 88,
      });
      calculateReputation('node_mid', {
        publishedCount: 20,
        promotedCount: 10,
        avgGdi: 60,
      });
      calculateReputation('node_low', {
        publishedCount: 5,
        promotedCount: 1,
        avgGdi: 40,
      });

      const leaderboard = getReputationLeaderboard(10);
      expect(leaderboard.length).toBe(3);
      expect(leaderboard[0].node_id).toBe('node_top');
      expect(leaderboard[1].node_id).toBe('node_mid');
      expect(leaderboard[2].node_id).toBe('node_low');
    });

    it('respects the limit parameter', () => {
      mockGetAssetsByOwner.mockReturnValue([]);
      mockGetNodeInfo.mockReturnValue(null);

      for (let i = 0; i < 5; i++) {
        calculateReputation(`node_${i}`, { publishedCount: i * 5, promotedCount: i });
      }

      const leaderboard = getReputationLeaderboard(3);
      expect(leaderboard.length).toBe(3);
    });
  });

  // ===== Store Reset =====

  describe('resetStores', () => {
    it('clears all reputation scores and credit balances', () => {
      mockGetAssetsByOwner.mockReturnValue([]);
      mockGetNodeInfo.mockReturnValue(null);

      calculateReputation('node_reset');
      initializeCreditBalance('node_reset');

      resetStores();

      expect(getReputation('node_reset')).toBeUndefined();
      expect(getCreditBalance('node_reset')).toBeUndefined();
      expect(getReputationLeaderboard()).toEqual([]);
    });
  });
});
