import type { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import {
  UnauthorizedError,
  ForbiddenError,
  TrustLevelError,
  QuarantineError,
} from './errors';
import type { TrustLevel } from './types';

const prisma = new PrismaClient();

export interface AuthResult {
  node_id: string;
  trust_level: TrustLevel;
  auth_type: 'session' | 'node_secret' | 'api_key';
  scopes?: string[];
}

export async function authenticate(
  request: FastifyRequest,
): Promise<AuthResult> {
  const authHeader = request.headers.authorization;
  const sessionToken =
    request.cookies?.session_token ??
    request.headers['x-session-token'] as string | undefined;

  // Layer 1: Session Token (highest priority)
  if (sessionToken) {
    return authenticateSession(sessionToken);
  }

  // Layer 2 & 3: Bearer token (node_secret or api_key)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    if (token.startsWith('ek_')) {
      return authenticateApiKey(token);
    }

    return authenticateNodeSecret(token);
  }

  throw new UnauthorizedError();
}

async function authenticateSession(
  token: string,
): Promise<AuthResult> {
  const session = await prisma.userSession.findUnique({
    where: { token },
    include: { node: true },
  });

  if (!session) {
    throw new UnauthorizedError('Invalid session token');
  }

  if (new Date(session.expires_at) < new Date()) {
    throw new UnauthorizedError('Session expired');
  }

  return {
    node_id: session.node.node_id,
    trust_level: session.node.trust_level as TrustLevel,
    auth_type: 'session',
  };
}

async function authenticateNodeSecret(
  secret: string,
): Promise<AuthResult> {
  const node = await prisma.node.findFirst({
    where: { node_secret: secret },
  });

  if (!node) {
    throw new UnauthorizedError('Invalid node secret');
  }

  return {
    node_id: node.node_id,
    trust_level: node.trust_level as TrustLevel,
    auth_type: 'node_secret',
  };
}

async function authenticateApiKey(
  key: string,
): Promise<AuthResult> {
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');

  const apiKey = await prisma.apiKey.findFirst({
    where: { key_hash: keyHash },
    include: { node: true },
  });

  if (!apiKey) {
    throw new UnauthorizedError('Invalid API key');
  }

  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    throw new UnauthorizedError('API key expired');
  }

  return {
    node_id: apiKey.node.node_id,
    trust_level: apiKey.node.trust_level as TrustLevel,
    auth_type: 'api_key',
    scopes: apiKey.scopes,
  };
}

export function requireAuth() {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    request.auth = await authenticate(request);
  };
}

export function requireTrustLevel(minLevel: TrustLevel) {
  const levelOrder: Record<TrustLevel, number> = {
    unverified: 0,
    verified: 1,
    trusted: 2,
  };

  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const auth = await authenticate(request);
    if (levelOrder[auth.trust_level] < levelOrder[minLevel]) {
      throw new TrustLevelError(minLevel, auth.trust_level);
    }
    request.auth = auth;
  };
}

export function requireScope(scope: string) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const auth = await authenticate(request);
    if (auth.auth_type === 'api_key') {
      if (!auth.scopes?.includes(scope) && !auth.scopes?.includes('read')) {
        throw new ForbiddenError(`Missing required scope: ${scope}`);
      }
    }
    request.auth = auth;
  };
}

export async function checkQuarantine(nodeId: string): Promise<void> {
  const activeQuarantine = await prisma.quarantineRecord.findFirst({
    where: { node_id: nodeId, is_active: true },
  });

  if (activeQuarantine) {
    throw new QuarantineError(activeQuarantine.level);
  }
}

// Extend FastifyRequest
declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthResult;
  }
}
