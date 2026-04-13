import fastify, { type FastifyInstance } from 'fastify';
import { marketplaceRoutes } from './routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'session',
  trust_level: 'trusted',
};

const mockCreateServiceListing = jest.fn();
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
}));

jest.mock('./service.marketplace', () => ({
  ...jest.requireActual('./service.marketplace'),
  createServiceListing: (...args: unknown[]) => mockCreateServiceListing(...args),
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
    mockCreateServiceListing.mockResolvedValue({ listing_id: 'svc-1' });
    mockPurchaseService.mockResolvedValue({ purchase_id: 'pur-1' });

    const [createRes, purchaseRes] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/marketplace/listings',
        payload: {
          title: 'Review service',
          description: 'I review code',
          category: 'engineering',
          tags: ['typescript'],
          price_type: 'one_time',
          price_credits: 25,
          license_type: 'open_source',
        },
      }),
      app.inject({
        method: 'POST',
        url: '/marketplace/purchases',
        payload: {
          listing_id: 'svc-1',
        },
      }),
    ]);

    expect(createRes.statusCode).toBe(201);
    expect(purchaseRes.statusCode).toBe(201);
    expect(mockCreateServiceListing).toHaveBeenCalledWith('node-1', {
      title: 'Review service',
      description: 'I review code',
      category: 'engineering',
      tags: ['typescript'],
      price_type: 'one_time',
      price_credits: 25,
      license_type: 'open_source',
    }, prisma);
    expect(mockPurchaseService).toHaveBeenCalledWith('node-1', 'svc-1', prisma);
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
        url: '/marketplace/transactions/node-1?limit=2&offset=1',
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
    mockConfirmPurchase.mockResolvedValue({ purchase_id: 'pur-1', status: 'confirmed' });
    mockDisputePurchase.mockResolvedValue({ dispute_id: 'dis-1', purchase_id: 'pur-1', status: 'disputed' });

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
    expect(mockGetMyPurchases).toHaveBeenCalledWith('node-1', 5, 2, prisma);
    expect(mockConfirmPurchase).toHaveBeenCalledWith('node-1', 'pur-1', prisma);
    expect(mockDisputePurchase).toHaveBeenCalledWith('node-1', 'pur-1', 'Service failed', prisma);
  });

  it('passes app prisma to transaction, stats, and balance routes', async () => {
    mockGetTransactionHistory.mockResolvedValue([]);
    mockGetTransaction.mockResolvedValue({ transaction_id: 'tx-1' });
    mockGetMarketStats.mockResolvedValue({ total_listings: 1 });
    mockGetBalance.mockResolvedValue({ node_id: 'node-1', credit_balance: 100 });

    const [transactionsRes, detailRes, statsRes, balanceRes] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/marketplace/transactions?limit=4&offset=1',
      }),
      app.inject({
        method: 'GET',
        url: '/marketplace/transactions/detail/tx-1',
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
    expect(mockGetTransactionHistory).toHaveBeenCalledWith('node-1', 4, 1, prisma);
    expect(mockGetTransaction).toHaveBeenCalledWith('node-1', 'tx-1', prisma);
    expect(mockGetMarketStats).toHaveBeenCalledWith(prisma);
    expect(mockGetBalance).toHaveBeenCalledWith('node-1', prisma);
  });
});
