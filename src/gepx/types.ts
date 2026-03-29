/**
 * GEPX Types — Portable Evolution Package Format
 * Chapter 31: Asset Bundle Export/Import
 *
 * Format:
 *   Bytes 0-3:   Magic "GEPX"
 *   Byte 4:      Version (1)
 *   Byte 5:      Flags (bit 0 = gzip compressed)
 *   Bytes 6-9:   Payload length (uint32 BE)
 *   Bytes 10+:    Payload (JSON, optionally gzip-compressed)
 *
 * Payload JSON shape:
 *   {
 *     "version": 1,
 *     "exported_at": "ISO8601",
 *     "bundle_type": "Gene" | "Capsule" | "EvolutionEvent" | "FullSnapshot",
 *     "metadata": { ... },
 *     "assets": [ ... ],
 *     "lineage": [ ... ],
 *     "memory_graph": { ... }
 *   }
 */

import type { Gene, Capsule, EvolutionEvent } from '../assets/types';
import type { AssetRecord } from '../assets/types';
export type { AssetRecord };

// ─── Archive Types ─────────────────────────────────────────────────────────────

export type GepxBundleType = 'Gene' | 'Capsule' | 'EvolutionEvent' | 'Mutation' | 'Recipe' | 'Organism' | 'FullSnapshot';

/** Top-level GEPX payload */
export interface GepxPayload {
  version: 1;
  exported_at: string;
  bundle_type: GepxBundleType;
  exporter_node_id?: string;
  metadata: GepxMetadata;
  assets: GepxAsset[];
  lineage?: GepxLineageRecord[];
  memory_graph?: GepxMemorySnapshot;
}

/** GEPX file metadata section */
export interface GepxMetadata {
  format_version: string;   // "1.0"
  hub_version?: string;     // EvoMap version
  bundle_name?: string;
  description?: string;
  tags?: string[];
  exported_by?: string;
  asset_count: number;
  checksum: string;        // SHA-256 of canonical JSON
}

/** Flattened asset inside a GEPX package */
export interface GepxAsset {
  asset_id: string;
  type: 'Gene' | 'Capsule' | 'EvolutionEvent' | 'Mutation' | 'Recipe' | 'Organism';
  owner_id: string;
  status: string;
  published_at: string;
  gdi?: { total: number; intrinsic: number; usage: number; social: number };
  fetch_count: number;
  report_count: number;
  gene?: Gene;
  capsule?: Capsule;
  evolution_event?: EvolutionEvent;
  mutation?: unknown;
  recipe?: unknown;
  organism?: unknown;
}

/** Minimal lineage edge for portability */
export interface GepxLineageRecord {
  parent_id: string;
  child_id: string;
  relation: 'evolved_from' | 'derived_from' | 'triggered';
  published_at: string;
}

/** Memory graph snapshot for FullSnapshot bundles */
export interface GepxMemorySnapshot {
  nodes: GepxMemoryNode[];
  edges: GepxMemoryEdge[];
}

export interface GepxMemoryNode {
  asset_id: string;
  type: 'Gene' | 'Capsule' | 'EvolutionEvent';
  signals: Record<string, number>;
  confidence: number;
  gdi?: number;
  metadata?: Record<string, unknown>;
}

export interface GepxMemoryEdge {
  source_id: string;
  target_id: string;
  relation: string;
  weight?: number;
}

// ─── Encoder/Decoder Result Types ──────────────────────────────────────────────

export interface GepxEncodeResult {
  data: Buffer;
  payload: GepxPayload;
  checksum: string;
}

export interface GepxDecodeResult {
  payload: GepxPayload;
  checksum: string;
  verified: boolean;
}

export interface GepxValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  payload?: GepxPayload;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const GEPX_MAGIC = Buffer.from('GEPX');
export const GEPX_VERSION = 1;
export const GEPX_COMPRESSED_FLAG = 0x01;
export const GEPX_FORMAT_VERSION = '1.0';
