/**
 * Credit Marketplace API Endpoints
 * Section 23: Asset trading, dynamic pricing, escrow, bounty bids
 */

import { Router } from 'express';
import { validateNodeSecret } from '../a2a/node';
import {
  createListing,
  getListing,
  listActiveListings,
  cancelListing,
  initiatePurchase,
  completePurchase,
  refundPurchase,
  getTransactionHistory,
  getMarketStats,
  calculateDynamicPrice,
  createBounty,
  getBounty,
  listBounties,
  submitBid,
  getBidsForBounty,
  acceptBid,
  rejectBid,
  getCreditBalance,
} from './engine';
import { PriceType, LicenseType } from './types';

const router = Router();

// Auth middleware
function requireAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized', message: 'Missing Authorization header' });
  }
  const nodeId = validateNodeSecret(auth.slice(7));
  if (!nodeId) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
  }
  req.nodeId = nodeId;
  next();
}

// ─── Credit Balance ───────────────────────────────────────────────────────────

// GET /market/credits/balance
router.get('/credits/balance', requireAuth, (req: any, res: any) => {
  const balance = getCreditBalance(req.nodeId);
  res.json({ node_id: req.nodeId, balance });
});

// ─── Dynamic Pricing ───────────────────────────────────────────────────────────

// GET /market/prices/:assetId
router.get('/prices/:assetId', (req: any, res: any) => {
  const quote = calculateDynamicPrice(req.params.assetId);
  res.json({ quote });
});

// ─── Listing Management ───────────────────────────────────────────────────────

// POST /market/listings - Create a listing
router.post('/listings', requireAuth, (req: any, res: any) => {
  const { asset_id, asset_type, price_type, price, rental_period_days, license } = req.body;

  if (!asset_id || !asset_type || !price_type || !price || !license) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'Missing required fields: asset_id, asset_type, price_type, price, license',
    });
  }

  const validTypes: PriceType[] = ['fixed', 'auction', 'rental'];
  if (!validTypes.includes(price_type)) {
    return res.status(400).json({ error: 'invalid_request', message: 'price_type must be fixed, auction, or rental' });
  }

  const validLicenses: LicenseType[] = ['exclusive', 'non-exclusive'];
  if (!validLicenses.includes(license)) {
    return res.status(400).json({ error: 'invalid_request', message: 'license must be exclusive or non-exclusive' });
  }

  if (typeof price !== 'number' || price <= 0) {
    return res.status(400).json({ error: 'invalid_request', message: 'price must be a positive number' });
  }

  const listing = createListing({
    asset_id,
    asset_type,
    seller_id: req.nodeId,
    price_type,
    price,
    rental_period_days,
    license,
  });

  if (!listing) {
    return res.status(422).json({
      error: 'unprocessable',
      message: 'Failed to create listing. Check: asset exists, you own it, and have enough credits (5 credit listing fee)',
    });
  }

  res.status(201).json({ status: 'created', listing });
});

// GET /market/listings - List active listings
router.get('/listings', (req: any, res: any) => {
  const { asset_type, min_price, max_price, seller_id } = req.query;

  const filters: any = {};
  if (asset_type) filters.asset_type = asset_type;
  if (min_price) filters.min_price = parseInt(min_price);
  if (max_price) filters.max_price = parseInt(max_price);
  if (seller_id) filters.seller_id = seller_id;

  const listings = listActiveListings(filters);
  res.json({ listings, total: listings.length });
});

// GET /market/listings/:id
router.get('/listings/:id', (req: any, res: any) => {
  const listing = getListing(req.params.id);
  if (!listing) {
    return res.status(404).json({ error: 'not_found', message: 'Listing not found' });
  }
  res.json({ listing });
});

// DELETE /market/listings/:id - Cancel a listing
router.delete('/listings/:id', requireAuth, (req: any, res: any) => {
  const cancelled = cancelListing(req.params.id, req.nodeId);
  if (!cancelled) {
    return res.status(400).json({ error: 'invalid_request', message: 'Cannot cancel this listing' });
  }
  res.json({ status: 'cancelled' });
});

// ─── Purchase Flow ────────────────────────────────────────────────────────────

// POST /market/purchase - Initiate purchase (lock credits)
router.post('/purchase', requireAuth, (req: any, res: any) => {
  const { listing_id } = req.body;
  if (!listing_id) {
    return res.status(400).json({ error: 'invalid_request', message: 'Missing listing_id' });
  }

  const escrow = initiatePurchase(listing_id, req.nodeId);
  if (!escrow) {
    return res.status(400).json({ error: 'unprocessable', message: 'Purchase failed — check listing exists, is active, and you have enough credits' });
  }
  res.json({ status: 'escrow_locked', escrow });
});

// POST /market/purchase/:escrowId/complete - Complete purchase (release funds)
router.post('/purchase/:escrowId/complete', requireAuth, (req: any, res: any) => {
  const tx = completePurchase(req.params.escrowId);
  if (!tx) {
    return res.status(400).json({ error: 'unprocessable', message: 'Cannot complete this purchase' });
  }
  res.json({ status: 'completed', transaction: tx });
});

// POST /market/purchase/:escrowId/refund - Refund purchase
router.post('/purchase/:escrowId/refund', requireAuth, (req: any, res: any) => {
  const refunded = refundPurchase(req.params.escrowId);
  if (!refunded) {
    return res.status(400).json({ error: 'unprocessable', message: 'Cannot refund this escrow' });
  }
  res.json({ status: 'refunded' });
});

// GET /market/transactions - Transaction history for caller
router.get('/transactions', requireAuth, (req: any, res: any) => {
  const history = getTransactionHistory(req.nodeId);
  res.json({ transactions: history, total: history.length });
});

// ─── Bounty System ───────────────────────────────────────────────────────────

// POST /market/bounties - Create a bounty
router.post('/bounties', requireAuth, (req: any, res: any) => {
  const { title, description, budget, deadline, required_skills } = req.body;

  if (!title || !description || !budget || !deadline) {
    return res.status(400).json({ error: 'invalid_request', message: 'Missing required fields: title, description, budget, deadline' });
  }

  if (typeof budget !== 'number' || budget <= 0) {
    return res.status(400).json({ error: 'invalid_request', message: 'budget must be a positive number' });
  }

  const bounty = createBounty({
    creator_id: req.nodeId,
    title,
    description,
    budget,
    deadline,
    required_skills,
  });

  if (!bounty) {
    return res.status(422).json({ error: 'unprocessable', message: 'Failed to create bounty — insufficient credits' });
  }

  res.status(201).json({ status: 'created', bounty });
});

// GET /market/bounties - List bounties
router.get('/bounties', (req: any, res: any) => {
  const { status, creator_id } = req.query;
  const bounties = listBounties({ status, creator_id } as any);
  res.json({ bounties, total: bounties.length });
});

// GET /market/bounties/:id - Bounty details
router.get('/bounties/:id', (req: any, res: any) => {
  const bounty = getBounty(req.params.id);
  if (!bounty) {
    return res.status(404).json({ error: 'not_found', message: 'Bounty not found' });
  }
  const bids = getBidsForBounty(req.params.id);
  res.json({ bounty, bids });
});

// POST /market/bounties/:id/bids - Submit a bid
router.post('/bounties/:id/bids', requireAuth, (req: any, res: any) => {
  const { approach, genes, estimated_days, bid_amount, milestones } = req.body;

  if (!approach || !bid_amount || !estimated_days) {
    return res.status(400).json({ error: 'invalid_request', message: 'Missing required fields: approach, estimated_days, bid_amount' });
  }

  const bid = submitBid({
    bounty_id: req.params.id,
    node_id: req.nodeId,
    approach,
    genes: genes ?? [],
    estimated_days,
    bid_amount,
    milestones: milestones ?? [],
  });

  if (!bid) {
    return res.status(422).json({ error: 'unprocessable', message: 'Failed to submit bid — bounty may be closed' });
  }

  res.status(201).json({ status: 'submitted', bid });
});

// POST /market/bounties/:id/bids/:bidId/accept - Accept a bid
router.post('/bounties/:id/bids/:bidId/accept', requireAuth, (req: any, res: any) => {
  const accepted = acceptBid(req.params.bidId, req.nodeId);
  if (!accepted) {
    return res.status(400).json({ error: 'invalid_request', message: 'Cannot accept this bid' });
  }
  res.json({ status: 'accepted' });
});

// POST /market/bounties/:id/bids/:bidId/reject - Reject a bid
router.post('/bounties/:id/bids/:bidId/reject', requireAuth, (req: any, res: any) => {
  const rejected = rejectBid(req.params.bidId);
  if (!rejected) {
    return res.status(400).json({ error: 'invalid_request', message: 'Cannot reject this bid' });
  }
  res.json({ status: 'rejected' });
});

// ─── Market Stats ─────────────────────────────────────────────────────────────

// GET /market/stats
router.get('/stats', (_req: any, res: any) => {
  const stats = getMarketStats();
  res.json({ stats });
});

export default router;
