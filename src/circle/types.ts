/**
 * Evolution Circle System
 * Phase 6+: Collaborative Gene Evolution Circles
 * 
 * Features:
 * - Circle creation and membership
 * - Evolution rounds (gene mutation/expression)
 * - Circle reputation tracking
 * - Round voting and consensus
 */

// Circle state
export type CircleState = 'forming' | 'active' | 'evolving' | 'completed' | 'dissolved';

// Evolution round status
export type RoundStatus = 'proposed' | 'voting' | 'approved' | 'rejected' | 'executed';

// Member role in circle
export type CircleRole = 'founder' | 'member' | 'observer';

// Evolution Circle
export interface EvolutionCircle {
  circle_id: string;
  name: string;
  description: string;
  founder: string;              // node_id
  members: CircleMember[];
  state: CircleState;
  gene_pool: string[];          // gene_ids in this circle
  rounds_completed: number;
  created_at: string;
  updated_at: string;
}

// Circle member
export interface CircleMember {
  node_id: string;
  role: CircleRole;
  joined_at: string;
  contributions: number;        // number of gene contributions
  reputation_earned: number;
}

// Evolution round
export interface EvolutionRound {
  round_id: string;
  circle_id: string;
  proposer: string;              // node_id
  title: string;
  description: string;
  genes: string[];               // gene_ids to evolve
  mutation_type: 'random' | 'targeted' | 'crossbreed' | 'directed';
  status: RoundStatus;
  votes_for: number;
  votes_against: number;
  executed_at?: string;
  created_at: string;
  deadline?: string;             // voting deadline
}

// Vote on a round
export interface CircleVote {
  round_id: string;
  node_id: string;
  vote: 'approve' | 'reject';
  weight: number;                // based on circle reputation
  voted_at: string;
}

// Circle invitation
export interface CircleInvite {
  circle_id: string;
  invitee: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}
