import * as pricing from './pricing';
import * as orderFlow from './order-flow';
import * as creditExchange from './credit-exchange';
import * as auction from './auction';
import * as review from './review';
import * as service from './service';
import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
  ForbiddenError,
} from '../shared/errors';

// ─── Shared mock Prisma client ────────────────────────────────────────────────

function createMockPrisma(overrides = {}) {
  return {
    marketplaceListing: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    marketplaceOrder: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    marketplaceAuction: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    marketplaceBid: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    marketplaceReview: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    marketplaceDispute: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    proposal: { create: jest.fn() },
    node: {
      findFirst: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    asset: { findUnique: jest.fn() },
    gene: { findUnique: jest.fn() },
    capsule: { findUnique: jest.fn() },
    recipe: { findUnique: jest.fn() },
    skill: { findUnique: jest.fn() },
    similarityRecord: { count: jest.fn() },
    creditTransaction: { create: jest.fn() },
    ...overrides,
  } as unknown;
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Marketplace — All Modules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PRICING
  // ══════════════════════════════════════════════════════════════════════════

  describe('pricing', () => {
    beforeAll(() => {
      pricing.setPrisma(createMockPrisma());
    });

    describe('BASE_PRICES', () => {
      it('should have correct base prices per asset type', () => {
        expect(pricing.BASE_PRICES.gene).toBe(100);
        expect(pricing.BASE_PRICES.capsule).toBe(200);
        expect(pricing.BASE_PRICES.recipe).toBe(300);
      });
    });

    describe('classifyPriceTier', () => {
      it.each([
        [10, 'budget'],
        [99, 'budget'],
        [100, 'standard'],
        [499, 'standard'],
        [500, 'premium'],
        [1999, 'premium'],
        [2000, 'elite'],
        [99999, 'elite'],
      ])('price %i → tier %s', (price, expected) => {
        expect(pricing.classifyPriceTier(price)).toBe(expected);
      });
    });

    describe('adjustByDemand', () => {
      it('returns peak factor during business hours', () => {
        const peak = new Date('2026-04-03T12:00:00Z');
        const result = pricing.adjustByDemand('gene', peak);
        expect(result.factor).toBe(1.25);
        expect(result.period).toBe('peak');
      });

      it('returns morning factor in early hours', () => {
        const morning = new Date('2026-04-03T07:00:00Z');
        const result = pricing.adjustByDemand('capsule', morning);
        expect(result.factor).toBe(1.1);
        expect(result.period).toBe('morning');
      });

      it('returns evening factor in early evening', () => {
        const evening = new Date('2026-04-03T20:00:00Z');
        const result = pricing.adjustByDemand('recipe', evening);
        expect(result.factor).toBe(1.1);
        expect(result.period).toBe('evening');
      });

      it('returns off_hours factor at night', () => {
        const night = new Date('2026-04-03T02:00:00Z');
        const result = pricing.adjustByDemand('gene', night);
        expect(result.factor).toBe(0.9);
        expect(result.period).toBe('off_hours');
      });
    });

    describe('adjustByScarcity', () => {
      it('returns unique factor when no supply', () => {
        const result = pricing.adjustByScarcity('asset-x', 0);
        expect(result.factor).toBe(2.0);
        expect(result.scarcity).toBe('unique');
      });

      it('returns rare factor for ≤3 supply', () => {
        expect(pricing.adjustByScarcity('x', 1).scarcity).toBe('rare');
        expect(pricing.adjustByScarcity('x', 3).scarcity).toBe('rare');
      });

      it('returns uncommon factor for 4-10 supply', () => {
        expect(pricing.adjustByScarcity('x', 5).scarcity).toBe('uncommon');
        expect(pricing.adjustByScarcity('x', 10).scarcity).toBe('uncommon');
      });

      it('returns common factor for >10 supply', () => {
        expect(pricing.adjustByScarcity('x', 100).scarcity).toBe('common');
      });
    });

    describe('calculateDynamicPrice', () => {
      it('throws NotFoundError for unknown listing', async () => {
        const mock = createMockPrisma({
          marketplaceListing: { findUnique: jest.fn().mockResolvedValue(null) },
        });
        pricing.setPrisma(mock);
        await expect(pricing.calculateDynamicPrice('missing')).rejects.toThrow(
          NotFoundError,
        );
      });

      it('calculates price with all factors', async () => {
        const mock = createMockPrisma({
          marketplaceListing: {
            findUnique: jest.fn().mockResolvedValue({
              listing_id: 'list-1',
              asset_type: 'capsule',
              asset: { asset_id: 'asset-1', gdi_score: 72, downloads: 50 },
            }),
          },
          node: {
            aggregate: jest.fn().mockResolvedValue({ _avg: { reputation: 54.3 } }),
          },
          similarityRecord: {
            count: jest.fn().mockResolvedValue(3),
          },
        });
        pricing.setPrisma(mock);

        const { price, breakdown } = await pricing.calculateDynamicPrice('list-1');

        expect(price).toBeGreaterThan(0);
        expect(breakdown.basePrice).toBe(200);
        expect(breakdown.assetGdi).toBe(72);
        expect(breakdown.fetchCount).toBe(50);
        expect(breakdown.similarCount).toBe(3);
        expect(breakdown.gdiFactor).toBeGreaterThan(0);
        expect(breakdown.demandFactor).toBeGreaterThan(1);
        expect(breakdown.scarcityFactor).toBeLessThan(1);
      });
    });

    describe('getPricingHistory', () => {
      it('returns empty array when no transactions', async () => {
        const mock = createMockPrisma({
          marketplaceTransaction: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        });
        pricing.setPrisma(mock);

        const history = await pricing.getPricingHistory('asset-1');
        expect(history).toEqual([]);
      });

      it('returns price points sorted desc', async () => {
        const ts = new Date('2026-03-01T12:00:00Z');
        const mock = createMockPrisma({
          marketplaceTransaction: {
            findMany: jest.fn().mockResolvedValue([
              { price: 150, completed_at: ts },
              { price: 120, completed_at: new Date('2026-02-01T12:00:00Z') },
            ]),
          },
        });
        pricing.setPrisma(mock);

        const history = await pricing.getPricingHistory('asset-1', 10);
        expect(history).toHaveLength(2);
        expect(history[0]!.price).toBe(150);
        expect(history[0]!.timestamp).toBe(ts.toISOString());
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ORDER FLOW
  // ══════════════════════════════════════════════════════════════════════════

  describe('orderFlow', () => {
    beforeAll(() => {
      orderFlow.setPrisma(createMockPrisma());
    });

    describe('createOrder', () => {
      it('throws NotFoundError when listing missing', async () => {
        const mock = createMockPrisma({
          marketplaceListing: { findUnique: jest.fn().mockResolvedValue(null) },
        });
        orderFlow.setPrisma(mock);
        await expect(
          orderFlow.createOrder('buyer-1', 'missing'),
        ).rejects.toThrow(NotFoundError);
      });

      it('throws ValidationError when listing not active', async () => {
        const mock = createMockPrisma({
          marketplaceListing: {
            findUnique: jest.fn().mockResolvedValue({
              listing_id: 'list-1',
              status: 'sold',
              seller_id: 'seller-1',
              price: 100,
              expires_at: new Date('2030-01-01'),
            }),
          },
        });
        orderFlow.setPrisma(mock);
        await expect(
          orderFlow.createOrder('buyer-1', 'list-1'),
        ).rejects.toThrow(ValidationError);
      });

      it('throws ValidationError when buyer buys own listing', async () => {
        const mock = createMockPrisma({
          marketplaceListing: {
            findUnique: jest.fn().mockResolvedValue({
              listing_id: 'list-1',
              status: 'active',
              seller_id: 'seller-1',
              price: 100,
              expires_at: new Date('2030-01-01'),
            }),
          },
        });
        orderFlow.setPrisma(mock);
        await expect(
          orderFlow.createOrder('seller-1', 'list-1'),
        ).rejects.toThrow(ValidationError);
      });

      it('throws ValidationError when listing expired', async () => {
        const mock = createMockPrisma({
          marketplaceListing: {
            findUnique: jest.fn().mockResolvedValue({
              listing_id: 'list-1',
              status: 'active',
              seller_id: 'seller-1',
              price: 100,
              expires_at: new Date('2020-01-01'),
            }),
          },
        });
        orderFlow.setPrisma(mock);
        await expect(
          orderFlow.createOrder('buyer-1', 'list-1'),
        ).rejects.toThrow(ValidationError);
      });

      it('throws InsufficientCreditsError when buyer cannot afford', async () => {
        const mock = createMockPrisma({
          marketplaceListing: {
            findUnique: jest.fn().mockResolvedValue({
              listing_id: 'list-1',
              status: 'active',
              seller_id: 'seller-1',
              price: 100,
              asset_id: 'asset-1',
              expires_at: new Date('2030-01-01'),
            }),
          },
          node: {
            findFirst: jest.fn().mockResolvedValue({
              node_id: 'buyer-1',
              credit_balance: 50,
            }),
          },
        });
        orderFlow.setPrisma(mock);
        await expect(
          orderFlow.createOrder('buyer-1', 'list-1'),
        ).rejects.toThrow(InsufficientCreditsError);
      });

      it('creates order and locks payment', async () => {
        const mock = createMockPrisma({
          marketplaceListing: {
            findUnique: jest.fn().mockResolvedValue({
              listing_id: 'list-1',
              status: 'active',
              seller_id: 'seller-1',
              price: 100,
              asset_id: 'asset-1',
              expires_at: new Date('2030-01-01'),
            }),
          },
          node: {
            findFirst: jest.fn().mockResolvedValue({
              node_id: 'buyer-1',
              credit_balance: 500,
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          creditTransaction: { create: jest.fn().mockResolvedValue({}) },
          marketplaceOrder: {
            upsert: jest.fn().mockImplementation((args) => ({
              ...args.create,
            })),
          },
        });
        orderFlow.setPrisma(mock);

        const order = await orderFlow.createOrder('buyer-1', 'list-1');

        expect(order.buyer_id).toBe('buyer-1');
        expect(order.seller_id).toBe('seller-1');
        expect(order.amount).toBe(100);
        expect(order.fee).toBe(5);
        expect(order.seller_receives).toBe(95);
        expect(order.status).toBe('payment_locked');
        expect(order.escrow_id).toMatch(/^escrow_/);
        expect(order.order_id).toMatch(/^order_/);
      });
    });

    describe('lockPayment', () => {
      it('throws NotFoundError when order missing', async () => {
        const mock = createMockPrisma({
          marketplaceOrder: { findUnique: jest.fn().mockResolvedValue(null) },
        });
        orderFlow.setPrisma(mock);
        await expect(
          orderFlow.lockPayment('missing'),
        ).rejects.toThrow(NotFoundError);
      });

      it('is idempotent for already-locked order', async () => {
        const mock = createMockPrisma({
          marketplaceOrder: {
            findUnique: jest.fn().mockResolvedValue({
              order_id: 'order-1',
              listing_id: 'list-1',
              buyer_id: 'buyer-1',
              seller_id: 'seller-1',
              asset_id: 'asset-1',
              amount: 100,
              fee: 5,
              seller_receives: 95,
              status: 'payment_locked',
              escrow_id: 'escrow-1',
              created_at: new Date(),
            }),
          },
        });
        orderFlow.setPrisma(mock);

        const result = await orderFlow.lockPayment('order-1');
        expect(result.status).toBe('payment_locked');
      });

      it('throws ValidationError for non-pending order', async () => {
        const mock = createMockPrisma({
          marketplaceOrder: {
            findUnique: jest.fn().mockResolvedValue({
              order_id: 'order-1',
              status: 'completed',
              listing_id: 'list-1',
              buyer_id: 'buyer-1',
              seller_id: 'seller-1',
              asset_id: 'asset-1',
              amount: 100,
              fee: 5,
              seller_receives: 95,
              escrow_id: 'escrow-1',
              created_at: new Date(),
            }),
          },
        });
        orderFlow.setPrisma(mock);
        await expect(
          orderFlow.lockPayment('order-1'),
        ).rejects.toThrow(ValidationError);
      });
    });

    describe('confirmDelivery', () => {
      it('throws ValidationError for invalid order status', async () => {
        const mock = createMockPrisma({
          marketplaceOrder: {
            findUnique: jest.fn().mockResolvedValue({
              order_id: 'order-1',
              status: 'pending',
              listing_id: 'list-1',
              buyer_id: 'buyer-1',
              seller_id: 'seller-1',
              asset_id: 'asset-1',
              amount: 100,
              fee: 5,
              seller_receives: 95,
              escrow_id: 'escrow-1',
              created_at: new Date(),
            }),
          },
        });
        orderFlow.setPrisma(mock);
        await expect(
          orderFlow.confirmDelivery('order-1', 'proof-123'),
        ).rejects.toThrow(ValidationError);
      });

      it('marks order as delivered', async () => {
        const mock = createMockPrisma({
          marketplaceOrder: {
            findUnique: jest.fn().mockResolvedValue({
              order_id: 'order-1',
              status: 'payment_locked',
              listing_id: 'list-1',
              buyer_id: 'buyer-1',
              seller_id: 'seller-1',
              asset_id: 'asset-1',
              amount: 100,
              fee: 5,
              seller_receives: 95,
              escrow_id: 'escrow-1',
              created_at: new Date(),
            }),
            update: jest.fn().mockImplementation((_args) => ({
              order_id: 'order-1',
              status: 'delivered',
              delivery_proof: 'proof-123',
              listing_id: 'list-1',
              buyer_id: 'buyer-1',
              seller_id: 'seller-1',
              asset_id: 'asset-1',
              amount: 100,
              fee: 5,
              seller_receives: 95,
              escrow_id: 'escrow-1',
              created_at: new Date(),
              delivered_at: new Date(),
            })),
          },
        });
        orderFlow.setPrisma(mock);

        const result = await orderFlow.confirmDelivery('order-1', 'proof-123');
        expect(result.status).toBe('delivered');
        expect(result.delivery_proof).toBe('proof-123');
      });
    });

    describe('completeOrder', () => {
      it('throws ValidationError for non-delivered order', async () => {
        const mock = createMockPrisma({
          marketplaceOrder: {
            findUnique: jest.fn().mockResolvedValue({
              order_id: 'order-1',
              status: 'pending',
              listing_id: 'list-1',
              buyer_id: 'buyer-1',
              seller_id: 'seller-1',
              asset_id: 'asset-1',
              amount: 100,
              fee: 5,
              seller_receives: 95,
              escrow_id: 'escrow-1',
              created_at: new Date(),
            }),
          },
        });
        orderFlow.setPrisma(mock);
        await expect(
          orderFlow.completeOrder('order-1'),
        ).rejects.toThrow(ValidationError);
      });

      it('credits seller and marks order completed', async () => {
        const mock = createMockPrisma({
          marketplaceOrder: {
            findUnique: jest.fn().mockResolvedValue({
              order_id: 'order-1',
              status: 'delivered',
              listing_id: 'list-1',
              buyer_id: 'buyer-1',
              seller_id: 'seller-1',
              asset_id: 'asset-1',
              amount: 100,
              fee: 5,
              seller_receives: 95,
              escrow_id: 'escrow-1',
              created_at: new Date(),
            }),
            update: jest.fn().mockImplementation(() => ({
              order_id: 'order-1',
              status: 'completed',
              listing_id: 'list-1',
              buyer_id: 'buyer-1',
              seller_id: 'seller-1',
              asset_id: 'asset-1',
              amount: 100,
              fee: 5,
              seller_receives: 95,
              escrow_id: 'escrow-1',
              created_at: new Date(),
              confirmed_at: new Date(),
              completed_at: new Date(),
            })),
          },
          node: {
            findFirst: jest.fn().mockResolvedValue({ credit_balance: 200 }),
            update: jest.fn().mockResolvedValue({}),
          },
          creditTransaction: { create: jest.fn().mockResolvedValue({}) },
          marketplaceListing: { update: jest.fn().mockResolvedValue({}) },
        });
        orderFlow.setPrisma(mock);

        const result = await orderFlow.completeOrder('order-1');
        expect(result.status).toBe('completed');
      });
    });

    describe('refundOrder', () => {
      it('throws ValidationError for completed order', async () => {
        const mock = createMockPrisma({
          marketplaceOrder: {
            findUnique: jest.fn().mockResolvedValue({
              order_id: 'order-1',
              status: 'completed',
              listing_id: 'list-1',
              buyer_id: 'buyer-1',
              seller_id: 'seller-1',
              asset_id: 'asset-1',
              amount: 100,
              fee: 5,
              seller_receives: 95,
              escrow_id: 'escrow-1',
              created_at: new Date(),
            }),
          },
        });
        orderFlow.setPrisma(mock);
        await expect(
          orderFlow.refundOrder('order-1', 'buyer protection'),
        ).rejects.toThrow(ValidationError);
      });

      it('refunds buyer credits', async () => {
        const mock = createMockPrisma({
          marketplaceOrder: {
            findUnique: jest.fn().mockResolvedValue({
              order_id: 'order-1',
              status: 'payment_locked',
              listing_id: 'list-1',
              buyer_id: 'buyer-1',
              seller_id: 'seller-1',
              asset_id: 'asset-1',
              amount: 100,
              fee: 5,
              seller_receives: 95,
              escrow_id: 'escrow-1',
              created_at: new Date(),
            }),
            update: jest.fn().mockImplementation(() => ({
              order_id: 'order-1',
              status: 'refunded',
              refund_reason: 'service not delivered',
              listing_id: 'list-1',
              buyer_id: 'buyer-1',
              seller_id: 'seller-1',
              asset_id: 'asset-1',
              amount: 100,
              fee: 5,
              seller_receives: 95,
              escrow_id: 'escrow-1',
              created_at: new Date(),
              refunded_at: new Date(),
            })),
          },
          node: {
            findFirst: jest.fn().mockResolvedValue({ credit_balance: 400 }),
            update: jest.fn().mockResolvedValue({}),
          },
          creditTransaction: { create: jest.fn().mockResolvedValue({}) },
        });
        orderFlow.setPrisma(mock);

        const result = await orderFlow.refundOrder(
          'order-1',
          'service not delivered',
        );
        expect(result.status).toBe('refunded');
        expect(result.refund_reason).toBe('service not delivered');
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CREDIT EXCHANGE
  // ══════════════════════════════════════════════════════════════════════════

  describe('creditExchange', () => {
    beforeAll(() => {
      creditExchange.setPrisma(createMockPrisma());
    });

    describe('getExchangeRate', () => {
      it('returns fixed rate', () => {
        const rate = creditExchange.getExchangeRate();
        expect(rate.credits_per_usd).toBe(100);
        expect(rate.rate_type).toBe('fixed');
      });
    });

    describe('transferCredits', () => {
      it('throws ValidationError for non-positive amount', async () => {
        await expect(
          creditExchange.transferCredits('a', 'b', 0),
        ).rejects.toThrow(ValidationError);
      });

      it('throws ValidationError for self-transfer', async () => {
        await expect(
          creditExchange.transferCredits('a', 'a', 100),
        ).rejects.toThrow(ValidationError);
      });

      it('throws NotFoundError for missing sender', async () => {
        const mock = createMockPrisma({
          node: {
            findFirst: jest.fn().mockResolvedValueOnce(null),
          },
        });
        creditExchange.setPrisma(mock);
        await expect(
          creditExchange.transferCredits('missing', 'b', 100),
        ).rejects.toThrow(NotFoundError);
      });

      it('throws NotFoundError for missing recipient', async () => {
        const mock = createMockPrisma({
          node: {
            findFirst: jest
              .fn()
              .mockResolvedValueOnce({ node_id: 'a', credit_balance: 500 })
              .mockResolvedValueOnce(null),
          },
        });
        creditExchange.setPrisma(mock);
        await expect(
          creditExchange.transferCredits('a', 'missing', 100),
        ).rejects.toThrow(NotFoundError);
      });

      it('throws InsufficientCreditsError when balance too low', async () => {
        const mock = createMockPrisma({
          node: {
            findFirst: jest
              .fn()
              .mockResolvedValueOnce({ node_id: 'a', credit_balance: 50 })
              .mockResolvedValueOnce({ node_id: 'b', credit_balance: 200 }),
          },
        });
        creditExchange.setPrisma(mock);
        await expect(
          creditExchange.transferCredits('a', 'b', 100),
        ).rejects.toThrow(InsufficientCreditsError);
      });

      it('transfers credits and records transactions', async () => {
        const mock = createMockPrisma({
          node: {
            findFirst: jest
              .fn()
              .mockResolvedValueOnce({ node_id: 'a', credit_balance: 500 })
              .mockResolvedValueOnce({ node_id: 'b', credit_balance: 200 }),
            update: jest.fn().mockResolvedValue({}),
          },
          creditTransaction: { create: jest.fn().mockResolvedValue({}) },
        });
        creditExchange.setPrisma(mock);

        const result = await creditExchange.transferCredits('a', 'b', 100);

        expect(result.from_id).toBe('a');
        expect(result.to_id).toBe('b');
        expect(result.amount).toBe(100);
        expect(result.from_balance_after).toBe(400);
        expect(result.to_balance_after).toBe(300);
        expect(result.transfer_id).toMatch(/^xfer_/);
      });
    });

    describe('exchangeCredits', () => {
      it('throws ValidationError for empty items', async () => {
        await expect(
          creditExchange.exchangeCredits('user-1', []),
        ).rejects.toThrow(ValidationError);
      });

      it('throws InsufficientCreditsError when balance too low', async () => {
        const mock = createMockPrisma({
          node: {
            findFirst: jest.fn().mockResolvedValue({
              node_id: 'user-1',
              credit_balance: 10,
            }),
          },
        });
        creditExchange.setPrisma(mock);
        await expect(
          creditExchange.exchangeCredits('user-1', [
            { goods_type: 'gene', goods_id: 'g1', price: 100, quantity: 1 },
          ]),
        ).rejects.toThrow(InsufficientCreditsError);
      });

      it('exchanges credits for valid goods atomically', async () => {
        const mock = createMockPrisma({
          node: {
            findFirst: jest.fn().mockResolvedValue({
              node_id: 'user-1',
              credit_balance: 500,
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          creditTransaction: { create: jest.fn().mockResolvedValue({}) },
          gene: {
            findUnique: jest.fn().mockResolvedValue({ gene_id: 'g1' }),
          },
        });
        creditExchange.setPrisma(mock);

        const result = await creditExchange.exchangeCredits('user-1', [
          { goods_type: 'gene', goods_id: 'g1', price: 100, quantity: 2 },
        ]);

        expect(result.exchange_id).toMatch(/^exch_/);
        expect(result.total_cost).toBe(200);
        expect(result.balance_after).toBe(300);
      });

      it('allows service items without database lookup', async () => {
        const mock = createMockPrisma({
          node: {
            findFirst: jest.fn().mockResolvedValue({
              node_id: 'user-1',
              credit_balance: 500,
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          creditTransaction: { create: jest.fn().mockResolvedValue({}) },
        });
        creditExchange.setPrisma(mock);

        const result = await creditExchange.exchangeCredits('user-1', [
          { goods_type: 'service', goods_id: 'svc-1', price: 50, quantity: 1 },
        ]);

        expect(result.total_cost).toBe(50);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // AUCTION
  // ══════════════════════════════════════════════════════════════════════════

  describe('auction', () => {
    beforeAll(() => {
      auction.setPrisma(createMockPrisma());
    });

    describe('createAuction', () => {
      it('throws NotFoundError for missing listing', async () => {
        const mock = createMockPrisma({
          marketplaceListing: { findUnique: jest.fn().mockResolvedValue(null) },
        });
        auction.setPrisma(mock);
        await expect(
          auction.createAuction('seller-1', 'missing', 50, 60),
        ).rejects.toThrow(NotFoundError);
      });

      it('throws ForbiddenError for non-owner', async () => {
        const mock = createMockPrisma({
          marketplaceListing: {
            findUnique: jest.fn().mockResolvedValue({
              listing_id: 'list-1',
              seller_id: 'other-seller',
              status: 'active',
            }),
          },
        });
        auction.setPrisma(mock);
        await expect(
          auction.createAuction('seller-1', 'list-1', 50, 60),
        ).rejects.toThrow(ForbiddenError);
      });

      it('throws ValidationError for non-active listing', async () => {
        const mock = createMockPrisma({
          marketplaceListing: {
            findUnique: jest.fn().mockResolvedValue({
              listing_id: 'list-1',
              seller_id: 'seller-1',
              status: 'sold',
            }),
          },
        });
        auction.setPrisma(mock);
        await expect(
          auction.createAuction('seller-1', 'list-1', 50, 60),
        ).rejects.toThrow(ValidationError);
      });

      it('creates auction with correct end time', async () => {
        const mock = createMockPrisma({
          marketplaceListing: {
            findUnique: jest.fn().mockResolvedValue({
              listing_id: 'list-1',
              seller_id: 'seller-1',
              status: 'active',
            }),
          },
          marketplaceAuction: {
            create: jest.fn().mockImplementation((args) => ({
              ...args.data,
            })),
          },
        });
        auction.setPrisma(mock);

        const result = await auction.createAuction(
          'seller-1',
          'list-1',
          50,
          30,
        );

        expect(result.seller_id).toBe('seller-1');
        expect(result.listing_id).toBe('list-1');
        expect(result.starting_price).toBe(50);
        expect(result.current_price).toBe(50);
        expect(result.status).toBe('active');
        expect(result.auction_id).toMatch(/^auct_/);

        // End time should be ~30 min from now
        const endTime = new Date(result.end_time);
        const diff = endTime.getTime() - Date.now();
        expect(diff).toBeGreaterThan(29 * 60 * 1000);
        expect(diff).toBeLessThan(31 * 60 * 1000);
      });
    });

    describe('placeBid', () => {
      it('throws NotFoundError for missing auction', async () => {
        const mock = createMockPrisma({
          marketplaceAuction: { findUnique: jest.fn().mockResolvedValue(null) },
        });
        auction.setPrisma(mock);
        await expect(
          auction.placeBid('missing', 'bidder-1', 60),
        ).rejects.toThrow(NotFoundError);
      });

      it('throws ValidationError when bid below current price', async () => {
        const mock = createMockPrisma({
          marketplaceAuction: {
            findUnique: jest.fn().mockResolvedValue({
              auction_id: 'auct-1',
              status: 'active',
              seller_id: 'seller-1',
              current_price: 100,
              end_time: new Date(Date.now() + 3600_000),
            }),
          },
        });
        auction.setPrisma(mock);
        await expect(
          auction.placeBid('auct-1', 'bidder-1', 50),
        ).rejects.toThrow(ValidationError);
      });

      it('throws InsufficientCreditsError when bidder cannot afford', async () => {
        const mock = createMockPrisma({
          marketplaceAuction: {
            findUnique: jest.fn().mockResolvedValue({
              auction_id: 'auct-1',
              status: 'active',
              seller_id: 'seller-1',
              current_price: 100,
              end_time: new Date(Date.now() + 3600_000),
            }),
          },
          node: {
            findFirst: jest.fn().mockResolvedValue({
              node_id: 'bidder-1',
              credit_balance: 50,
            }),
          },
        });
        auction.setPrisma(mock);
        await expect(
          auction.placeBid('auct-1', 'bidder-1', 150),
        ).rejects.toThrow(InsufficientCreditsError);
      });

      it('places valid bid and increments bid count', async () => {
        const mock = createMockPrisma({
          marketplaceAuction: {
            findUnique: jest.fn().mockResolvedValue({
              auction_id: 'auct-1',
              status: 'active',
              seller_id: 'seller-1',
              starting_price: 50,
              current_price: 100,
              listing_id: 'list-1',
              end_time: new Date(Date.now() + 3600_000),
              start_time: new Date(),
              bid_count: 0,
              created_at: new Date(),
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          node: {
            findFirst: jest.fn().mockResolvedValue({
              node_id: 'bidder-1',
              credit_balance: 500,
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          creditTransaction: { create: jest.fn().mockResolvedValue({}) },
          marketplaceBid: {
            create: jest.fn().mockImplementation((args) => ({
              bid_id: `bid_${Math.random().toString(36).slice(2)}`,
              ...args.data,
            })),
          },
        });
        auction.setPrisma(mock);

        const result = await auction.placeBid('auct-1', 'bidder-1', 120);

        expect(result.amount).toBe(120);
        expect(result.bidder_id).toBe('bidder-1');
        expect(result.bid_id).toMatch(/^bid_/);
      });
    });

    describe('extendAuction', () => {
      it('throws ValidationError when max extensions reached', async () => {
        const mock = createMockPrisma({
          marketplaceAuction: {
            findUnique: jest.fn().mockResolvedValue({
              auction_id: 'auct-1',
              status: 'active',
              extended_count: 3,
              end_time: new Date(Date.now() + 60_000),
            }),
          },
        });
        auction.setPrisma(mock);
        await expect(
          auction.extendAuction('auct-1'),
        ).rejects.toThrow(ValidationError);
      });

      it('extends end time by 5 minutes', async () => {
        const baseEnd = new Date(Date.now() + 60_000);
        const mock = createMockPrisma({
          marketplaceAuction: {
            findUnique: jest.fn().mockResolvedValue({
              auction_id: 'auct-1',
              status: 'active',
              extended_count: 0,
              starting_price: 50,
              current_price: 100,
              listing_id: 'list-1',
              seller_id: 'seller-1',
              start_time: new Date(),
              end_time: baseEnd,
              bid_count: 0,
              created_at: new Date(),
            }),
            update: jest.fn().mockImplementation(() => ({
              auction_id: 'auct-1',
              listing_id: 'list-1',
              seller_id: 'seller-1',
              starting_price: 50,
              current_price: 100,
              status: 'extended',
              extended_count: 1,
              bid_count: 0,
              start_time: new Date(),
              end_time: new Date(baseEnd.getTime() + 5 * 60_000),
              extended_until: new Date(baseEnd.getTime() + 5 * 60_000),
              created_at: new Date(),
            })),
          },
        });
        auction.setPrisma(mock);

        const result = await auction.extendAuction('auct-1');
        expect(result.status).toBe('extended');
      });
    });

    describe('finalizeAuction', () => {
      it('throws ValidationError when already finalized', async () => {
        const mock = createMockPrisma({
          marketplaceAuction: {
            findUnique: jest.fn().mockResolvedValue({
              auction_id: 'auct-1',
              status: 'finalized',
              listing_id: 'list-1',
              seller_id: 'seller-1',
              starting_price: 50,
              current_price: 50,
              bid_count: 0,
              start_time: new Date(),
              end_time: new Date(),
            }),
          },
        });
        auction.setPrisma(mock);
        await expect(
          auction.finalizeAuction('auct-1'),
        ).rejects.toThrow(ValidationError);
      });

      it('finalizes with no bids — restores listing', async () => {
        const mock = createMockPrisma({
          marketplaceAuction: {
            findUnique: jest.fn().mockResolvedValue({
              auction_id: 'auct-1',
              status: 'active',
              listing_id: 'list-1',
              seller_id: 'seller-1',
              starting_price: 50,
              current_price: 50,
              bid_count: 0,
              start_time: new Date(),
              end_time: new Date(),
              bids: [],
            }),
            update: jest.fn().mockImplementation(() => ({
              auction_id: 'auct-1',
              status: 'finalized',
              listing_id: 'list-1',
              seller_id: 'seller-1',
              starting_price: 50,
              current_price: 50,
              bid_count: 0,
              start_time: new Date(),
              end_time: new Date(),
            })),
          },
          marketplaceListing: { update: jest.fn().mockResolvedValue({}) },
        });
        auction.setPrisma(mock);

        const result = await auction.finalizeAuction('auct-1');
        expect(result.status).toBe('finalized');
        expect(result.winner_id).toBeUndefined();
      });

      it('finalizes with bids — transfers payment', async () => {
        const mock = createMockPrisma({
          marketplaceAuction: {
            findUnique: jest.fn().mockResolvedValue({
              auction_id: 'auct-1',
              status: 'active',
              listing_id: 'list-1',
              seller_id: 'seller-1',
              starting_price: 50,
              current_price: 120,
              bid_count: 1,
              start_time: new Date(),
              end_time: new Date(),
              bids: [
                {
                  bid_id: 'bid-1',
                  bidder_id: 'winner-1',
                  amount: 120,
                  created_at: new Date(),
                },
              ],
            }),
            update: jest.fn().mockImplementation(() => ({
              auction_id: 'auct-1',
              status: 'finalized',
              winner_id: 'winner-1',
              current_price: 120,
              listing_id: 'list-1',
              seller_id: 'seller-1',
              starting_price: 50,
              bid_count: 1,
              start_time: new Date(),
              end_time: new Date(),
            })),
          },
          node: {
            findFirst: jest
              .fn()
              .mockResolvedValueOnce({ credit_balance: 500 })
              .mockResolvedValueOnce({ credit_balance: 200 }),
            update: jest.fn().mockResolvedValue({}),
          },
          creditTransaction: { create: jest.fn().mockResolvedValue({}) },
          marketplaceListing: { update: jest.fn().mockResolvedValue({}) },
        });
        auction.setPrisma(mock);

        const result = await auction.finalizeAuction('auct-1');
        expect(result.status).toBe('finalized');
        expect(result.winner_id).toBe('winner-1');
      });
    });

    describe('getAuctionStatus', () => {
      it('returns auction with top bid', async () => {
        const ts = new Date('2026-03-01T12:00:00Z');
        const mock = createMockPrisma({
          marketplaceAuction: {
            findUnique: jest.fn().mockResolvedValue({
              auction_id: 'auct-1',
              listing_id: 'list-1',
              seller_id: 'seller-1',
              starting_price: 50,
              current_price: 120,
              status: 'active',
              bid_count: 2,
              start_time: new Date(),
              end_time: new Date(),
              bids: [
                {
                  bid_id: 'bid-2',
                  bidder_id: 'bidder-2',
                  amount: 120,
                  created_at: ts,
                },
                {
                  bid_id: 'bid-1',
                  bidder_id: 'bidder-1',
                  amount: 80,
                  created_at: new Date('2026-02-28T12:00:00Z'),
                },
              ],
            }),
          },
        });
        auction.setPrisma(mock);

        const result = await auction.getAuctionStatus('auct-1');

        expect(result.auction_id).toBe('auct-1');
        expect(result.top_bid!.amount).toBe(120);
        expect(result.top_bid!.bidder_id).toBe('bidder-2');
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // REVIEW
  // ══════════════════════════════════════════════════════════════════════════

  describe('review', () => {
    beforeAll(() => {
      review.setPrisma(createMockPrisma());
    });

    describe('createReview', () => {
      it('throws ValidationError for rating out of range', async () => {
        await expect(
          review.createReview('order-1', 'buyer-1', 0),
        ).rejects.toThrow(ValidationError);
        await expect(
          review.createReview('order-1', 'buyer-1', 6),
        ).rejects.toThrow(ValidationError);
      });

      it('throws NotFoundError for missing order', async () => {
        const mock = createMockPrisma({
          marketplaceOrder: { findUnique: jest.fn().mockResolvedValue(null) },
        });
        review.setPrisma(mock);
        await expect(
          review.createReview('missing', 'buyer-1', 5),
        ).rejects.toThrow(NotFoundError);
      });

      it('throws ValidationError for non-completed order', async () => {
        const mock = createMockPrisma({
          marketplaceOrder: {
            findUnique: jest.fn().mockResolvedValue({
              order_id: 'order-1',
              status: 'pending',
              buyer_id: 'buyer-1',
              seller_id: 'seller-1',
            }),
          },
        });
        review.setPrisma(mock);
        await expect(
          review.createReview('order-1', 'buyer-1', 5),
        ).rejects.toThrow(ValidationError);
      });

      it('throws ValidationError for duplicate review', async () => {
        const mock = createMockPrisma({
          marketplaceOrder: {
            findUnique: jest.fn().mockResolvedValue({
              order_id: 'order-1',
              status: 'completed',
              buyer_id: 'buyer-1',
              seller_id: 'seller-1',
            }),
          },
          marketplaceReview: {
            findFirst: jest.fn().mockResolvedValue({ review_id: 'rev-1' }),
          },
        });
        review.setPrisma(mock);
        await expect(
          review.createReview('order-1', 'buyer-1', 5),
        ).rejects.toThrow(ValidationError);
      });

      it('creates review with rating and comment', async () => {
        const mock = createMockPrisma({
          marketplaceOrder: {
            findUnique: jest.fn().mockResolvedValue({
              order_id: 'order-1',
              status: 'completed',
              buyer_id: 'buyer-1',
              seller_id: 'seller-1',
            }),
          },
          marketplaceReview: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((args) => ({
              review_id: `rev_${Math.random().toString(36).slice(2)}`,
              ...args.data,
            })),
            findMany: jest.fn().mockResolvedValue([]),
          },
          node: { update: jest.fn().mockResolvedValue({}) },
        });
        review.setPrisma(mock);

        const result = await review.createReview(
          'order-1',
          'buyer-1',
          4,
          'Good service!',
        );

        expect(result.rating).toBe(4);
        expect(result.comment).toBe('Good service!');
        expect(result.reviewee_id).toBe('seller-1');
        expect(result.review_id).toMatch(/^rev_/);
      });
    });

    describe('openDispute', () => {
      it('throws ValidationError for short reason', async () => {
        await expect(
          review.openDispute('order-1', 'buyer-1', 'short'),
        ).rejects.toThrow(ValidationError);
      });

      it('throws ValidationError for non-participant', async () => {
        const mock = createMockPrisma({
          marketplaceOrder: {
            findUnique: jest.fn().mockResolvedValue({
              order_id: 'order-1',
              status: 'delivered',
              buyer_id: 'buyer-1',
              seller_id: 'seller-1',
            }),
          },
        });
        review.setPrisma(mock);
        await expect(
          review.openDispute('order-1', 'stranger', 'Some reason here'),
        ).rejects.toThrow(ValidationError);
      });

      it('opens dispute and creates council proposal', async () => {
        const mock = createMockPrisma({
          marketplaceOrder: {
            findUnique: jest.fn().mockResolvedValue({
              order_id: 'order-1',
              status: 'delivered',
              buyer_id: 'buyer-1',
              seller_id: 'seller-1',
              amount: 100,
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          marketplaceDispute: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((args) => ({
              dispute_id: `disp_${Math.random().toString(36).slice(2)}`,
              ...args.data,
            })),
          },
          proposal: { create: jest.fn().mockResolvedValue({}) },
        });
        review.setPrisma(mock);

        const result = await review.openDispute(
          'order-1',
          'buyer-1',
          'Service was not delivered as described',
          'screenshot-123',
        );

        expect(result.dispute_id).toMatch(/^disp_/);
        expect(result.status).toBe('open');
        expect(result.reason).toBe('Service was not delivered as described');
      });
    });

    describe('resolveDispute', () => {
      it('buyer_wins — refunds buyer', async () => {
        const mock = createMockPrisma({
          marketplaceDispute: {
            findUnique: jest.fn().mockResolvedValue({
              dispute_id: 'disp-1',
              order_id: 'order-1',
              status: 'open',
              opener_id: 'buyer-1',
              reason: 'Not delivered',
              order: {
                order_id: 'order-1',
                buyer_id: 'buyer-1',
                seller_id: 'seller-1',
                amount: 100,
                seller_receives: 95,
                listing_id: 'list-1',
              },
            }),
            update: jest.fn().mockImplementation(() => ({
              dispute_id: 'disp-1',
              order_id: 'order-1',
              status: 'resolved',
              opener_id: 'buyer-1',
              reason: 'Not delivered',
              created_at: new Date(),
              resolved_at: new Date(),
            })),
          },
          node: {
            findFirst: jest.fn().mockResolvedValue({ credit_balance: 400 }),
            update: jest.fn().mockResolvedValue({}),
          },
          creditTransaction: { create: jest.fn().mockResolvedValue({}) },
          marketplaceOrder: { update: jest.fn().mockResolvedValue({}) },
        });
        review.setPrisma(mock);

        const result = await review.resolveDispute('disp-1', 'buyer_wins');

        expect(result.status).toBe('resolved');
      });

      it('seller_wins — credits seller', async () => {
        const mock = createMockPrisma({
          marketplaceDispute: {
            findUnique: jest.fn().mockResolvedValue({
              dispute_id: 'disp-1',
              order_id: 'order-1',
              status: 'open',
              opener_id: 'buyer-1',
              reason: 'Quality issue',
              order: {
                order_id: 'order-1',
                buyer_id: 'buyer-1',
                seller_id: 'seller-1',
                amount: 100,
                seller_receives: 95,
                listing_id: 'list-1',
              },
            }),
            update: jest.fn().mockImplementation(() => ({
              dispute_id: 'disp-1',
              order_id: 'order-1',
              status: 'resolved',
              opener_id: 'buyer-1',
              reason: 'Quality issue',
              created_at: new Date(),
              resolved_at: new Date(),
            })),
          },
          node: {
            findFirst: jest
              .fn()
              .mockResolvedValueOnce({ credit_balance: 100 })
              .mockResolvedValueOnce({ credit_balance: 200 }),
            update: jest.fn().mockResolvedValue({}),
          },
          creditTransaction: { create: jest.fn().mockResolvedValue({}) },
          marketplaceOrder: { update: jest.fn().mockResolvedValue({}) },
          marketplaceListing: { update: jest.fn().mockResolvedValue({}) },
        });
        review.setPrisma(mock);

        const result = await review.resolveDispute('disp-1', 'seller_wins');

        expect(result.status).toBe('resolved');
      });

      it('split — divides credits equally', async () => {
        const mock = createMockPrisma({
          marketplaceDispute: {
            findUnique: jest.fn().mockResolvedValue({
              dispute_id: 'disp-1',
              order_id: 'order-1',
              status: 'open',
              opener_id: 'buyer-1',
              reason: 'Partial delivery',
              order: {
                order_id: 'order-1',
                buyer_id: 'buyer-1',
                seller_id: 'seller-1',
                amount: 100,
                seller_receives: 95,
                listing_id: 'list-1',
              },
            }),
            update: jest.fn().mockImplementation(() => ({
              dispute_id: 'disp-1',
              order_id: 'order-1',
              status: 'resolved',
              created_at: new Date(),
              resolved_at: new Date(),
            })),
          },
          node: {
            findFirst: jest.fn().mockResolvedValue({ credit_balance: 200 }),
            update: jest.fn().mockResolvedValue({}),
          },
          creditTransaction: { create: jest.fn().mockResolvedValue({}) },
          marketplaceOrder: { update: jest.fn().mockResolvedValue({}) },
        });
        review.setPrisma(mock);

        const result = await review.resolveDispute('disp-1', 'split');

        expect(result.status).toBe('resolved');
      });
    });
  });
});

// ─── Marketplace Service Entry ─────────────────────────────────────────────────

const mockMPPrisma = {
  asset: { findUnique: jest.fn() },
  node: { findFirst: jest.fn(), update: jest.fn() },
  marketplaceListing: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  marketplaceTransaction: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  creditTransaction: { create: jest.fn() },
} as any;

describe('Marketplace Service Entry', () => {
  beforeAll(() => {
    service.setPrisma(mockMPPrisma);
  });
  beforeEach(() => { jest.clearAllMocks(); });

  describe('createListing', () => {
    it('should create a listing for a published asset', async () => {
      mockMPPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1', author_id: 'node-1', status: 'published',
      } as any);
      mockMPPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 80 } as any);
      mockMPPrisma.marketplaceListing.findFirst.mockResolvedValue(null);
      mockMPPrisma.marketplaceListing.create.mockResolvedValue({
        listing_id: 'lst-1', seller_id: 'node-1', asset_id: 'asset-1',
        asset_type: 'gene', price: 100, status: 'active',
        listed_at: new Date(), expires_at: new Date(Date.now() + 86400000),
      } as any);

      const result = await service.createListing('node-1', 'asset-1', 'gene', 100);

      expect(result.listing_id).toBe('lst-1');
      expect(result.status).toBe('active');
    });

    it('should throw NotFoundError when asset not found', async () => {
      mockMPPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(service.createListing('node-1', 'nonexistent', 'gene', 100))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError when not the asset owner', async () => {
      mockMPPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1', author_id: 'node-1', status: 'published',
      } as any);

      await expect(service.createListing('node-2', 'asset-1', 'gene', 100))
        .rejects.toThrow(ForbiddenError);
    });

    it('should throw ValidationError for unpublished asset', async () => {
      mockMPPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1', author_id: 'node-1', status: 'draft',
      } as any);

      await expect(service.createListing('node-1', 'asset-1', 'gene', 100))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for price out of range', async () => {
      mockMPPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1', author_id: 'node-1', status: 'published',
      } as any);

      await expect(service.createListing('node-1', 'asset-1', 'gene', 0))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('buyListing', () => {
    it('should complete a purchase', async () => {
      mockMPPrisma.marketplaceListing.findUnique.mockResolvedValue({
        listing_id: 'lst-1', seller_id: 'node-1', asset_id: 'asset-1',
        asset_type: 'gene', price: 100, status: 'active',
        expires_at: new Date(Date.now() + 86400000),
      } as any);
      mockMPPrisma.node.findFirst
        .mockResolvedValueOnce({ node_id: 'node-2', credit_balance: 500 } as any)
        .mockResolvedValueOnce({ node_id: 'node-1', credit_balance: 100 } as any);
      mockMPPrisma.marketplaceListing.update.mockResolvedValue({} as any);
      mockMPPrisma.node.update.mockResolvedValue({} as any);
      mockMPPrisma.creditTransaction.create.mockResolvedValue({} as any);
      mockMPPrisma.marketplaceTransaction.create.mockResolvedValue({
        transaction_id: 'txn-1', listing_id: 'lst-1', seller_id: 'node-1',
        buyer_id: 'node-2', asset_id: 'asset-1', price: 100, fee: 5,
        seller_receives: 95, completed_at: new Date(),
      } as any);

      const result = await service.buyListing('node-2', 'lst-1');

      expect(result.transaction_id).toBe('txn-1');
      expect(result.price).toBe(100);
    });

    it('should throw NotFoundError when listing not found', async () => {
      mockMPPrisma.marketplaceListing.findUnique.mockResolvedValue(null);

      await expect(service.buyListing('node-2', 'nonexistent'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when listing is not active', async () => {
      mockMPPrisma.marketplaceListing.findUnique.mockResolvedValue({
        listing_id: 'lst-1', seller_id: 'node-1', status: 'sold',
        expires_at: new Date(Date.now() + 86400000),
      } as any);

      await expect(service.buyListing('node-2', 'lst-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when buyer is the seller', async () => {
      mockMPPrisma.marketplaceListing.findUnique.mockResolvedValue({
        listing_id: 'lst-1', seller_id: 'node-1', status: 'active',
        expires_at: new Date(Date.now() + 86400000),
      } as any);

      await expect(service.buyListing('node-1', 'lst-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw InsufficientCreditsError when buyer lacks funds', async () => {
      mockMPPrisma.marketplaceListing.findUnique.mockResolvedValue({
        listing_id: 'lst-1', seller_id: 'node-1', status: 'active', price: 100,
        expires_at: new Date(Date.now() + 86400000),
      } as any);
      mockMPPrisma.node.findFirst.mockResolvedValue({
        node_id: 'node-2', credit_balance: 10,
      } as any);

      await expect(service.buyListing('node-2', 'lst-1'))
        .rejects.toThrow(InsufficientCreditsError);
    });
  });

  describe('cancelListing', () => {
    it('should cancel an active listing', async () => {
      mockMPPrisma.marketplaceListing.findUnique.mockResolvedValue({
        listing_id: 'lst-1', seller_id: 'node-1', asset_id: 'asset-1',
        asset_type: 'gene', price: 100, status: 'active',
        listed_at: new Date(), expires_at: new Date(Date.now() + 86400000),
      } as any);
      mockMPPrisma.marketplaceListing.update.mockResolvedValue({
        listing_id: 'lst-1', seller_id: 'node-1', asset_id: 'asset-1',
        asset_type: 'gene', price: 100, status: 'cancelled',
        listed_at: new Date(), expires_at: new Date(Date.now() + 86400000),
      } as any);

      const result = await service.cancelListing('node-1', 'lst-1');

      expect(result.status).toBe('cancelled');
    });

    it('should throw ForbiddenError when non-seller cancels', async () => {
      mockMPPrisma.marketplaceListing.findUnique.mockResolvedValue({
        listing_id: 'lst-1', seller_id: 'node-1', status: 'active',
        expires_at: new Date(Date.now() + 86400000),
      } as any);

      await expect(service.cancelListing('node-2', 'lst-1'))
        .rejects.toThrow(ForbiddenError);
    });

    it('should throw ValidationError when listing is not active', async () => {
      mockMPPrisma.marketplaceListing.findUnique.mockResolvedValue({
        listing_id: 'lst-1', seller_id: 'node-1', status: 'sold',
        expires_at: new Date(Date.now() + 86400000),
      } as any);

      await expect(service.cancelListing('node-1', 'lst-1'))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('getListings', () => {
    it('should return paginated listings', async () => {
      const now = new Date();
      const later = new Date(Date.now() + 86400000);
      mockMPPrisma.marketplaceListing.findMany
        .mockResolvedValueOnce([
          { listing_id: 'lst-1', seller_id: 'node-1', asset_id: 'asset-1',
            asset_type: 'gene', price: 100, status: 'active',
            listed_at: now, expires_at: later },
        ])
        .mockResolvedValueOnce([]);
      // count called by Promise.all second element
      (mockMPPrisma.marketplaceListing.count as any).mockResolvedValueOnce(1);

      const result = await service.getListings();

      expect(result.items).toHaveLength(1);
    });
  });

  describe('getTransactionHistory', () => {
    it('should return transaction history', async () => {
      mockMPPrisma.marketplaceTransaction.findMany.mockResolvedValue([
        { transaction_id: 'txn-1', listing_id: 'lst-1', seller_id: 'node-1',
          buyer_id: 'node-2', asset_id: 'asset-1', price: 100, fee: 5,
          seller_receives: 95, completed_at: new Date() },
      ]);

      const result = await service.getTransactionHistory('node-1');

      expect(result).toHaveLength(1);
    });
  });
});
