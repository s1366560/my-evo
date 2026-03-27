/**
 * Bounty Types - Task Bounty System
 * Phase 3-4: Swarm + Bounty Integration
 * 
 * Bounty lifecycle:
 * OPEN → IN_PROGRESS → PENDING_REVIEW → COMPLETED
 *              ↓                ↓
 *         CANCELLED        DISPUTED
 */

// Bounty status state machine
export type BountyState =
  | 'open'          // Accepting bids
  | 'in_progress'  // Worker assigned, executing
  | 'pending_review' // Deliverable submitted, awaiting acceptance
  | 'completed'    // Accepted, rewards distributed
  | 'cancelled'    // Cancelled by creator or timeout
  | 'disputed';    // Dispute raised

// Bounty record
export interface Bounty {
  bounty_id: string;
  title: string;
  description: string;
  tags: string[];              // skill tags for matching
  reward: number;              // credits reward (min 50)
  platform_fee_pct: number;    // platform fee (5%)
  created_by: string;          // node_id of creator
  created_at: string;
  deadline?: string;           // optional deadline (ISO-8601)
  visibility: 'public' | 'private';
  state: BountyState;
  max_bids: number;           // max concurrent workers
  acceptance_criteria?: string[]; //验收标准
}

// Bid on a bounty
export interface BountyBid {
  bid_id: string;
  bounty_id: string;
  bidder: string;             // node_id
  proposal: string;           // execution proposal
  estimated_completion?: string;
  submitted_at: string;
  status: 'open' | 'accepted' | 'rejected' | 'withdrawn';
}

// Deliverable submitted by worker
export interface BountyDeliverable {
  bounty_id: string;
  worker: string;
  content: string;           // description or URL to output
  artifacts?: string[];      // asset_ids or file references
  submitted_at: string;
  review_note?: string;
}

// Bounty payout record
export interface BountyPayout {
  payout_id: string;
  bounty_id: string;
  worker: string;
  gross_reward: number;
  platform_fee: number;
  net_reward: number;
  paid_at: string;
}

// Bounty listing filter
export interface BountyFilter {
  state?: BountyState;
  tags?: string[];
  created_by?: string;
  min_reward?: number;
  max_reward?: number;
  deadline_before?: string;
  visibility?: 'public' | 'private';
  limit?: number;
  offset?: number;
}

// Bounty creation input
export interface CreateBountyInput {
  bounty_id: string;
  title: string;
  description: string;
  tags?: string[];
  reward: number;
  deadline?: string;
  visibility?: 'public' | 'private';
  max_bids?: number;
  acceptance_criteria?: string[];
}

// Bounty claim (bid accepted → work started)
export interface ClaimBountyInput {
  bounty_id: string;
  worker: string;
  proposal: string;
  estimated_completion?: string;
}

// Bounty submission (work done, requesting review)
export interface SubmitBountyInput {
  bounty_id: string;
  worker: string;
  content: string;
  artifacts?: string[];
  review_note?: string;
}

// Bounty acceptance (creator accepts deliverable)
export interface AcceptBountyInput {
  bounty_id: string;
  creator: string;
  worker: string;
  actual_reward: number;
}

// Constants
export const BOUNTY_MIN_REWARD = 50;
export const BOUNTY_PLATFORM_FEE_PCT = 0.05; // 5%
export const BOUNTY_DEFAULT_MAX_BIDS = 3;
export const BOUNTY_CLAIM_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
