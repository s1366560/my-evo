/**
 * Bounty Engine - In-memory store and state machine
 * Phase 3-4: Swarm + Bounty Integration
 */

import {
  Bounty,
  BountyBid,
  BountyDeliverable,
  BountyPayout,
  BountyState,
  BountyFilter,
  CreateBountyInput,
  ClaimBountyInput,
  SubmitBountyInput,
  AcceptBountyInput,
  BOUNTY_MIN_REWARD,
  BOUNTY_PLATFORM_FEE_PCT,
  BOUNTY_DEFAULT_MAX_BIDS,
  BOUNTY_CLAIM_TIMEOUT_MS,
} from './types';

// ============ In-Memory Stores ============
const bounties = new Map<string, Bounty>();
const bids = new Map<string, BountyBid>();
const deliverables = new Map<string, BountyDeliverable>();
const payouts = new Map<string, BountyPayout>();
const bountyBidsIndex = new Map<string, Set<string>>(); // bounty_id → bid_ids
const workerBounties = new Map<string, Set<string>>();  // node_id → bounty_ids

// ============ Bounty CRUD ============

export function createBounty(input: CreateBountyInput): Bounty {
  const now = new Date().toISOString();

  if (input.reward < BOUNTY_MIN_REWARD) {
    throw new Error(`Bounty reward must be at least ${BOUNTY_MIN_REWARD} credits`);
  }

  const bounty: Bounty = {
    bounty_id: input.bounty_id,
    title: input.title,
    description: input.description,
    tags: input.tags ?? [],
    reward: input.reward,
    platform_fee_pct: BOUNTY_PLATFORM_FEE_PCT,
    created_by: input.created_by ?? '',
    created_at: now,
    deadline: input.deadline,
    visibility: input.visibility ?? 'public',
    state: 'open',
    max_bids: input.max_bids ?? BOUNTY_DEFAULT_MAX_BIDS,
    acceptance_criteria: input.acceptance_criteria,
  };

  bounties.set(bounty.bounty_id, bounty);
  return bounty;
}

export function getBounty(bountyId: string): Bounty | undefined {
  return bounties.get(bountyId);
}

export function updateBountyState(
  bountyId: string,
  newState: BountyState,
  updatedBy?: string
): Bounty | undefined {
  const bounty = bounties.get(bountyId);
  if (!bounty) return undefined;

  // Validate state transitions
  const validTransitions: Record<BountyState, BountyState[]> = {
    open: ['in_progress', 'cancelled'],
    in_progress: ['pending_review', 'cancelled', 'open'], // back to open if worker abandoned
    pending_review: ['completed', 'disputed', 'cancelled'],
    completed: [], // terminal
    cancelled: [],  // terminal
    disputed: ['completed', 'cancelled'],
  };

  if (!validTransitions[bounty.state]?.includes(newState)) {
    throw new Error(
      `Invalid state transition: ${bounty.state} → ${newState} for bounty ${bountyId}`
    );
  }

  bounty.state = newState;
  return bounty;
}

export function listBounties(filter?: BountyFilter): Bounty[] {
  let result = [...bounties.values()];

  if (filter?.state) {
    result = result.filter(b => b.state === filter.state);
  }
  if (filter?.created_by) {
    result = result.filter(b => b.created_by === filter.created_by);
  }
  if (filter?.tags && filter.tags.length > 0) {
    result = result.filter(b =>
      filter.tags!.some(tag => b.tags.includes(tag))
    );
  }
  if (filter?.min_reward !== undefined) {
    result = result.filter(b => b.reward >= filter.min_reward!);
  }
  if (filter?.max_reward !== undefined) {
    result = result.filter(b => b.reward <= filter.max_reward!);
  }
  if (filter?.visibility) {
    result = result.filter(b => b.visibility === filter.visibility);
  }
  if (filter?.deadline_before) {
    result = result.filter(b => !b.deadline || b.deadline <= filter.deadline_before!);
  }

  // Sort by created_at desc
  result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const offset = filter?.offset ?? 0;
  const limit = filter?.limit ?? 50;
  return result.slice(offset, offset + limit);
}

export function countBounties(filter?: { state?: BountyState }): number {
  let result = [...bounties.values()];
  if (filter?.state) {
    result = result.filter(b => b.state === filter.state);
  }
  return result.length;
}

// ============ Bid Operations ============

export function submitBid(input: {
  bid_id: string;
  bounty_id: string;
  bidder: string;
  proposal: string;
  estimated_completion?: string;
}): BountyBid {
  const bounty = bounties.get(input.bounty_id);
  if (!bounty) throw new Error(`Bounty ${input.bounty_id} not found`);
  if (bounty.state !== 'open') throw new Error(`Bounty ${input.bounty_id} is not open for bids`);

  // Check if bidder already has a bid for this bounty
  const existingBids = bountyBidsIndex.get(input.bounty_id);
  if (existingBids) {
    for (const bidId of existingBids) {
      const existing = bids.get(bidId);
      if (existing && existing.bidder === input.bidder) {
        throw new Error(`Already submitted a bid for this bounty`);
      }
    }
  }

  // Check max bids limit
  const acceptedBids = getAcceptedBidsForBounty(input.bounty_id);
  if (acceptedBids.length >= bounty.max_bids) {
    throw new Error(`Bounty ${input.bounty_id} has reached max bids limit`);
  }

  const bid: BountyBid = {
    bid_id: input.bid_id,
    bounty_id: input.bounty_id,
    bidder: input.bidder,
    proposal: input.proposal,
    estimated_completion: input.estimated_completion,
    submitted_at: new Date().toISOString(),
    status: 'open',
  };

  bids.set(bid.bid_id, bid);

  if (!bountyBidsIndex.has(input.bounty_id)) {
    bountyBidsIndex.set(input.bounty_id, new Set());
  }
  bountyBidsIndex.get(input.bounty_id)!.add(bid.bid_id);

  if (!workerBounties.has(input.bidder)) {
    workerBounties.set(input.bidder, new Set());
  }
  workerBounties.get(input.bidder)!.add(input.bounty_id);

  return bid;
}

export function getBid(bountyId: string, bidder: string): BountyBid | undefined {
  const bidIds = bountyBidsIndex.get(bountyId);
  if (!bidIds) return undefined;
  for (const bidId of bidIds) {
    const bid = bids.get(bidId);
    if (bid && bid.bidder === bidder) return bid;
  }
  return undefined;
}

export function getBidsForBounty(bountyId: string): BountyBid[] {
  const bidIds = bountyBidsIndex.get(bountyId);
  if (!bidIds) return [];
  return [...bidIds]
    .map(id => bids.get(id))
    .filter((b): b is BountyBid => b !== undefined)
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
}

export function getAcceptedBidsForBounty(bountyId: string): BountyBid[] {
  return getBidsForBounty(bountyId).filter(b => b.status === 'accepted');
}

export function acceptBid(bountyId: string, bidId: string): BountyBid {
  const bid = bids.get(bidId);
  if (!bid || bid.bounty_id !== bountyId) throw new Error(`Bid ${bidId} not found for bounty ${bountyId}`);

  const bounty = bounties.get(bountyId);
  if (!bounty) throw new Error(`Bounty ${bountyId} not found`);

  // Accept the bid
  bid.status = 'accepted';

  // Transition bounty to in_progress
  updateBountyState(bountyId, 'in_progress');

  // Mark other open bids as rejected
  const allBids = getBidsForBounty(bountyId);
  for (const b of allBids) {
    if (b.bid_id !== bidId && b.status === 'open') {
      b.status = 'rejected';
    }
  }

  return bid;
}

export function rejectBid(bountyId: string, bidId: string): BountyBid {
  const bid = bids.get(bidId);
  if (!bid || bid.bounty_id !== bountyId) throw new Error(`Bid ${bidId} not found`);
  bid.status = 'rejected';
  return bid;
}

// ============ Deliverable & Submission ============

export function submitDeliverable(input: SubmitBountyInput): BountyDeliverable {
  const bounty = bounties.get(input.bounty_id);
  if (!bounty) throw new Error(`Bounty ${input.bounty_id} not found`);
  if (bounty.state !== 'in_progress') {
    throw new Error(`Bounty ${input.bounty_id} is not in_progress`);
  }

  // Check that the worker has an accepted bid
  const acceptedBid = getAcceptedBidsForBounty(input.bounty_id)
    .find(b => b.bidder === input.worker);
  if (!acceptedBid) {
    throw new Error(`Worker ${input.worker} does not have an accepted bid for bounty ${input.bounty_id}`);
  }

  const deliverable: BountyDeliverable = {
    bounty_id: input.bounty_id,
    worker: input.worker,
    content: input.content,
    artifacts: input.artifacts,
    submitted_at: new Date().toISOString(),
    review_note: input.review_note,
  };

  deliverables.set(input.bounty_id, deliverable);

  // Transition to pending_review
  updateBountyState(input.bounty_id, 'pending_review');

  return deliverable;
}

export function getDeliverable(bountyId: string): BountyDeliverable | undefined {
  return deliverables.get(bountyId);
}

// ============ Bounty Acceptance & Payout ============

export function acceptBounty(input: AcceptBountyInput): BountyPayout {
  const bounty = bounties.get(input.bounty_id);
  if (!bounty) throw new Error(`Bounty ${input.bounty_id} not found`);
  if (bounty.state !== 'pending_review') {
    throw new Error(`Bounty ${input.bounty_id} is not pending review`);
  }
  if (bounty.created_by !== input.creator) {
    throw new Error(`Only bounty creator can accept`);
  }

  const deliverable = deliverables.get(input.bounty_id);
  if (!deliverable) throw new Error(`No deliverable found for bounty ${input.bounty_id}`);

  // Calculate payout
  const platform_fee = Math.round(input.actual_reward * BOUNTY_PLATFORM_FEE_PCT);
  const net_reward = input.actual_reward - platform_fee;

  const payout: BountyPayout = {
    payout_id: `pay_${bounty.bounty_id}_${Date.now()}`,
    bounty_id: input.bounty_id,
    worker: input.worker,
    gross_reward: input.actual_reward,
    platform_fee,
    net_reward,
    paid_at: new Date().toISOString(),
  };

  payouts.set(payout.payout_id, payout);

  // Transition to completed
  updateBountyState(input.bounty_id, 'completed');

  return payout;
}

export function cancelBounty(bountyId: string, cancelledBy: string, reason?: string): Bounty {
  const bounty = bounties.get(bountyId);
  if (!bounty) throw new Error(`Bounty ${bountyId} not found`);

  // Only creator or system can cancel
  if (bounty.created_by !== cancelledBy && cancelledBy !== 'system') {
    throw new Error(`Not authorized to cancel bounty ${bountyId}`);
  }

  // Refund accepted bidder if in_progress
  if (bounty.state === 'in_progress') {
    const acceptedBids = getAcceptedBidsForBounty(bountyId);
    for (const bid of acceptedBids) {
      bid.status = 'withdrawn';
    }
  }

  updateBountyState(bountyId, 'cancelled');
  return bounty;
}

export function disputeBounty(bountyId: string, disputedBy: string, reason: string): Bounty {
  const bounty = bounties.get(bountyId);
  if (!bounty) throw new Error(`Bounty ${bountyId} not found`);
  if (bounty.state !== 'pending_review') {
    throw new Error(`Can only dispute bounties in pending_review state`);
  }

  updateBountyState(bountyId, 'disputed');
  return bounty;
}

// ============ Queries ============

export function getOpenBounties(tags?: string[], limit?: number): Bounty[] {
  return listBounties({
    state: 'open',
    tags,
    visibility: 'public',
    limit,
  });
}

export function getBountiesByWorker(nodeId: string): Bounty[] {
  const bountyIds = workerBounties.get(nodeId);
  if (!bountyIds) return [];
  return [...bountyIds]
    .map(id => bounties.get(id))
    .filter((b): b is Bounty => b !== undefined)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getBountyStats(): {
  total: number;
  by_state: Record<string, number>;
  total_reward: number;
  total_payouts: number;
  avg_reward: number;
} {
  const by_state: Record<string, number> = {};
  let total_reward = 0;
  let total_payouts = 0;

  for (const bounty of bounties.values()) {
    by_state[bounty.state] = (by_state[bounty.state] ?? 0) + 1;
    if (bounty.state === 'completed') {
      total_reward += bounty.reward;
    }
  }

  for (const payout of payouts.values()) {
    total_payouts += payout.net_reward;
  }

  const completed = [...bounties.values()].filter(b => b.state === 'completed').length;

  return {
    total: bounties.size,
    by_state,
    total_reward,
    total_payouts,
    avg_reward: completed > 0 ? total_reward / completed : 0,
  };
}

export { BOUNTY_MIN_REWARD, BOUNTY_PLATFORM_FEE_PCT };

// ============ Test Support ============

export function resetBountyStores(): void {
  bounties.clear();
  bids.clear();
  deliverables.clear();
  payouts.clear();
  bountyBidsIndex.clear();
  workerBounties.clear();
}
