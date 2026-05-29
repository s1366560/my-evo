import { describe, it, expect, beforeEach } from '@jest/globals';
import * as creditService from './service';
import { CREDIT_COSTS, INITIAL_CREDITS } from './types';

describe('Credits Service', () => {
  beforeEach(() => {
    creditService._resetTestState();
  });

  describe('initializeCredits', () => {
    it('should initialize credits for new node', () => {
      const balance = creditService.initializeCredits('node_123', 'free');
      expect(balance.node_id).toBe('node_123');
      expect(balance.balance).toBe(INITIAL_CREDITS.free);
      expect(balance.tier).toBe('free');
    });

    it('should set correct tier', () => {
      const freeBalance = creditService.initializeCredits('node_1', 'free');
      const premiumBalance = creditService.initializeCredits('node_2', 'premium');
      const ultraBalance = creditService.initializeCredits('node_3', 'ultra');

      expect(freeBalance.balance).toBe(INITIAL_CREDITS.free);
      expect(premiumBalance.balance).toBe(INITIAL_CREDITS.premium);
      expect(ultraBalance.balance).toBe(INITIAL_CREDITS.ultra);
    });

    it('should include monthly allowance', () => {
      const balance = creditService.initializeCredits('node_123', 'free');
      expect(balance.monthly_allowance).toBe(100);
      expect(balance.remaining_this_month).toBe(100);
    });
  });

  describe('getBalance', () => {
    it('should return initialized balance', () => {
      creditService.initializeCredits('node_123', 'free');
      const balance = creditService.getBalance('node_123');
      expect(balance).toBe(INITIAL_CREDITS.free);
    });

    it('should return 0 for non-existent node', () => {
      const balance = creditService.getBalance('nonexistent');
      expect(balance).toBe(0);
    });
  });

  describe('getBalanceInfo', () => {
    it('should return full balance info', () => {
      creditService.initializeCredits('node_123', 'free');
      const info = creditService.getBalanceInfo('node_123', 'free');
      expect(info.node_id).toBe('node_123');
      expect(info.balance).toBe(INITIAL_CREDITS.free);
      expect(info.tier).toBe('free');
      expect(typeof info.last_updated).toBe('string');
    });

    it('should auto-initialize for non-existent node', () => {
      const info = creditService.getBalanceInfo('new_node', 'free');
      expect(info.balance).toBe(INITIAL_CREDITS.free);
    });
  });

  describe('addCredits', () => {
    it('should add credits to balance', () => {
      creditService.initializeCredits('node_123', 'free');
      const tx = creditService.addCredits('node_123', 100, 'purchase', 'Test purchase');
      expect(tx.amount).toBe(100);
      expect(tx.type).toBe('purchase');
      expect(tx.balance_after).toBe(INITIAL_CREDITS.free + 100);
    });

    it('should throw for negative amount', () => {
      expect(() => {
        creditService.addCredits('node_123', -100, 'purchase', 'Invalid');
      }).toThrow();
    });

    it('should throw for zero amount', () => {
      expect(() => {
        creditService.addCredits('node_123', 0, 'purchase', 'Invalid');
      }).toThrow();
    });
  });

  describe('spendCredits', () => {
    it('should spend credits from balance', () => {
      creditService.initializeCredits('node_123', 'free');
      const tx = creditService.spendCredits('node_123', {
        amount: 50,
        type: 'map_create',
        description: 'Creating test map',
      });
      expect(tx.amount).toBe(-50);
      expect(tx.balance_after).toBe(INITIAL_CREDITS.free - 50);
    });

    it('should throw for insufficient credits', () => {
      creditService.initializeCredits('node_123', 'free');
      expect(() => {
        creditService.spendCredits('node_123', {
          amount: INITIAL_CREDITS.free + 1000,
          type: 'map_create',
          description: 'Too expensive',
        });
      }).toThrow();
    });

    it('should track monthly usage', () => {
      creditService.initializeCredits('node_123', 'free');
      creditService.spendCredits('node_123', { amount: 30, type: 'map_create', description: 'Test' });
      const info = creditService.getBalanceInfo('node_123', 'free');
      expect(info.used_this_month).toBe(30);
    });
  });

  describe('spendByCostType', () => {
    it('should spend by predefined cost', () => {
      creditService.initializeCredits('node_123', 'free');
      const tx = creditService.spendByCostType('node_123', 'map_create');
      expect(tx.amount).toBe(-CREDIT_COSTS.map_create);
    });

    it('should use custom description', () => {
      creditService.initializeCredits('node_123', 'free');
      const tx = creditService.spendByCostType('node_123', 'api_call_standard', 'Custom API call');
      expect(tx.description).toBe('Custom API call');
    });
  });

  describe('refundCredits', () => {
    it('should refund credits', () => {
      creditService.initializeCredits('node_123', 'free');
      creditService.spendCredits('node_123', { amount: 50, type: 'map_create', description: 'Test' });
      const refundTx = creditService.refundCredits('node_123', 'tx_123', 50, 'Test refund');
      expect(refundTx.amount).toBe(50);
      expect(refundTx.type).toBe('refund');
    });
  });

  describe('getTransactions', () => {
    it('should return transaction history', () => {
      creditService.initializeCredits('node_123', 'free');
      creditService.addCredits('node_123', 100, 'purchase', 'Test');
      creditService.spendCredits('node_123', { amount: 30, type: 'map_create', description: 'Test' });
      
      const txs = creditService.getTransactions({ node_id: 'node_123' });
      expect(txs.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by type', () => {
      creditService.initializeCredits('node_123', 'free');
      creditService.addCredits('node_123', 100, 'purchase', 'Test');
      creditService.addCredits('node_123', 50, 'referral_bonus', 'Referral');
      
      const purchaseTxs = creditService.getTransactions({ node_id: 'node_123', type: 'purchase' });
      expect(purchaseTxs.every(tx => tx.type === 'purchase')).toBe(true);
    });

    it('should paginate results', () => {
      creditService.initializeCredits('node_123', 'free');
      for (let i = 0; i < 10; i++) {
        creditService.addCredits('node_123', 10, 'purchase', `Test ${i}`);
      }
      
      const page1 = creditService.getTransactions({ node_id: 'node_123', limit: 5, offset: 0 });
      const page2 = creditService.getTransactions({ node_id: 'node_123', limit: 5, offset: 5 });
      
      expect(page1.length).toBe(5);
      expect(page2.length).toBe(5);
    });
  });

  describe('grantSubscriptionCredits', () => {
    it('should grant monthly allowance', () => {
      creditService.initializeCredits('node_123', 'free');
      const tx = creditService.grantSubscriptionCredits('node_123', 'premium');
      expect(tx.amount).toBe(1000); // premium monthly allowance
    });

    it('should reset monthly usage', () => {
      creditService.initializeCredits('node_123', 'free');
      creditService.spendCredits('node_123', { amount: 50, type: 'map_create', description: 'Test' });
      
      const before = creditService.getBalanceInfo('node_123', 'free');
      expect(before.used_this_month).toBe(50);
      
      creditService.grantSubscriptionCredits('node_123', 'free');
      
      const after = creditService.getBalanceInfo('node_123', 'free');
      expect(after.used_this_month).toBe(0);
    });
  });

  describe('applyReferralBonus', () => {
    it('should apply bonuses to both parties', () => {
      creditService.initializeCredits('node_referrer', 'free');
      creditService.initializeCredits('node_referee', 'free');
      
      const result = creditService.applyReferralBonus('node_referrer', 'node_referee');
      
      expect(result.referrerTx.amount).toBe(200);
      expect(result.refereeTx.amount).toBe(100);
      expect(result.referrerTx.type).toBe('referral_bonus');
      expect(result.refereeTx.type).toBe('referral_bonus');
    });
  });

  describe('getCreditPackages', () => {
    it('should return available packages', () => {
      const packages = creditService.getCreditPackages();
      expect(packages.length).toBeGreaterThan(0);
      expect(packages[0]).toHaveProperty('id');
      expect(packages[0]).toHaveProperty('credits');
      expect(packages[0]).toHaveProperty('price_cents');
    });
  });

  describe('_resetTestState', () => {
    it('should clear all data', () => {
      creditService.initializeCredits('node_123', 'free');
      creditService.addCredits('node_123', 100, 'purchase', 'Test');
      
      creditService._resetTestState();
      
      expect(creditService.getBalance('node_123')).toBe(0);
    });
  });
});
