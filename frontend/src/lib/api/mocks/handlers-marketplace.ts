import { http, HttpResponse } from 'msw';
import { MOCK_USER_ID, delay } from './handlers';

export const mockListing = {
  listing_id: 'lst_01J8K4M6N7P9Q2R3S5T6U7V8W',
  seller_id: MOCK_USER_ID,
  asset_id: 'gene-001',
  asset_type: 'Gene',
  asset_name: 'context-window-scheduler',
  price: 150,
  status: 'active',
  listed_at: '2026-04-25T10:00:00.000Z',
  expires_at: '2026-05-25T10:00:00.000Z',
  gdi_score: 82,
  seller_name: 'DemoUser',
};

export const mockListingList = [
  mockListing,
  { ...mockListing, listing_id: 'lst_01J8K4M6N7P9Q2R3S5T6U7V9', asset_id: 'gene-002', asset_name: 'retrieval-augmented-gen', price: 250, gdi_score: 91 },
  { ...mockListing, listing_id: 'lst_01J8K4M6N7P9Q2R3S5T6U8A1', asset_id: 'capsule-001', asset_type: 'Capsule', asset_name: 'code-review-agent', price: 180, gdi_score: 78 },
  { ...mockListing, listing_id: 'lst_01J8K4M6N7P9Q2R3S5T6U8B2', asset_id: 'capsule-002', asset_type: 'Capsule', asset_name: 'security-scanner', price: 320, gdi_score: 88 },
];

export const marketplaceHandlers = [
  http.get('/api/v2/marketplace/listings', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const minPrice = url.searchParams.get('minPrice');
    const maxPrice = url.searchParams.get('maxPrice');
    const sort = url.searchParams.get('sort') || 'newest';
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    let filtered = [...mockListingList];
    if (type) filtered = filtered.filter(l => l.asset_type === type);
    if (minPrice) filtered = filtered.filter(l => l.price >= parseInt(minPrice, 10));
    if (maxPrice) filtered = filtered.filter(l => l.price <= parseInt(maxPrice, 10));

    if (sort === 'price_asc') filtered.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') filtered.sort((a, b) => b.price - a.price);
    else filtered.sort((a, b) => new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime());

    return HttpResponse.json({
      success: true,
      data: { listings: filtered.slice(offset, offset + limit), total: filtered.length },
    });
  }),
  http.get('/api/v2/marketplace/listings/:id', async ({ params }) => {
    await delay(150);
    const listing = mockListingList.find(l => l.listing_id === params.id);
    if (!listing) return HttpResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return HttpResponse.json({ success: true, data: { listing }, listing });
  }),
  http.post('/api/v2/marketplace/list', async ({ request }) => {
    await delay(300);
    const body = await request.json() as { asset_id: string; asset_type: string; price: number };
    if (!body.asset_id || !body.asset_type || !body.price) {
      return HttpResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
    }
    return HttpResponse.json({
      success: true,
      data: {
        listing_id: `lst_${Date.now().toString(36)}`,
        seller_id: MOCK_USER_ID,
        asset_id: body.asset_id,
        asset_type: body.asset_type,
        price: body.price,
        status: 'active',
        listed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  }),
  http.post('/api/v2/marketplace/buy/:listingId', async ({ params }) => {
    await delay(400);
    const listing = mockListingList.find(l => l.listing_id === params.listingId);
    if (!listing) return HttpResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return HttpResponse.json({
      success: true,
      transaction: {
        transaction_id: `txn_${Date.now().toString(36)}`,
        listing_id: listing.listing_id,
        asset_id: listing.asset_id,
        amount: listing.price,
        fee: Math.ceil(listing.price * 0.05),
        timestamp: new Date().toISOString(),
      },
      remainingCredits: 12480 - listing.price,
    });
  }),
  http.post('/api/v2/marketplace/cancel/:listingId', async ({ params }) => {
    await delay(200);
    const listing = mockListingList.find(l => l.listing_id === params.listingId);
    if (!listing) return HttpResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return HttpResponse.json({ success: true });
  }),
  http.get('/api/v2/marketplace/transactions', async () => {
    await delay(200);
    return HttpResponse.json({
      transactions: [
        { transaction_id: 'txn_1', listing_id: mockListing.listing_id, asset_id: mockListing.asset_id, amount: 150, fee: 8, timestamp: '2026-04-25T10:00:00Z' },
      ],
    });
  }),
  http.get('/api/v2/marketplace/purchases', async () => {
    await delay(200);
    return HttpResponse.json({
      purchases: [
        { purchase_id: 'pur_1', asset_id: 'gene-001', asset_name: 'context-window-scheduler', purchased_at: '2026-04-25T10:00:00Z' },
      ],
    });
  }),
  http.get('/api/v2/marketplace/my-listings', async () => {
    await delay(200);
    return HttpResponse.json({
      listings: mockListingList.filter(l => l.seller_id === MOCK_USER_ID),
    });
  }),
];
