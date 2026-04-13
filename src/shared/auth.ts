import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import {
  EvoMapError,
  UnauthorizedError,
  ForbiddenError,
  TrustLevelError,
  QuarantineError,
} from './errors';
import type { TrustLevel } from './types';

let prisma: PrismaClient | undefined;

export interface AuthResult {
  node_id: string;
  userId?: string;
  trust_level: TrustLevel;
  auth_type: 'session' | 'node_secret' | 'api_key';
  scopes?: string[];
}

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function getPrismaClient(request?: FastifyRequest): PrismaClient {
  const serverPrisma = (
    request?.server as FastifyInstance & { prisma?: PrismaClient } | undefined
  )?.prisma;

  if (serverPrisma) {
    return serverPrisma;
  }

  if (prisma) {
    return prisma;
  }

  throw new EvoMapError('Prisma client not configured', 'INTERNAL_ERROR', 500);
}

export async function authenticate(
  request: FastifyRequest,
): Promise<AuthResult> {
  const prismaClient = getPrismaClient(request);
  const authHeader = request.headers.authorization;
  const sessionToken =
    request.cookies?.session_token ??
    request.headers['x-session-token'] as string | undefined;

  // Layer 1: Session Token (highest priority)
  if (sessionToken) {
    return authenticateSession(prismaClient, sessionToken);
  }

  // Layer 2 & 3: Bearer token (node_secret or api_key)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    if (token.startsWith('ek_')) {
      return authenticateApiKey(prismaClient, token);
    }

    return authenticateNodeSecret(prismaClient, token);
  }

  throw new UnauthorizedError();
}

async function authenticateSession(
  prismaClient: PrismaClient,
  token: string,
): Promise<AuthResult> {
  const session = await prismaClient.userSession.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    throw new UnauthorizedError('Invalid session token');
  }

  if (new Date(session.expires_at) < new Date()) {
    throw new UnauthorizedError('Session expired');
  }

  return {
    node_id: session.user.node_id ?? `user-${session.user.id}`,
    userId: session.user.id,
    trust_level: session.user.trust_level as TrustLevel,
    auth_type: 'session',
  };
}

async function authenticateNodeSecret(
  prismaClient: PrismaClient,
  secret: string,
): Promise<AuthResult> {
  const node = await prismaClient.node.findFirst({
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
  prismaClient: PrismaClient,
  key: string,
): Promise<AuthResult> {
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');

  const apiKey = await prismaClient.apiKey.findFirst({
    where: { key_hash: keyHash },
    include: { user: true },
  });

  if (!apiKey) {
    throw new UnauthorizedError('Invalid API key');
  }

  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    throw new UnauthorizedError('API key expired');
  }

  return {
    node_id: apiKey.user.node_id ?? `user-${apiKey.user.id}`,
    userId: apiKey.user.id,
    trust_level: apiKey.user.trust_level as TrustLevel,
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

export async function checkQuarantine(
  nodeId: string,
  prismaClient?: PrismaClient,
): Promise<void> {
  const client = prismaClient ?? prisma;

  if (!client) {
    throw new EvoMapError('Prisma client not configured', 'INTERNAL_ERROR', 500);
  }

  const activeQuarantine = await client.quarantineRecord.findFirst({
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
