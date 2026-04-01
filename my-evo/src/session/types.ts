/**
 * Session Types
 */

export type SessionStatus = 'creating' | 'active' | 'paused' | 'completed' | 'cancelled' | 'error' | 'expired';
export type MessageType = 'subtask_result' | 'query' | 'response' | 'vote' | 'signal' | 'system' | 'operation';
export type ConsensusAlgorithm = 'raft_like' | 'majority' | 'unanimous';

export interface VectorClock {
  clocks: { [nodeId: string]: number };
}

export interface SessionMessage {
  id: string;
  session_id: string;
  type: MessageType;
  from: string;
  content: any;
  vector_clock: VectorClock;
  causal_dependencies: string[];
  timestamp: number;
}

export interface Session {
  id: string;
  title: string;
  status: SessionStatus;
  creator_id: string;
  members: SessionMember[];
  context: Record<string, any>;
  max_participants: number;
  consensus_config: ConsensusConfig;
  vector_clock: VectorClock;
  messages: SessionMessage[];
  created_at: number;
  updated_at: number;
  expires_at: number;
}

export interface SessionMember {
  node_id: string;
  role: 'organizer' | 'participant' | 'observer';
  joined_at: number;
  last_heartbeat: number;
}

export interface ConsensusConfig {
  algorithm: ConsensusAlgorithm;
  quorum_size: number;
  timeout_ms: number;
}

export interface ConsensusProposal {
  id: string;
  session_id: string;
  proposer_id: string;
  type: 'decision' | 'vote' | 'kick';
  description: string;
  options?: string[];
  votes: { [nodeId: string]: string };
  vote_deadline: number;
  quorum_reached?: boolean;
  decided?: boolean;
  decision?: string;
}

export interface Operation {
  id: string;
  type: 'code_edit' | 'comment' | 'status_change';
  from: string;
  patch?: any;
  vector_clock: VectorClock;
  timestamp: number;
}

export interface SessionEvent {
  type: string;
  session_id: string;
  actor_id: string;
  data?: any;
  timestamp: number;
}
