/**
 * .gepx Binary Format Specification
 *
 * Header (10 bytes fixed):
 * - Offset 0x00: Magic Number "GEPX" (4 bytes ASCII)
 * - Offset 0x04: Version (1 byte, current 0x01)
 * - Offset 0x05: Flags (1 byte, bit0=gzip)
 * - Offset 0x06: Payload Length (4 bytes uint32 BE)
 *
 * Payload: JSON bytes (optionally gzip-compressed)
 */

export const MAGIC_BYTES = 'GEPX';
export const CURRENT_VERSION = 0x01;
export const SUPPORTED_VERSIONS = [0x01] as const;
export const FORMAT_VERSION = '1.0.0';
export const MAX_PAYLOAD_SIZE = 100 * 1024 * 1024; // 100MB

export type BundleType =
  | 'Gene'
  | 'Capsule'
  | 'EvolutionEvent'
  | 'Mutation'
  | 'Recipe'
  | 'Organism'
  | 'FullSnapshot';

export interface GepxMetadata {
  format_version: string;
  hub_version: string;
  bundle_name: string;
  description: string;
  tags: string[];
  exported_by: string;
  asset_count: number;
  checksum: string;
}

export interface LineageEntry {
  asset_id: string;
  parent_ids: string[];
  generation: number;
  created_at: string;
}

export interface MemoryGraphNode {
  id: string;
  type: string;
  label: string;
  properties: Record<string, unknown>;
  confidence: number;
}

export interface MemoryGraphEdge {
  source_id: string;
  target_id: string;
  relationship: string;
  weight: number;
}

export interface GepxPayload {
  version: string;
  exported_at: string;
  bundle_type: BundleType;
  metadata: GepxMetadata;
  assets: Asset[];
  lineage: LineageEntry[];
  memory_graph?: {
    nodes: MemoryGraphNode[];
    edges: MemoryGraphEdge[];
  };
}

export type AssetType = 'Gene' | 'Capsule' | 'EvolutionEvent' | 'Mutation' | 'Recipe' | 'Organism';

export interface Asset {
  asset_id: string;
  asset_type: AssetType;
  name: string;
  version: string;
  content: string;
  gdi_score?: {
    usefulness: number;
    novelty: number;
    rigor: number;
    reuse: number;
  };
  tags: string[];
  lineage?: LineageEntry[];
  metadata?: Record<string, unknown>;
}

export interface GepxBundle {
  bundle_id: string;
  bundle_type: BundleType;
  name: string;
  description: string;
  tags: string[];
  exported_by: string;
  asset_count: number;
  checksum: string;
  size_bytes: number;
  created_at: Date;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationErrorDetail[];
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

export interface CompatibilityResult {
  compatible: boolean;
  current_version: string;
  required_version: string;
  warnings: string[];
  errors: string[];
}

export interface Manifest {
  checksum: string;
  algorithm: 'sha256';
  generated_at: string;
  bundle_id: string;
  asset_count: number;
  version: string;
}

export interface EncodeOptions {
  compress?: boolean;
  hubVersion?: string;
}

export interface ManifestVerifyResult {
  valid: boolean;
  manifest: Manifest | null;
  errors: string[];
}
