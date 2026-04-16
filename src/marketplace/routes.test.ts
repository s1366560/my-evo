import fastify, { type FastifyInstance } from 'fastify';
import { marketplaceRoutes } from './routes';
import { QuarantineError } from '../shared/errors';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'session',
  trust_level: 'trusted',
};
let mockQuarantineLevel: string | null = null;

const mockCreateServiceListing = jest.fn();
const mockSearchServiceListings = jest.fn();
const mockGetServiceListing = jest.fn();
const mockUpdateServiceListing = jest.fn();
const mockCancelServiceListing = jest.fn();
const mockPurchaseService = jest.fn();
const mockGetMyPurchases = jest.fn();
const mockConfirmPurchase = jest.fn();
const mockDisputePurchase = jest.fn();
const mockGetTransactionHistory = jest.fn();
const mockGetTransaction = jest.fn();
const mockGetMarketStats = jest.fn();
const mockGetBalance = jest.fn();
const mockCreateListing = jest.fn();
const mockBuyListing = jest.fn();
const mockCancelListing = jest.fn();
const mockGetListings = jest.fn();
const mockGetLegacyTransactionHistory = jest.fn();
const mockCalculateDynamicPrice = jest.fn();

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (
    request: {
      auth?: {
        node_id: string;
        auth_type?: string;
        trust_level?: string;
      };
    },
  ) => {
    request.auth = mockAuth;
  },
  requireNoActiveQuarantine: () => async () => {
    if (mockQuarantineLevel) {
      throw new QuarantineError(mockQuarantineLevel);
    }
  },
}));

jest.mock('./service.marketplace', () => ({
  ...jest.requireActual('./service.marketplace'),
  createServiceListing: (...args: unknown[]) => mockCreateServiceListing(...args),
  searchServiceListings: (...args: unknown[]) => mockSearchServiceListings(...args),
  getServiceListing: (...args: unknown[]) => mockGetServiceListing(...args),
  updateServiceListing: (...args: unknown[]) => mockUpdateServiceListing(...args),
  cancelServiceListing: (...args: unknown[]) => mockCancelServiceListing(...args),
  purchaseService: (...args: unknown[]) => mockPurchaseService(...args),
  getMyPurchases: (...args: unknown[]) => mockGetMyPurchases(...args),
  confirmPurchase: (...args: unknown[]) => mockConfirmPurchase(...args),
  disputePurchase: (...args: unknown[]) => mockDisputePurchase(...args),
  getTransactionHistory: (...args: unknown[]) => mockGetTransactionHistory(...args),
  getTransaction: (...args: unknown[]) => mockGetTransaction(...args),
  getMarketStats: (...args: unknown[]) => mockGetMarketStats(...args),
  getBalance: (...args: unknown[]) => mockGetBalance(...args),
}));

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  createListing: (...args: unknown[]) => mockCreateListing(...args),
  buyListing: (...args: unknown[]) => mockBuyListing(...args),
  cancelListing: (...args: unknown[]) => mockCancelListing(...args),
  getListings: (...args: unknown[]) => mockGetListings(...args),
  getTransactionHistory: (...args: unknown[]) => mockGetLegacyTransactionHistory(...args),
}));

jest.mock('./pricing', () => ({
  ...jest.requireActual('./pricing'),
  calculateDynamicPrice: (...args: unknown[]) => mockCalculateDynamicPrice(...args),
}));

function buildApp(prisma: unknown): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', prisma as any);
  return app;
}

describe('Marketplace routes', () => {
  let app: FastifyInstance;
  let prisma: { marker: string };

  beforeEach(async () => {
    mockQuarantineLevel = null;
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'session',
      trust_level: 'trusted',
    };
    prisma = { marker: 'marketplace-prisma' };
    app = buildApp(prisma);
    await app.register(marketplaceRoutes, { prefix: '/marketplace' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('passes app prisma to listing creation and purchase routes', async () => {
    mockCreateServiceListing.mockResolvedValue({ listing_id: 'listing_1' });
    mockPurchaseService.mockResolvedValue({
      purchase_id: 'pur-1',
      transaction_id: 'tx-1',
      listing_id: 'listing_1',
      amount: 25,
      escrow: {
        escrow_id: 'escrow_1',
        amount: 25,
        status: 'locked',
        locked_at: '2026-01-01T00:00:00Z',
      },
      status: 'pending',
    });

    const [createRes, purchaseRes] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/marketplace/listings',
        payload: {
          title: 'Review service',
          description: 'I review code',
          category: 'engineering',
          tags: ['typescript'],
          price_type: 'fixed',
          price_credits: 25,
          license_type: 'non-exclusive',
        },
      }),
      app.inject({
        method: 'POST',
        url: '/marketplace/purchases',
        payload: {
          listing_id: 'listing_1',
        },
      }),
    ]);

    expect(createRes.statusCode).toBe(201);
    expect(purchaseRes.statusCode).toBe(201);
    expect(JSON.parse(createRes.payload)).toMatchObject({
      listing_fee_charged: 5,
      message: 'Service listed successfully.',
    });
    expect(JSON.parse(purchaseRes.payload)).toMatchObject({
      transaction_id: 'tx-1',
      amount: 25,
      escrow: {
        escrow_id: 'escrow_1',
        amount: 25,
        status: 'locked',
      },
      status: 'pending',
      message: 'Payment locked in escrow. Seller has been notified.',
    });
    expect(mockCreateServiceListing).toHaveBeenCalledWith('node-1', {
      title: 'Review service',
      description: 'I review code',
      category: 'engineering',
      tags: ['typescript'],
      price_type: 'fixed',
      price_credits: 25,
      license_type: 'non-exclusive',
    }, prisma);
    expect(mockPurchaseService).toHaveBeenCalledWith('node-1', 'listing_1', prisma);
  });

  it('blocks listing creation when the node is quarantined', async () => {
    mockQuarantineLevel = 'L2';

    const response = await app.inject({
      method: 'POST',
      url: '/marketplace/listings',
      payload: {
        title: 'Review service',
        description: 'I review code',
        category: 'engineering',
        price_type: 'one_time',
        price_credits: 25,
        license_type: 'open_source',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.payload).message).toContain('quarantine');
    expect(mockCreateServiceListing).not.toHaveBeenCalled();
  });

  it('blocks purchases when the node is quarantined', async () => {
    mockQuarantineLevel = 'L1';

    const response = await app.inject({
      method: 'POST',
      url: '/marketplace/purchases',
      payload: {
        listing_id: 'svc-1',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.payload).message).toContain('quarantine');
    expect(mockPurchaseService).not.toHaveBeenCalled();
  });

  it('passes app prisma to legacy marketplace routes', async () => {
    mockCreateListing.mockResolvedValue({ listing_id: 'legacy-1' });
    mockBuyListing.mockResolvedValue({ transaction_id: 'tx-legacy' });
    mockCancelListing.mockResolvedValue({ listing_id: 'legacy-1', status: 'cancelled' });
    mockGetListings.mockResolvedValue({ items: [], total: 0 });
    mockGetLegacyTransactionHistory.mockResolvedValue([]);

    const [createRes, buyRes, cancelRes, listRes, historyRes] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/marketplace/list',
        payload: {
          asset_id: 'asset-1',
          asset_type: 'Gene',
          price: 10,
        },
      }),
      app.inject({
        method: 'POST',
        url: '/marketplace/buy/listing-1',
      }),
      app.inject({
        method: 'POST',
        url: '/marketplace/cancel/listing-1',
      }),
      app.inject({
        method: 'GET',
        url: '/marketplace/listings?type=Gene&minPrice=5&maxPrice=20&sort=price_desc&limit=3&offset=1',
      }),
      app.inject({
        method: 'GET',
        url: '/marketplace/transactions/history/node-1?limit=2&offset=1',
      }),
    ]);

    expect(createRes.statusCode).toBe(201);
    expect(buyRes.statusCode).toBe(200);
    expect(cancelRes.statusCode).toBe(200);
    expect(listRes.statusCode).toBe(200);
    expect(historyRes.statusCode).toBe(200);
    expect(mockCreateListing).toHaveBeenCalledWith('node-1', 'asset-1', 'Gene', 10, prisma);
    expect(mockBuyListing).toHaveBeenCalledWith('node-1', 'listing-1', prisma);
    expect(mockCancelListing).toHaveBeenCalledWith('node-1', 'listing-1', prisma);
    expect(mockGetListings).toHaveBeenCalledWith('Gene', 5, 20, 'price_desc', 3, 1, prisma);
    expect(mockGetLegacyTransactionHistory).toHaveBeenCalledWith('node-1', 2, 1, prisma);
  });

  it('routes service-listing reads and writes through the canonical marketplace endpoints', async () => {
    mockSearchServiceListings.mockResolvedValue({ items: [{ listing_id: 'listing_1' }], total: 1 });
    mockGetServiceListing.mockResolvedValue({ listing_id: 'listing_1', stats: { purchases: 2 } });
    mockUpdateServiceListing.mockResolvedValue({ listing_id: 'listing_1', status: 'active' });
    mockCancelServiceListing.mockResolvedValue({ listing_id: 'listing_1', status: 'cancelled' });

    const [searchRes, detailRes, updateRes, cancelRes] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/marketplace/listings?q=review&category=engineering&limit=5&offset=1&include_inactive=true',
      }),
      app.inject({
        method: 'GET',
        url: '/marketplace/listings/listing_1',
      }),
      app.inject({
        method: 'PUT',
        url: '/marketplace/listings/listing_1',
        payload: {
          title: 'Updated title',
          price_type: 'auction',
          price_credits: 90,
          license_type: 'exclusive',
        },
      }),
      app.inject({
        method: 'POST',
        url: '/marketplace/listings/listing_1/cancel',
      }),
    ]);

    expect(searchRes.statusCode).toBe(200);
    expect(detailRes.statusCode).toBe(200);
    expect(updateRes.statusCode).toBe(200);
    expect(cancelRes.statusCode).toBe(200);
    expect(mockSearchServiceListings).toHaveBeenCalledWith({
      query: 'review',
      category: 'engineering',
      include_inactive: true,
      limit: 5,
      offset: 1,
    }, prisma);
    expect(mockGetServiceListing).toHaveBeenCalledWith('listing_1', prisma);
    expect(mockUpdateServiceListing).toHaveBeenCalledWith('node-1', 'listing_1', {
      title: 'Updated title',
      price_type: 'auction',
      price_credits: 90,
      license_type: 'exclusive',
    }, prisma);
    expect(mockCancelServiceListing).toHaveBeenCalledWith('node-1', 'listing_1', prisma);
  });

  it('passes app prisma to marketplace pricing routes', async () => {
    mockCalculateDynamicPrice.mockResolvedValue({
      price: 123,
      breakdown: {
        basePrice: 100,
        gdiFactor: 1.2,
        demandFactor: 1.1,
        scarcityFactor: 0.8,
        assetGdi: 60,
        networkAvgGdi: 50,
        fetchCount: 10,
        similarCount: 2,
      },
    });

    const [pricingRes, aliasRes] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/marketplace/pricing/listing-1',
      }),
      app.inject({
        method: 'GET',
        url: '/marketplace/calculate-price/listing-1',
      }),
    ]);

    expect(pricingRes.statusCode).toBe(200);
    expect(aliasRes.statusCode).toBe(200);
    expect(mockCalculateDynamicPrice).toHaveBeenNthCalledWith(1, 'listing-1', prisma);
    expect(mockCalculateDynamicPrice).toHaveBeenNthCalledWith(2, 'listing-1', prisma);
  });

  it('passes app prisma to purchase lifecycle routes', async () => {
    mockGetMyPurchases.mockResolvedValue({ items: [], total: 0 });
    mockConfirmPurchase.mockResolvedValue({
      purchase_id: 'pur-1',
      transaction_id: 'tx-1',
      amount: 200,
      status: 'confirmed',
      escrow: {
        escrow_id: 'escrow_pur-1',
        amount: 200,
        status: 'released',
      },
    });
    mockDisputePurchase.mockResolvedValue({
      dispute_id: 'dis-1',
      purchase_id: 'pur-1',
      transaction_id: 'tx-1',
      amount: 200,
      status: 'disputed',
      escrow: {
        escrow_id: 'escrow_pur-1',
        amount: 200,
        status: 'locked',
      },
    });

    const [listRes, confirmRes, disputeRes] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/marketplace/purchases?limit=5&offset=2',
      }),
      app.inject({
        method: 'POST',
        url: '/marketplace/purchases/pur-1/confirm',
      }),
      app.inject({
        method: 'POST',
        url: '/marketplace/purchases/pur-1/dispute',
        payload: {
          reason: 'Service failed',
        },
      }),
    ]);

    expect(listRes.statusCode).toBe(200);
    expect(confirmRes.statusCode).toBe(200);
    expect(disputeRes.statusCode).toBe(201);
    expect(JSON.parse(confirmRes.payload)).toMatchObject({
      transaction_id: 'tx-1',
      purchase_id: 'pur-1',
      amount: 200,
      status: 'confirmed',
      escrow: {
        escrow_id: 'escrow_pur-1',
        status: 'released',
      },
      message: 'Escrow released to seller. Purchase confirmed.',
    });
    expect(JSON.parse(disputeRes.payload)).toMatchObject({
      transaction_id: 'tx-1',
      purchase_id: 'pur-1',
      amount: 200,
      status: 'disputed',
      escrow: {
        escrow_id: 'escrow_pur-1',
        status: 'locked',
      },
      message: 'Dispute opened. Funds remain locked until resolution.',
    });
    expect(mockGetMyPurchases).toHaveBeenCalledWith('node-1', 5, 2, prisma);
    expect(mockConfirmPurchase).toHaveBeenCalledWith('node-1', 'pur-1', prisma);
    expect(mockDisputePurchase).toHaveBeenCalledWith('node-1', 'pur-1', 'Service failed', prisma);
  });

  it('passes app prisma to transaction, stats, and balance routes', async () => {
    mockGetTransactionHistory.mockResolvedValue([]);
    mockGetTransaction.mockResolvedValue({
      transaction_id: 'tx-1',
      amount: 200,
      platform_fee: 10,
      seller_revenue: 190,
      status: 'completed',
      escrow: {
        escrow_id: 'escrow_tx-1',
        amount: 200,
        status: 'released',
        locked_at: '2026-01-02T00:00:00Z',
      },
    });
    mockGetMarketStats.mockResolvedValue({
      total_listings: 1,
      total_volume_credits: 250,
      average_price: 125,
      price_tiers: { budget: 0, standard: 1, premium: 0, elite: 0 },
      bounties: { total: 2, open: 1, completed: 1, cancelled: 0 },
    });
    mockGetBalance.mockResolvedValue({ node_id: 'node-1', credit_balance: 100 });

    const [transactionsRes, detailRes, statsRes, balanceRes] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/marketplace/transactions?limit=4&offset=1',
      }),
      app.inject({
        method: 'GET',
        url: '/marketplace/transactions/tx-1',
      }),
      app.inject({
        method: 'GET',
        url: '/marketplace/stats',
      }),
      app.inject({
        method: 'GET',
        url: '/marketplace/balance',
      }),
    ]);

    expect(transactionsRes.statusCode).toBe(200);
    expect(detailRes.statusCode).toBe(200);
    expect(statsRes.statusCode).toBe(200);
    expect(balanceRes.statusCode).toBe(200);
    expect(JSON.parse(detailRes.payload)).toMatchObject({
      success: true,
      data: {
        transaction_id: 'tx-1',
        amount: 200,
        platform_fee: 10,
        seller_revenue: 190,
        status: 'completed',
        escrow: {
          escrow_id: 'escrow_tx-1',
          status: 'released',
        },
      },
    });
    expect(JSON.parse(statsRes.payload)).toEqual({
      success: true,
      data: {
        total_listings: 1,
        total_volume_credits: 250,
        average_price: 125,
        price_tiers: { budget: 0, standard: 1, premium: 0, elite: 0 },
        bounties: { total: 2, open: 1, completed: 1, cancelled: 0 },
      },
    });
    expect(JSON.parse(detailRes.payload)).toEqual({
      success: true,
      data: {
        transaction_id: 'tx-1',
        amount: 200,
        platform_fee: 10,
        seller_revenue: 190,
        status: 'completed',
        escrow: {
          escrow_id: 'escrow_tx-1',
          amount: 200,
          status: 'released',
          locked_at: '2026-01-02T00:00:00Z',
        },
      },
    });
    expect(mockGetTransactionHistory).toHaveBeenCalledWith('node-1', 4, 1, prisma);
    expect(mockGetTransaction).toHaveBeenCalledWith('node-1', 'tx-1', prisma);
    expect(mockGetMarketStats).toHaveBeenCalledWith(prisma);
    expect(mockGetBalance).toHaveBeenCalledWith('node-1', prisma);
  });
});
