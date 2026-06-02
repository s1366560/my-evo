// Short-lived signed state tokens for OAuth flows.
//
// Each state token is HMAC-signed with JWT_SECRET and contains:
//   - jti:       random unique id (used for single-use tracking)
//   - provider:  provider name the state was issued for
//   - iat:       issued-at timestamp (ms since epoch)
//
// On issuance, the jti is recorded in an in-memory OAuthStateStore (Map keyed
// by jti) with a 10-minute TTL. On callback validation, the jti is atomically
// consumed so a replay of the same state token always fails.
//
// Error codes returned to the controller (stable for clients/tests):
//   missing_state       — no token supplied
//   malformed_state     — token is not a 2-part base64url string
//   bad_signature       — HMAC signature mismatch
//   malformed_payload   — body could not be JSON-decoded
//   missing_jti         — jti claim is absent
//   missing_iat         — iat claim is absent
//   expired             — iat is older than the TTL
//   provider_mismatch   — state was issued for a different provider
//   unknown_jti         — jti was not previously issued (replay or forgery)
//   already_consumed    — jti was already used on a previous callback

import crypto from 'crypto';
import { config } from '../config/index.js';

export const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface StatePayload {
  /** JWT ID — random unique id used for single-use tracking. */
  jti: string;
  /** Provider name the state token was issued for. */
  provider: string;
  /** Issued-at timestamp (ms since epoch). */
  iat: number;
}

interface StateRecord {
  jti: string;
  provider: string;
  issuedAt: number;
  consumed: boolean;
  consumedAt?: number;
}

export interface StateValidationOk { ok: true; payload: StatePayload; }
export interface StateValidationErr { ok: false; reason: string; }
export type StateValidation = StateValidationOk | StateValidationErr;

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function getSecret(): string {
  return config.jwtSecret || 'dev-secret';
}

function sign(payload: string): string {
  return b64url(
    crypto.createHmac('sha256', getSecret()).update(payload).digest()
  );
}

/**
 * In-memory store for issued OAuth state jtis.
 * Provides TTL eviction and atomic single-use consumption.
 */
export class OAuthStateStore {
  private records = new Map<string, StateRecord>();
  private ttlMs: number;

  constructor(ttlMs: number = STATE_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  /** Record a freshly issued jti. Returns the record. */
  issue(jti: string, provider: string, now: number = Date.now()): StateRecord {
    const record: StateRecord = { jti, provider, issuedAt: now, consumed: false };
    this.records.set(jti, record);
    return record;
  }

  /**
   * Atomically check + mark a jti as consumed.
   * Returns the record on success, or null if the jti is unknown, expired, or
   * already consumed. The caller should map the null result to a 400.
   */
  consume(jti: string, now: number = Date.now()): StateRecord | null {
    this.evict(now);
    const record = this.records.get(jti);
    if (!record) return null;
    if (record.consumed) return null;
    if (now - record.issuedAt > this.ttlMs) return null;
    record.consumed = true;
    record.consumedAt = now;
    return record;
  }

  /** Look up a record without mutating it (test/diagnostic helper). */
  peek(jti: string, now: number = Date.now()): StateRecord | null {
    this.evict(now);
    return this.records.get(jti) || null;
  }

  /** Drop entries older than the TTL. Called automatically by consume/peek. */
  evict(now: number = Date.now()): number {
    let removed = 0;
    for (const [jti, rec] of this.records.entries()) {
      if (now - rec.issuedAt > this.ttlMs) {
        this.records.delete(jti);
        removed++;
      }
    }
    return removed;
  }

  clear(): void {
    this.records.clear();
  }

  size(): number {
    return this.records.size;
  }
}

/**
 * Process-wide OAuth state store. Tests can call `__resetOAuthStateStore()`
 * or use a custom `OAuthStateStore` via `setOAuthStateStore` for isolation.
 */
export const oauthStateStore = new OAuthStateStore();

let activeStore: OAuthStateStore = oauthStateStore;
export function setOAuthStateStore(store: OAuthStateStore): void {
  activeStore = store;
}
export function getOAuthStateStore(): OAuthStateStore {
  return activeStore;
}
export function __resetOAuthStateStore(): void {
  activeStore.clear();
}

/** Issue a fresh state token and register its jti in the active store. */
export function createStateToken(provider: string): string {
  const jti = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  activeStore.issue(jti, provider, now);
  const payload: StatePayload = { jti, provider, iat: now };
  const body = b64url(JSON.stringify(payload));
  const sig = sign(body);
  return `${body}.${sig}`;
}

/**
 * Validate a state token: signature, format, TTL, and single-use semantics.
 * On success the jti is marked consumed; subsequent replays return unknown_jti
 * or already_consumed.
 */
export function validateStateToken(
  token: string | undefined | null,
  expectedProvider: string,
  now: number = Date.now()
): StateValidation {
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'missing_state' };
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return { ok: false, reason: 'malformed_state' };
  }
  const [body, sig] = parts;
  const expectedSig = sign(body);
  // Constant-time comparison
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, reason: 'bad_signature' };
  }
  let payload: StatePayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString('utf8')) as StatePayload;
  } catch {
    return { ok: false, reason: 'malformed_payload' };
  }
  if (!payload.jti || typeof payload.jti !== 'string') {
    return { ok: false, reason: 'missing_jti' };
  }
  if (typeof payload.iat !== 'number') {
    return { ok: false, reason: 'missing_iat' };
  }
  if (now - payload.iat > STATE_TTL_MS) {
    return { ok: false, reason: 'expired' };
  }
  if (payload.provider !== expectedProvider) {
    return { ok: false, reason: 'provider_mismatch' };
  }
  const record = activeStore.consume(payload.jti, now);
  if (!record) {
    // Distinguish unknown jti from already-consumed using a non-mutating peek.
    const peeked = activeStore.peek(payload.jti, now);
    if (!peeked) {
      return { ok: false, reason: 'unknown_jti' };
    }
    if (peeked.consumed) {
      return { ok: false, reason: 'already_consumed' };
    }
    // Peek exists and is not consumed but consume() returned null → expired between calls.
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, payload };
}
