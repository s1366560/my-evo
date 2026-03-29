/**
 * GEPX Encoder — Pack assets into portable .gepx archive files
 * Chapter 31: Asset Bundle Export/Import
 */

import { createHash } from 'crypto';
import { gzip } from 'zlib';
import { promisify } from 'util';
import type {
  GepxPayload,
  GepxEncodeResult,
  GepxBundleType,
  GepxMetadata,
  GepxAsset,
  GepxLineageRecord,
  GepxMemorySnapshot,
  GepxMemoryNode,
  GepxMemoryEdge,
} from './types';
import {
  GEPX_MAGIC,
  GEPX_VERSION,
  GEPX_COMPRESSED_FLAG,
  GEPX_FORMAT_VERSION,
} from './types';
import type { AssetRecord } from '../assets/types';
import type { Gene, Capsule, EvolutionEvent } from '../assets/types';

const gzipAsync = promisify(gzip);

/**
 * Compute SHA-256 checksum of canonical JSON (sorted keys)
 */
function computeChecksum(payload: GepxPayload): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Build a GepxMetadata object
 */
function buildMetadata(
  bundleType: GepxBundleType,
  assetCount: number,
  checksum: string,
  extras?: { name?: string; description?: string; tags?: string[]; exporter?: string }
): GepxMetadata {
  return {
    format_version: GEPX_FORMAT_VERSION,
    bundle_name: extras?.name,
    description: extras?.description,
    tags: extras?.tags ?? [],
    exported_by: extras?.exporter,
    asset_count: assetCount,
    checksum,
  };
}

/**
 * Convert an AssetRecord + asset to GepxAsset
 */
function toGepxAsset(record: AssetRecord): GepxAsset {
  const { asset, ...rest } = record;
  const gepxAsset: GepxAsset = {
    asset_id: asset.asset_id,
    type: asset.type,
    owner_id: rest.owner_id,
    status: rest.status,
    published_at: rest.published_at,
    gdi: rest.gdi,
    fetch_count: rest.fetch_count,
    report_count: rest.report_count,
  };

  if (asset.type === 'Gene') {
    gepxAsset.gene = asset as unknown as Gene;
  } else if (asset.type === 'Capsule') {
    gepxAsset.capsule = asset as unknown as Capsule;
  } else if (asset.type === 'EvolutionEvent') {
    gepxAsset.evolution_event = asset as unknown as EvolutionEvent;
  }

  return gepxAsset;
}

/**
 * Encode a list of AssetRecords into a GEPX archive
 */
export function encodeGepxBundle(params: {
  records: AssetRecord[];
  bundleType?: GepxBundleType;
  bundleName?: string;
  description?: string;
  tags?: string[];
  exporterNodeId?: string;
  lineage?: GepxLineageRecord[];
  memorySnapshot?: GepxMemorySnapshot;
  compress?: boolean;
}): GepxEncodeResult {
  const { records, bundleType = 'FullSnapshot', bundleName, description, tags, exporterNodeId, lineage, memorySnapshot, compress = true } = params;

  const assets: GepxAsset[] = records.map(toGepxAsset);
  const bundleKind: GepxBundleType = records.length === 1 ? records[0].asset.type : bundleType;

  const payload: GepxPayload = {
    version: 1,
    exported_at: new Date().toISOString(),
    bundle_type: bundleKind,
    exporter_node_id: exporterNodeId,
    metadata: {} as GepxMetadata, // filled below after checksum
    assets,
    lineage,
    memory_graph: memorySnapshot,
  };

  const checksum = computeChecksum(payload);
  payload.metadata = buildMetadata(bundleKind, assets.length, checksum, { name: bundleName, description, tags, exporter: exporterNodeId });

  const jsonPayload = JSON.stringify(payload);
  const jsonBuffer = Buffer.from(jsonPayload, 'utf8');

  let payloadBuffer: Buffer = jsonBuffer;
  let flags = 0;

  if (compress) {
    payloadBuffer = gzipSync(jsonBuffer);
    flags |= GEPX_COMPRESSED_FLAG;
  }

  // Build header: MAGIC(4) + VERSION(1) + FLAGS(1) + PAYLOAD_LEN(4) = 10 bytes
  const header = Buffer.alloc(10);
  GEPX_MAGIC.copy(header, 0);                                    // bytes 0-3
  header[4] = GEPX_VERSION;                                        // byte 4
  header[5] = flags;                                              // byte 5
  header.writeUInt32BE(payloadBuffer.length, 6);                   // bytes 6-9

  const result = Buffer.concat([header, payloadBuffer]);

  return { data: result, payload, checksum };
}

/**
 * Synchronous gzip (since Node 11+)
 */
function gzipSync(data: Buffer): Buffer {
  // Use sync API via compression export
  const zlib = require('zlib');
  return zlib.gzipSync(data);
}

/**
 * Encode a single asset (Gene/Capsule/EvolutionEvent) into a GEPX buffer
 */
export function encodeSingleAsset(params: {
  assetId: string;
  asset: Gene | Capsule | EvolutionEvent;
  record: AssetRecord;
  exporterNodeId?: string;
  compress?: boolean;
}): GepxEncodeResult {
  return encodeGepxBundle({
    records: [params.record],
    bundleType: params.asset.type,
    bundleName: `${params.asset.type.toLowerCase()}-${params.assetId.slice(0, 8)}`,
    exporterNodeId: params.exporterNodeId,
    compress: params.compress ?? true,
  });
}

/**
 * Encode lineage records into a GEPX archive
 */
export function encodeLineageBundle(params: {
  records: AssetRecord[];
  lineage: GepxLineageRecord[];
  exporterNodeId?: string;
  compress?: boolean;
}): GepxEncodeResult {
  return encodeGepxBundle({
    records: params.records,
    bundleType: 'FullSnapshot',
    bundleName: 'lineage-bundle',
    exporterNodeId: params.exporterNodeId,
    lineage: params.lineage,
    compress: params.compress ?? true,
  });
}
