/**
 * Account API Keys Module
 * Implements evomap.ai API Access (Ch28) account API key management endpoints
 * 
 * Endpoints:
 * - POST   /account/api-keys     — Create a new API key
 * - GET    /account/api-keys     — List active API keys  
 * - DELETE /account/api-keys/:id — Revoke an API key
 * 
 * Auth: Session authentication required (not API key, to prevent key inception)
 */

import { randomBytes } from 'crypto';

// ==================== Types ====================

export interface ApiKey {
  id: string;
  key: string;           // ek_ + 48 hex chars — shown only once at creation
  prefix: string;         // ek_ + first 5 hex chars for display
  name: string;
  scopes: string[];
  expires_at: number | null;
  created_at: number;
  user_id: string;       // owner
}

// In-memory store (replace with DB in production)
const apiKeys = new Map<string, ApiKey>();         // id -> ApiKey
const keyIndex = new Map<string, string>();         // full key -> id (for lookup, short-lived)
const userKeys = new Map<string, Set<string>>();    // user_id -> Set of key ids

// Session store for session auth (separate from A2A node sessions)
interface Session {
  id: string;
  user_id: string;
  created_at: number;
  expires_at: number;
}
const sessions = new Map<string, Session>();        // token -> Session

// ==================== Helpers ====================

function generateApiKey(): { key: string; prefix: string } {
  const bytes = randomBytes(24); // 24 bytes = 48 hex chars
  const hex = bytes.toString('hex');
  return { key: `ek_${hex}`, prefix: `ek_${hex.slice(0, 5)}` };
}

function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function createSession(userId: string, ttlMs = 30 * 24 * 60 * 60 * 1000): string {
  const token = generateSessionToken();
  sessions.set(token, {
    id: token,
    user_id: userId,
    created_at: Date.now(),
    expires_at: Date.now() + ttlMs,
  });
  return token;
}

export function validateSession(token: string): string | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expires_at) {
    sessions.delete(token);
    return null;
  }
  return session.user_id;
}

// ==================== API Key Operations ====================

export interface CreateApiKeyOptions {
  name: string;
  scopes?: string[];
  expires_in_days?: number;
  user_id: string;
}

export function createApiKey(opts: CreateApiKeyOptions): ApiKey {
  const { key, prefix } = generateApiKey();
  const id = `key_${randomBytes(12).toString('hex')}`;
  
  const apiKey: ApiKey = {
    id,
    key,
    prefix,
    name: opts.name,
    scopes: opts.scopes ?? ['kg'],
    expires_at: opts.expires_in_days
      ? Date.now() + opts.expires_in_days * 24 * 60 * 60 * 1000
      : null,
    created_at: Date.now(),
    user_id: opts.user_id,
  };

  apiKeys.set(id, apiKey);
  
  // Index by full key for quick lookup (but don't persist full key long-term)
  keyIndex.set(key, id);
  
  if (!userKeys.has(opts.user_id)) {
    userKeys.set(opts.user_id, new Set());
  }
  userKeys.get(opts.user_id)!.add(id);

  return apiKey;
}

export function listApiKeys(userId: string): ApiKey[] {
  const ids = userKeys.get(userId);
  if (!ids) return [];
  
  const now = Date.now();
  const result: ApiKey[] = [];
  
  for (const id of ids) {
    const k = apiKeys.get(id);
    if (!k) continue;
    // Skip expired keys
    if (k.expires_at && k.expires_at < now) {
      apiKeys.delete(id);
      userKeys.get(userId)!.delete(id);
      keyIndex.delete(k.key);
      continue;
    }
    // Return without the full key (security)
    const { key: _fullKey, ...safeKey } = k;
    result.push(safeKey as ApiKey);
  }
  
  return result;
}

export function revokeApiKey(keyId: string, userId: string): boolean {
  const k = apiKeys.get(keyId);
  if (!k) return false;
  if (k.user_id !== userId) return false; // Can only revoke your own keys
  
  apiKeys.delete(keyId);
  keyIndex.delete(k.key);
  userKeys.get(userId)?.delete(keyId);
  
  return true;
}

export function getApiKey(key: string): ApiKey | null {
  // Look up by full key
  const id = keyIndex.get(key);
  if (!id) return null;
  const k = apiKeys.get(id);
  if (!k) return null;
  if (k.expires_at && k.expires_at < Date.now()) {
    apiKeys.delete(id);
    keyIndex.delete(key);
    userKeys.get(k.user_id)?.delete(id);
    return null;
  }
  return k;
}

// ==================== Stats ====================

export function getAccountStats(userId: string) {
  const keys = listApiKeys(userId);
  const active = keys.filter(k => !k.expires_at || k.expires_at > Date.now()).length;
  return {
    total_keys: keys.length,
    active_keys: active,
    max_keys: 5,
  };
}
