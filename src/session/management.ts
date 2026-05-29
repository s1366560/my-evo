import type { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import {
  SESSION_TOKEN_LENGTH,
  SESSION_EXPIRY_DAYS,
} from '../shared/constants';
import { createUnconfiguredPrismaClient } from '../shared/prisma';
import { NotFoundError, ValidationError } from '../shared/errors';

let prisma = createUnconfiguredPrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function getPrismaClient(prismaClient?: PrismaClient): PrismaClient {
  return prismaClient ?? prisma;
}

function generateToken(length: number = SESSION_TOKEN_LENGTH): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

// ===== Session Management Types =====
export interface SessionInfo {
  id: string;
  token_prefix: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  user_agent?: string;
  ip_address?: string;
  device_id?: string;
  last_active?: string;
}

export interface CreateSessionOptions {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
  deviceId?: string;
  rememberMe?: boolean;
  expiresAt?: Date;
}

// ===== Session Creation =====
export async function createEnhancedSession(
  options: CreateSessionOptions,
  prismaClient?: PrismaClient,
): Promise<{ token: string; session: SessionInfo }> {
  const client = getPrismaClient(prismaClient);

  const token = generateToken();
  const expiresAt = options.expiresAt ?? new Date(
    Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  // If rememberMe, extend expiry
  let finalExpiry = expiresAt;
  if (options.rememberMe) {
    finalExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
  }

  const session = await client.userSession.create({
    data: {
      token,
      user_id: options.userId,
      expires_at: finalExpiry,
    },
  });

  return {
    token,
    session: {
      id: session.id,
      token_prefix: token.slice(0, 8) + '...',
      user_id: session.user_id,
      created_at: session.created_at.toISOString(),
      expires_at: session.expires_at.toISOString(),
      is_active: new Date(session.expires_at) > new Date(),
      user_agent: options.userAgent,
      ip_address: options.ipAddress,
      device_id: options.deviceId,
    },
  };
}

// ===== Session Listing =====
export async function listUserSessions(
  userId: string,
  prismaClient?: PrismaClient,
): Promise<SessionInfo[]> {
  const client = getPrismaClient(prismaClient);

  const sessions = await client.userSession.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
  });

  const now = new Date();
  return sessions.map((s) => ({
    id: s.id,
    token_prefix: s.token.slice(0, 8) + '...',
    user_id: s.user_id,
    created_at: s.created_at.toISOString(),
    expires_at: s.expires_at.toISOString(),
    is_active: new Date(s.expires_at) > now,
  }));
}

// ===== Session Revocation =====
export async function revokeSession(
  userId: string,
  sessionId: string,
  prismaClient?: PrismaClient,
): Promise<void> {
  const client = getPrismaClient(prismaClient);

  const session = await client.userSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new NotFoundError('Session', sessionId);
  }

  if (session.user_id !== userId) {
    throw new ValidationError('Cannot revoke session belonging to another user');
  }

  await client.userSession.delete({
    where: { id: sessionId },
  });
}

// ===== Revoke All Sessions Except Current =====
export async function revokeAllSessionsExcept(
  userId: string,
  exceptSessionId: string,
  prismaClient?: PrismaClient,
): Promise<{ revoked_count: number }> {
  const client = getPrismaClient(prismaClient);

  const result = await client.userSession.deleteMany({
    where: {
      user_id: userId,
      id: { not: exceptSessionId },
    },
  });

  return { revoked_count: result.count };
}

// ===== Session Validation =====
export async function validateSession(
  token: string,
  prismaClient?: PrismaClient,
): Promise<{ valid: boolean; session?: SessionInfo; reason?: string }> {
  const client = getPrismaClient(prismaClient);

  const session = await client.userSession.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    return { valid: false, reason: 'Session not found' };
  }

  const now = new Date();
  if (new Date(session.expires_at) < now) {
    // Clean up expired session
    await client.userSession.delete({ where: { id: session.id } });
    return { valid: false, reason: 'Session expired' };
  }

  return {
    valid: true,
    session: {
      id: session.id,
      token_prefix: token.slice(0, 8) + '...',
      user_id: session.user_id,
      created_at: session.created_at.toISOString(),
      expires_at: session.expires_at.toISOString(),
      is_active: true,
    },
  };
}

// ===== Extend Session =====
export async function extendSession(
  userId: string,
  sessionId: string,
  additionalDays: number = SESSION_EXPIRY_DAYS,
  prismaClient?: PrismaClient,
): Promise<SessionInfo> {
  const client = getPrismaClient(prismaClient);

  const session = await client.userSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new NotFoundError('Session', sessionId);
  }

  if (session.user_id !== userId) {
    throw new ValidationError('Cannot extend session belonging to another user');
  }

  const newExpiry = new Date(
    Date.now() + additionalDays * 24 * 60 * 60 * 1000,
  );

  const updated = await client.userSession.update({
    where: { id: sessionId },
    data: { expires_at: newExpiry },
  });

  return {
    id: updated.id,
    token_prefix: updated.token.slice(0, 8) + '...',
    user_id: updated.user_id,
    created_at: updated.created_at.toISOString(),
    expires_at: updated.expires_at.toISOString(),
    is_active: true,
  };
}

// ===== Session Statistics =====
export async function getSessionStats(
  userId: string,
  prismaClient?: PrismaClient,
): Promise<{
  total_sessions: number;
  active_sessions: number;
  expired_sessions: number;
  oldest_session?: string;
  newest_session?: string;
}> {
  const client = getPrismaClient(prismaClient);

  const sessions = await client.userSession.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'asc' },
  });

  const now = new Date();
  const activeSessions = sessions.filter(
    (s) => new Date(s.expires_at) > now,
  );
  const expiredSessions = sessions.filter(
    (s) => new Date(s.expires_at) <= now,
  );

  // Clean up expired sessions
  if (expiredSessions.length > 0) {
    await client.userSession.deleteMany({
      where: {
        user_id: userId,
        id: { in: expiredSessions.map((s) => s.id) },
      },
    });
  }

  return {
    total_sessions: sessions.length,
    active_sessions: activeSessions.length,
    expired_sessions: expiredSessions.length,
    oldest_session: sessions[0]?.created_at.toISOString(),
    newest_session: sessions[sessions.length - 1]?.created_at.toISOString(),
  };
}

// ===== Token Refresh =====
export async function refreshSessionToken(
  userId: string,
  sessionId: string,
  prismaClient?: PrismaClient,
): Promise<{ new_token: string; session: SessionInfo }> {
  const client = getPrismaClient(prismaClient);

  const session = await client.userSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new NotFoundError('Session', sessionId);
  }

  if (session.user_id !== userId) {
    throw new ValidationError('Cannot refresh session belonging to another user');
  }

  // Generate new token
  const newToken = generateToken();

  const updated = await client.userSession.update({
    where: { id: sessionId },
    data: { token: newToken },
  });

  return {
    new_token: newToken,
    session: {
      id: updated.id,
      token_prefix: newToken.slice(0, 8) + '...',
      user_id: updated.user_id,
      created_at: updated.created_at.toISOString(),
      expires_at: updated.expires_at.toISOString(),
      is_active: true,
    },
  };
}
