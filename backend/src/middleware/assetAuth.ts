// 3-layer authentication middleware for the assets marketplace.
// Resolution order:
//   1. Session token — Bearer JWT in Authorization header (existing `authenticate`)
//   2. API key — `ek_` prefix in `x-api-key` header (for node/CLI integrations)
//   3. Node secret — `X-Node-Secret` header paired with `X-Node-Id` (for trusted
//      evolver nodes signing programmatic calls)
//
// On resolution the request is augmented with `req.assetAuth = { kind, userId? }`.
// 401 if none match; 403 if the resolved identity cannot perform a required op.
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { HttpError } from './errorHandler.js';

export type AssetAuthKind = 'session' | 'api_key' | 'node_secret' | 'anonymous';

export interface AssetAuthIdentity {
  kind: AssetAuthKind;
  userId?: string;
  email?: string;
  role?: string;
  /** Raw API key prefix (only the first 8 chars) for audit logging */
  apiKeyPrefix?: string;
  nodeId?: string;
}

export interface AssetAuthRequest extends Request {
  assetAuth?: AssetAuthIdentity;
}

const API_KEY_PREFIX = 'ek_';
const NODE_ID_PATTERN = /^node_[a-zA-Z0-9_-]{1,80}$/;

// Tiny in-memory store of API keys for demo/mock mode.
// In production this would be backed by a DB table.
interface ApiKeyRecord {
  userId: string;
  email: string;
  role: string;
  key: string;
  createdAt: Date;
}
const apiKeys = new Map<string, ApiKeyRecord>();

export function registerApiKey(rec: Omit<ApiKeyRecord, 'createdAt'>): void {
  apiKeys.set(rec.key, { ...rec, createdAt: new Date() });
}

export function clearApiKeys(): void {
  apiKeys.clear();
}

// Node secrets — in production these come from a Node record in DB.
interface NodeSecretRecord {
  nodeId: string;
  secret: string;
  createdAt: Date;
}
const nodeSecrets = new Map<string, NodeSecretRecord>();

export function registerNodeSecret(rec: Omit<NodeSecretRecord, 'createdAt'>): void {
  nodeSecrets.set(rec.nodeId, { ...rec, createdAt: new Date() });
}

export function clearNodeSecrets(): void {
  nodeSecrets.clear();
}

function trySessionAuth(req: Request): AssetAuthIdentity | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    return {
      kind: 'session',
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

function tryApiKeyAuth(req: Request): AssetAuthIdentity | null {
  const key = req.headers['x-api-key'];
  if (typeof key !== 'string' || !key.startsWith(API_KEY_PREFIX)) return null;
  const rec = apiKeys.get(key);
  if (!rec) return null;
  return {
    kind: 'api_key',
    userId: rec.userId,
    email: rec.email,
    role: rec.role,
    apiKeyPrefix: key.slice(0, 8),
  };
}

function tryNodeSecretAuth(req: Request): AssetAuthIdentity | null {
  const nodeId = req.headers['x-node-id'];
  const secret = req.headers['x-node-secret'];
  if (typeof nodeId !== 'string' || typeof secret !== 'string') return null;
  if (!NODE_ID_PATTERN.test(nodeId)) return null;
  const rec = nodeSecrets.get(nodeId);
  if (!rec || rec.secret !== secret) return null;
  return { kind: 'node_secret', nodeId };
}

/**
 * Resolve the request's auth identity. Sets `req.assetAuth`. Never throws —
 * 401 is raised by callers (assetAuthRequired) when the identity is missing.
 */
export function resolveAssetAuth(req: AssetAuthRequest, _res: Response, next: NextFunction): void {
  const identity =
    trySessionAuth(req) ??
    tryApiKeyAuth(req) ??
    tryNodeSecretAuth(req) ??
    ({ kind: 'anonymous' } as AssetAuthIdentity);
  req.assetAuth = identity;
  next();
}

export const assetAuth = resolveAssetAuth;

export function assetAuthRequired(req: AssetAuthRequest, _res: Response, next: NextFunction): void {
  if (!req.assetAuth || req.assetAuth.kind === 'anonymous') {
    return next(new HttpError(401, 'Authentication required (session, ek_ API key, or node secret)'));
  }
  next();
}

/**
 * Require the request to be made by a human user (session or API key),
 * not by a node secret. Used for purchase/review/rating actions that
 * are not appropriate for a node identity.
 */
export function requireHumanIdentity(req: AssetAuthRequest, _res: Response, next: NextFunction): void {
  if (!req.assetAuth || req.assetAuth.kind === 'anonymous' || req.assetAuth.kind === 'node_secret') {
    return next(new HttpError(403, 'This action requires a human (session or ek_ API key) identity'));
  }
  next();
}

/**
 * Extract a userId from the resolved identity. Throws 401 if anonymous,
 * 403 if the caller has no human-like userId (e.g. node_secret without mapping).
 */
export function requireUserId(req: AssetAuthRequest): string {
  if (!req.assetAuth) throw new HttpError(401, 'Authentication required');
  if (req.assetAuth.kind === 'anonymous') throw new HttpError(401, 'Authentication required');
  if (req.assetAuth.kind === 'node_secret') {
    // Nodes have no implicit user; routes requiring a userId should use requireHumanIdentity
    throw new HttpError(403, 'Node identity cannot act on behalf of a user');
  }
  if (!req.assetAuth.userId) throw new HttpError(401, 'Identity is missing a userId');
  return req.assetAuth.userId;
}
