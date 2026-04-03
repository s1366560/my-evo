import { v4 as uuidv4 } from 'uuid';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  SESSION_TTL_MS,
  MEMBER_TIMEOUT_MS,
  MAX_PARTICIPANTS,
} from '../shared/constants';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../shared/errors';
import type {
  SessionStatus,
  MessageType,
  VectorClock,
  ConsensusConfig,
} from '../shared/types';
import type {
  CreateSessionInput,
  SendMessageInput,
  ProposeConsensusInput,
  VoteConsensusInput,
  ListSessionsInput,
} from './types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export { prisma };

interface SessionMemberData {
  node_id: string;
  role: 'organizer' | 'participant' | 'observer';
  joined_at: string;
  last_heartbeat: string;
  is_active: boolean;
}

interface SessionMessageData {
  id: string;
  session_id: string;
  sender_id: string;
  type: string;
  content: string;
  vector_clock: Record<string, number>;
  timestamp: string;
}

export async function createSession(
  creatorId: string,
  title: string,
  maxParticipants?: number,
  consensusConfig?: ConsensusConfig,
) {
  const effectiveMax = maxParticipants ?? MAX_PARTICIPANTS;
  if (effectiveMax < 2 || effectiveMax > 50) {
    throw new ValidationError('maxParticipants must be between 2 and 50');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  const creatorMember: SessionMemberData = {
    node_id: creatorId,
    role: 'organizer',
    joined_at: now.toISOString(),
    last_heartbeat: now.toISOString(),
    is_active: true,
  };

  const defaultConfig: ConsensusConfig = consensusConfig ?? {
    algorithm: 'majority',
    quorum: Math.ceil(effectiveMax / 2),
  };

  const session = await prisma.collaborationSession.create({
    data: {
      title,
      status: 'active',
      creator_id: creatorId,
      members: [creatorMember] as unknown as Prisma.InputJsonValue,
      context: {},
      max_participants: effectiveMax,
      consensus_config: defaultConfig as unknown as Prisma.InputJsonValue,
      vector_clock: {},
      messages: [],
      created_at: now,
      updated_at: now,
      expires_at: expiresAt,
    },
  });

  return session;
}

export async function joinSession(
  sessionId: string,
  nodeId: string,
) {
  const session = await prisma.collaborationSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new NotFoundError('Session', sessionId);
  }

  if (session.status !== 'active') {
    throw new ValidationError('Session is not active');
  }

  const members = (session.members as unknown) as SessionMemberData[];
  const activeMembers = members.filter((m) => m.is_active);

  if (activeMembers.length >= session.max_participants) {
    throw new ValidationError('Session is full');
  }

  const alreadyJoined = members.some(
    (m) => m.node_id === nodeId && m.is_active,
  );
  if (alreadyJoined) {
    throw new ValidationError('Node is already in this session');
  }

  const now = new Date();
  const newMember: SessionMemberData = {
    node_id: nodeId,
    role: 'participant',
    joined_at: now.toISOString(),
    last_heartbeat: now.toISOString(),
    is_active: true,
  };

  const updatedMembers = [...members, newMember];
  const updatedClock = {
    ...((session.vector_clock as Record<string, number>) ?? {}),
    [nodeId]: 0,
  };

  const updated = await prisma.collaborationSession.update({
    where: { id: sessionId },
    data: {
      members: updatedMembers as unknown as Prisma.InputJsonValue,
      vector_clock: updatedClock,
      updated_at: now,
    },
  });

  return updated;
}

export async function leaveSession(
  sessionId: string,
  nodeId: string,
) {
  const session = await prisma.collaborationSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new NotFoundError('Session', sessionId);
  }

  const members = (session.members as unknown) as SessionMemberData[];
  const memberIndex = members.findIndex(
    (m) => m.node_id === nodeId && m.is_active,
  );

  if (memberIndex === -1) {
    throw new ValidationError('Node is not in this session');
  }

  const now = new Date();
  const updatedMembers = members.map((m, i) =>
    i === memberIndex ? { ...m, is_active: false } : m,
  );

  const activeMembers = updatedMembers.filter((m) => m.is_active);
  const newStatus: SessionStatus = activeMembers.length === 0 ? 'cancelled' : (session.status as SessionStatus);

  const updated = await prisma.collaborationSession.update({
    where: { id: sessionId },
    data: {
      members: updatedMembers as unknown as Prisma.InputJsonValue,
      status: newStatus,
      updated_at: now,
    },
  });

  return updated;
}

export async function sendMessage(
  sessionId: string,
  senderId: string,
  type: MessageType,
  content: string,
) {
  const session = await prisma.collaborationSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new NotFoundError('Session', sessionId);
  }

  if (session.status !== 'active') {
    throw new ValidationError('Session is not active');
  }

  const members = (session.members as unknown) as SessionMemberData[];
  const isMember = members.some(
    (m) => m.node_id === senderId && m.is_active,
  );
  if (!isMember) {
    throw new ForbiddenError('Only session members can send messages');
  }

  const now = new Date();
  const currentClock = (session.vector_clock as Record<string, number>) ?? {};
  const updatedClock = {
    ...currentClock,
    [senderId]: (currentClock[senderId] ?? 0) + 1,
  };

  const message: SessionMessageData = {
    id: uuidv4(),
    session_id: sessionId,
    sender_id: senderId,
    type,
    content,
    vector_clock: { ...updatedClock },
    timestamp: now.toISOString(),
  };

  const existingMessages = (session.messages as unknown) as SessionMessageData[];
  const updatedMessages = [...existingMessages, message];

  const updated = await prisma.collaborationSession.update({
    where: { id: sessionId },
    data: {
      messages: updatedMessages as unknown as Prisma.InputJsonValue,
      vector_clock: updatedClock,
      updated_at: now,
    },
  });

  return { session: updated, message };
}

export async function proposeConsensus(
  sessionId: string,
  proposerId: string,
  type: string,
  content: string,
) {
  const session = await prisma.collaborationSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new NotFoundError('Session', sessionId);
  }

  if (session.status !== 'active') {
    throw new ValidationError('Session is not active');
  }

  const members = (session.members as unknown) as SessionMemberData[];
  const isMember = members.some(
    (m) => m.node_id === proposerId && m.is_active,
  );
  if (!isMember) {
    throw new ForbiddenError('Only session members can propose consensus');
  }

  const proposal = {
    id: uuidv4(),
    session_id: sessionId,
    proposer_id: proposerId,
    type,
    content,
    votes: [] as Array<{ voter_id: string; vote: string; timestamp: string }>,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  const message = await sendMessage(
    sessionId,
    proposerId,
    'vote' as MessageType,
    JSON.stringify({ type: 'consensus_proposal', proposal }),
  );

  return { proposal, message };
}

export async function voteConsensus(
  sessionId: string,
  proposalId: string,
  voterId: string,
  vote: 'approve' | 'reject',
) {
  const session = await prisma.collaborationSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new NotFoundError('Session', sessionId);
  }

  const members = (session.members as unknown) as SessionMemberData[];
  const isMember = members.some(
    (m) => m.node_id === voterId && m.is_active,
  );
  if (!isMember) {
    throw new ForbiddenError('Only session members can vote');
  }

  const now = new Date();
  const voteRecord = {
    voter_id: voterId,
    vote,
    timestamp: now.toISOString(),
  };

  const result = await sendMessage(
    sessionId,
    voterId,
    'vote' as MessageType,
    JSON.stringify({ type: 'consensus_vote', proposal_id: proposalId, vote }),
  );

  return { vote: voteRecord, message: result.message };
}

export async function heartbeat(
  sessionId: string,
  nodeId: string,
) {
  const session = await prisma.collaborationSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new NotFoundError('Session', sessionId);
  }

  if (session.status !== 'active') {
    throw new ValidationError('Session is not active');
  }

  const members = (session.members as unknown) as SessionMemberData[];
  const memberIndex = members.findIndex(
    (m) => m.node_id === nodeId && m.is_active,
  );

  if (memberIndex === -1) {
    throw new ValidationError('Node is not an active member of this session');
  }

  const now = new Date();
  const updatedMembers = members.map((m, i) =>
    i === memberIndex ? { ...m, last_heartbeat: now.toISOString() } : m,
  );

  const updated = await prisma.collaborationSession.update({
    where: { id: sessionId },
    data: {
      members: updatedMembers as unknown as Prisma.InputJsonValue,
      updated_at: now,
    },
  });

  return updated;
}

export async function getSession(sessionId: string) {
  const session = await prisma.collaborationSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new NotFoundError('Session', sessionId);
  }

  return session;
}

export async function listSessions(input: ListSessionsInput) {
  const { status, limit = 20, offset = 0 } = input;

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }

  const [sessions, total] = await Promise.all([
    prisma.collaborationSession.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.collaborationSession.count({ where }),
  ]);

  return { sessions, total, limit, offset };
}

export async function expireSessions() {
  const now = new Date();

  const expired = await prisma.collaborationSession.findMany({
    where: {
      status: 'active',
      expires_at: { lt: now },
    },
  });

  for (const session of expired) {
    await prisma.collaborationSession.update({
      where: { id: session.id },
      data: { status: 'expired' as SessionStatus, updated_at: now },
    });
  }

  return { expired_count: expired.length };
}
