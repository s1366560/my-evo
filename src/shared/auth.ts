import type { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError, ForbiddenError, QuarantineError, TrustLevelError } from './errors';

// Augment FastifyRequest to include auth property
declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

// Auth types
export interface AuthContext {
  userId?: string;
  node_id?: string;
  auth_type: 'session' | 'api_key' | 'node_secret' | 'oauth';
  trust_level?: 'unverified' | 'verified' | 'trusted';
  scopes?: string[];
}

// Quick auth check - returns auth context or null
export async function authenticate(request: FastifyRequest): Promise<AuthContext | null> {
  // Check session token
  const sessionToken = request.cookies?.session_token;
  if (sessionToken) {
    try {
      const session = await request.server.prisma.userSession.findUnique({
        where: { token: sessionToken },
        include: { user: true },
      });
      if (session && session.expires_at > new Date()) {
        return {
          userId: session.user.id,
          node_id: session.user.node_id ?? undefined,
          auth_type: 'session',
          trust_level: session.user.trust_level as 'unverified' | 'verified' | 'trusted',
        };
      }
    } catch {
      return null;
    }
  }

  // Check Authorization header
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    // Check node secret
    if (token.startsWith('ns_')) {
      try {
        const node = await request.server.prisma.node.findFirst({
          where: { node_secret: token },
        });
        if (node) {
          return {
            node_id: node.node_id,
            auth_type: 'node_secret',
            trust_level: node.trust_level as 'unverified' | 'verified' | 'trusted',
          };
        }
      } catch {
        return null;
      }
    }

    // Check API key hash
    if (token.startsWith('ek_')) {
      try {
        // For API keys, find by prefix (stored separately from hash)
        const apiKey = await request.server.prisma.apiKey.findFirst({
          where: { prefix: token.substring(0, 16) },
          include: { user: true },
        });
        if (apiKey && apiKey.user) {
          return {
            userId: apiKey.user_id,
            node_id: apiKey.user.node_id ?? undefined,
            auth_type: 'api_key',
            trust_level: apiKey.user.trust_level as 'unverified' | 'verified' | 'trusted',
            scopes: apiKey.scopes as string[],
          };
        }
      } catch {
        return null;
      }
    }
  }

  return null;
}

// Middleware: requireNodeSecretAuth
export function requireNodeSecretAuth() {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing authorization header');
    }

    const token = authHeader.slice(7);
    if (!token.startsWith('ns_')) {
      throw new UnauthorizedError('Node secret credentials required');
    }

    try {
      const node = await request.server.prisma.node.findFirst({
        where: { node_secret: token },
      });

      if (!node) {
        throw new UnauthorizedError('Invalid node secret');
      }

      (request as FastifyRequest & { auth: AuthContext }).auth = {
        node_id: node.node_id,
        auth_type: 'node_secret',
        trust_level: node.trust_level as 'unverified' | 'verified' | 'trusted',
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError('Invalid node secret');
    }
  };
}

// Middleware: requireAuth
export function requireAuth() {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const auth = await authenticate(request);
    if (!auth) {
      throw new UnauthorizedError('Authentication required');
    }
    (request as FastifyRequest & { auth: AuthContext }).auth = auth;
  };
}

// Middleware: requireTrustLevel
export function requireTrustLevel(minLevel: 'verified' | 'trusted') {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const auth = await authenticate(request);
    if (!auth) {
      throw new UnauthorizedError('Authentication required');
    }

    const levelRank = { unverified: 0, verified: 1, trusted: 2 };
    const currentLevel = auth.trust_level ?? 'unverified';
    const minRank = levelRank[minLevel];

    if (levelRank[currentLevel] < minRank) {
      throw new TrustLevelError(`Trust level '${minLevel}' or higher required`);
    }

    (request as FastifyRequest & { auth: AuthContext }).auth = auth;
  };
}

// Middleware: requireNoActiveQuarantine
export function requireNoActiveQuarantine() {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const auth = await authenticate(request);
    if (!auth) {
      throw new UnauthorizedError('Authentication required');
    }

    if (auth.node_id) {
      try {
        const quarantine = await request.server.prisma.quarantineRecord.findFirst({
          where: {
            node_id: auth.node_id,
            is_active: true,
            OR: [
              { expires_at: undefined },
              { expires_at: { gt: new Date() } },
            ],
          },
        });
        if (quarantine) {
          throw new QuarantineError(`Node is under quarantine until ${quarantine.expires_at?.toISOString() ?? 'indefinite'}`);
        }
      } catch (error) {
        if (error instanceof QuarantineError) throw error;
      }
    }

    (request as FastifyRequest & { auth: AuthContext }).auth = auth;
  };
}

// Middleware: requireScope
export function requireScope(requiredScope: string) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing authorization header');
    }

    const token = authHeader.slice(7);
    if (!token.startsWith('ek_')) {
      throw new UnauthorizedError('API key required');
    }

    try {
      // For API keys, find by prefix
      const apiKey = await request.server.prisma.apiKey.findFirst({
        where: { prefix: token.substring(0, 16) },
        include: { user: true },
      });

      if (!apiKey || !apiKey.user) {
        throw new UnauthorizedError('Invalid API key');
      }

      const scopes = apiKey.scopes as string[] ?? [];
      if (!scopes.includes(requiredScope)) {
        throw new ForbiddenError(`Scope '${requiredScope}' required`);
      }

      (request as FastifyRequest & { auth: AuthContext }).auth = {
        userId: apiKey.user_id,
        node_id: apiKey.user.node_id ?? undefined,
        auth_type: 'api_key',
        trust_level: apiKey.user.trust_level as 'unverified' | 'verified' | 'trusted',
        scopes,
      };
    } catch (error) {
      if (error instanceof UnauthorizedError || error instanceof ForbiddenError) throw error;
      throw new UnauthorizedError('Invalid API key');
    }
  };
}

// Check quarantine status
export async function checkQuarantine(request: FastifyRequest, nodeId: string): Promise<boolean> {
  try {
    const quarantine = await request.server.prisma.quarantineRecord.findFirst({
      where: {
        node_id: nodeId,
        is_active: true,
        OR: [
          { expires_at: undefined },
          { expires_at: { gt: new Date() } },
        ],
      },
    });
    return !!quarantine;
  } catch {
    return false;
  }
}

// Quick check: authenticate node secret from Authorization header
export async function authenticateNodeSecretBearer(request: FastifyRequest): Promise<AuthContext | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (!token.startsWith('ns_')) return null;

  try {
    const node = await request.server.prisma.node.findFirst({
      where: { node_secret: token },
    });
    if (!node) return null;

    return {
      node_id: node.node_id,
      auth_type: 'node_secret',
      trust_level: node.trust_level as 'unverified' | 'verified' | 'trusted',
    };
  } catch {
    return null;
  }
}
