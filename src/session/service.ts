import { v4 as uuidv4 } from 'uuid';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  SESSION_TTL_MS,
  MEMBER_TIMEOUT_MS,
  MAX_PARTICIPANTS,
} from '../shared/constants';
import {
  EvoMapError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  ConflictError,
} from '../shared/errors';
import { createUnconfiguredPrismaClient } from '../shared/prisma';
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

let prisma = createUnconfiguredPrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function getPrismaClient(prismaClient?: PrismaClient): PrismaClient {
  return prismaClient ?? prisma;
}

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

interface SessionBoardItemData {
  id: string;
  type: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface SessionBoardData {
  items: SessionBoardItemData[];
  pinned: string[];
}

interface SessionOrchestrationData {
  orchestration_id: string;
  session_id: string;
  mode?: 'sequential' | 'parallel' | 'hierarchical';
  task_graph?: Array<{ task_id: string; depends_on?: string[] }>;
  reassign?: Record<string, unknown>;
  force_converge?: boolean;
  task_board_updates?: unknown;
  status: 'started';
  started_by: string;
  started_at: string;
}

interface SessionSubmissionData {
  submission_id: string;
  session_id: string;
  task_id: string;
  result_asset_id: string;
  result?: unknown;
  summary?: string;
  submitted_by: string;
  submitted_at: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getSessionMembers(session: { members: unknown }): SessionMemberData[] {
  return Array.isArray(session.members)
    ? session.members as unknown as SessionMemberData[]
    : [];
}

function getSessionMessages(session: { messages: unknown }): SessionMessageData[] {
  return Array.isArray(session.messages)
    ? session.messages as unknown as SessionMessageData[]
    : [];
}

function getSessionContextRecord(context: unknown): Record<string, unknown> {
  return asRecord(context);
}

function getBoardFromContext(context: Record<string, unknown>): SessionBoardData {
  const board = asRecord(context.board);
  const items = Array.isArray(board.items)
    ? board.items.filter((item): item is SessionBoardItemData =>
      typeof item === 'object' && item !== null,
    )
    : [];
  const pinned = Array.isArray(board.pinned)
    ? board.pinned.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    items,
    pinned: pinned.filter((itemId) => items.some((item) => item.id === itemId)),
  };
}

function getSharedStateFromContext(context: Record<string, unknown>): Record<string, unknown> {
  return asRecord(context.shared_state);
}

function getOrchestrationsFromContext(context: Record<string, unknown>): SessionOrchestrationData[] {
  return Array.isArray(context.orchestrations)
    ? context.orchestrations.filter((entry): entry is SessionOrchestrationData =>
      typeof entry === 'object' && entry !== null,
    )
    : [];
}

function getSubmissionsFromContext(context: Record<string, unknown>): SessionSubmissionData[] {
  return Array.isArray(context.submissions)
    ? context.submissions.filter((entry): entry is SessionSubmissionData =>
      typeof entry === 'object' && entry !== null,
    )
    : [];
}

async function loadSession(sessionId: string, prismaClient?: PrismaClient) {
  const client = getPrismaClient(prismaClient);
  const session = await client.collaborationSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new NotFoundError('Session', sessionId);
  }

  return session;
}

function requireActiveSession(session: { status: string }): void {
  if (session.status !== 'active') {
    throw new ValidationError('Session is not active');
  }
}

function requireSessionMember(
  session: { members: unknown },
  nodeId: string,
  errorMessage: string,
): SessionMemberData[] {
  const members = getSessionMembers(session);
  const isMember = members.some((member) => member.node_id === nodeId && member.is_active);

  if (!isMember) {
    throw new ForbiddenError(errorMessage);
  }

  return members;
}

function canReadSession(
  session: { creator_id: string; status: string; members: unknown },
  nodeId: string,
): boolean {
  const isActiveMember = getSessionMembers(session)
    .some((member) => member.node_id === nodeId && member.is_active);

  if (isActiveMember) {
    return true;
  }

  return session.creator_id === nodeId
    && ['completed', 'cancelled', 'error', 'expired'].includes(session.status);
}

function requireSessionReader(
  session: { creator_id: string; status: string; members: unknown },
  nodeId: string,
  errorMessage: string,
): void {
  if (!canReadSession(session, nodeId)) {
    throw new ForbiddenError(errorMessage);
  }
}

function getNextUpdatedAt(previous: Date, now: Date): Date {
  return new Date(Math.max(now.getTime(), previous.getTime() + 1));
}

async function saveSessionContext(
  session: { id: string; updated_at: Date },
  context: Record<string, unknown>,
  now: Date,
  prismaClient?: PrismaClient,
): Promise<void> {
  const client = getPrismaClient(prismaClient);
  const nextUpdatedAt = getNextUpdatedAt(session.updated_at, now);
  const result = await client.collaborationSession.updateMany({
    where: {
      id: session.id,
      updated_at: session.updated_at,
    },
    data: {
      context: context as Prisma.InputJsonValue,
      updated_at: nextUpdatedAt,
    },
  });

  if (result.count === 0) {
    throw new ConflictError('Session context changed; retry');
  }
}

async function saveSessionState(
  session: { id: string; updated_at: Date },
  data: Record<string, unknown>,
  now: Date,
  prismaClient?: PrismaClient,
): Promise<Awaited<ReturnType<typeof loadSession>>> {
  const client = getPrismaClient(prismaClient);
  const nextUpdatedAt = getNextUpdatedAt(session.updated_at, now);
  const result = await client.collaborationSession.updateMany({
    where: {
      id: session.id,
      updated_at: session.updated_at,
    },
    data: {
      ...data,
      updated_at: nextUpdatedAt,
    },
  });

  if (result.count === 0) {
    throw new ConflictError('Session changed; retry');
  }

  return loadSession(session.id, client);
}

export async function createSession(
  creatorId: string,
  title: string,
  maxParticipants?: number,
  consensusConfig?: ConsensusConfig,
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
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

  const session = await client.collaborationSession.create({
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
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
  const session = await client.collaborationSession.findUnique({
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

  return saveSessionState(session, {
    members: updatedMembers as unknown as Prisma.InputJsonValue,
    vector_clock: updatedClock,
  }, now, client);
}

export async function leaveSession(
  sessionId: string,
  nodeId: string,
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
  const session = await client.collaborationSession.findUnique({
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

  return saveSessionState(session, {
    members: updatedMembers as unknown as Prisma.InputJsonValue,
    status: newStatus,
  }, now, client);
}

export async function sendMessage(
  sessionId: string,
  senderId: string,
  type: MessageType,
  content: string,
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
  const session = await client.collaborationSession.findUnique({
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

  const updated = await saveSessionState(session, {
    messages: updatedMessages as unknown as Prisma.InputJsonValue,
    vector_clock: updatedClock,
  }, now, client);

  return { session: updated, message };
}

export async function proposeConsensus(
  sessionId: string,
  proposerId: string,
  type: string,
  content: string,
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
  const session = await client.collaborationSession.findUnique({
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
    client,
  );

  return { proposal, message };
}

export async function voteConsensus(
  sessionId: string,
  proposalId: string,
  voterId: string,
  vote: 'approve' | 'reject',
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
  const session = await client.collaborationSession.findUnique({
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
    client,
  );

  return { vote: voteRecord, message: result.message };
}

export async function heartbeat(
  sessionId: string,
  nodeId: string,
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
  const session = await client.collaborationSession.findUnique({
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

  return saveSessionState(session, {
    members: updatedMembers as unknown as Prisma.InputJsonValue,
  }, now, client);
}

export async function getSession(
  sessionId: string,
  nodeId: string,
  prismaClient?: PrismaClient,
) {
  const session = await loadSession(sessionId, prismaClient);
  requireSessionReader(session, nodeId, 'Only session participants can access this session');
  return session;
}

export async function listSessions(input: ListSessionsInput, prismaClient?: PrismaClient) {
  const client = getPrismaClient(prismaClient);
  const { status, limit = 20, offset = 0 } = input;

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }

  const [sessions, total] = await Promise.all([
    client.collaborationSession.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    client.collaborationSession.count({ where }),
  ]);

  return { sessions, total, limit, offset };
}

export async function listSessionsForNode(
  nodeId: string,
  input: ListSessionsInput,
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
  const { status, limit = 20, offset = 0 } = input;

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }

  const sessionMemberships = await client.collaborationSession.findMany({
    where,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      creator_id: true,
      status: true,
      members: true,
    },
  });

  const memberSessionIds = sessionMemberships
    .filter((session) =>
      canReadSession(session, nodeId),
    )
    .map((session) => session.id);

  const pagedSessionIds = memberSessionIds.slice(offset, offset + limit);
  if (pagedSessionIds.length === 0) {
    return {
      sessions: [],
      total: memberSessionIds.length,
      limit,
      offset,
    };
  }

  const pagedSessions = await client.collaborationSession.findMany({
    where: {
      id: {
        in: pagedSessionIds,
      },
    },
  });

  const sessionsById = new Map(pagedSessions.map((session) => [session.id, session]));
  const readableSessions = pagedSessionIds
    .map((sessionId) => sessionsById.get(sessionId))
    .filter((session): session is typeof pagedSessions[number] => Boolean(session))
    .filter((session) => canReadSession(session, nodeId));

  return {
    sessions: readableSessions,
    total: sessionMemberships.filter((session) => canReadSession(session, nodeId)).length,
    limit,
    offset,
  };
}

export async function getSessionBoard(
  sessionId: string,
  nodeId: string,
  prismaClient?: PrismaClient,
) {
  const session = await loadSession(sessionId, prismaClient);
  requireSessionReader(session, nodeId, 'Only session readers can access the session board');

  const context = getSessionContextRecord(session.context);
  return {
    session_id: sessionId,
    board: getBoardFromContext(context),
    updated_at: session.updated_at.toISOString(),
  };
}

export async function updateSessionBoard(
  sessionId: string,
  nodeId: string,
  action: 'add' | 'remove' | 'pin' | 'unpin',
  item?: { id: string; type: string; content: string },
  itemId?: string,
  prismaClient?: PrismaClient,
) {
  const session = await loadSession(sessionId, prismaClient);
  requireActiveSession(session);
  requireSessionMember(session, nodeId, 'Only session members can update the session board');

  const context = getSessionContextRecord(session.context);
  const board = getBoardFromContext(context);
  const now = new Date();
  const nowIso = now.toISOString();

  switch (action) {
    case 'add': {
      if (!item?.id || !item.type || !item.content) {
        throw new ValidationError('item with id, type, and content is required for add');
      }

      const existingIndex = board.items.findIndex((entry) => entry.id === item.id);
      const existingItem = existingIndex >= 0 ? board.items[existingIndex] : undefined;
      const nextItem: SessionBoardItemData = existingItem
        ? {
          id: existingItem.id,
          type: item.type,
          content: item.content,
          created_by: existingItem.created_by,
          created_at: existingItem.created_at,
          updated_at: nowIso,
        }
        : {
          id: item.id,
          type: item.type,
          content: item.content,
          created_by: nodeId,
          created_at: nowIso,
          updated_at: nowIso,
        };

      if (existingIndex >= 0) {
        board.items[existingIndex] = nextItem;
      } else {
        board.items.push(nextItem);
      }
      break;
    }
    case 'remove': {
      if (!itemId) {
        throw new ValidationError('item_id is required for remove');
      }
      if (!board.items.some((entry) => entry.id === itemId)) {
        throw new ValidationError('item_id must reference an existing board item');
      }
      board.items = board.items.filter((entry) => entry.id !== itemId);
      board.pinned = board.pinned.filter((entry) => entry !== itemId);
      break;
    }
    case 'pin': {
      if (!itemId) {
        throw new ValidationError('item_id is required for pin');
      }
      if (!board.items.some((entry) => entry.id === itemId)) {
        throw new ValidationError('item_id must reference an existing board item');
      }
      if (!board.pinned.includes(itemId)) {
        board.pinned.push(itemId);
      }
      break;
    }
    case 'unpin': {
      if (!itemId) {
        throw new ValidationError('item_id is required for unpin');
      }
      board.pinned = board.pinned.filter((entry) => entry !== itemId);
      break;
    }
    default:
      throw new ValidationError('Invalid board action');
  }

  context.board = board;
  await saveSessionContext(session, context, now, prismaClient);

  return {
    session_id: sessionId,
    action,
    board,
    updated_by: nodeId,
    updated_at: nowIso,
  };
}

export async function orchestrateSession(
  sessionId: string,
  nodeId: string,
  input: {
    mode?: 'sequential' | 'parallel' | 'hierarchical';
    task_graph?: Array<{ task_id: string; depends_on?: string[] }>;
    reassign?: Record<string, unknown>;
    force_converge?: boolean;
    task_board_updates?: unknown;
  },
  prismaClient?: PrismaClient,
) {
  const session = await loadSession(sessionId, prismaClient);
  requireActiveSession(session);
  requireSessionMember(session, nodeId, 'Only session members can orchestrate the session');

  const context = getSessionContextRecord(session.context);
  const orchestrations = getOrchestrationsFromContext(context);
  const sharedState = getSharedStateFromContext(context);
  const now = new Date();
  const orchestratorId = typeof sharedState.orchestrator_id === 'string'
    ? sharedState.orchestrator_id
    : session.creator_id;

  if (nodeId !== orchestratorId) {
    throw new ForbiddenError('Only the session orchestrator can orchestrate the session');
  }

  if (
    input.mode === undefined
    && input.task_graph === undefined
    && input.reassign === undefined
    && input.force_converge === undefined
    && input.task_board_updates === undefined
  ) {
    throw new ValidationError('At least one orchestration directive is required');
  }

  const orchestration: SessionOrchestrationData = {
    orchestration_id: uuidv4(),
    session_id: sessionId,
    status: 'started',
    started_by: nodeId,
    started_at: now.toISOString(),
    ...(input.mode !== undefined ? { mode: input.mode } : {}),
    ...(input.task_graph !== undefined ? { task_graph: input.task_graph } : {}),
    ...(input.reassign !== undefined ? { reassign: input.reassign } : {}),
    ...(input.force_converge !== undefined ? { force_converge: input.force_converge } : {}),
    ...(input.task_board_updates !== undefined ? { task_board_updates: input.task_board_updates } : {}),
  };

  context.orchestrations = [...orchestrations, orchestration];
  context.shared_state = {
    ...sharedState,
    current_orchestration_id: orchestration.orchestration_id,
    orchestrator_id: orchestratorId,
    ...(input.mode !== undefined ? { orchestration_mode: input.mode } : {}),
    ...(input.force_converge ? { force_converge_requested_at: now.toISOString() } : {}),
  };

  await saveSessionContext(session, context, now, prismaClient);

  return orchestration;
}

export async function submitSessionResult(
  sessionId: string,
  nodeId: string,
  taskId: string,
  resultAssetId: string,
  options?: {
    result?: unknown;
    summary?: string;
  },
  prismaClient?: PrismaClient,
) {
  const session = await loadSession(sessionId, prismaClient);
  requireActiveSession(session);
  requireSessionMember(session, nodeId, 'Only session members can submit session results');

  const context = getSessionContextRecord(session.context);
  const submissions = getSubmissionsFromContext(context);
  const sharedState = getSharedStateFromContext(context);
  const now = new Date();
  const normalizedTaskId = taskId.trim();
  const normalizedResultAssetId = resultAssetId.trim();
  const normalizedSummary = options?.summary?.trim();
  const summary = normalizedSummary ? normalizedSummary : null;

  if (!normalizedTaskId || !normalizedResultAssetId) {
    throw new ValidationError('task_id and result_asset_id are required');
  }

  const submission: SessionSubmissionData = {
    submission_id: uuidv4(),
    session_id: sessionId,
    task_id: normalizedTaskId,
    result_asset_id: normalizedResultAssetId,
    submitted_by: nodeId,
    submitted_at: now.toISOString(),
    ...(options?.result !== undefined ? { result: options.result } : {}),
    ...(summary ? { summary } : {}),
  };

  context.submissions = [...submissions, submission];
  context.shared_state = {
    ...sharedState,
    latest_submission_id: submission.submission_id,
    latest_submission_by: nodeId,
    latest_submission_task_id: normalizedTaskId,
    latest_submission_asset_id: normalizedResultAssetId,
    latest_submission_summary: summary,
  };

  await saveSessionContext(session, context, now, prismaClient);

  return submission;
}

export async function getSessionContext(
  sessionId: string,
  nodeId: string,
  limit = 20,
  prismaClient?: PrismaClient,
) {
  const session = await loadSession(sessionId, prismaClient);
  requireSessionReader(
    session,
    nodeId,
    'Only session readers can access the session context',
  );
  const participants = getSessionMembers(session);
  const context = getSessionContextRecord(session.context);
  const normalizedLimit = Math.max(1, Math.min(limit, 100));

  return {
    session_id: sessionId,
    messages: getSessionMessages(session).slice(-normalizedLimit),
    participants: participants.filter((member) => member.is_active),
    shared_state: getSharedStateFromContext(context),
    board: getBoardFromContext(context),
    orchestrations: getOrchestrationsFromContext(context).slice(-normalizedLimit),
    submissions: getSubmissionsFromContext(context).slice(-normalizedLimit),
  };
}

export async function expireSessions(prismaClient?: PrismaClient) {
  const client = getPrismaClient(prismaClient);
  const now = new Date();

  const expired = await client.collaborationSession.findMany({
    where: {
      status: 'active',
      expires_at: { lt: now },
    },
  });

  for (const session of expired) {
    await client.collaborationSession.update({
      where: { id: session.id },
      data: { status: 'expired' as SessionStatus, updated_at: now },
    });
  }

  return { expired_count: expired.length };
}
