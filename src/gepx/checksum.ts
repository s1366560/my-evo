import crypto from 'crypto';
import { GepxBundle, Manifest, ManifestVerifyResult } from './types';

/**
 * Calculate SHA-256 checksum of a GepxBundle.
 * Checksum is computed over the canonical JSON of the bundle's core fields,
 * excluding the checksum field itself.
 */
export function calculateChecksum(bundle: GepxBundle): string {
  const canonical = buildCanonicalBundle(bundle);
  return crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

/**
 * Verify that a GepxBundle's checksum matches its content.
 */
export function verifyChecksum(bundle: GepxBundle): boolean {
  if (!bundle.checksum) return false;
  const expected = calculateChecksum(bundle);
  if (bundle.checksum.length !== 64 || expected.length !== 64) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf-8'),
      Buffer.from(bundle.checksum, 'utf-8'),
    );
  } catch {
    return false;
  }
}

/**
 * Generate a manifest for a GepxBundle.
 * The manifest contains the checksum, algorithm, bundle_id, and metadata.
 */
export function generateManifest(bundle: GepxBundle): Manifest {
  const checksum = calculateChecksum(bundle);
  return {
    checksum,
    algorithm: 'sha256',
    generated_at: new Date().toISOString(),
    bundle_id: bundle.bundle_id,
    asset_count: bundle.asset_count,
    version: '1.0.0',
  };
}

/**
 * Verify a bundle against a manifest.
 * Checks bundle_id, asset_count, and checksum.
 */
export function verifyManifest(
  bundle: GepxBundle,
  manifest: Manifest,
): ManifestVerifyResult {
  const errors: string[] = [];

  if (manifest.bundle_id !== bundle.bundle_id) {
    errors.push(
      `bundle_id mismatch: manifest=${manifest.bundle_id}, bundle=${bundle.bundle_id}`,
    );
  }

  if (manifest.asset_count !== bundle.asset_count) {
    errors.push(
      `asset_count mismatch: manifest=${manifest.asset_count}, bundle=${bundle.asset_count}`,
    );
  }

  if (manifest.algorithm !== 'sha256') {
    errors.push(`Unsupported hash algorithm: ${manifest.algorithm}`);
  }

  const expectedChecksum = calculateChecksum(bundle);
  if (manifest.checksum !== expectedChecksum) {
    errors.push('checksum mismatch: manifest checksum does not match bundle');
  }

  return {
    valid: errors.length === 0,
    manifest: errors.length === 0 ? manifest : null,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build the canonical JSON string used for checksum computation. */
function buildCanonicalBundle(bundle: GepxBundle): string {
  const canonical = {
    bundle_id: bundle.bundle_id,
    bundle_type: bundle.bundle_type,
    name: bundle.name,
    description: bundle.description,
    tags: bundle.tags ?? [],
    exported_by: bundle.exported_by,
    asset_count: bundle.asset_count,
  };
  return JSON.stringify(canonical);
}
