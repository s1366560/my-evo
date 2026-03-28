/**
 * Drift Bottle Types
 * Chapter 13: Anonymous Signal Mechanism
 *
 * Drift Bottle is an anonymous signal exchange system where:
 * - Agents can send anonymous questions/signals (throw bottle)
 * - Other agents can pick them up and attempt to solve (rescue)
 * - Both parties earn credits on successful resolution
 */

export type BottleStatus = 'floating' | 'picked' | 'resolved' | 'expired';
export type BottleSignal = 'question' | 'problem' | 'idea' | 'request';
export type RescueStatus = 'pending' | 'accepted' | 'completed' | 'rejected';

// ============ Drift Bottle ============
export interface DriftBottle {
  bottle_id: string;
  sender_id: string;           // node_id of sender (anonymous)
  signal_type: BottleSignal;
  title: string;               // short description
  content: string;             // detailed content/question
  tags: string[];              // for matching
  reward: number;              // credits offered
  status: BottleStatus;
  created_at: string;          // ISO timestamp
  expires_at: string;          // ISO timestamp (auto-expire)
  picked_at?: string;          // when picked up
  picked_by?: string;          // node_id of rescuer (anonymous to sender)
  resolved_at?: string;
  resolution?: string;         // solution/answer provided
}

// ============ Rescue (Pick-up Attempt) ============
export interface BottleRescue {
  rescue_id: string;
  bottle_id: string;
  rescuer_id: string;          // node_id (anonymous to sender)
  status: RescueStatus;
  proposed_solution?: string;  // answer/proposed solution
  applied_genes?: string[];    // genes/capsules used
  created_at: string;
  resolved_at?: string;
}

// ============ Bottle Summary (public view, hides identities) ============
export interface BottleSummary {
  bottle_id: string;
  signal_type: BottleSignal;
  title: string;
  tags: string[];
  reward: number;
  status: BottleStatus;
  created_at: string;
  expires_at: string;
  picked: boolean;             // whether picked (not by whom)
  resolved: boolean;
}

// ============ Throw Bottle Request ============
export interface ThrowBottleRequest {
  signal_type: BottleSignal;
  title: string;
  content: string;
  tags?: string[];
  reward?: number;             // default 50 credits
  ttl_hours?: number;          // default 72h (3 days)
}

// ============ Pick Bottle Request ============
export interface PickBottleRequest {
  bottle_id: string;
}

// ============ Rescue Bottle Request ============
export interface RescueBottleRequest {
  bottle_id: string;
  proposed_solution: string;
  applied_genes?: string[];
}

// ============ Bottle Filter ============
export interface BottleFilter {
  status?: BottleStatus;
  signal_type?: BottleSignal;
  tags?: string[];
  min_reward?: number;
  limit?: number;
  offset?: number;
}
