import crypto from 'crypto';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
  ForbiddenError,
} from '../shared/errors';

// ─── Prisma singleton ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _prisma: any = null;

export function setPrisma(client: unknown): void {
  _prisma = client;
}

function db() {
  if (!_prisma) {
    throw new Error('Prisma client not initialized. Call setPrisma().');
  }
  return _prisma;
}

// ─── Auction types ──────────────────────────────────────────────────────────────

export type AuctionStatus = 'active' | 'extended' | 'finalized' | 'cancelled';

export interface Auction {
  auction_id: string;
  listing_id: string;
  seller_id: string;
  starting_price: number;
  current_price: number;
  reserve_price?: number;
  status: AuctionStatus;
  winner_id?: string;
  bid_count: number;
  start_time: string;
  end_time: string;
  extended_until?: string;
  created_at: string;
}

export interface Bid {
  bid_id: string;
  auction_id: string;
  bidder_id: string;
  amount: number;
  created_at: string;
}

// ─── createAuction ─────────────────────────────────────────────────────────────

/**
 * Creates an auction listing with a starting price and duration (minutes).
 * Seller's listing is reserved exclusively for the auction.
 */
export async function createAuction(
  sellerId: string,
  listingId: string,
  startingPrice: number,
  durationMinutes = 60,
  reservePrice?: number,
): Promise<Auction> {
  const listing = await db().marketplaceListing.findUnique({
    where: { listing_id: listingId },
  });

  if (!listing) {
    throw new NotFoundError('Listing', listingId);
  }

  if (listing.seller_id !== sellerId) {
    throw new ForbiddenError('Only the listing owner can create an auction');
  }

  if (listing.status !== 'active') {
    throw new ValidationError('Cannot auction a non-active listing');
  }

  if (startingPrice <= 0) {
    throw new ValidationError('Starting price must be positive');
  }

  const auctionId = `auct_${crypto.randomUUID()}`;
  const now = new Date();
  const endTime = new Date(now.getTime() + durationMinutes * 60 * 1000);

  const auction = await db().marketplaceAuction.create({
    data: {
      auction_id: auctionId,
      listing_id: listingId,
      seller_id: sellerId,
      starting_price: startingPrice,
      current_price: startingPrice,
      reserve_price: reservePrice,
      status: 'active',
      bid_count: 0,
      start_time: now,
      end_time: endTime,
    },
  });

  return _toAuction(auction);
}

// ─── placeBid ─────────────────────────────────────────────────────────────────

/**
 * Places a bid on an active auction.
 * Bid must exceed current price by at least 1 credit.
 * The bidder's credits are locked for the bid amount.
 */
export async function placeBid(
  auctionId: string,
  bidderId: string,
  amount: number,
): Promise<Bid & { auction: Auction }> {
  const auction = await db().marketplaceAuction.findUnique({
    where: { auction_id: auctionId },
  });

  if (!auction) {
    throw new NotFoundError('Auction', auctionId);
  }

  if (auction.status !== 'active' && auction.status !== 'extended') {
    throw new ValidationError(`Auction is not accepting bids: ${auction.status}`);
  }

  if (new Date(auction.end_time) < new Date()) {
    throw new ValidationError('Auction has ended');
  }

  if (auction.seller_id === bidderId) {
    throw new ValidationError('Seller cannot bid on their own auction');
  }

  if (amount <= auction.current_price) {
    throw new ValidationError(
      `Bid must exceed current price of ${auction.current_price}`,
    );
  }

  const bidder = await db().node.findFirst({
    where: { node_id: bidderId },
  });

  if (!bidder) {
    throw new NotFoundError('Bidder node', bidderId);
  }

  if ((bidder.credit_balance ?? 0) < amount) {
    throw new InsufficientCreditsError(amount, bidder.credit_balance ?? 0);
  }

  const bidId = `bid_${crypto.randomUUID()}`;
  const now = new Date();

  const bid = await db().marketplaceBid.create({
    data: {
      bid_id: bidId,
      auction_id: auctionId,
      bidder_id: bidderId,
      amount,
      created_at: now,
    },
  });

  await db().marketplaceAuction.update({
    where: { auction_id: auctionId },
    data: {
      current_price: amount,
      bid_count: { increment: 1 },
    },
  });

  return {
    bid_id: bid.bid_id,
    auction_id: bid.auction_id,
    bidder_id: bid.bidder_id,
    amount: bid.amount,
    created_at: now.toISOString(),
    auction: _toAuction(auction),
  };
}

// ─── extendAuction ─────────────────────────────────────────────────────────────

/**
 * Extends auction end time when a bid is placed in the last 5 minutes.
 * Extension adds 5 minutes to the current end time.
 * Maximum 3 extensions per auction.
 */
export async function extendAuction(
  auctionId: string,
  additionalMinutes = 5,
): Promise<Auction> {
  const auction = await db().marketplaceAuction.findUnique({
    where: { auction_id: auctionId },
  });

  if (!auction) {
    throw new NotFoundError('Auction', auctionId);
  }

  if (auction.status === 'finalized' || auction.status === 'cancelled') {
    throw new ValidationError('Cannot extend a finalized or cancelled auction');
  }

  const maxExtensions = 3;
  const currentExtensions = (auction.extended_count ?? 0);

  if (currentExtensions >= maxExtensions) {
    throw new ValidationError(
      `Maximum extensions (${maxExtensions}) reached for this auction`,
    );
  }

  const newEndTime = new Date(
    new Date(auction.end_time).getTime() + additionalMinutes * 60 * 1000,
  );

  const updated = await db().marketplaceAuction.update({
    where: { auction_id: auctionId },
    data: {
      end_time: newEndTime,
      status: 'extended',
      extended_count: { increment: 1 },
      extended_until: newEndTime,
    },
  });

  return _toAuction(updated);
}

// ─── finalizeAuction ───────────────────────────────────────────────────────────

/**
 * Finalizes the auction, transferring credits to seller and asset to winner.
 * If no bids were placed, the listing is restored to active.
 * If reserve price is set and not met, highest bidder still wins (reserve is
 * informational only per spec).
 */
export async function finalizeAuction(
  auctionId: string,
): Promise<Auction> {
  const auction = await db().marketplaceAuction.findUnique({
    where: { auction_id: auctionId },
    include: { bids: { orderBy: { amount: 'desc' }, take: 1 } },
  });

  if (!auction) {
    throw new NotFoundError('Auction', auctionId);
  }

  if (auction.status === 'finalized') {
    throw new ValidationError('Auction already finalized');
  }

  if (auction.status === 'cancelled') {
    throw new ValidationError('Cannot finalize a cancelled auction');
  }

  const winningBid = auction.bids[0];

  if (!winningBid) {
    // No bids — restore listing to active
    await db().marketplaceListing.update({
      where: { listing_id: auction.listing_id },
      data: { status: 'active' },
    });
  } else {
    const fee = Math.ceil(winningBid.amount * 0.05);
    const sellerReceives = winningBid.amount - fee;

    // Deduct from winner
    const winner = await db().node.findFirst({
      where: { node_id: winningBid.bidder_id },
    });

    await db().node.update({
      where: { node_id: winningBid.bidder_id },
      data: { credit_balance: { decrement: winningBid.amount } },
    });

    await db().creditTransaction.create({
      data: {
        node_id: winningBid.bidder_id,
        amount: -winningBid.amount,
        type: 'marketplace_buy',
        description: `Auction win: ${auctionId}`,
        balance_after: (winner?.credit_balance ?? 0) - winningBid.amount,
      },
    });

    // Credit seller
    const seller = await db().node.findFirst({
      where: { node_id: auction.seller_id },
    });

    await db().node.update({
      where: { node_id: auction.seller_id },
      data: { credit_balance: { increment: sellerReceives } },
    });

    await db().creditTransaction.create({
      data: {
        node_id: auction.seller_id,
        amount: sellerReceives,
        type: 'marketplace_sale',
        description: `Auction sale: ${auctionId}`,
        balance_after: (seller?.credit_balance ?? 0) + sellerReceives,
      },
    });

    // Mark listing as sold
    await db().marketplaceListing.update({
      where: { listing_id: auction.listing_id },
      data: {
        status: 'sold',
        buyer_id: winningBid.bidder_id,
        sold_at: new Date(),
      },
    });
  }

  const updated = await db().marketplaceAuction.update({
    where: { auction_id: auctionId },
    data: {
      status: 'finalized',
      winner_id: winningBid?.bidder_id,
      current_price: winningBid?.amount ?? auction.current_price,
    },
  });

  return _toAuction(updated);
}

// ─── getAuctionStatus ─────────────────────────────────────────────────────────

export async function getAuctionStatus(
  auctionId: string,
): Promise<Auction & { top_bid?: Bid }> {
  const auction = await db().marketplaceAuction.findUnique({
    where: { auction_id: auctionId },
    include: {
      bids: { orderBy: { amount: 'desc' }, take: 1 },
    },
  });

  if (!auction) {
    throw new NotFoundError('Auction', auctionId);
  }

  const topBid = auction.bids[0];

  return {
    ..._toAuction(auction),
    top_bid: topBid
      ? {
          bid_id: topBid.bid_id,
          auction_id: topBid.auction_id,
          bidder_id: topBid.bidder_id,
          amount: topBid.amount,
          created_at: new Date(topBid.created_at).toISOString(),
        }
      : undefined,
  };
}

// ─── cancelAuction ─────────────────────────────────────────────────────────────

export async function cancelAuction(
  auctionId: string,
  sellerId: string,
): Promise<Auction> {
  const auction = await db().marketplaceAuction.findUnique({
    where: { auction_id: auctionId },
  });

  if (!auction) {
    throw new NotFoundError('Auction', auctionId);
  }

  if (auction.seller_id !== sellerId) {
    throw new ForbiddenError('Only the auction owner can cancel it');
  }

  if (auction.status === 'finalized') {
    throw new ValidationError('Cannot cancel a finalized auction');
  }

  // Refund all bids
  const bids = await db().marketplaceBid.findMany({
    where: { auction_id: auctionId },
  });

  await Promise.all(
    bids.map(async (b: { bidder_id: string; amount: number; bid_id: string }) => {
      const bidder = await db().node.findFirst({
        where: { node_id: b.bidder_id },
      });

      await db().node.update({
        where: { node_id: b.bidder_id },
        data: { credit_balance: { increment: b.amount } },
      });

      await db().creditTransaction.create({
        data: {
          node_id: b.bidder_id,
          amount: b.amount,
          type: 'bounty_refund',
          description: `Auction cancelled refund: bid ${b.bid_id}`,
          balance_after: (bidder?.credit_balance ?? 0) + b.amount,
        },
      });
    }),
  );

  // Restore listing
  await db().marketplaceListing.update({
    where: { listing_id: auction.listing_id },
    data: { status: 'active' },
  });

  const updated = await db().marketplaceAuction.update({
    where: { auction_id: auctionId },
    data: { status: 'cancelled' },
  });

  return _toAuction(updated);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _toAuction(r: Record<string, unknown>): Auction {
  return {
    auction_id: r['auction_id'] as string,
    listing_id: r['listing_id'] as string,
    seller_id: r['seller_id'] as string,
    starting_price: r['starting_price'] as number,
    current_price: r['current_price'] as number,
    reserve_price: r['reserve_price'] as number | undefined,
    status: r['status'] as AuctionStatus,
    winner_id: r['winner_id'] as string | undefined,
    bid_count: r['bid_count'] as number,
    start_time: _iso(r['start_time']),
    end_time: _iso(r['end_time']),
    extended_until: r['extended_until']
      ? _iso(r['extended_until'])
      : undefined,
    created_at: _iso(r['created_at'] ?? r['start_time']),
  };
}

function _iso(v: unknown): string {
  return (v instanceof Date ? v : new Date(v as string)).toISOString();
}
