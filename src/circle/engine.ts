/**
 * Evolution Circle Engine - In-memory store
 * Phase 6+: Evolution Circle System
 */

import { randomBytes } from 'crypto';
import {
  EvolutionCircle,
  CircleMember,
  EvolutionRound,
  CircleVote,
  CircleInvite,
  CircleState,
  RoundStatus,
} from './types';

// In-memory stores
const circles = new Map<string, EvolutionCircle>();
const rounds = new Map<string, EvolutionRound>();
const votes = new Map<string, CircleVote>();      // `${round_id}_${node_id}` -> vote
const invites = new Map<string, CircleInvite>();  // invite_id -> invite
let circleInsertOrder = 0;
let roundInsertOrder = 0;

function genId(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString('hex')}`;
}

// ============ Circle Management ============

export function createCircle(founderNodeId: string, name: string, description: string): EvolutionCircle {
  const now = new Date().toISOString();
  const seq = ++circleInsertOrder;

  const circle: EvolutionCircle = {
    circle_id: genId('circle'),
    name,
    description,
    founder: founderNodeId,
    members: [{
      node_id: founderNodeId,
      role: 'founder',
      joined_at: now,
      contributions: 0,
      reputation_earned: 0,
    }],
    state: 'forming',
    gene_pool: [],
    rounds_completed: 0,
    created_at: now,
    created_seq: seq,
    updated_at: now,
  };

  circles.set(circle.circle_id, circle);
  return circle;
}

export function getCircle(circleId: string): EvolutionCircle | undefined {
  return circles.get(circleId);
}

export function updateCircleState(circleId: string, state: CircleState): EvolutionCircle | undefined {
  const circle = circles.get(circleId);
  if (!circle) return undefined;
  circle.state = state;
  circle.updated_at = new Date().toISOString();
  return circle;
}

export function listCircles(filter?: { state?: CircleState; founder?: string }): EvolutionCircle[] {
  let all = [...circles.values()];
  if (filter?.state) all = all.filter(c => c.state === filter.state);
  if (filter?.founder) all = all.filter(c => c.founder === filter.founder);
  return all.sort((a, b) => {
    const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.created_seq - a.created_seq;
  });
}

export function listMyCircles(nodeId: string): EvolutionCircle[] {
  return [...circles.values()].filter(c =>
    c.members.some(m => m.node_id === nodeId)
  );
}

// ============ Member Management ============

export function joinCircle(circleId: string, nodeId: string, role: 'member' | 'observer' = 'member'): EvolutionCircle | null {
  const circle = circles.get(circleId);
  if (!circle) return null;
  
  if (circle.members.some(m => m.node_id === nodeId)) {
    return circle; // already member
  }
  
  const member: CircleMember = {
    node_id: nodeId,
    role,
    joined_at: new Date().toISOString(),
    contributions: 0,
    reputation_earned: 0,
  };
  
  circle.members.push(member);
  circle.updated_at = new Date().toISOString();
  
  if (circle.state === 'forming') {
    circle.state = 'active';
  }
  
  return circle;
}

export function leaveCircle(circleId: string, nodeId: string): boolean {
  const circle = circles.get(circleId);
  if (!circle) return false;
  
  const idx = circle.members.findIndex(m => m.node_id === nodeId);
  if (idx === -1) return false;
  
  const member = circle.members[idx];
  if (member.role === 'founder') return false; // founder can't leave
  
  circle.members.splice(idx, 1);
  circle.updated_at = new Date().toISOString();
  return true;
}

export function addGeneToCircle(circleId: string, geneId: string, nodeId: string): EvolutionCircle | null {
  const circle = circles.get(circleId);
  if (!circle) return null;
  
  const member = circle.members.find(m => m.node_id === nodeId);
  if (!member) return null;
  
  if (!circle.gene_pool.includes(geneId)) {
    circle.gene_pool.push(geneId);
    member.contributions++;
    circle.updated_at = new Date().toISOString();
  }
  
  return circle;
}

// ============ Evolution Rounds ============

export function createRound(
  circleId: string,
  proposer: string,
  title: string,
  description: string,
  genes: string[],
  mutationType: 'random' | 'targeted' | 'crossbreed' | 'directed'
): EvolutionRound | null {
  const circle = circles.get(circleId);
  if (!circle) return null;
  
  if (!circle.members.some(m => m.node_id === proposer)) return null;
  
  const now = new Date();
  const deadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const seq = ++roundInsertOrder;

  const round: EvolutionRound = {
    round_id: genId('round'),
    circle_id: circleId,
    proposer,
    title,
    description,
    genes,
    mutation_type: mutationType,
    status: 'proposed',
    votes_for: 0,
    votes_against: 0,
    created_at: now.toISOString(),
    created_seq: seq,
    deadline: deadline.toISOString(),
  };
  
  rounds.set(round.round_id, round);

  // Auto-advance to voting after short delay (in real system would be automatic)
  round.status = 'voting';

  return round;
}

export function getRound(roundId: string): EvolutionRound | undefined {
  return rounds.get(roundId);
}

export function listRounds(circleId?: string, status?: RoundStatus): EvolutionRound[] {
  let all = [...rounds.values()];
  if (circleId) all = all.filter(r => r.circle_id === circleId);
  if (status) all = all.filter(r => r.status === status);
  return all.sort((a, b) => {
    const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.created_seq - a.created_seq;
  });
}

// ============ Voting ============

export function castVote(roundId: string, nodeId: string, vote: 'approve' | 'reject'): EvolutionRound | null {
  const round = rounds.get(roundId);
  if (!round) return null;
  if (round.status !== 'voting') return null;
  
  const circle = circles.get(round.circle_id);
  if (!circle) return null;
  
  const member = circle.members.find(m => m.node_id === nodeId);
  if (!member) return null;
  
  // Check if already voted
  const existingKey = `${roundId}_${nodeId}`;
  if (votes.has(existingKey)) return null;
  
  // Calculate weight based on member's contributions
  const weight = Math.max(1, Math.floor(Math.sqrt(member.contributions + 1)));
  
  const voteRecord: CircleVote = {
    round_id: roundId,
    node_id: nodeId,
    vote,
    weight,
    voted_at: new Date().toISOString(),
  };
  
  votes.set(existingKey, voteRecord);
  
  if (vote === 'approve') {
    round.votes_for += weight;
  } else {
    round.votes_against += weight;
  }
  
  return round;
}

export function finalizeRound(roundId: string): EvolutionRound | null {
  const round = rounds.get(roundId);
  if (!round) return null;
  if (round.status !== 'voting') return null;
  
  const totalVotes = round.votes_for + round.votes_against;
  
  if (totalVotes === 0) {
    // No votes yet - keep open
    return round;
  }
  
  const approvalRate = round.votes_for / totalVotes;
  
  if (approvalRate >= 0.6) { // 60% threshold
    round.status = 'approved';
    const circle = circles.get(round.circle_id);
    if (circle) {
      circle.state = 'evolving';
      circle.updated_at = new Date().toISOString();
    }
  } else {
    round.status = 'rejected';
  }
  
  return round;
}

export function executeRound(roundId: string): EvolutionRound | null {
  const round = rounds.get(roundId);
  if (!round) return null;
  if (round.status !== 'approved') return null;
  
  round.status = 'executed';
  round.executed_at = new Date().toISOString();
  
  const circle = circles.get(round.circle_id);
  if (circle) {
    circle.rounds_completed++;
    circle.state = 'active';
    circle.updated_at = new Date().toISOString();
    
    // Credit proposer
    const proposerMember = circle.members.find(m => m.node_id === round.proposer);
    if (proposerMember) {
      proposerMember.reputation_earned += 10;
    }
  }
  
  return round;
}

// ============ Invites ============

export function createInvite(circleId: string, inviterNodeId: string, inviteeNodeId: string): CircleInvite | null {
  const circle = circles.get(circleId);
  if (!circle) return null;
  
  if (!circle.members.some(m => m.node_id === inviterNodeId)) return null;
  
  const invite: CircleInvite = {
    circle_id: circleId,
    invitee: inviteeNodeId,
    invited_by: inviterNodeId,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  
  invites.set(genId('invite'), invite);
  return invite;
}

export function respondToInvite(circleId: string, inviteeNodeId: string, accept: boolean): boolean {
  for (const invite of invites.values()) {
    if (invite.circle_id === circleId && invite.invitee === inviteeNodeId && invite.status === 'pending') {
      invite.status = accept ? 'accepted' : 'declined';
      
      if (accept) {
        joinCircle(circleId, inviteeNodeId, 'member');
      }
      return true;
    }
  }
  return false;
}

// ============ Testing Utilities ============

export function resetStores(): void {
  circles.clear();
  rounds.clear();
  votes.clear();
  invites.clear();
  circleInsertOrder = 0;
  roundInsertOrder = 0;
}
