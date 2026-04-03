import type {
  SessionStatus,
  MessageType,
  CollaborationSession,
  SessionMember,
  SessionMessage,
  VectorClock,
  ConsensusConfig,
} from '../shared/types';

export {
  SessionStatus,
  MessageType,
  CollaborationSession,
  SessionMember,
  SessionMessage,
  VectorClock,
  ConsensusConfig,
};

export interface CreateSessionInput {
  creatorId: string;
  title: string;
  maxParticipants?: number;
  consensusConfig?: ConsensusConfig;
}

export interface JoinSessionInput {
  sessionId: string;
  nodeId: string;
}

export interface LeaveSessionInput {
  sessionId: string;
  nodeId: string;
}

export interface SendMessageInput {
  sessionId: string;
  senderId: string;
  type: MessageType;
  content: string;
}

export interface ProposeConsensusInput {
  sessionId: string;
  proposerId: string;
  type: string;
  content: string;
}

export interface VoteConsensusInput {
  sessionId: string;
  proposalId: string;
  voterId: string;
  vote: 'approve' | 'reject';
}

export interface HeartbeatInput {
  sessionId: string;
  nodeId: string;
}

export interface ListSessionsInput {
  status?: SessionStatus;
  limit?: number;
  offset?: number;
}
