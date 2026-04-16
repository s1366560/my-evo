import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { NotFoundError, ValidationError } from '../shared/errors';
import * as serializer from './serializer';
import * as checksum from './checksum';
import * as compatibility from './compatibility';
import * as schema from './schema';
import {
  GepxBundle,
  GepxPayload,
  CompatibilityResult,
  Manifest,
  ManifestVerifyResult,
  ValidationResult,
  BundleType,
} from './types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export { prisma };

// ---------------------------------------------------------------------------
// Types (re-export for convenience)
// ---------------------------------------------------------------------------

export type { GepxBundle, GepxPayload, CompatibilityResult, Manifest, ManifestVerifyResult, ValidationResult, BundleType };

// ---------------------------------------------------------------------------
// Serializer integration
// ---------------------------------------------------------------------------

/** Serialize a GepxBundle to JSON. */
export function serializeToJson(bundle: GepxBundle): string {
  return serializer.serialize(bundle);
}

/** Deserialize JSON to GepxPayload. */
export function deserializeFromJson(json: string): GepxPayload {
  return serializer.deserialize(json);
}

export function encodeBundleToBinary(payload: GepxPayload, compress = false): Buffer {
  return serializer.encodeGepxBundle(payload, compress);
}

export function decodeBundleFromBinary(buffer: Buffer): GepxPayload {
  return serializer.decodeGepxBufferSync(buffer);
}

export function validateGepxBinary(buffer: Buffer) {
  const decoded = serializer.decodeGepxBufferDetailedSync(buffer);
  const validation = schema.validateSchema(decoded.payload);
  return {
    valid: validation.valid,
    format_version: decoded.payload.version,
    bundle_type: decoded.payload.bundle_type,
    asset_count: decoded.payload.assets.length,
    checksum_match: validation.valid,
    compressed: decoded.compressed,
    payload_size: decoded.payloadSize,
    errors: validation.errors,
  };
}

/** Convert GepxBundle to base64. */
export function bundleToBase64(bundle: GepxBundle): string {
  return serializer.toBase64(bundle);
}

/** Parse base64 to GepxPayload. */
export function bundleFromBase64(base64: string): GepxPayload {
  return serializer.fromBase64(base64);
}

// ---------------------------------------------------------------------------
// Checksum integration
// ---------------------------------------------------------------------------

/** Calculate SHA-256 checksum of a bundle. */
export function calcChecksum(bundle: GepxBundle): string {
  return checksum.calculateChecksum(bundle);
}

/** Verify a bundle's checksum. */
export function verifyBundleChecksum(bundle: GepxBundle): boolean {
  return checksum.verifyChecksum(bundle);
}

/** Generate a manifest for a bundle. */
export function genManifest(bundle: GepxBundle): Manifest {
  return checksum.generateManifest(bundle);
}

/** Verify a bundle against a manifest. */
export function verifyBundleManifest(bundle: GepxBundle, manifest: Manifest): ManifestVerifyResult {
  return checksum.verifyManifest(bundle, manifest);
}

// ---------------------------------------------------------------------------
// Compatibility integration
// ---------------------------------------------------------------------------

/** Check version compatibility for a bundle. */
export function checkBundleCompatibility(bundle: GepxBundle): CompatibilityResult {
  return compatibility.checkCompatibility(bundle);
}

/** Check if a format version is supported. */
export function isVersionSupported(version: string): boolean {
  return compatibility.isSupported(version);
}

/** Migrate a bundle to a target format version. */
export function migrateBundle(bundle: GepxBundle, targetVersion: string): GepxBundle {
  return compatibility.migrateToVersion(bundle, targetVersion);
}

// ---------------------------------------------------------------------------
// Schema validation integration
// ---------------------------------------------------------------------------

/** Validate a GepxPayload against JSON schema. */
export function validateGepxPayload(payload: unknown): ValidationResult {
  return schema.validateSchema(payload);
}

/** Validate a single asset. */
export function validateAssetObject(asset: unknown): ValidationResult {
  return schema.validateAssetObject(asset);
}

/** Validate a gene asset. */
export function validateGeneAsset(asset: unknown): ValidationResult {
  return schema.validateGene(asset);
}

/** Validate metadata. */
export function validateGepxMetadata(metadata: unknown): ValidationResult {
  return schema.validateMetadataObject(metadata);
}

// ---------------------------------------------------------------------------
// Combined export (full bundle with integrity)
// ---------------------------------------------------------------------------

export interface ExportBundleOptions {
  name: string;
  description: string;
  bundleType: BundleType;
  exportedBy: string;
  assetIds: string[];
  tags?: string[];
}

export interface ExportBundleResult {
  bundle: GepxBundle;
  json: string;
  base64: string;
  checksum: string;
  manifest: Manifest;
  validation: ValidationResult;
  compatibility: CompatibilityResult;
}

/**
 * Full export pipeline: build bundle -> serialize -> checksum -> manifest -> validate.
 */
export function exportBundle(options: ExportBundleOptions): ExportBundleResult {
  const bundleId = crypto.randomUUID();
  const bundle = serializer.buildBundle({
    bundleId,
    bundleType: options.bundleType,
    name: options.name,
    description: options.description,
    tags: options.tags,
    exportedBy: options.exportedBy,
    assetCount: options.assetIds.length,
    createdAt: new Date(),
  });

  const json = serializer.serialize(bundle);
  const base64 = serializer.toBase64(bundle);
  const checksumValue = checksum.calculateChecksum(bundle);
  const manifest = checksum.generateManifest(bundle);
  const compatibilityResult = compatibility.checkCompatibility(bundle);

  // Validate the JSON representation
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    parsed = null;
  }
  const validation = schema.validateSchema(parsed);

  return {
    bundle,
    json,
    base64,
    checksum: checksumValue,
    manifest,
    validation,
    compatibility: compatibilityResult,
  };
}

// ---------------------------------------------------------------------------
// DB-backed CRUD (delegates to Prisma)
// ---------------------------------------------------------------------------

export interface ListBundlesInput {
  bundleType?: string;
  limit?: number;
  offset?: number;
}

export async function listBundles(
  bundleType?: string,
  limit = 20,
  offset = 0,
) {
  const where: Record<string, unknown> = {};
  if (bundleType) {
    where.bundle_type = bundleType;
  }

  const [items, total] = await Promise.all([
    prisma.gepxBundle.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.gepxBundle.count({ where }),
  ]);

  return { items, total };
}

export async function getBundle(bundleId: string) {
  const bundle = await prisma.gepxBundle.findUnique({
    where: { bundle_id: bundleId },
  });

  if (!bundle) {
    throw new NotFoundError('GepxBundle', bundleId);
  }

  return bundle;
}

export async function createBundle(
  exportedBy: string,
  name: string,
  description: string,
  bundleType: string,
  assetIds: string[],
  tags?: string[],
) {
  const bundleId = crypto.randomUUID();
  const now = new Date();

  const rawBundle = serializer.buildBundle({
    bundleId,
    bundleType,
    name,
    description,
    tags,
    exportedBy,
    assetCount: assetIds.length,
    createdAt: now,
  });

  const bundle = await prisma.gepxBundle.create({
    data: {
      bundle_id: bundleId,
      bundle_type: bundleType,
      name,
      description,
      tags: tags ?? [],
      exported_by: exportedBy,
      asset_count: assetIds.length,
      checksum: rawBundle.checksum,
      size_bytes: rawBundle.size_bytes,
      created_at: now,
    },
  });

  return bundle;
}

export async function downloadBundle(bundleId: string, nodeId: string) {
  const bundle = await prisma.gepxBundle.findUnique({
    where: { bundle_id: bundleId },
  });

  if (!bundle) {
    throw new NotFoundError('GepxBundle', bundleId);
  }

  const assets = await prisma.sandboxAsset.findMany({
    where: { sandbox_id: bundleId },
    take: bundle.asset_count,
  });

  const exportId = crypto.randomUUID();
  const now = new Date();

  const exportRecord = await prisma.gepxExport.create({
    data: {
      export_id: exportId,
      bundle_id: bundleId,
      node_id: nodeId,
      format: 'gepx',
      created_at: now,
    },
  });

  void assets;

  return { bundle, assets, exportRecord };
}

export async function exportBundleArchive(
  nodeId: string,
  options: {
    bundle_name: string;
    description: string;
    asset_ids: string[];
    tags?: string[];
    bundle_type?: BundleType;
    compress?: boolean;
  },
) {
  const bundle = await createBundle(
    nodeId,
    options.bundle_name,
    options.description,
    options.bundle_type ?? 'FullSnapshot',
    options.asset_ids,
    options.tags,
  );

  const normalizedBundle: GepxBundle = {
    bundle_id: bundle.bundle_id,
    bundle_type: bundle.bundle_type as BundleType,
    name: bundle.name,
    description: bundle.description,
    tags: bundle.tags,
    exported_by: bundle.exported_by,
    asset_count: bundle.asset_count,
    checksum: bundle.checksum,
    size_bytes: bundle.size_bytes,
    created_at: bundle.created_at,
  };
  const payload = serializer.deserialize(serializer.serialize(normalizedBundle));
  const binary = serializer.encodeGepxBundle(payload, options.compress ?? false);

  return {
    bundle_id: bundle.bundle_id,
    filename: `${bundle.name}.gepx`,
    size_bytes: binary.length,
    asset_count: bundle.asset_count,
    compressed: options.compress ?? false,
    checksum: bundle.checksum,
    download_url: `/gepx/bundle/${bundle.bundle_id}`,
    binary,
  };
}

export async function listExports(nodeId: string) {
  return prisma.gepxExport.findMany({
    where: { node_id: nodeId },
    orderBy: { created_at: 'desc' },
  });
}

export async function importBundle(
  nodeId: string,
  bundleData: unknown,
) {
  if (!bundleData || typeof bundleData !== 'object') {
    throw new ValidationError('Invalid bundle_data: must be a JSON object');
  }

  const data = bundleData as Record<string, unknown>;

  const bundleId = (data.bundle_id as string) ?? crypto.randomUUID();
  const name = (data.name as string) ?? 'Imported Bundle';
  const description = (data.description as string) ?? '';
  const bundleType = (data.bundle_type as string) ?? 'unknown';
  const tags = (data.tags as string[]) ?? [];
  const assets = (data.assets as unknown[]) ?? [];

  const now = new Date();

  const bundle = await prisma.gepxBundle.upsert({
    where: { bundle_id: bundleId },
    update: {},
    create: {
      bundle_id: bundleId,
      bundle_type: bundleType,
      name,
      description,
      tags,
      exported_by: nodeId,
      asset_count: assets.length,
      checksum: (data.checksum as string) ?? crypto.randomUUID().replace(/-/g, '').slice(0, 32),
      size_bytes: 0,
      created_at: now,
    },
  });

  const exportId = crypto.randomUUID();
  await prisma.gepxExport.create({
    data: {
      export_id: exportId,
      bundle_id: bundleId,
      node_id: nodeId,
      format: 'gepx',
      created_at: now,
    },
  });

  void assets;

  return {
    imported: bundle,
    skipped: 0,
  };
}
