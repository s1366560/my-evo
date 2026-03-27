/**
 * Session Service - Real-time Collaboration
 */

import { randomUUID } from 'crypto';
import {
  Session,
  SessionMember,
  SessionMessage,
  SessionEvent,
  SessionStatus,
  VectorClock,
  ConsensusProposal,
  ConsensusConfig,
  Operation,
} from './types';

// ============ Constants ============

const SESSION_HEARTBEAT_INTERVAL = 30000; // 30 seconds
const SESSION_MEMBER_TIMEOUT = 90000; // 90 seconds
const SESSION_TTL_DEFAULT = 7200000; // 2 hours

// ============ Vector Clock ============

export function createVectorClock(): VectorClock {
  return { clocks: {} };
}

export function incrementClock(clock: VectorClock, nodeId: string): VectorClock {
  const newClock = { ...clock, clocks: { ...clock.clocks } };
  newClock.clocks[nodeId] = (newClock.clocks[nodeId] || 0) + 1;
  return newClock;
}

export function mergeClock(clock1: VectorClock, clock2: VectorClock): VectorClock {
  const merged: { [nodeId: string]: number } = { ...clock1.clocks };
  for (const [nodeId, count] of Object.entries(clock2.clocks)) {
    merged[nodeId] = Math.max(merged[nodeId] || 0, count);
  }
  return { clocks: merged };
}

export function happensBefore(clock1: VectorClock, clock2: VectorClock): boolean {
  const allNodes = new Set([...Object.keys(clock1.clocks), ...Object.keys(clock2.clocks)]);
  let atLeastOneLess = false;
  for (const node of allNodes) {
    const v1 = clock1.clocks[node] || 0;
    const v2 = clock2.clocks[node] || 0;
    if (v1 > v2) return false;
    if (v1 < v2) atLeastOneLess = true;
  }
  return atLeastOneLess;
}

export function isConcurrent(clock1: VectorClock, clock2: VectorClock): boolean {
  return !happensBefore(clock1, clock2) && !happensBefore(clock2, clock1);
}

// ============ Session Management ============

export function createSession(params: {
  id?: string;
  title: string;
  creator_id: string;
  context?: Record<string, any>;
  max_participants?: number;
  consensus_config?: Partial<ConsensusConfig>;
  ttl_seconds?: number;
}): Session {
  const now = Date.now();
  const ttl = (params.ttl_seconds || 7200) * 1000;
  
  return {
    id: params.id || `sess_${randomUUID().slice(0, 8)}`,
    title: params.title,
    status: 'creating',
    creator_id: params.creator_id,
    members: [
      {
        node_id: params.creator_id,
        role: 'organizer',
        joined_at: now,
        last_heartbeat: now,
      }
    ],
    context: params.context || {},
    max_participants: params.max_participants || 5,
    consensus_config: {
      algorithm: params.consensus_config?.algorithm || 'raft_like',
      quorum_size: params.consensus_config?.quorum_size || 2,
      timeout_ms: params.consensus_config?.timeout_ms || 5000,
    },
    vector_clock: createVectorClock(),
    messages: [],
    created_at: now,
    updated_at: now,
    expires_at: now + ttl,
  };
}

export function activateSession(session: Session): Session {
  return { ...session, status: 'active', updated_at: Date.now() };
}

export function addMember(session: Session, nodeId: string, role: 'participant' | 'observer' = 'participant'): Session {
  if (session.members.some(m => m.node_id === nodeId)) return session;
  if (session.members.length >= session.max_participants) {
    throw new Error('Session is full');
  }
  const now = Date.now();
  return {
    ...session,
    members: [...session.members, { node_id: nodeId, role, joined_at: now, last_heartbeat: now }],
    updated_at: now,
  };
}

export function removeMember(session: Session, nodeId: string): Session {
  return {
    ...session,
    members: session.members.filter(m => m.node_id !== nodeId),
    updated_at: Date.now(),
  };
}

export function heartbeatMember(session: Session, nodeId: string): Session {
  return {
    ...session,
    members: session.members.map(m =>
      m.node_id === nodeId ? { ...m, last_heartbeat: Date.now() } : m
    ),
    updated_at: Date.now(),
  };
}

export function isMemberActive(session: Session, nodeId: string): boolean {
  const member = session.members.find(m => m.node_id === nodeId);
  if (!member) return false;
  return Date.now() - member.last_heartbeat < SESSION_MEMBER_TIMEOUT;
}

export function addMessage(
  session: Session,
  message: Omit<SessionMessage, 'id' | 'session_id' | 'timestamp' | 'vector_clock'>
): Session {
  const now = Date.now();
  const newClock = incrementClock(session.vector_clock, message.from);
  const newMessage: SessionMessage = {
    ...message,
    id: `msg_${randomUUID().slice(0, 8)}`,
    session_id: session.id,
    timestamp: now,
    vector_clock: newClock,
  };
  return {
    ...session,
    messages: [...session.messages, newMessage],
    vector_clock: newClock,
    updated_at: now,
  };
}

export function createConsensusProposal(params: {
  session_id: string;
  proposer_id: string;
  type: 'decision' | 'vote' | 'kick';
  description: string;
  options?: string[];
  timeout_ms?: number;
}): ConsensusProposal {
  return {
    id: `prop_${randomUUID().slice(0, 8)}`,
    session_id: params.session_id,
    proposer_id: params.proposer_id,
    type: params.type,
    description: params.description,
    options: params.options,
    votes: {},
    vote_deadline: Date.now() + (params.timeout_ms || 5000),
  };
}

export function vote(proposal: ConsensusProposal, voterId: string, voteValue: string): ConsensusProposal {
  if (Date.now() > proposal.vote_deadline) {
    throw new Error('Voting deadline has passed');
  }
  return { ...proposal, votes: { ...proposal.votes, [voterId]: voteValue } };
}

export function tallyVotes(proposal: ConsensusProposal, totalMembers: number): {
  quorum_reached: boolean;
  decided: boolean;
  decision?: string;
} {
  const voteCount = Object.keys(proposal.votes).length;
  const quorum = Math.ceil(totalMembers / 2);
  if (voteCount < quorum) return { quorum_reached: false, decided: false };
  
  const counts: { [option: string]: number } = {};
  for (const v of Object.values(proposal.votes)) {
    counts[v] = (counts[v] || 0) + 1;
  }
  
  const isExpired = Date.now() > proposal.vote_deadline;
  const hasMajority = Object.values(counts).some(c => c >= quorum);
  
  if (isExpired || hasMajority) {
    let maxCount = 0, winner = 'abstain';
    for (const [option, count] of Object.entries(counts)) {
      if (count > maxCount) { maxCount = count; winner = option; }
    }
    return { quorum_reached: true, decided: true, decision: winner };
  }
  
  return { quorum_reached: true, decided: false };
}

export function pauseSession(session: Session): Session {
  return { ...session, status: 'paused', updated_at: Date.now() };
}

export function resumeSession(session: Session): Session {
  return { ...session, status: 'active', updated_at: Date.now() };
}

export function completeSession(session: Session): Session {
  return { ...session, status: 'completed', updated_at: Date.now() };
}

export function cancelSession(session: Session, reason?: string): Session {
  return { ...session, status: 'cancelled', context: { ...session.context, cancel_reason: reason }, updated_at: Date.now() };
}

export function isExpired(session: Session): boolean {
  return Date.now() > session.expires_at;
}

export function createEvent(params: {
  type: string;
  session_id: string;
  actor_id: string;
  data?: any;
}): SessionEvent {
  return { ...params, timestamp: Date.now() };
}

export function getActiveMembers(session: Session): SessionMember[] {
  return session.members.filter(m => isMemberActive(session, m.node_id));
}

export function canReachQuorum(session: Session): boolean {
  return getActiveMembers(session).length >= session.consensus_config.quorum_size;
}
