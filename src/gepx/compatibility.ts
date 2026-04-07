import { GepxBundle, CompatibilityResult, BundleType } from './types';

/** Minimum hub version required to parse this library. */
export const MIN_HUB_VERSION = '1.0.0';

/**
 * Current gpx format version used by this library.
 * Follows semver. Increment on any breaking format change.
 */
export const CURRENT_GEPX_FORMAT_VERSION = '1.0.0';

/**
 * Version requirements per asset/bundle type.
 * Maps bundle_type -> minimum format version required.
 */
const VERSION_REQUIREMENTS: Record<string, string> = {
  Gene: '1.0.0',
  Capsule: '1.0.0',
  EvolutionEvent: '1.0.0',
  Mutation: '1.0.0',
  Recipe: '1.0.0',
  Organism: '1.0.0',
  FullSnapshot: '1.0.0',
};

export interface VersionMap {
  current: string;
  minimum: string;
  supported: string[];
}

/**
 * Check whether a bundle's version is compatible with this library.
 * Returns a CompatibilityResult with warnings/errors for migration guidance.
 */
export function checkCompatibility(bundle: GepxBundle): CompatibilityResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const bundleVersion = bundle.bundle_type;
  const requiredVersion = getRequiredVersion(bundleVersion as BundleType);

  const current = CURRENT_GEPX_FORMAT_VERSION;
  const cmp = compareSemver(current, requiredVersion);

  if (cmp < 0) {
    errors.push(
      `Bundle type "${bundleVersion}" requires format version >= ${requiredVersion}, ` +
        `but this library only supports up to ${current}`,
    );
  }

  if (!isSupported(current)) {
    errors.push(`Current format version ${current} is not supported`);
  }

  // Warn on old format versions
  if (cmp > 0) {
    warnings.push(
      `Bundle type "${bundleVersion}" was written for format ${requiredVersion}. ` +
        `Consider migrating to ${current} for latest features.`,
    );
  }

  // Warn when bundle has no assets
  if (bundle.asset_count > 0 && !bundle.checksum) {
    warnings.push('Bundle has assets but no checksum — integrity cannot be verified');
  }

  return {
    compatible: errors.length === 0,
    current_version: current,
    required_version: requiredVersion,
    warnings,
    errors,
  };
}

/**
 * Return the minimum format version required to represent a given asset type.
 */
export function getRequiredVersion(assetType: BundleType): string {
  return VERSION_REQUIREMENTS[assetType] ?? CURRENT_GEPX_FORMAT_VERSION;
}

/**
 * Return whether a given format version string is supported by this library.
 */
export function isSupported(version: string): boolean {
  return compareSemver(version, MIN_HUB_VERSION) >= 0;
}

/**
 * Migrate a bundle to a target format version.
 * Currently this is a no-op pass-through since we only support 1.0.0.
 * Future migrations (e.g., 1.0.0 -> 1.1.0) would be implemented here.
 */
export function migrateToVersion(
  bundle: GepxBundle,
  targetVersion: string,
): GepxBundle {
  const current = CURRENT_GEPX_FORMAT_VERSION;

  if (!isSupported(targetVersion)) {
    throw new Error(`Target version ${targetVersion} is not supported`);
  }

  if (compareSemver(targetVersion, current) > 0) {
    throw new Error(
      `Migration to ${targetVersion} not yet supported: ` +
        `this library is at ${current}`,
    );
  }

  if (targetVersion === current) {
    return bundle; // No migration needed
  }

  // Migration logic for future versions would go here
  return bundle;
}

/**
 * Get the current version map for this module.
 */
export function getVersionMap(): VersionMap {
  return {
    current: CURRENT_GEPX_FORMAT_VERSION,
    minimum: MIN_HUB_VERSION,
    supported: [CURRENT_GEPX_FORMAT_VERSION],
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compare two semver strings.
 * Returns -1 if a < b, 0 if a == b, 1 if a > b.
 */
function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);

  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }

  return 0;
}
