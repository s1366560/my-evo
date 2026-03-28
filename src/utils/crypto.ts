/**
 * Cryptographic utilities for EvoMap Hub.
 * Wraps Node.js crypto for consistent hashing and key derivation across modules.
 */

import * as crypto from 'crypto';

const HASH_ALGORITHM = 'sha256';
const KEYLEN = 32; // 256 bits for node_secret

/**
 * Compute SHA-256 hash of a string or buffer.
 * Used for asset content hashing and deduplication.
 */
export function sha256(data: string | Buffer): string {
  return crypto.createHash(HASH_ALGORITHM).update(data).digest('hex');
}

/**
 * Generate a cryptographically random hex string of given byte length.
 * Default 32 bytes = 64 hex chars (suitable for node_secret).
 */
export function randomHex(byteLength: number = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Derive a key using HKDF-SHA256.
 * Used for sub-key derivation from node_secret.
 */
export function hkdfKey(
  inputKey: string,
  salt: string,
  info: string,
  byteLength: number = 32
): string {
  return crypto
    .createHmac('sha256', salt)
    .update(inputKey)
    .digest('hex')
    .slice(0, byteLength * 2);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Useful for comparing secrets like node_secret.
 */
export function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Hash a buffer and return base64url-encoded digest.
 * Used for compact asset IDs.
 */
export function sha256Base64Url(data: string | Buffer): string {
  return crypto
    .createHash(HASH_ALGORITHM)
    .update(data)
    .digest('base64url');
}
