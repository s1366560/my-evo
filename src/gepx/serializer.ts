import crypto from 'crypto';
import {
  Asset,
  GepxBundle,
  GepxMetadata,
  GepxPayload,
  LineageEntry,
  MemoryGraphEdge,
  MemoryGraphNode,
} from './types';
import { calculateChecksum } from './checksum';
import { FORMAT_VERSION } from './types';

const MAGIC = 'GEPX';
const VERSION_BYTE = 0x01;

export interface SerializeOptions {
  hubVersion?: string;
}

/**
 * Serialize a GepxBundle to a JSON string (without binary header).
 * Includes computed checksum in metadata.
 */
export function serialize(bundle: GepxBundle): string {
  const payload = buildPayload(bundle);
  return JSON.stringify(payload);
}

/**
 * Deserialize a JSON string back to a GepxBundle-like object.
 * Does not restore binary-specific fields (size_bytes, created_at Date).
 */
export function deserialize(json: string): GepxPayload {
  const parsed = JSON.parse(json) as GepxPayload;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid gepx payload: must be a JSON object');
  }
  return parsed;
}

/**
 * Convert a GepxBundle to a base64-encoded string (JSON, no binary header).
 */
export function toBase64(bundle: GepxBundle): string {
  const json = serialize(bundle);
  return Buffer.from(json, 'utf-8').toString('base64');
}

/**
 * Parse a base64-encoded gepx string back to a GepxPayload.
 */
export function fromBase64(base64: string): GepxPayload {
  const trimmed = base64.trim();
  let decoded: string;
  try {
    decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
  } catch {
    throw new Error('Invalid base64 input: failed to decode');
  }
  if (!decoded) {
    throw new Error('Invalid base64 input: decoded to empty string');
  }
  return deserialize(decoded);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build the GepxPayload structure from a GepxBundle. */
function buildPayload(bundle: GepxBundle): GepxPayload {
  const now = new Date();
  const exportedAt = bundle.created_at
    ? bundle.created_at.toISOString()
    : now.toISOString();

  const { checksum } = computeChecksumFields(bundle);

  const metadata: GepxMetadata = {
    format_version: FORMAT_VERSION,
    hub_version: '1.0.0',
    bundle_name: bundle.name,
    description: bundle.description,
    tags: bundle.tags ?? [],
    exported_by: bundle.exported_by,
    asset_count: bundle.asset_count,
    checksum,
  };

  return {
    version: FORMAT_VERSION,
    exported_at: exportedAt,
    bundle_type: bundle.bundle_type,
    metadata,
    assets: [],
    lineage: [],
  };
}

function computeChecksumFields(bundle: GepxBundle): { checksum: string } {
  const raw = {
    bundle_id: bundle.bundle_id,
    bundle_type: bundle.bundle_type,
    name: bundle.name,
    description: bundle.description,
    tags: bundle.tags ?? [],
    exported_by: bundle.exported_by,
    asset_count: bundle.asset_count,
  };
  const checksum = crypto
    .createHash('sha256')
    .update(JSON.stringify(raw), 'utf-8')
    .digest('hex');
  return { checksum };
}

/**
 * Build a GepxBundle from raw fields (useful for testing / factory use).
 */
export function buildBundle(params: {
  bundleId: string;
  bundleType: string;
  name: string;
  description: string;
  tags?: string[];
  exportedBy: string;
  assetCount: number;
  assets?: Asset[];
  lineage?: LineageEntry[];
  memoryGraphNodes?: MemoryGraphNode[];
  memoryGraphEdges?: MemoryGraphEdge[];
  createdAt?: Date;
}): GepxBundle {
  const createdAt = params.createdAt ?? new Date();
  const bundle: GepxBundle = {
    bundle_id: params.bundleId,
    bundle_type: params.bundleType as GepxBundle['bundle_type'],
    name: params.name,
    description: params.description,
    tags: params.tags ?? [],
    exported_by: params.exportedBy,
    asset_count: params.assetCount,
    checksum: '',
    size_bytes: 0,
    created_at: createdAt,
  };
  const { checksum } = computeChecksumFields(bundle);
  bundle.checksum = checksum;
  bundle.size_bytes = Buffer.byteLength(serialize(bundle), 'utf-8');
  return bundle;
}
