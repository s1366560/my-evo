/**
 * EvoMap GEP Protocol - Cryptographic Utilities
 * Asset ID computation using SHA-256 + Canonical JSON
 */

import crypto from 'crypto';

/**
 * Sort object keys recursively for canonical JSON
 */
export function sortKeys<T extends Record<string, unknown>>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => 
      typeof item === 'object' && item !== null 
        ? sortKeys(item as Record<string, unknown>) 
        : item
    ) as unknown as T;
  }

  const sorted = Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        acc[key] = sortKeys(value as Record<string, unknown>);
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, unknown>);

  return sorted as T;
}

/**
 * Remove a field from an object without mutation
 */
export function removeField<T extends Record<string, unknown>>(obj: T, field: string): T {
  const { [field]: _, ...rest } = obj;
  return rest as T;
}

/**
 * Convert to canonical JSON string (sorted keys, no whitespace)
 */
export function canonicalJson<T extends Record<string, unknown>>(obj: T): string {
  return JSON.stringify(sortKeys(obj));
}

/**
 * Compute SHA-256 hash of a string
 */
export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Compute asset_id for an asset
 * asset_id = sha256(canonical_json(asset_without_asset_id))
 * 
 * @param asset - Asset object without asset_id
 * @returns asset_id (64 character hex string)
 */
export function computeAssetId<T extends Record<string, unknown>>(asset: T): string {
  const assetWithoutId = removeField(asset, 'asset_id');
  const canonical = canonicalJson(assetWithoutId);
  return sha256(canonical);
}

/**
 * Verify asset_id matches computed hash
 */
export function verifyAssetId(asset: Record<string, unknown>): boolean {
  if (!asset.asset_id) {
    return false;
  }
  const computed = computeAssetId(asset);
  return computed === asset.asset_id;
}

/**
 * Generate a random node ID
 */
export function generateNodeId(): string {
  const bytes = crypto.randomBytes(16);
  return `node_${bytes.toString('hex')}`;
}

/**
 * Generate a random bundle ID
 */
export function generateBundleId(): string {
  const bytes = crypto.randomBytes(16);
  return `bundle_${bytes.toString('hex')}`;
}

/**
 * Generate a random task ID
 */
export function generateTaskId(): string {
  const bytes = crypto.randomBytes(16);
  return `task_${bytes.toString('hex')}`;
}

/**
 * Generate a random session ID
 */
export function generateSessionId(): string {
  const bytes = crypto.randomBytes(16);
  return `session_${bytes.toString('hex')}`;
}

/**
 * Generate a random challenge ID
 */
export function generateChallengeId(): string {
  const bytes = crypto.randomBytes(8);
  return `challenge_${bytes.toString('hex')}`;
}

/**
 * Secure compare two strings (timing-safe)
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Hash a secret using SHA-256
 */
export function hashSecret(secret: string): string {
  return sha256(secret);
}
