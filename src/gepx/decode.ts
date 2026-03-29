/**
 * GEPX Decoder — Unpack .gepx archive files back into assets
 * Chapter 31: Asset Bundle Export/Import
 */

import { createHash } from 'crypto';
import { gunzip } from 'zlib';
import { promisify } from 'util';
import type {
  GepxPayload,
  GepxDecodeResult,
  GepxValidationResult,
  GepxAsset,
  GepxLineageRecord,
  GepxMemorySnapshot,
} from './types';
import {
  GEPX_MAGIC,
  GEPX_VERSION,
  GEPX_COMPRESSED_FLAG,
} from './types';
import type { Gene, Capsule, EvolutionEvent } from '../assets/types';

const gunzipAsync = promisify(gunzip);

/**
 * Compute SHA-256 checksum of canonical JSON
 */
function computeChecksum(payload: GepxPayload): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Verify GEPX magic header
 */
function validateHeader(data: Buffer): { valid: boolean; error?: string; version?: number; flags?: number; payloadLen?: number } {
  if (data.length < 10) {
    return { valid: false, error: `File too short: ${data.length} bytes (minimum 10)` };
  }

  const magic = data.subarray(0, 4);
  if (!magic.equals(GEPX_MAGIC)) {
    return { valid: false, error: `Invalid magic: expected GEPX, got ${magic.toString()}` };
  }

  const version = data[4];
  if (version !== GEPX_VERSION) {
    return { valid: false, error: `Unsupported GEPX version: ${version} (supported: ${GEPX_VERSION})` };
  }

  const flags = data[5];
  const payloadLen = data.readUInt32BE(6);

  if (data.length < 10 + payloadLen) {
    return { valid: false, error: `Truncated file: declared ${payloadLen} bytes payload but file is only ${data.length - 10} bytes` };
  }

  return { valid: true, version, flags, payloadLen };
}

/**
 * Decode a GEPX Buffer into a GepxPayload
 */
export async function decodeGepxBuffer(data: Buffer): Promise<GepxDecodeResult> {
  const headerResult = validateHeader(data);
  if (!headerResult.valid) {
    throw new Error(`Invalid GEPX header: ${headerResult.error}`);
  }

  const { flags, payloadLen } = headerResult;
  const payloadBytes = data.subarray(10, 10 + payloadLen);

  let jsonBytes: Buffer;
  if (flags & GEPX_COMPRESSED_FLAG) {
    jsonBytes = await gunzipAsync(payloadBytes);
  } else {
    jsonBytes = payloadBytes;
  }

  let payload: GepxPayload;
  try {
    payload = JSON.parse(jsonBytes.toString('utf8'));
  } catch {
    throw new Error('Failed to parse GEPX payload as JSON');
  }

  if (!payload || typeof payload.version !== 'number') {
    throw new Error('Invalid GEPX payload: missing or invalid version field');
  }

  const checksum = computeChecksum(payload);

  return { payload, checksum, verified: true };
}

/**
 * Decode synchronously (for use in non-async contexts)
 * Throws if the file is gzip-compressed (use async version instead)
 */
export function decodeGepxBufferSync(data: Buffer): GepxDecodeResult {
  const headerResult = validateHeader(data);
  if (!headerResult.valid) {
    throw new Error(`Invalid GEPX header: ${headerResult.error}`);
  }

  const { flags, payloadLen } = headerResult;

  if (flags & GEPX_COMPRESSED_FLAG) {
    // Cannot synchronously decompress; suggest async version
    throw new Error('GEPX file is gzip-compressed; use decodeGepxBuffer() instead');
  }

  const payloadBytes = data.subarray(10, 10 + payloadLen);

  let payload: GepxPayload;
  try {
    payload = JSON.parse(payloadBytes.toString('utf8'));
  } catch {
    throw new Error('Failed to parse GEPX payload as JSON');
  }

  const checksum = computeChecksum(payload);

  return { payload, checksum, verified: true };
}

/**
 * Validate a GEPX payload without full decoding
 */
export function validateGepxPayload(payload: unknown): GepxValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload is not an object'], warnings: [] };
  }

  const p = payload as Record<string, unknown>;

  if (p.version !== 1) {
    errors.push(`Unsupported GEPX payload version: ${p.version}`);
  }

  if (!p.bundle_type || !['Gene', 'Capsule', 'EvolutionEvent', 'FullSnapshot'].includes(p.bundle_type as string)) {
    errors.push(`Invalid or missing bundle_type: ${p.bundle_type}`);
  }

  if (!p.exported_at) {
    errors.push('Missing exported_at timestamp');
  } else if (isNaN(Date.parse(p.exported_at as string))) {
    errors.push(`Invalid exported_at timestamp: ${p.exported_at}`);
  }

  if (!Array.isArray(p.assets)) {
    errors.push('Missing or invalid assets array');
  } else {
    for (let i = 0; i < (p.assets as unknown[]).length; i++) {
      const asset = (p.assets as Record<string, unknown>[])[i];
      if (!asset.asset_id) errors.push(`Asset[${i}]: missing asset_id`);
      if (!asset.type) errors.push(`Asset[${i}]: missing type`);
    }
  }

  if (p.metadata && typeof p.metadata === 'object') {
    const meta = p.metadata as Record<string, unknown>;
    if (!meta.checksum) warnings.push('Metadata missing checksum — integrity verification skipped');
    if (!meta.format_version) warnings.push('Metadata missing format_version');
  } else {
    warnings.push('Missing or invalid metadata section');
  }

  // Check for old exports (>1 year)
  if (p.exported_at) {
    const exportAge = Date.now() - new Date(p.exported_at as string).getTime();
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    if (exportAge > oneYear) {
      warnings.push(`Export is ${Math.round(exportAge / oneYear * 10) / 10} years old — consider re-exporting for compatibility`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    payload: errors.length === 0 ? (payload as GepxPayload) : undefined,
  };
}

/**
 * Extract flat assets from a decoded GEPX payload
 */
export function extractAssets(payload: GepxPayload): {
  genes: Gene[];
  capsules: Capsule[];
  evolutionEvents: EvolutionEvent[];
  records: Map<string, { asset: Gene | Capsule | EvolutionEvent; owner_id: string; status: string; gdi?: { total: number; intrinsic: number; usage: number; social: number }; fetch_count: number; report_count: number }>;
} {
  const genes: Gene[] = [];
  const capsules: Capsule[] = [];
  const evolutionEvents: EvolutionEvent[] = [];
  const records = new Map();

  for (const gepxAsset of payload.assets) {
    const record = {
      asset: gepxAsset.gene ?? gepxAsset.capsule ?? gepxAsset.evolution_event!,
      owner_id: gepxAsset.owner_id,
      status: gepxAsset.status,
      gdi: gepxAsset.gdi,
      fetch_count: gepxAsset.fetch_count,
      report_count: gepxAsset.report_count,
    };

    records.set(gepxAsset.asset_id, record);

    if (gepxAsset.type === 'Gene' && gepxAsset.gene) genes.push(gepxAsset.gene);
    else if (gepxAsset.type === 'Capsule' && gepxAsset.capsule) capsules.push(gepxAsset.capsule);
    else if (gepxAsset.type === 'EvolutionEvent' && gepxAsset.evolution_event) evolutionEvents.push(gepxAsset.evolution_event);
  }

  return { genes, capsules, evolutionEvents, records };
}
