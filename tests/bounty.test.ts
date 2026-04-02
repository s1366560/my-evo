/**
 * Bounty Engine Tests
 * Phase 3-4: Bounty System
 */

import {
  createBounty,
  getBounty,
  updateBountyState,
  listBounties,
  countBounties,
  submitBid,
  getBid,
  getBidsForBounty,
  getAcceptedBidsForBounty,
  acceptBid,
  rejectBid,
  submitDeliverable,
  getDeliverable,
  acceptBounty,
  cancelBounty,
  disputeBounty,
  getOpenBounties,
  getBountiesByWorker,
  getBountyStats,
  resetBountyStores,
} from '../src/bounty/engine';
import { BountyState } from '../src/bounty/types';

describe('Bounty Engine', () => {
  beforeEach(() => {
    resetBountyStores();
  });

  // ============ Bounty CRUD ============
  describe('Bounty CRUD', () => {
    it('should create a bounty with open state', () => {
      const bounty = createBounty({
        bounty_id: 'bounty_001',
        title: 'Build API',
        description: 'Create a REST API',
        tags: ['api', 'nodejs'],
        reward: 100,
      });

      expect(bounty.bounty_id).toBe('bounty_001');
      expect(bounty.state).toBe('open');
      expect(bounty.reward).toBe(100);
      expect(bounty.visibility).toBe('public');
    });

    it('should throw when reward is below minimum', () => {
      expect(() =>
        createBounty({
          bounty_id: 'bounty_too_low',
          title: 'Too cheap',
          description: 'Reward too low',
          reward: 10, // min is 50
        })
      ).toThrow();
    });

    it('should get a bounty by id', () => {
      createBounty({
        bounty_id: 'bounty_get_001',
        title: 'Get Test',
        description: 'Testing get',
        reward: 75,
      });

      const bounty = getBounty('bounty_get_001');
      expect(bounty).toBeDefined();
      expect(bounty?.title).toBe('Get Test');
    });

    it('should return undefined for non-existent bounty', () => {
      const bounty = getBounty('nonexistent');
      expect(bounty).toBeUndefined();
    });

    it('should list all bounties with no filter', () => {
      createBounty({ bounty_id: 'list_b1', title: 'B1', description: 'D', reward: 60 });
      createBounty({ bounty_id: 'list_b2', title: 'B2', description: 'D', reward: 70 });

      const bounties = listBounties();
      expect(bounties.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter bounties by state', () => {
      createBounty({ bounty_id: 'filter_s1', title: 'F1', description: 'D', reward: 60 });
      const b2 = createBounty({ bounty_id: 'filter_s2', title: 'F2', description: 'D', reward: 70 });
      updateBountyState(b2.bounty_id, 'cancelled');

      const openBounties = listBounties({ state: 'open' });
      expect(openBounties.every(b => b.state === 'open')).toBe(true);
    });

    it('should filter bounties by tags', () => {
      createBounty({ bounty_id: 'tag_b1', title: 'T1', description: 'D', tags: ['legal'], reward: 80 });
      createBounty({ bounty_id: 'tag_b2', title: 'T2', description: 'D', tags: ['code'], reward: 90 });

      const legalBounties = listBounties({ tags: ['legal'] });
      expect(legalBounties.some(b => b.tags.includes('legal'))).toBe(true);
    });

    it('should filter by reward range', () => {
      createBounty({ bounty_id: 'rew_b1', title: 'R1', description: 'D', reward: 60 });
      createBounty({ bounty_id: 'rew_b2', title: 'R2', description: 'D', reward: 150 });

      const filtered = listBounties({ min_reward: 100 });
      expect(filtered.every(b => b.reward >= 100)).toBe(true);
    });

    it('should count bounties by state', () => {
      createBounty({ bounty_id: 'cnt_b1', title: 'C1', description: 'D', reward: 60 });
      const b2 = createBounty({ bounty_id: 'cnt_b2', title: 'C2', description: 'D', reward: 70 });
      updateBountyState(b2.bounty_id, 'cancelled');

      expect(countBounties({ state: 'open' })).toBeGreaterThanOrEqual(1);
      expect(countBounties({ state: 'cancelled' })).toBeGreaterThanOrEqual(1);
    });
  });

  // ============ Bounty State Transitions ============
  describe('Bounty State Transitions', () => {
    it('should transition bounty to in_progress', () => {
      const bounty = createBounty({ bounty_id: 'state_1', title: 'S1', description: 'D', reward: 80 });
      const updated = updateBountyState(bounty.bounty_id, 'in_progress');
      expect(updated.state).toBe('in_progress');
    });

    it('should transition bounty to pending_review', () => {
      const bounty = createBounty({ bounty_id: 'state_2', title: 'S2', description: 'D', reward: 80 });
      updateBountyState(bounty.bounty_id, 'in_progress');
      const updated = updateBountyState(bounty.bounty_id, 'pending_review');
      expect(updated.state).toBe('pending_review');
    });

    it('should transition bounty to completed', () => {
      const bounty = createBounty({ bounty_id: 'state_3', title: 'S3', description: 'D', reward: 80 });
      updateBountyState(bounty.bounty_id, 'in_progress');
      updateBountyState(bounty.bounty_id, 'pending_review');
      const updated = updateBountyState(bounty.bounty_id, 'completed');
      expect(updated.state).toBe('completed');
    });

    it('should cancel a bounty', () => {
      const bounty = createBounty({ bounty_id: 'cancel_1', title: 'C1', description: 'D', reward: 80, created_by: 'creator_1' });
      const cancelled = cancelBounty(bounty.bounty_id, 'creator_1', 'No longer needed');
      expect(cancelled.state).toBe('cancelled');
    });

    it('should dispute a bounty', () => {
      const bounty = createBounty({ bounty_id: 'dispute_1', title: 'D1', description: 'D', reward: 80, created_by: 'bounty_owner' });
      updateBountyState(bounty.bounty_id, 'in_progress');
      updateBountyState(bounty.bounty_id, 'pending_review');
      const disputed = disputeBounty(bounty.bounty_id, 'worker_1', 'Quality issue');
      expect(disputed.state).toBe('disputed');
    });
  });

  // ============ Bidding ============
  describe('Bidding', () => {
    it('should submit a bid on an open bounty', () => {
      const bounty = createBounty({ bounty_id: 'bid_b1', title: 'B1', description: 'D', reward: 100 });
      const bid = submitBid({
        bounty_id: bounty.bounty_id,
        bid_id: 'bid_001',
        bidder: 'node_bidder_1',
        proposal: 'I will build this API efficiently',
        estimated_completion: '2026-04-10T00:00:00Z',
      });

      expect(bid.bid_id).toBe('bid_001');
      expect(bid.bounty_id).toBe('bid_b1');
      expect(bid.bidder).toBe('node_bidder_1');
      expect(bid.status).toBe('open');
    });

    it('should get a specific bid', () => {
      const bounty = createBounty({ bounty_id: 'getbid_b1', title: 'GB1', description: 'D', reward: 100 });
      submitBid({
        bounty_id: bounty.bounty_id,
        bid_id: 'getbid_001',
        bidder: 'node_x',
        proposal: 'My proposal',
      });

      const bid = getBid(bounty.bounty_id, 'node_x');
      expect(bid).toBeDefined();
      expect(bid?.bid_id).toBe('getbid_001');
    });

    it('should get all bids for a bounty', () => {
      const bounty = createBounty({ bounty_id: 'allbids_b1', title: 'AB1', description: 'D', reward: 100 });
      submitBid({ bounty_id: bounty.bounty_id, bid_id: 'ab_bid1', bidder: 'node_y', proposal: 'Bid 1' });
      submitBid({ bounty_id: bounty.bounty_id, bid_id: 'ab_bid2', bidder: 'node_z', proposal: 'Bid 2' });

      const bids = getBidsForBounty(bounty.bounty_id);
      expect(bids.length).toBe(2);
    });

    it('should accept a bid', () => {
      const bounty = createBounty({ bounty_id: 'accept_b1', title: 'Ac1', description: 'D', reward: 100 });
      const bid = submitBid({
        bounty_id: bounty.bounty_id,
        bid_id: 'accept_bid1',
        bidder: 'node_accept',
        proposal: 'Accepted proposal',
      });

      const accepted = acceptBid(bounty.bounty_id, bid.bid_id);
      expect(accepted.status).toBe('accepted');
    });

    it('should reject a bid', () => {
      const bounty = createBounty({ bounty_id: 'reject_b1', title: 'Rj1', description: 'D', reward: 100 });
      const bid = submitBid({
        bounty_id: bounty.bounty_id,
        bid_id: 'reject_bid1',
        bidder: 'node_reject',
        proposal: 'Rejected proposal',
      });

      const rejected = rejectBid(bounty.bounty_id, bid.bid_id);
      expect(rejected.status).toBe('rejected');
    });

    it('should get accepted bids for a bounty', () => {
      const bounty = createBounty({ bounty_id: 'accbids_b1', title: 'AB2', description: 'D', reward: 100 });
      const bid1 = submitBid({ bounty_id: bounty.bounty_id, bid_id: 'ab2_bid1', bidder: 'n1', proposal: 'B1' });
      submitBid({ bounty_id: bounty.bounty_id, bid_id: 'ab2_bid2', bidder: 'n2', proposal: 'B2' });
      acceptBid(bounty.bounty_id, bid1.bid_id);

      const accepted = getAcceptedBidsForBounty(bounty.bounty_id);
      expect(accepted.length).toBe(1);
      expect(accepted[0].bid_id).toBe('ab2_bid1');
    });
  });

  // ============ Deliverables ============
  describe('Deliverables', () => {
    it('should submit a deliverable', () => {
      const bounty = createBounty({ bounty_id: 'deliv_b1', title: 'D1', description: 'D', reward: 100 });
      submitBid({ bounty_id: bounty.bounty_id, bid_id: 'deliv_bid1', bidder: 'node_w', proposal: 'Work' });
      acceptBid(bounty.bounty_id, 'deliv_bid1'); // acceptBid transitions to in_progress automatically
      // do NOT call updateBountyState here - submitDeliverable requires in_progress state

      const deliverable = submitDeliverable({
        bounty_id: bounty.bounty_id,
        worker: 'node_w',
        content: 'Here is the completed work',
        artifacts: ['asset_abc123'],
      });

      expect(deliverable.bounty_id).toBe('deliv_b1');
      expect(deliverable.content).toBe('Here is the completed work');
      expect(deliverable.artifacts).toContain('asset_abc123');
    });

    it('should get a deliverable by bounty id', () => {
      const bounty = createBounty({ bounty_id: 'getdel_b1', title: 'GD1', description: 'D', reward: 100 });
      submitBid({ bounty_id: bounty.bounty_id, bid_id: 'gd_bid1', bidder: 'node_d', proposal: 'P' });
      acceptBid(bounty.bounty_id, 'gd_bid1');

      submitDeliverable({
        bounty_id: bounty.bounty_id,
        worker: 'node_d',
        content: 'Deliverable content',
      });

      const retrieved = getDeliverable(bounty.bounty_id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe('Deliverable content');
    });

    it('should return undefined for non-existent deliverable', () => {
      const deliverable = getDeliverable('nonexistent_bounty');
      expect(deliverable).toBeUndefined();
    });
  });

  // ============ Payout ============
  describe('Payout', () => {
    it('should accept bounty and compute payout', () => {
      const bounty = createBounty({
        bounty_id: 'payout_b1',
        title: 'P1',
        description: 'D',
        reward: 200,
        created_by: 'bounty_creator',
      });
      submitBid({ bounty_id: bounty.bounty_id, bid_id: 'payout_bid1', bidder: 'node_payout', proposal: 'Work' });
      acceptBid(bounty.bounty_id, 'payout_bid1');
      submitDeliverable({
        bounty_id: bounty.bounty_id,
        worker: 'node_payout',
        content: 'Done',
      });

      const payout = acceptBounty({
        bounty_id: bounty.bounty_id,
        creator: 'bounty_creator',
        worker: 'node_payout',
        actual_reward: 200,
      });

      expect(payout.payout_id).toBeDefined();
      expect(payout.worker).toBe('node_payout');
      expect(payout.gross_reward).toBe(200);
      expect(payout.net_reward).toBeLessThan(200); // less than gross due to platform fee
    });

    it('should apply 5% platform fee correctly', () => {
      const bounty = createBounty({
        bounty_id: 'fee_b1',
        title: 'Fee',
        description: 'D',
        reward: 1000,
        created_by: 'fee_creator',
      });
      submitBid({ bounty_id: bounty.bounty_id, bid_id: 'fee_bid', bidder: 'node_fee', proposal: 'W' });
      acceptBid(bounty.bounty_id, 'fee_bid');
      submitDeliverable({
        bounty_id: bounty.bounty_id,
        worker: 'node_fee',
        content: 'Done',
      });

      const payout = acceptBounty({
        bounty_id: bounty.bounty_id,
        creator: 'fee_creator',
        worker: 'node_fee',
        actual_reward: 1000,
      });

      const expectedFee = Math.floor(1000 * 0.05);
      expect(payout.platform_fee).toBe(expectedFee);
      expect(payout.net_reward).toBe(1000 - expectedFee);
    });
  });

  // ============ Bounty Queries ============
  describe('Bounty Queries', () => {
    it('should get open bounties', () => {
      createBounty({ bounty_id: 'open_b1', title: 'O1', description: 'D', reward: 80 });
      createBounty({ bounty_id: 'open_b2', title: 'O2', description: 'D', reward: 90 });

      const openBounties = getOpenBounties();
      expect(openBounties.every(b => b.state === 'open')).toBe(true);
    });

    it('should filter open bounties by tags', () => {
      createBounty({ bounty_id: 'optag_b1', title: 'OT1', description: 'D', tags: ['python'], reward: 80 });
      createBounty({ bounty_id: 'optag_b2', title: 'OT2', description: 'D', tags: ['legal'], reward: 90 });

      const pythonBounties = getOpenBounties(['python']);
      expect(pythonBounties.every(b => b.tags.includes('python'))).toBe(true);
    });

    it('should limit open bounties results', () => {
      for (let i = 1; i <= 5; i++) {
        createBounty({ bounty_id: `limit_b${i}`, title: `L${i}`, description: 'D', reward: 60 + i });
      }

      const limited = getOpenBounties(undefined, 3);
      expect(limited.length).toBeLessThanOrEqual(3);
    });

    it('should get bounties by worker', () => {
      createBounty({ bounty_id: 'byw_b1', title: 'BW1', description: 'D', reward: 80 });
      submitBid({ bounty_id: 'byw_b1', bid_id: 'byw_bid1', bidder: 'node_byw', proposal: 'P' });
      acceptBid('byw_b1', 'byw_bid1');

      const workerBounties = getBountiesByWorker('node_byw');
      expect(workerBounties.some(b => b.bounty_id === 'byw_b1')).toBe(true);
    });

    it('should get bounty stats', () => {
      createBounty({ bounty_id: 'stats_b1', title: 'S1', description: 'D', reward: 100 });
      createBounty({ bounty_id: 'stats_b2', title: 'S2', description: 'D', reward: 200 });

      const stats = getBountyStats();
      expect(stats.total).toBeGreaterThanOrEqual(2);
      expect(stats.by_state['open']).toBeGreaterThanOrEqual(2);
    });
  });
});
